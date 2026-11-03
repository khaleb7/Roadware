import { getEncounter } from "../data";
import { grantXpToAll, livingCrew } from "../crew";
import type { SeededRng } from "../rng";
import { allocateId } from "../state";
import type { GameEvent, GameState } from "../types";
import { canAddVehicle } from "../vehicles";
import { tacticalBalance } from "./data";
import type { TacticalBattle } from "./types";

function ev(state: GameState, kind: string, message: string): GameEvent {
  return { turn: state.turn, kind, message };
}

/** Apply finished tactical battle onto strategic GameState. */
export function applyTacticalResult(
  state: GameState,
  battle: TacticalBattle,
  rng: SeededRng,
): GameEvent[] {
  if (!battle.result) {
    throw new Error("Battle has no result");
  }
  const events: GameEvent[] = [];
  const result = battle.result;

  state.resources.ammunition = battle.ammo;
  state.lastBattleReport = result.report;
  events.push(ev(state, "battle", result.report.summary));
  for (const line of result.report.lines.slice(-6)) {
    events.push(ev(state, "battle-detail", line));
  }

  // Sync / remove player vehicles from battle outcome
  const nextVehicles = [];
  for (const v of state.vehicles) {
    const unit = battle.units.find(
      (u) => u.side === "player" && u.sourceVehicleId === v.id,
    );
    if (!unit) {
      nextVehicles.push(v);
      continue;
    }
    if (unit.destroyed) {
      events.push(ev(state, "wreck", `${v.name} lost in the scrap.`));
      continue;
    }
    v.durability = Math.max(1, Math.min(v.maxDurability, unit.hull));
    nextVehicles.push(v);
  }
  state.vehicles = nextVehicles;

  // Crew deaths + wounds
  if (result.deadCrewIds.length > 0) {
    state.crew = state.crew.filter((c) => !result.deadCrewIds.includes(c.id));
    events.push(
      ev(
        state,
        "casualty",
        `${result.deadCrewIds.length} crew lost in tactical fight.`,
      ),
    );
  }
  for (const u of battle.units.filter((x) => x.side === "player")) {
    for (const slot of u.crew) {
      const c = state.crew.find((x) => x.id === slot.crewId);
      if (c && slot.alive) c.health = Math.min(c.health, slot.health);
    }
  }

  // Salvage enemy vehicles
  for (const offer of result.salvage) {
    if (!canAddVehicle(state)) {
      events.push(ev(state, "salvage", `Yard full — left ${offer.name}.`));
      break;
    }
    state.vehicles.push({
      id: allocateId(state, "veh"),
      classId: offer.classId,
      name: offer.name,
      durability: offer.durability,
      maxDurability: offer.maxDurability,
    });
    events.push(
      ev(
        state,
        "salvage",
        `${offer.name} (${offer.durability}/${offer.maxDurability}).`,
      ),
    );
  }

  if (result.winner === "player") {
    const arch = getEncounter(battle.encounterArchetypeId);
    const rolls = rng.int(
      tacticalBalance.salvage.lootRollsMin,
      tacticalBalance.salvage.lootRollsMax,
    );
    for (let i = 0; i < rolls; i += 1) {
      const entry = rng.pickWeighted(arch.lootTable);
      const amount = rng.int(entry.min, entry.max);
      if (amount > 0) {
        state.resources[entry.resource] += amount;
        events.push(ev(state, "loot", `Battlefield loot +${amount} ${entry.resource}`));
      }
    }
    grantXpToAll(livingCrew(state.crew), tacticalBalance.victoryXp, {
      combat: tacticalBalance.victoryXp,
    });
  } else {
    grantXpToAll(livingCrew(state.crew), tacticalBalance.defeatXp, {
      survival: tacticalBalance.defeatXp,
    });
  }

  if (state.crew.length === 0 || state.vehicles.length === 0) {
    state.phase = "lost";
    state.lossReason =
      state.crew.length === 0
        ? "All crew lost in tactical combat."
        : "All vehicles wrecked in tactical combat.";
    events.push(ev(state, "loss", state.lossReason));
  }

  state.tacticalBattle = null;
  state.pendingEncounter = null;
  return events;
}
