import balanceJson from "../../data/balance.json";
import specialistsJson from "../../data/specialists.json";
import vehicleClassesJson from "../../data/vehicle-classes.json";
import type { ResourceId, SpecialistId, VehicleClassId } from "./types";

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
    xpPerCombatRating: number;
    xpPerSurvivalRating: number;
    xpPerLeadershipRating: number;
    ratingGain: number;
    maxRating: number;
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
  stubMap: Record<string, { name: string; links: string[] }>;
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
export const vehicleClasses = vehicleClassesJson as Record<
  VehicleClassId,
  VehicleClassDef
>;
export const specialists = specialistsJson as Record<SpecialistId, SpecialistDef>;

export function getVehicleClass(classId: VehicleClassId): VehicleClassDef {
  const def = vehicleClasses[classId];
  if (!def) {
    throw new Error(`Unknown vehicle class: ${classId}`);
  }
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
