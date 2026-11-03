import { balance, citiesData, emptyResources, getVehicleClass } from "./data";
import { generateAllCities, markCityVisited } from "./map";
import { SeededRng } from "./rng";
import type { CrewMember, GameEvent, GameState, Resources, Vehicle } from "./types";
import { RESOURCE_IDS } from "./types";

export function createInitialState(seed: number): GameState {
  const rng = new SeededRng(seed);
  const resources = { ...emptyResources(), ...balance.startingResources };

  let nextEntityId = 1;
  const allocId = (prefix: string): string => {
    const id = `${prefix}-${nextEntityId}`;
    nextEntityId += 1;
    return id;
  };

  const crew: CrewMember[] = balance.startingConvoy.crew.map((c) => ({
    id: allocId("crew"),
    name: c.name,
    specialist: c.specialist,
    health: balance.crewDefaults.startingHealth,
    combat: c.combat,
    survival: c.survival,
    leadership: c.leadership,
    xp: balance.crewDefaults.startingXp,
    combatXpBank: 0,
    survivalXpBank: 0,
    leadershipXpBank: 0,
  }));

  const vehicles: Vehicle[] = balance.startingConvoy.vehicles.map((v) => {
    const cls = getVehicleClass(v.classId);
    return {
      id: allocId("veh"),
      classId: v.classId,
      name: v.name,
      durability: cls.maxDurability,
      maxDurability: cls.maxDurability,
    };
  });

  const cities = generateAllCities(rng);
  const startId = balance.startingConvoy.locationId || citiesData.startCityId;
  const startCity = cities[startId];
  if (!startCity) {
    throw new Error(`Start city missing: ${startId}`);
  }
  markCityVisited(startCity);

  return {
    seed,
    rngState: rng.getState(),
    turn: 1,
    phase: "playing",
    lossReason: null,
    locationId: startId,
    resources,
    crew,
    vehicles,
    caches: [],
    cities,
    pendingEncounter: null,
    lastBattleReport: null,
    lastTravelTerrainId: null,
    hungerStreak: 0,
    stranded: false,
    nextEntityId,
    log: [
      {
        turn: 1,
        kind: "boot",
        message: `Convoy assembled in ${startId}. The road does not care.`,
      },
    ],
  };
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): GameState {
  const parsed = JSON.parse(json) as GameState;
  assertGameState(parsed);
  return parsed;
}

export function assertGameState(state: GameState): void {
  for (const id of RESOURCE_IDS) {
    if (typeof state.resources[id] !== "number") {
      throw new Error(`Invalid resources.${id}`);
    }
  }
  if (!Array.isArray(state.crew) || !Array.isArray(state.vehicles)) {
    throw new Error("Invalid crew/vehicles arrays");
  }
  if (!state.cities || typeof state.cities !== "object") {
    throw new Error("Invalid cities map");
  }
}

export function appendLog(state: GameState, event: GameEvent): void {
  state.log.push(event);
  const overflow = state.log.length - balance.maxLogEntries;
  if (overflow > 0) {
    state.log.splice(0, overflow);
  }
}

export function allocateId(state: GameState, prefix: string): string {
  const id = `${prefix}-${state.nextEntityId}`;
  state.nextEntityId += 1;
  return id;
}

export function sumResources(partial: Partial<Resources>): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + (partial[id] ?? 0), 0);
}

export function rngFromState(state: GameState): SeededRng {
  return new SeededRng(state.rngState);
}

export function syncRng(state: GameState, rng: SeededRng): void {
  state.rngState = rng.getState();
}
