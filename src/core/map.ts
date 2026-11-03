import {
  balance,
  citiesData,
  cityById,
  emptyResources,
  getCityDef,
  getFaction,
  getTerrain,
  vehicleClasses,
} from "./data";
import type { SeededRng } from "./rng";
import type {
  CityRuntime,
  CityRevealFlags,
  CityStatusView,
  GameState,
  NeighborInfo,
  RecruitTemplate,
  Resources,
  SpecialistId,
  TerrainId,
  VehicleClassId,
} from "./types";
import { RESOURCE_IDS } from "./types";

export interface RoadLink {
  to: string;
  terrain: TerrainId;
  miles: number;
}

const adjacency: Record<string, RoadLink[]> = {};

for (const edge of citiesData.edges) {
  (adjacency[edge.from] ??= []).push({
    to: edge.to,
    terrain: edge.terrain,
    miles: edge.miles,
  });
  (adjacency[edge.to] ??= []).push({
    to: edge.from,
    terrain: edge.terrain,
    miles: edge.miles,
  });
}

export function getNeighbors(cityId: string): RoadLink[] {
  return adjacency[cityId] ?? [];
}

export function findRoad(fromId: string, toId: string): RoadLink | undefined {
  return getNeighbors(fromId).find((n) => n.to === toId);
}

export function computeTravelCost(
  state: GameState,
  miles: number,
  terrainId: TerrainId,
  hasDriver: boolean,
): { fuelCost: number; tireWearChance: number } {
  const t = getTerrain(terrainId);
  const travel = balance.travel;
  const consumption = balance.consumption;

  const effectiveMiles = miles / Math.max(0.1, t.speedMultiplier);
  let fuelCost =
    Math.ceil((effectiveMiles / travel.milesPerFuelUnit) * t.fuelMultiplier) +
    consumption.fuelPerMoveFlat +
    consumption.fuelPerVehicleOnMove * state.vehicles.length;

  if (hasDriver) {
    fuelCost = Math.max(
      consumption.minFuelCost,
      Math.ceil(fuelCost * consumption.driverFuelMultiplier),
    );
  } else {
    fuelCost = Math.max(consumption.minFuelCost, fuelCost);
  }

  const tireWearChance = Math.min(
    travel.maxTireWearChance,
    consumption.tireWearChanceOnMove *
      t.tireWearMultiplier *
      (miles / travel.referenceMilesForTireWear),
  );

  return { fuelCost, tireWearChance };
}

function blankReveal(): CityRevealFlags {
  return {
    population: false,
    danger: false,
    faction: false,
    loot: false,
    vehicles: false,
    recruits: false,
    specials: false,
  };
}

const SPECIALISTS: SpecialistId[] = [
  "medic",
  "mechanic",
  "driver",
  "scout",
  "negotiator",
  "gunner",
  "leader",
];

const RECRUIT_NAMES = [
  "Ash Rivera",
  "Kim Bao",
  "Drew Hale",
  "Mara Quinn",
  "Otto Finch",
  "Sable Ortiz",
  "Jonah Reed",
  "Priya Shah",
  "Ellis Kane",
  "Vera Moss",
];

export function generateCityRuntime(defId: string, rng: SeededRng): CityRuntime {
  const def = getCityDef(defId);
  const gen = balance.cityGeneration;
  const popJitter = 1 + (rng.next() * 2 - 1) * gen.populationJitterFraction;
  const population = Math.max(
    gen.minPopulation,
    Math.round(def.basePopulation * popJitter),
  );
  const danger = Math.max(
    gen.minDanger,
    Math.min(
      gen.maxDanger,
      def.baseDanger + rng.int(-gen.dangerJitter, gen.dangerJitter),
    ),
  );

  const pool = citiesData.regionFactionPools[def.region] ?? ["scavengers"];
  const factionId = pool[rng.int(0, pool.length - 1)]!;

  const loot = emptyResources();
  const piles = rng.int(gen.lootPileCountMin, gen.lootPileCountMax);
  for (let i = 0; i < piles; i += 1) {
    const entry = rng.pickWeighted(balance.search.lootTable);
    loot[entry.resource] += rng.int(entry.min, entry.max);
  }

  const vehicleYard: VehicleClassId[] = [];
  if (rng.chance(gen.vehicleYardChance)) {
    const count = rng.int(gen.vehicleYardMin, gen.vehicleYardMax);
    const classIds = Object.keys(vehicleClasses) as VehicleClassId[];
    for (let i = 0; i < count; i += 1) {
      vehicleYard.push(classIds[rng.int(0, classIds.length - 1)]!);
    }
  }

  const recruitCount = rng.int(gen.recruitCountMin, gen.recruitCountMax);
  const recruits: RecruitTemplate[] = [];
  for (let i = 0; i < recruitCount; i += 1) {
    recruits.push({
      name: RECRUIT_NAMES[rng.int(0, RECRUIT_NAMES.length - 1)]!,
      specialist: SPECIALISTS[rng.int(0, SPECIALISTS.length - 1)]!,
      combat: rng.int(gen.recruitCombatMin, gen.recruitCombatMax),
      survival: rng.int(gen.recruitSurvivalMin, gen.recruitSurvivalMax),
      leadership: rng.int(gen.recruitLeadershipMin, gen.recruitLeadershipMax),
    });
  }

  const specialLocations: string[] = [];
  if (rng.chance(gen.specialLocationChance)) {
    const max = Math.min(gen.specialLocationMax, citiesData.specialLocationPool.length);
    const count = rng.int(1, Math.max(1, max));
    const poolLocs = [...citiesData.specialLocationPool];
    for (let i = 0; i < count && poolLocs.length > 0; i += 1) {
      const idx = rng.int(0, poolLocs.length - 1);
      specialLocations.push(poolLocs.splice(idx, 1)[0]!);
    }
  }

  return {
    id: defId,
    visited: false,
    searched: false,
    population,
    danger,
    factionId,
    loot,
    vehicleYard,
    recruits,
    specialLocations,
    revealed: blankReveal(),
  };
}

export function generateAllCities(rng: SeededRng): Record<string, CityRuntime> {
  const cities: Record<string, CityRuntime> = {};
  const ids = Object.keys(cityById).sort();
  for (const id of ids) {
    cities[id] = generateCityRuntime(id, rng);
  }
  return cities;
}

/** Arriving at a city reveals population + danger. */
export function markCityVisited(city: CityRuntime): void {
  city.visited = true;
  city.revealed.population = true;
  city.revealed.danger = true;
}

/** Searching reveals faction, loot, yard, recruits, specials. */
export function markCitySearched(city: CityRuntime): void {
  city.searched = true;
  city.revealed.faction = true;
  city.revealed.loot = true;
  city.revealed.vehicles = true;
  city.revealed.recruits = true;
  city.revealed.specials = true;
  markCityVisited(city);
}

export function neighborStatus(state: GameState, hasDriver: boolean): NeighborInfo[] {
  return getNeighbors(state.locationId).map((link) => {
    const def = getCityDef(link.to);
    const { fuelCost } = computeTravelCost(state, link.miles, link.terrain, hasDriver);
    return {
      id: link.to,
      name: `${def.name}, ${def.state}`,
      terrain: link.terrain,
      miles: link.miles,
      fuelCost,
    };
  });
}

export function cityStatusView(city: CityRuntime): CityStatusView {
  const def = getCityDef(city.id);
  const revealedLoot = (): Partial<Resources> | null => {
    if (!city.revealed.loot) return null;
    const partial: Partial<Resources> = {};
    for (const id of RESOURCE_IDS) {
      if (city.loot[id] > 0) partial[id] = city.loot[id];
    }
    return partial;
  };

  return {
    id: city.id,
    name: def.name,
    stateCode: def.state,
    visited: city.visited,
    searched: city.searched,
    population: city.revealed.population ? city.population : null,
    danger: city.revealed.danger ? city.danger : null,
    factionLabel: city.revealed.faction ? getFaction(city.factionId).label : null,
    loot: revealedLoot(),
    vehicleYard: city.revealed.vehicles ? [...city.vehicleYard] : null,
    recruitCount: city.revealed.recruits ? city.recruits.length : null,
    recruits: city.revealed.recruits ? city.recruits.map((r) => ({ ...r })) : null,
    specialLocations: city.revealed.specials ? [...city.specialLocations] : null,
  };
}

export function sumLoot(loot: Resources): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + loot[id], 0);
}

export function graphStats(): { cityCount: number; edgeCount: number } {
  return {
    cityCount: citiesData.cities.length,
    edgeCount: citiesData.edges.length,
  };
}
