import { balance, emptyResources, getVehicleClass, vehicleClasses } from "./data";
import {
  clampHealth,
  findCrew,
  grantXp,
  grantXpToAll,
  hasSpecialist,
  livingCrew,
} from "./crew";
import { applyEndOfTurn } from "./endTurn";
import type { SeededRng } from "./rng";
import {
  allocateId,
  appendLog,
  cloneState,
  rngFromState,
  sumResources,
  syncRng,
} from "./state";
import type {
  CommandResult,
  GameCommand,
  GameEvent,
  GameState,
  Resources,
  StatusSnapshot,
  VehicleClassId,
} from "./types";
import { RESOURCE_IDS } from "./types";
import { addVehicle, canAddVehicle, findVehicle, moveFuelCost } from "./vehicles";

export function applyCommand(state: GameState, command: GameCommand): CommandResult {
  if (command.type === "status") {
    return {
      ok: true,
      state,
      events: [],
      turnAdvanced: false,
      status: snapshot(state),
    };
  }

  if (state.phase !== "playing") {
    return fail(state, `Game over: ${state.lossReason ?? state.phase}`);
  }

  const next = cloneState(state);
  const rng = rngFromState(next);
  const events: GameEvent[] = [];

  try {
    switch (command.type) {
      case "move":
        events.push(...cmdMove(next, rng, command.destinationId));
        break;
      case "search":
        events.push(...cmdSearch(next, rng));
        break;
      case "loot":
        events.push(...cmdLoot(next, rng, command.cacheId));
        break;
      case "repair":
        events.push(...cmdRepair(next, command.vehicleId));
        break;
      case "heal":
        events.push(...cmdHeal(next, command.crewId));
        break;
      case "cache":
        events.push(...cmdCache(next, command.deposit));
        break;
      case "rest":
        events.push(...cmdRest(next));
        break;
      case "attack":
        events.push(...cmdAttack(next, rng));
        break;
      case "scavengeVehicle":
        events.push(...cmdScavengeVehicle(next, rng, command.classId));
        break;
      case "captureVehicle":
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
  events.push(...applyEndOfTurn(next, rng));
  syncRng(next, rng);

  if (next.phase === "playing") {
    next.turn += 1;
  }

  for (const e of events) {
    appendLog(next, e);
  }

  return { ok: true, state: next, events, turnAdvanced: true };
}

function fail(state: GameState, error: string): CommandResult {
  return { ok: false, state, events: [], turnAdvanced: false, error };
}

function snapshot(state: GameState): StatusSnapshot {
  return {
    turn: state.turn,
    phase: state.phase,
    locationId: state.locationId,
    resources: { ...state.resources },
    crewCount: state.crew.length,
    vehicleCount: state.vehicles.length,
    hungerStreak: state.hungerStreak,
    stranded: state.stranded,
    lossReason: state.lossReason,
  };
}

function ev(state: GameState, kind: string, message: string): GameEvent {
  return { turn: state.turn, kind, message };
}

function cmdMove(state: GameState, rng: SeededRng, destinationId: string): GameEvent[] {
  const here = balance.stubMap[state.locationId];
  if (!here) throw new Error(`Unknown location: ${state.locationId}`);
  if (!here.links.includes(destinationId)) {
    throw new Error(`No road from ${state.locationId} to ${destinationId}`);
  }
  if (!balance.stubMap[destinationId]) {
    throw new Error(`Unknown destination: ${destinationId}`);
  }

  let fuelCost = moveFuelCost(state);
  if (hasSpecialist(state.crew, "driver")) {
    fuelCost = Math.max(
      balance.consumption.minFuelCost,
      Math.ceil(fuelCost * balance.consumption.driverFuelMultiplier),
    );
  }

  const needFuel = balance.stranded.blockMoveWithoutFuel;
  const needTires = balance.stranded.blockMoveWithoutTires;

  if (needFuel && state.resources.fuel < fuelCost) {
    state.stranded = true;
    throw new Error(`Stranded: need ${fuelCost} fuel, have ${state.resources.fuel}`);
  }
  if (needTires && state.resources.tires <= 0) {
    state.stranded = true;
    throw new Error("Stranded: no tires left for the road");
  }

  state.resources.fuel -= fuelCost;
  const events: GameEvent[] = [
    ev(
      state,
      "move",
      `Rolled to ${balance.stubMap[destinationId]!.name} (burned ${fuelCost} fuel).`,
    ),
  ];

  if (rng.chance(balance.consumption.tireWearChanceOnMove)) {
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
  if (state.resources.fuel > 0 && state.resources.tires > 0) {
    state.stranded = false;
  }

  grantXpToAll(state.crew, balance.experience.moveXp, {
    survival: balance.experience.moveXp,
  });
  return events;
}

function cmdSearch(state: GameState, rng: SeededRng): GameEvent[] {
  let chance = balance.search.baseFindChance;
  if (hasSpecialist(state.crew, "scout")) {
    chance += balance.search.scoutBonusFindChance;
  }
  grantXpToAll(state.crew, balance.experience.searchXp, {
    survival: balance.experience.searchXp,
  });

  if (!rng.chance(chance)) {
    return [ev(state, "search", "Search turns up dust and old paint.")];
  }

  const entry = rng.pickWeighted(balance.search.lootTable);
  const amount = rng.int(entry.min, entry.max);
  state.resources[entry.resource] += amount;
  return [ev(state, "search", `Found ${amount} ${entry.resource} while searching.`)];
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
    return [ev(state, "loot", `Pulled supplies from cache ${cacheId}.`)];
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

function cmdAttack(state: GameState, rng: SeededRng): GameEvent[] {
  if (state.resources.guns < balance.attack.gunsRequired) {
    throw new Error("Need guns to attack");
  }
  if (state.resources.ammunition < balance.attack.ammunitionCost) {
    throw new Error("Not enough ammunition");
  }

  state.resources.ammunition -= balance.attack.ammunitionCost;
  let chance = balance.attack.stubVictoryChance;
  if (hasSpecialist(state.crew, "gunner")) {
    chance += balance.attack.gunnerBonusVictoryChance;
  }

  grantXpToAll(state.crew, balance.experience.attackXp, {
    combat: balance.experience.attackXp,
  });

  if (rng.chance(chance)) {
    const entry = rng.pickWeighted(balance.search.lootTable);
    const amount = rng.int(entry.min, entry.max);
    state.resources[entry.resource] += amount;
    return [
      ev(state, "attack", `Won the scrap (stub). Took ${amount} ${entry.resource}.`),
    ];
  }

  const victim = livingCrew(state.crew)[0];
  if (victim) {
    victim.health -= balance.attack.stubDamageToEnemy;
    clampHealth(victim);
  }
  return [ev(state, "attack", "Ambush went badly (stub). Someone is hurt.")];
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
  const id = pickClass(rng, classId);
  const cls = getVehicleClass(id);
  const vehicle = addVehicle(state, id, `Scavenged ${cls.label}`);
  const minF = balance.scavenge.minDurabilityFraction;
  const maxF = balance.scavenge.maxDurabilityFraction;
  const fraction = minF + rng.next() * (maxF - minF);
  vehicle.durability = Math.max(1, Math.floor(vehicle.maxDurability * fraction));
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
