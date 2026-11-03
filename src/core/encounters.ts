import { balance, encounters, getEncounter, getVehicleClass } from "./data";
import { clampHealth, grantXpToAll, hasSpecialist, livingCrew } from "./crew";
import type {
  BattleReport,
  EncounterAction,
  EncounterArchetype,
  EncounterContext,
  PendingEncounter,
} from "./encounterTypes";
import type { SeededRng } from "./rng";
import { createTacticalBattle } from "./tactical/createBattle";
import type { GameEvent, GameState, TerrainId } from "./types";
import { RESOURCE_IDS } from "./types";

function ev(state: GameState, kind: string, message: string): GameEvent {
  return { turn: state.turn, kind, message };
}

export function rollEncounterChance(
  state: GameState,
  context: EncounterContext,
  danger: number,
): number {
  const cfg = balance.encounters;
  let chance = context === "road" ? cfg.roadBaseChance : cfg.cityAttackBaseChance;
  chance += danger * cfg.dangerChancePerPoint;
  if (hasSpecialist(state.crew, "scout")) {
    chance -= cfg.scoutAvoidBonus;
  }
  return Math.max(0, Math.min(cfg.maxChance, chance));
}

export function pickEncounterArchetype(
  rng: SeededRng,
  context: EncounterContext,
): EncounterArchetype {
  const pool = Object.values(encounters).filter((a) => a.contexts.includes(context));
  if (pool.length === 0) {
    throw new Error(`No encounters for context ${context}`);
  }
  const weighted = pool.map((a) => ({ item: a, weight: a.spawnWeight }));
  return rng.pickWeighted(weighted).item;
}

export function createPendingEncounter(
  rng: SeededRng,
  state: GameState,
  context: EncounterContext,
  terrainId: TerrainId,
  archetype?: EncounterArchetype,
): PendingEncounter {
  const arch = archetype ?? pickEncounterArchetype(rng, context);
  return {
    archetypeId: arch.id,
    kind: arch.kind,
    name: arch.name,
    description: arch.description,
    strength: rng.int(arch.strengthMin, arch.strengthMax),
    morale: rng.int(arch.moraleMin, arch.moraleMax),
    actions: [...arch.actions],
    terrainId,
    locationId: state.locationId,
    context,
  };
}

/** Maybe spawn a road encounter after a successful move. */
export function maybeSpawnRoadEncounter(
  state: GameState,
  rng: SeededRng,
  terrainId: TerrainId,
): GameEvent[] {
  if (state.pendingEncounter) return [];
  const city = state.cities[state.locationId];
  const danger = city?.danger ?? 5;
  const chance = rollEncounterChance(state, "road", danger);
  if (!rng.chance(chance)) {
    return [ev(state, "road", "Open road. No contact.")];
  }
  state.pendingEncounter = createPendingEncounter(rng, state, "road", terrainId);
  const p = state.pendingEncounter;
  return [
    ev(state, "encounter", `${p.name} — ${p.description} [${p.actions.join("/")}]`),
  ];
}

export function assertNoPending(state: GameState): void {
  if (state.tacticalBattle) {
    throw new Error("Finish tactical combat first");
  }
  if (state.pendingEncounter) {
    throw new Error(
      `Resolve encounter with ${state.pendingEncounter.name} first (${state.pendingEncounter.actions.join("/")})`,
    );
  }
}

function averageLeadership(state: GameState): number {
  const alive = livingCrew(state.crew);
  if (alive.length === 0) return 0;
  return alive.reduce((s, c) => s + c.leadership, 0) / alive.length;
}

function averageSurvival(state: GameState): number {
  const alive = livingCrew(state.crew);
  if (alive.length === 0) return 0;
  return alive.reduce((s, c) => s + c.survival, 0) / alive.length;
}

function playerCombatStrength(state: GameState): number {
  const qc = balance.quickCombat;
  const crewPower = livingCrew(state.crew).reduce((s, c) => s + c.combat, 0);
  const guns = state.resources.guns * qc.gunWeight;
  const armor = state.vehicles.reduce(
    (s, v) => s + getVehicleClass(v.classId).armor * qc.vehicleArmorWeight,
    0,
  );
  const gunner = hasSpecialist(state.crew, "gunner") ? qc.gunnerBonus : 0;
  return crewPower * qc.crewCombatWeight + guns + armor + gunner;
}

function playerMorale(state: GameState): number {
  const qc = balance.quickCombat;
  let m = averageLeadership(state) * qc.leadershipMoraleWeight;
  if (hasSpecialist(state.crew, "leader")) m += qc.leaderSpecialistBonus;
  return m;
}

function applyDistributedDamage(
  state: GameState,
  rng: SeededRng,
  total: number,
): string[] {
  const notes: string[] = [];
  const alive = livingCrew(state.crew);
  if (alive.length === 0 || total <= 0) return notes;
  let remaining = total;
  while (remaining > 0 && livingCrew(state.crew).length > 0) {
    const pool = livingCrew(state.crew);
    const victim = pool[rng.int(0, pool.length - 1)]!;
    const hit = Math.min(remaining, rng.int(1, Math.max(1, Math.ceil(total / 3))));
    victim.health -= hit;
    clampHealth(victim);
    remaining -= hit;
    notes.push(`${victim.name} -${hit} hp`);
  }
  state.crew = state.crew.filter((c) => c.health > 0);
  return notes;
}

function spendFightAmmo(state: GameState): number {
  const cfg = balance.encounters;
  let cost = cfg.fightAmmoBase;
  if (hasSpecialist(state.crew, "gunner")) cost += cfg.fightAmmoPerGunner;
  const spent = Math.min(state.resources.ammunition, cost);
  state.resources.ammunition -= spent;
  return spent;
}

function grantFightLoot(
  state: GameState,
  rng: SeededRng,
  arch: EncounterArchetype,
): string[] {
  const notes: string[] = [];
  const rolls = rng.int(
    balance.encounters.lootRollsOnWinMin,
    balance.encounters.lootRollsOnWinMax,
  );
  for (let i = 0; i < rolls; i += 1) {
    const entry = rng.pickWeighted(arch.lootTable);
    const amount = rng.int(entry.min, entry.max);
    if (amount <= 0) continue;
    state.resources[entry.resource] += amount;
    notes.push(`+${amount} ${entry.resource}`);
  }
  return notes;
}

function applyDefeatLosses(state: GameState, rng: SeededRng): string[] {
  const notes: string[] = [];
  const table = balance.quickCombat.resourceLossOnDefeat;
  for (const id of RESOURCE_IDS) {
    const row = table[id];
    if (!row) continue;
    const loss = Math.min(state.resources[id], rng.int(row.min, row.max));
    if (loss > 0) {
      state.resources[id] -= loss;
      notes.push(`lost ${loss} ${id}`);
    }
  }
  return notes;
}

export function quickResolveFight(
  state: GameState,
  rng: SeededRng,
  pending: PendingEncounter,
): { report: BattleReport; events: GameEvent[] } {
  const arch = getEncounter(pending.archetypeId);
  const qc = balance.quickCombat;
  const events: GameEvent[] = [];

  if (balance.quickCombat.ammoSpendOnFight) {
    const spent = spendFightAmmo(state);
    events.push(ev(state, "combat", `Expended ${spent} ammunition.`));
  }

  const pStr = playerCombatStrength(state);
  const pMor = playerMorale(state);
  const eStr = pending.strength * qc.enemyStrengthWeight;
  const eMor = pending.morale * qc.enemyMoraleWeight;
  const tPlayer = qc.terrainPlayerBonus[pending.terrainId] ?? 0;
  const tEnemy = qc.terrainEnemyBonus[pending.terrainId] ?? 0;
  const jitterP = rng.int(-qc.rngJitter, qc.rngJitter);
  const jitterE = rng.int(-qc.rngJitter, qc.rngJitter);

  const playerScore = Math.max(1, pStr + pMor + tPlayer + jitterP);
  const enemyScore = Math.max(1, eStr + eMor + tEnemy + jitterE);
  const ratio = playerScore / (playerScore + enemyScore);

  const ordered = [...qc.outcomes].sort((a, b) => b.minRatio - a.minRatio);
  const outcome =
    ordered.find((o) => ratio >= o.minRatio) ?? ordered[ordered.length - 1]!;

  const damage = rng.int(outcome.damageMin, outcome.damageMax);
  const dmgNotes = applyDistributedDamage(state, rng, damage);
  const lines: string[] = [
    `Scores ${Math.round(playerScore)} vs ${Math.round(enemyScore)} (ratio ${ratio.toFixed(2)}).`,
    ...dmgNotes.map((n) => `Casualty: ${n}`),
  ];

  if (rng.chance(outcome.vehicleDamageChance) && state.vehicles.length > 0) {
    const v = state.vehicles[rng.int(0, state.vehicles.length - 1)]!;
    v.durability = Math.max(1, v.durability - qc.vehicleDamageAmount);
    lines.push(
      `${v.name} battered (−${qc.vehicleDamageAmount} durability → ${v.durability}).`,
    );
  }

  const wonLoot = (qc.winLootOn as string[]).includes(outcome.id);
  if (wonLoot) {
    lines.push(...grantFightLoot(state, rng, arch).map((n) => `Loot ${n}`));
  } else {
    lines.push(...applyDefeatLosses(state, rng).map((n) => `Spoils taken: ${n}`));
  }

  // Plague exposure even on fight in yellow mile
  if (arch.plague && rng.chance(arch.plague.exposureChance)) {
    const plagueNotes = applyDistributedDamage(state, rng, arch.plague.healthDamage);
    lines.push(...plagueNotes.map((n) => `Plague: ${n}`));
  }

  grantXpToAll(state.crew, outcome.xp, { combat: outcome.xp });

  if (state.crew.length === 0) {
    state.phase = "lost";
    state.lossReason = `Wiped out fighting ${pending.name}.`;
    lines.push(state.lossReason);
  }

  const titles: Record<string, string> = {
    decisive: "Decisive victory",
    win: "Hard-fought win",
    pyrrhic: "Pyrrhic scrap",
    loss: "Beaten back",
    rout: "Routed",
  };

  const report: BattleReport = {
    outcomeId: outcome.id,
    title: titles[outcome.id] ?? outcome.id,
    summary: `${reportTitle(pending)} — ${titles[outcome.id] ?? outcome.id}.`,
    playerScore,
    enemyScore,
    ratio,
    lines,
  };

  events.push(ev(state, "battle", report.summary));
  for (const line of report.lines) {
    events.push(ev(state, "battle-detail", line));
  }
  return { report, events };
}

function reportTitle(pending: PendingEncounter): string {
  return `${pending.name} (${pending.kind.replace(/_/g, " ")})`;
}

export function resolveEncounterAction(
  state: GameState,
  rng: SeededRng,
  action: EncounterAction,
  mode: "quick" | "tactical" = "quick",
): { events: GameEvent[]; report: BattleReport | null; startedTactical: boolean } {
  const pending = state.pendingEncounter;
  if (!pending) throw new Error("No pending encounter");
  if (!pending.actions.includes(action)) {
    throw new Error(`${pending.name} will not accept action: ${action}`);
  }

  const arch = getEncounter(pending.archetypeId);
  const events: GameEvent[] = [];
  let report: BattleReport | null = null;
  let startedTactical = false;

  switch (action) {
    case "fight": {
      if (mode === "tactical") {
        state.tacticalBattle = createTacticalBattle(state, pending, rng);
        state.pendingEncounter = null;
        startedTactical = true;
        events.push(
          ev(
            state,
            "tactical",
            `Entering tactical road fight vs ${pending.name}. Deploy, then beginCombat.`,
          ),
        );
        break;
      }
      const result = quickResolveFight(state, rng, pending);
      events.push(...result.events);
      report = result.report;
      break;
    }
    case "evade": {
      events.push(...resolveEvade(state, rng, pending, arch));
      break;
    }
    case "negotiate": {
      const result = resolveNegotiate(state, rng, pending, arch);
      events.push(...result.events);
      report = result.report;
      break;
    }
    case "trade": {
      events.push(...resolveTrade(state, pending, arch));
      break;
    }
    default: {
      const _x: never = action;
      throw new Error(`Unknown action ${_x}`);
    }
  }

  if (!startedTactical) {
    state.pendingEncounter = null;
    state.lastBattleReport = report;
  }
  return { events, report, startedTactical };
}

function resolveEvade(
  state: GameState,
  rng: SeededRng,
  pending: PendingEncounter,
  arch: EncounterArchetype,
): GameEvent[] {
  const cfg = balance.encounterActions;
  let chance = cfg.evadeBaseChance;
  if (hasSpecialist(state.crew, "scout")) chance += cfg.scoutEvadeBonus;
  if (hasSpecialist(state.crew, "driver")) chance += cfg.driverEvadeBonus;
  chance += averageSurvival(state) * cfg.survivalEvadeScale;
  chance -= pending.morale * cfg.enemyMoraleEvadePenaltyScale;

  grantXpToAll(state.crew, balance.experience.evadeXp, {
    survival: balance.experience.evadeXp,
  });

  const events: GameEvent[] = [];
  if (rng.chance(Math.min(0.95, Math.max(0.05, chance)))) {
    events.push(ev(state, "evade", `Slipped past ${pending.name}.`));
    return events;
  }

  const dmg = rng.int(cfg.evadeFailDamageMin, cfg.evadeFailDamageMax);
  const notes = applyDistributedDamage(state, rng, dmg);
  events.push(ev(state, "evade", `Failed to evade ${pending.name}. Caught a volley.`));
  for (const n of notes) events.push(ev(state, "casualty", n));

  if (arch.plague && rng.chance(arch.plague.exposureChance)) {
    const pnotes = applyDistributedDamage(state, rng, arch.plague.healthDamage);
    for (const n of pnotes) events.push(ev(state, "plague", n));
  }

  if (state.crew.length === 0) {
    state.phase = "lost";
    state.lossReason = `Destroyed while fleeing ${pending.name}.`;
    events.push(ev(state, "loss", state.lossReason));
  }
  return events;
}

function resolveNegotiate(
  state: GameState,
  rng: SeededRng,
  pending: PendingEncounter,
  arch: EncounterArchetype,
): { events: GameEvent[]; report: BattleReport | null } {
  const cfg = balance.encounterActions;
  let chance = cfg.negotiateBaseChance;
  if (hasSpecialist(state.crew, "negotiator")) chance += cfg.negotiatorBonus;
  chance += averageLeadership(state) * cfg.leadershipNegotiateScale;
  chance -= pending.morale * cfg.enemyMoraleNegotiatePenaltyScale;

  grantXpToAll(state.crew, balance.experience.negotiateXp, {
    leadership: balance.experience.negotiateXp,
  });

  const events: GameEvent[] = [];
  if (rng.chance(Math.min(0.95, Math.max(0.05, chance)))) {
    const tribute = Math.min(state.resources.food, cfg.negotiateTributeFood);
    state.resources.food -= tribute;
    events.push(
      ev(
        state,
        "negotiate",
        `Talked down ${pending.name}${tribute > 0 ? ` (tribute ${tribute} food)` : ""}.`,
      ),
    );
    if (arch.giftOnNegotiate) {
      state.resources[arch.giftOnNegotiate.resource] += arch.giftOnNegotiate.amount;
      events.push(
        ev(
          state,
          "gift",
          `Received ${arch.giftOnNegotiate.amount} ${arch.giftOnNegotiate.resource}.`,
        ),
      );
    }
    return { events, report: null };
  }

  events.push(ev(state, "negotiate", `Talk failed with ${pending.name}.`));
  if (cfg.negotiateFailForceFight && pending.actions.includes("fight")) {
    const result = quickResolveFight(state, rng, pending);
    events.push(...result.events);
    return { events, report: result.report };
  }
  return { events, report: null };
}

function resolveTrade(
  state: GameState,
  pending: PendingEncounter,
  arch: EncounterArchetype,
): GameEvent[] {
  if (!arch.trade) {
    throw new Error(`${pending.name} has nothing to trade`);
  }
  const { give, receive } = arch.trade;
  if (state.resources[give.resource] < give.amount) {
    throw new Error(
      `Need ${give.amount} ${give.resource} to trade (have ${state.resources[give.resource]})`,
    );
  }
  state.resources[give.resource] -= give.amount;
  state.resources[receive.resource] += receive.amount;

  grantXpToAll(state.crew, balance.experience.tradeXp, {
    leadership: balance.experience.tradeXp,
  });

  const events: GameEvent[] = [
    ev(
      state,
      "trade",
      `Traded ${give.amount} ${give.resource} for ${receive.amount} ${receive.resource} with ${pending.name}.`,
    ),
  ];

  if (arch.healOnTrade) {
    for (const c of livingCrew(state.crew)) {
      c.health += arch.healOnTrade.healthRestored;
      clampHealth(c);
    }
    events.push(
      ev(
        state,
        "heal",
        `Clinic care restored ${arch.healOnTrade.healthRestored} health convoy-wide.`,
      ),
    );
  }
  return events;
}
