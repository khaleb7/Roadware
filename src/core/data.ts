import balanceJson from "../../data/balance.json";
import citiesJson from "../../data/cities.json";
import encountersJson from "../../data/encounters.json";
import factionsJson from "../../data/factions.json";
import specialistsJson from "../../data/specialists.json";
import terrainJson from "../../data/terrain.json";
import vehicleClassesJson from "../../data/vehicle-classes.json";
import type { EncounterArchetype } from "./encounterTypes";
import type { ResourceId, SpecialistId, TerrainId, VehicleClassId } from "./types";

export interface LootEntry {
  resource: ResourceId;
  min: number;
  max: number;
  weight: number;
}

export interface BalanceData {
  maxVehicles: number;
  maxLogEntries: number;
  resourceOrder: ResourceId[];
  startingResources: Record<ResourceId, number>;
  consumption: {
    foodPerCrewPerTurn: number;
    fuelPerMoveFlat: number;
    fuelPerVehicleOnMove: number;
    tireWearChanceOnMove: number;
    tiresConsumedOnWear: number;
    driverFuelMultiplier: number;
    minFuelCost: number;
  };
  travel: {
    milesPerFuelUnit: number;
    referenceMilesForTireWear: number;
    maxTireWearChance: number;
  };
  cityGeneration: {
    lootPileCountMin: number;
    lootPileCountMax: number;
    vehicleYardChance: number;
    vehicleYardMin: number;
    vehicleYardMax: number;
    recruitCountMin: number;
    recruitCountMax: number;
    specialLocationChance: number;
    specialLocationMax: number;
    dangerJitter: number;
    populationJitterFraction: number;
    minPopulation: number;
    minDanger: number;
    maxDanger: number;
    recruitCombatMin: number;
    recruitCombatMax: number;
    recruitSurvivalMin: number;
    recruitSurvivalMax: number;
    recruitLeadershipMin: number;
    recruitLeadershipMax: number;
  };
  recruit: {
    searchHireChance: number;
    negotiatorHireBonus: number;
    maxCrewSoftCap: number;
  };
  scavenge: {
    minDurabilityFraction: number;
    maxDurabilityFraction: number;
  };
  starvation: {
    healthLossWhenHungry: number;
    desertionChancePerHungryCrew: number;
    hungerStreakBeforeDesertion: number;
  };
  stranded: {
    blockMoveWithoutFuel: boolean;
    blockMoveWithoutTires: boolean;
  };
  experience: {
    restXp: number;
    searchXp: number;
    lootXp: number;
    repairXp: number;
    healXp: number;
    moveXp: number;
    attackXp: number;
    surviveHungryTurnXp: number;
    evadeXp: number;
    negotiateXp: number;
    tradeXp: number;
    xpPerCombatRating: number;
    xpPerSurvivalRating: number;
    xpPerLeadershipRating: number;
    ratingGain: number;
    maxRating: number;
  };
  encounters: {
    roadBaseChance: number;
    cityAttackBaseChance: number;
    dangerChancePerPoint: number;
    scoutAvoidBonus: number;
    maxChance: number;
    lootRollsOnWinMin: number;
    lootRollsOnWinMax: number;
    fightAmmoBase: number;
    fightAmmoPerGunner: number;
  };
  quickCombat: {
    crewCombatWeight: number;
    gunWeight: number;
    vehicleArmorWeight: number;
    gunnerBonus: number;
    leadershipMoraleWeight: number;
    leaderSpecialistBonus: number;
    enemyStrengthWeight: number;
    enemyMoraleWeight: number;
    terrainPlayerBonus: Record<TerrainId, number>;
    terrainEnemyBonus: Record<TerrainId, number>;
    rngJitter: number;
    ammoSpendOnFight: boolean;
    outcomes: Array<{
      id: string;
      minRatio: number;
      damageMin: number;
      damageMax: number;
      vehicleDamageChance: number;
      xp: number;
    }>;
    vehicleDamageAmount: number;
    winLootOn: string[];
    resourceLossOnDefeat: Partial<Record<ResourceId, { min: number; max: number }>>;
  };
  encounterActions: {
    evadeBaseChance: number;
    scoutEvadeBonus: number;
    driverEvadeBonus: number;
    survivalEvadeScale: number;
    enemyMoraleEvadePenaltyScale: number;
    evadeFailDamageMin: number;
    evadeFailDamageMax: number;
    negotiateBaseChance: number;
    negotiatorBonus: number;
    leadershipNegotiateScale: number;
    enemyMoraleNegotiatePenaltyScale: number;
    negotiateTributeFood: number;
    negotiateFailForceFight: boolean;
  };
  heal: {
    medicineCost: number;
    healthRestored: number;
    medicBonusHealth: number;
  };
  repair: {
    sparePartsCost: number;
    durabilityRestored: number;
    mechanicBonusDurability: number;
  };
  rest: {
    healthRestored: number;
    leadershipMoraleHint: boolean;
  };
  search: {
    baseFindChance: number;
    scoutBonusFindChance: number;
    lootTable: LootEntry[];
  };
  loot: {
    baseFindChance: number;
    negotiatorBonusFindChance: number;
    multiplierMin: number;
    multiplierMax: number;
  };
  attack: {
    ammunitionCost: number;
    gunsRequired: number;
    stubDamageToEnemy: number;
    stubVictoryChance: number;
    gunnerBonusVictoryChance: number;
    dangerVictoryPenaltyPerPoint: number;
    minVictoryChance: number;
  };
  cache: {
    minDepositTotal: number;
  };
  crewDefaults: {
    startingHealth: number;
    minHealth: number;
    maxHealth: number;
    startingCombat: number;
    startingSurvival: number;
    startingLeadership: number;
    startingXp: number;
  };
  startingConvoy: {
    locationId: string;
    crew: Array<{
      name: string;
      specialist: SpecialistId;
      combat: number;
      survival: number;
      leadership: number;
    }>;
    vehicles: Array<{ classId: VehicleClassId; name: string }>;
  };
}

export interface CityDef {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  region: string;
  basePopulation: number;
  baseDanger: number;
}

export interface RoadEdge {
  from: string;
  to: string;
  terrain: TerrainId;
  miles: number;
}

export interface CitiesData {
  version: number;
  startCityId: string;
  cities: CityDef[];
  edges: RoadEdge[];
  specialLocationPool: string[];
  regionFactionPools: Record<string, string[]>;
}

export interface TerrainDef {
  id: TerrainId;
  label: string;
  speedMultiplier: number;
  fuelMultiplier: number;
  tireWearMultiplier: number;
}

export interface FactionDef {
  id: string;
  label: string;
  attitude: string;
}

export interface VehicleClassDef {
  id: VehicleClassId;
  label: string;
  maxCrew: number;
  cargo: number;
  armor: number;
  speed: number;
  fuelEfficiency: number;
  maxDurability: number;
  captureWeight: number;
}

export interface SpecialistDef {
  id: SpecialistId;
  label: string;
  description: string;
}

export const balance = balanceJson as BalanceData;
export const citiesData = citiesJson as CitiesData;
export const terrain = terrainJson as Record<TerrainId, TerrainDef>;
export const factions = factionsJson as Record<string, FactionDef>;
export const encounters = encountersJson as Record<string, EncounterArchetype>;
export const vehicleClasses = vehicleClassesJson as Record<
  VehicleClassId,
  VehicleClassDef
>;
export const specialists = specialistsJson as Record<SpecialistId, SpecialistDef>;

export function getEncounter(id: string): EncounterArchetype {
  const arch = encounters[id];
  if (!arch) throw new Error(`Unknown encounter: ${id}`);
  return arch;
}

export const cityById: Record<string, CityDef> = Object.fromEntries(
  citiesData.cities.map((c) => [c.id, c]),
);

export function getVehicleClass(classId: VehicleClassId): VehicleClassDef {
  const def = vehicleClasses[classId];
  if (!def) throw new Error(`Unknown vehicle class: ${classId}`);
  return def;
}

export function getTerrain(id: TerrainId): TerrainDef {
  const def = terrain[id];
  if (!def) throw new Error(`Unknown terrain: ${id}`);
  return def;
}

export function getFaction(id: string): FactionDef {
  return factions[id] ?? factions.unknown!;
}

export function getCityDef(id: string): CityDef {
  const def = cityById[id];
  if (!def) throw new Error(`Unknown city: ${id}`);
  return def;
}

export function emptyResources(): Record<ResourceId, number> {
  return {
    food: 0,
    fuel: 0,
    tires: 0,
    medicine: 0,
    guns: 0,
    ammunition: 0,
    spareParts: 0,
  };
}
