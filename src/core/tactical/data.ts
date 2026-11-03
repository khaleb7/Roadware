import tacticalJson from "../../../data/tactical.json";
import weaponsJson from "../../../data/weapons.json";
import type { VehicleClassId } from "../types";

export interface WeaponDef {
  id: string;
  label: string;
  range: number;
  damage: number;
  ammoPerShot: number;
  accuracy: number;
  tireHitChance: number;
  crewHitChance: number;
}

export interface TacticalBalance {
  gridWidth: number;
  gridHeight: number;
  playerDeployMinY: number;
  playerDeployMaxY: number;
  enemyDeployMinY: number;
  enemyDeployMaxY: number;
  facing: {
    frontDamageTaken: number;
    sideDamageTaken: number;
    rearDamageTaken: number;
  };
  armorMitigationPerPoint: number;
  maxArmorMitigation: number;
  tireMax: number;
  tireDestroyThreshold: number;
  tireDamageOnHit: number;
  hullDestroyAt: number;
  movesPerTurnBase: number;
  speedMovesDivisor: number;
  attacksPerTurn: number;
  ram: {
    adjacentOnly: boolean;
    baseDamage: number;
    selfDamageFraction: number;
    immobilizeChance: number;
    requiresMove: boolean;
  };
  board: {
    adjacentOnly: boolean;
    baseChance: number;
    combatScale: number;
    targetCrewPenalty: number;
    successCaptures: boolean;
  };
  enemyForce: {
    minVehicles: number;
    maxVehicles: number;
    strengthPerVehicle: number;
    classWeights: Array<{ classId: VehicleClassId; weight: number }>;
    defaultWeapons: Record<VehicleClassId, string[]>;
  };
  playerDefaultWeapons: Record<VehicleClassId, string[]>;
  salvage: {
    disabledChance: number;
    boardedGuaranteed: boolean;
    durabilityFractionMin: number;
    durabilityFractionMax: number;
    lootRollsMin: number;
    lootRollsMax: number;
  };
  victoryXp: number;
  defeatXp: number;
  crewCasualtyHealthLoss: number;
  ai: {
    preferShootRange: boolean;
    ramIfStronger: boolean;
  };
}

export const tacticalBalance = tacticalJson as TacticalBalance;
export const weapons = weaponsJson as Record<string, WeaponDef>;

export function getWeapon(id: string): WeaponDef {
  const w = weapons[id];
  if (!w) throw new Error(`Unknown weapon: ${id}`);
  return w;
}
