import {
  balance,
  emptyResources,
  getCityDef,
  getFaction,
  getTerrain,
  getVehicleClass,
  vehicleClasses,
} from "./data";
import {
  clampHealth,
  findCrew,
  grantXp,
  grantXpToAll,
  hasSpecialist,
  livingCrew,
} from "./crew";
import { applyEndOfTurn } from "./endTurn";
import {
  campaignStatusView,
  deliverScientists,
  extractScientist,
  tryDiscoverScientists,
} from "./campaign";
import {
  assertNoPending,
  createPendingEncounter,
  maybeSpawnRoadEncounter,
  resolveEncounterAction,
} from "./encounters";
import {
  cityStatusView,
  computeTravelCost,
  findRoad,
  markCitySearched,
  markCityVisited,
  neighborStatus,
  sumLoot,
} from "./map";
import type { SeededRng } from "./rng";
import {
  allocateId,
  appendLog,
  cloneState,
  rngFromState,
  sumResources,
  syncRng,
} from "./state";
import { applyTacticalAction } from "./tactical/actions";
import { applyTacticalResult } from "./tactical/applyResult";
import type {
  CommandResult,
  FightMode,
  GameCommand,
  GameEvent,
  GameState,
  Resources,
  StatusSnapshot,
  TacticalAction,
  VehicleClassId,
} from "./types";
import { RESOURCE_IDS } from "./types";
import { addVehicle, canAddVehicle, findVehicle } from "./vehicles";

const ALLOWED_WHILE_PENDING = new Set<GameCommand["type"]>([
  "status",
  "resolveEncounter",
]);

const ALLOWED_WHILE_TACTICAL = new Set<GameCommand["type"]>(["status", "tactical"]);

export function applyCommand(state: GameState, command: GameCommand): CommandResult {
  if (command.type === "status") {
    return {
      ok: true,
      state,
      events: [],
      turnAdvanced: false,
      status: buildStatus(state),
    };
  }

  if (state.phase !== "playing") {
    return fail(state, `Game over: ${state.lossReason ?? state.phase}`);
  }

  if (state.tacticalBattle && !ALLOWED_WHILE_TACTICAL.has(command.type)) {
    return fail(state, "Finish tactical combat first (tactical commands only)");
  }

  if (state.pendingEncounter && !ALLOWED_WHILE_PENDING.has(command.type)) {
    return fail(
      state,
      `Resolve encounter with ${state.pendingEncounter.name} first (${state.pendingEncounter.actions.join("/")})`,
    );
  }

  const next = cloneState(state);
  const rng = rngFromState(next);
  const events: GameEvent[] = [];
  let skipStrategicUpkeep = false;

  try {
    switch (command.type) {
      case "move":
        assertNoPending(next);
        events.push(...cmdMove(next, rng, command.destinationId));
        break;
      case "search":
        assertNoPending(next);
        events.push(...cmdSearch(next, rng));
        break;
      case "loot":
        assertNoPending(next);
        events.push(...cmdLoot(next, rng, command.cacheId));
        break;
      case "retrieve":
        assertNoPending(next);
        events.push(...cmdLoot(next, rng, command.cacheId));
        break;
      case "repair":
        assertNoPending(next);
        events.push(...cmdRepair(next, command.vehicleId));
        break;
      case "heal":
        assertNoPending(next);
        events.push(...cmdHeal(next, command.crewId));
        break;
      case "cache":
        assertNoPending(next);
        events.push(...cmdCache(next, command.deposit));
        break;
      case "rest":
        assertNoPending(next);
        events.push(...cmdRest(next));
        break;
      case "attack":
        assertNoPending(next);
        events.push(...cmdAttack(next, rng));
        break;
      case "resolveEncounter": {
        const mode: FightMode = command.mode ?? "quick";
        const resolved = resolveEncounterAction(next, rng, command.action, mode);
        events.push(...resolved.events);
        if (resolved.startedTactical) {
          skipStrategicUpkeep = true;
        }
        break;
      }
      case "tactical": {
        const tac = cmdTactical(next, rng, command.action);
        events.push(...tac.events);
        skipStrategicUpkeep = !tac.finished;
        break;
      }
      case "extractScientist":
        assertNoPending(next);
        events.push(...extractScientist(next, rng, command.scientistId));
        break;
      case "deliverScientists":
        assertNoPending(next);
        events.push(...deliverScientists(next));
        break;
      case "scavengeVehicle":
        assertNoPending(next);
        events.push(...cmdScavengeVehicle(next, rng, command.classId));
        break;
      case "captureVehicle":
        assertNoPending(next);
        events.push(...cmdCaptureVehicle(next, rng, command.classId));
        break;
      default: {
        const _exhaustive: never = command;
        return fail(state, `Unknown command: ${JSON.stringify(_exhaustive)}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(state, message);
  }

  syncRng(next, rng);

  let turnAdvanced = false;
  if (!skipStrategicUpkeep) {
    events.push(...applyEndOfTurn(next, rng));
    syncRng(next, rng);
    if (next.phase === "playing") {
      next.turn += 1;
    }
    turnAdvanced = true;
  }

  for (const e of events) {
    appendLog(next, e);
  }

  return { ok: true, state: next, events, turnAdvanced };
}

function fail(state: GameState, error: string): CommandResult {
  return { ok: false, state, events: [], turnAdvanced: false, error };
}

function buildStatus(state: GameState): StatusSnapshot {
  const city = state.cities[state.locationId];
  if (!city) {
    throw new Error(`Missing city runtime: ${state.locationId}`);
  }
  const def = getCityDef(state.locationId);
  const driver = hasSpecialist(state.crew, "driver");
  return {
    turn: state.turn,
    phase: state.phase,
    locationId: state.locationId,
    locationName: `${def.name}, ${def.state}`,
    resources: { ...state.resources },
    crewCount: state.crew.length,
    vehicleCount: state.vehicles.length,
    hungerStreak: state.hungerStreak,
    stranded: state.stranded,
    lossReason: state.lossReason,
    neighbors: neighborStatus(state, driver),
    city: cityStatusView(city),
    cachesHere: state.caches
      .filter((c) => c.locationId === state.locationId)
      .map((c) => ({ id: c.id, resources: { ...c.resources } })),
    pendingEncounter: state.pendingEncounter
      ? structuredClone(state.pendingEncounter)
      : null,
    tacticalBattle: state.tacticalBattle ? structuredClone(state.tacticalBattle) : null,
    lastBattleReport: state.lastBattleReport
      ? structuredClone(state.lastBattleReport)
      : null,
    campaign: campaignStatusView(state),
    recentLog: state.log.slice(-8),
  };
}

function ev(state: GameState, kind: string, message: string): GameEvent {
  return { turn: state.turn, kind, message };
}

function currentCity(state: GameState) {
  const city = state.cities[state.locationId];
  if (!city) throw new Error(`Unknown city runtime: ${state.locationId}`);
  return city;
}

function cmdMove(state: GameState, rng: SeededRng, destinationId: string): GameEvent[] {
  const road = findRoad(state.locationId, destinationId);
  if (!road) {
    throw new Error(`No highway from ${state.locationId} to ${destinationId}`);
  }
  const dest = state.cities[destinationId];
  if (!dest) throw new Error(`Unknown destination: ${destinationId}`);

  const driver = hasSpecialist(state.crew, "driver");
  const { fuelCost, tireWearChance } = computeTravelCost(
    state,
    road.miles,
    road.terrain,
    driver,
  );
  const terrainLabel = getTerrain(road.terrain).label;
  const needFuel = balance.stranded.blockMoveWithoutFuel;
  const needTires = balance.stranded.blockMoveWithoutTires;

  if (needFuel && state.resources.fuel < fuelCost) {
    state.stranded = true;
    throw new Error(
      `Stranded: need ${fuelCost} fuel for ${road.miles} mi ${terrainLabel}, have ${state.resources.fuel}`,
    );
  }
  if (needTires && state.resources.tires <= 0) {
    state.stranded = true;
    throw new Error("Stranded: no tires left for the road");
  }

  state.resources.fuel -= fuelCost;
  const destDef = getCityDef(destinationId);
  const events: GameEvent[] = [
    ev(
      state,
      "move",
      `Rolled ${road.miles} mi via ${terrainLabel} to ${destDef.name} (burned ${fuelCost} fuel).`,
    ),
  ];

  if (rng.chance(tireWearChance)) {
    const used = Math.min(
      balance.consumption.tiresConsumedOnWear,
      state.resources.tires,
    );
    state.resources.tires -= used;
    events.push(ev(state, "wear", `Tire blowout — lost ${used} tire(s).`));
    if (state.resources.tires <= 0 && needTires) {
      state.stranded = true;
      events.push(ev(state, "stranded", "Convoy is stranded without tires."));
    }
  }

  state.locationId = destinationId;
  state.lastTravelTerrainId = road.terrain;
  markCityVisited(dest);
  if (state.resources.fuel > 0 && state.resources.tires > 0) {
    state.stranded = false;
  }

  grantXpToAll(state.crew, balance.experience.moveXp, {
    survival: balance.experience.moveXp,
  });

  events.push(...maybeSpawnRoadEncounter(state, rng, road.terrain));
  return events;
}

function cmdSearch(state: GameState, rng: SeededRng): GameEvent[] {
  const city = currentCity(state);
  markCitySearched(city);

  let chance = balance.search.baseFindChance;
  if (hasSpecialist(state.crew, "scout")) {
    chance += balance.search.scoutBonusFindChance;
  }
  grantXpToAll(state.crew, balance.experience.searchXp, {
    survival: balance.experience.searchXp,
  });

  const events: GameEvent[] = [
    ev(
      state,
      "search",
      `Swept ${getCityDef(city.id).name}. Faction: ${getFaction(city.factionId).label}.`,
    ),
  ];

  if (city.specialLocations.length > 0) {
    events.push(
      ev(state, "specials", `Noted sites: ${city.specialLocations.join(", ")}.`),
    );
  }

  events.push(...tryDiscoverScientists(state, rng));

  // Recruit attempt
  let hireChance = balance.recruit.searchHireChance;
  if (hasSpecialist(state.crew, "negotiator")) {
    hireChance += balance.recruit.negotiatorHireBonus;
  }
  if (
    city.recruits.length > 0 &&
    state.crew.length < balance.recruit.maxCrewSoftCap &&
    rng.chance(hireChance)
  ) {
    const recruit = city.recruits.shift()!;
    state.crew.push({
      id: allocateId(state, "crew"),
      name: recruit.name,
      specialist: recruit.specialist,
      health: balance.crewDefaults.startingHealth,
      combat: recruit.combat,
      survival: recruit.survival,
      leadership: recruit.leadership,
      xp: 0,
      combatXpBank: 0,
      survivalXpBank: 0,
      leadershipXpBank: 0,
    });
    events.push(
      ev(state, "recruit", `${recruit.name} joins as ${recruit.specialist}.`),
    );
  }

  if (!rng.chance(chance)) {
    events.push(ev(state, "search", "No easy scrap in the open."));
    return events;
  }

  if (sumLoot(city.loot) > 0) {
    const entry = rng.pickWeighted(balance.search.lootTable);
    const available = city.loot[entry.resource];
    if (available > 0) {
      const amount = Math.min(available, rng.int(entry.min, entry.max));
      city.loot[entry.resource] -= amount;
      state.resources[entry.resource] += amount;
      events.push(
        ev(state, "search", `Pulled ${amount} ${entry.resource} from city stocks.`),
      );
      return events;
    }
  }

  const entry = rng.pickWeighted(balance.search.lootTable);
  const amount = rng.int(entry.min, entry.max);
  state.resources[entry.resource] += amount;
  events.push(
    ev(state, "search", `Found ${amount} ${entry.resource} while searching.`),
  );
  return events;
}

function cmdLoot(
  state: GameState,
  rng: SeededRng,
  cacheId: string | undefined,
): GameEvent[] {
  grantXpToAll(state.crew, balance.experience.lootXp, {
    leadership: balance.experience.lootXp,
  });

  if (cacheId) {
    const idx = state.caches.findIndex((c) => c.id === cacheId);
    if (idx < 0) throw new Error(`Unknown cache: ${cacheId}`);
    const cache = state.caches[idx]!;
    if (cache.locationId !== state.locationId) {
      throw new Error("Cache is not at this location");
    }
    for (const id of RESOURCE_IDS) {
      state.resources[id] += cache.resources[id] ?? 0;
    }
    state.caches.splice(idx, 1);
    return [ev(state, "loot", `Retrieved cache ${cacheId}.`)];
  }

  const city = currentCity(state);
  if (!city.revealed.loot) {
    markCitySearched(city);
  }

  if (sumLoot(city.loot) > 0) {
    let chance = balance.loot.baseFindChance;
    if (hasSpecialist(state.crew, "negotiator")) {
      chance += balance.loot.negotiatorBonusFindChance;
    }
    if (!rng.chance(chance)) {
      return [ev(state, "loot", "Guards or rubble — loot run empty-handed.")];
    }

    const positive = RESOURCE_IDS.filter((id) => city.loot[id] > 0);
    const resource = positive[rng.int(0, positive.length - 1)]!;
    const mult = rng.int(balance.loot.multiplierMin, balance.loot.multiplierMax);
    const amount = Math.min(city.loot[resource], Math.max(1, rng.int(1, 5) * mult));
    city.loot[resource] -= amount;
    state.resources[resource] += amount;
    return [ev(state, "loot", `Looted ${amount} ${resource} from ${city.id}.`)];
  }

  let chance = balance.loot.baseFindChance;
  if (hasSpecialist(state.crew, "negotiator")) {
    chance += balance.loot.negotiatorBonusFindChance;
  }
  if (!rng.chance(chance)) {
    return [ev(state, "loot", "Loot run empty-handed.")];
  }

  const entry = rng.pickWeighted(balance.search.lootTable);
  const mult = rng.int(balance.loot.multiplierMin, balance.loot.multiplierMax);
  const amount = rng.int(entry.min, entry.max) * mult;
  state.resources[entry.resource] += amount;
  return [ev(state, "loot", `Looted ${amount} ${entry.resource}.`)];
}

function cmdRepair(state: GameState, vehicleId: string): GameEvent[] {
  const vehicle = findVehicle(state.vehicles, vehicleId);
  if (!vehicle) throw new Error(`Unknown vehicle: ${vehicleId}`);
  if (vehicle.durability >= vehicle.maxDurability) {
    throw new Error(`${vehicle.name} is already roadworthy`);
  }
  if (state.resources.spareParts < balance.repair.sparePartsCost) {
    throw new Error("Not enough spare parts to repair");
  }

  state.resources.spareParts -= balance.repair.sparePartsCost;
  let restore = balance.repair.durabilityRestored;
  if (hasSpecialist(state.crew, "mechanic")) {
    restore += balance.repair.mechanicBonusDurability;
  }
  vehicle.durability = Math.min(vehicle.maxDurability, vehicle.durability + restore);

  const mechanics = livingCrew(state.crew).filter((c) => c.specialist === "mechanic");
  const xpTargets = mechanics.length > 0 ? mechanics : livingCrew(state.crew);
  for (const m of xpTargets) {
    grantXp(m, balance.experience.repairXp, { survival: balance.experience.repairXp });
  }

  return [
    ev(
      state,
      "repair",
      `Repaired ${vehicle.name} to ${vehicle.durability}/${vehicle.maxDurability}.`,
    ),
  ];
}

function cmdHeal(state: GameState, crewId: string): GameEvent[] {
  const member = findCrew(state.crew, crewId);
  if (!member) throw new Error(`Unknown crew: ${crewId}`);
  if (member.health >= balance.crewDefaults.maxHealth) {
    throw new Error(`${member.name} is already healthy`);
  }
  if (state.resources.medicine < balance.heal.medicineCost) {
    throw new Error("Not enough medicine");
  }

  state.resources.medicine -= balance.heal.medicineCost;
  let healAmt = balance.heal.healthRestored;
  if (hasSpecialist(state.crew, "medic")) {
    healAmt += balance.heal.medicBonusHealth;
  }
  member.health += healAmt;
  clampHealth(member);

  const medics = livingCrew(state.crew).filter((c) => c.specialist === "medic");
  const xpTargets = medics.length > 0 ? medics : livingCrew(state.crew);
  for (const m of xpTargets) {
    grantXp(m, balance.experience.healXp, { survival: balance.experience.healXp });
  }

  return [ev(state, "heal", `Treated ${member.name} → health ${member.health}.`)];
}

function cmdCache(state: GameState, deposit: Partial<Resources>): GameEvent[] {
  const total = sumResources(deposit);
  if (total < balance.cache.minDepositTotal) {
    throw new Error("Cache deposit is empty");
  }
  for (const id of RESOURCE_IDS) {
    const want = deposit[id] ?? 0;
    if (want < 0) throw new Error(`Negative cache amount for ${id}`);
    if (want > state.resources[id]) {
      throw new Error(`Cannot cache ${want} ${id}; have ${state.resources[id]}`);
    }
  }

  const stored = emptyResources();
  for (const id of RESOURCE_IDS) {
    const want = deposit[id] ?? 0;
    if (want > 0) {
      state.resources[id] -= want;
      stored[id] = want;
    }
  }

  const cache = {
    id: allocateId(state, "cache"),
    locationId: state.locationId,
    resources: Object.fromEntries(
      RESOURCE_IDS.filter((id) => stored[id] > 0).map((id) => [id, stored[id]]),
    ) as Partial<Resources>,
  };
  state.caches.push(cache);
  return [ev(state, "cache", `Buried cache ${cache.id} at ${state.locationId}.`)];
}

function cmdRest(state: GameState): GameEvent[] {
  for (const member of livingCrew(state.crew)) {
    member.health += balance.rest.healthRestored;
    clampHealth(member);
    grantXp(member, balance.experience.restXp, {
      survival: balance.experience.restXp,
      leadership: balance.experience.restXp,
    });
  }
  return [ev(state, "rest", "Convoy rests. Wounds ease a little.")];
}

/**
 * Attack probes the current city for a hostile contact and leaves a pending
 * encounter to resolve (fight/evade/negotiate/trade as allowed).
 */
function cmdAttack(state: GameState, rng: SeededRng): GameEvent[] {
  if (state.resources.guns < balance.attack.gunsRequired) {
    throw new Error("Need guns to pick a fight");
  }
  const city = currentCity(state);
  const terrainId = state.lastTravelTerrainId ?? "ruined";
  state.pendingEncounter = createPendingEncounter(rng, state, "city", terrainId);
  const p = state.pendingEncounter;
  grantXpToAll(state.crew, balance.experience.attackXp, {
    combat: Math.floor(balance.experience.attackXp / 2),
  });
  return [
    ev(
      state,
      "attack",
      `Picked a fight in ${getCityDef(city.id).name}: ${p.name} — ${p.description}`,
    ),
    ev(
      state,
      "encounter",
      `Pending [${p.actions.join("/")}] str ${p.strength} / morale ${p.morale}.`,
    ),
  ];
}

function cmdTactical(
  state: GameState,
  _rng: SeededRng,
  action: TacticalAction,
): { events: GameEvent[]; finished: boolean } {
  if (!state.tacticalBattle) {
    throw new Error("No tactical battle in progress");
  }
  const result = applyTacticalAction(state.tacticalBattle, action);
  if (!result.ok) {
    throw new Error(result.error ?? "Tactical action failed");
  }
  state.tacticalBattle = result.battle;
  state.rngState = result.battle.rngState;

  const events: GameEvent[] = result.messages.map((message) => ({
    turn: state.turn,
    kind: "tactical",
    message,
  }));

  if (result.battle.phase === "ended" && result.battle.result) {
    const finishRng = rngFromState(state);
    events.push(...applyTacticalResult(state, result.battle, finishRng));
    state.rngState = finishRng.getState();
    return { events, finished: true };
  }
  return { events, finished: false };
}

function pickClass(rng: SeededRng, classId?: VehicleClassId): VehicleClassId {
  if (classId) {
    getVehicleClass(classId);
    return classId;
  }
  const weighted = (Object.keys(vehicleClasses) as VehicleClassId[]).map((id) => ({
    id,
    weight: getVehicleClass(id).captureWeight,
  }));
  return rng.pickWeighted(weighted).id;
}

function cmdScavengeVehicle(
  state: GameState,
  rng: SeededRng,
  classId?: VehicleClassId,
): GameEvent[] {
  if (!canAddVehicle(state)) {
    throw new Error(`Vehicle cap (${balance.maxVehicles}) reached`);
  }
  const city = currentCity(state);
  let id: VehicleClassId;
  if (classId) {
    id = classId;
    const yardIdx = city.vehicleYard.indexOf(classId);
    if (yardIdx >= 0) city.vehicleYard.splice(yardIdx, 1);
  } else if (city.vehicleYard.length > 0) {
    id = city.vehicleYard.shift()!;
  } else {
    id = pickClass(rng);
  }

  const cls = getVehicleClass(id);
  const vehicle = addVehicle(state, id, `Scavenged ${cls.label}`);
  const minF = balance.scavenge.minDurabilityFraction;
  const maxF = balance.scavenge.maxDurabilityFraction;
  const fraction = minF + rng.next() * (maxF - minF);
  vehicle.durability = Math.max(1, Math.floor(vehicle.maxDurability * fraction));
  city.revealed.vehicles = true;
  return [
    ev(
      state,
      "scavengeVehicle",
      `Scavenged ${vehicle.name} (${vehicle.durability}/${vehicle.maxDurability}).`,
    ),
  ];
}

function cmdCaptureVehicle(
  state: GameState,
  rng: SeededRng,
  classId?: VehicleClassId,
): GameEvent[] {
  if (!canAddVehicle(state)) {
    throw new Error(`Vehicle cap (${balance.maxVehicles}) reached`);
  }
  const id = pickClass(rng, classId);
  const cls = getVehicleClass(id);
  const vehicle = addVehicle(state, id, `Captured ${cls.label}`);
  return [ev(state, "captureVehicle", `Captured ${vehicle.name} (stub).`)];
}
