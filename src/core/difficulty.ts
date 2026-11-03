import difficultyJson from "../../data/difficulty.json";
import type { Resources } from "./types";
import { RESOURCE_IDS } from "./types";

export type DifficultyId = "classic" | "road-weary";

export interface DifficultyProfile {
  id: DifficultyId;
  label: string;
  blurb: string;
  startingResourceMult: number;
  foodPerCrewMult: number;
  encounterChanceMult: number;
  lootMult: number;
  enemyStrengthMult: number;
  deadlineTurnsMult: number;
  starvationDamageMult: number;
}

interface DifficultyFile {
  default: DifficultyId;
  profiles: Record<DifficultyId, DifficultyProfile>;
}

const data = difficultyJson as DifficultyFile;

export const difficultyData = data;

export function getDifficulty(id: DifficultyId | string | undefined): DifficultyProfile {
  const key = (id ?? data.default) as DifficultyId;
  return data.profiles[key] ?? data.profiles[data.default];
}

export function listDifficulties(): DifficultyProfile[] {
  return Object.values(data.profiles);
}

export function scaleStartingResources(
  base: Resources,
  profile: DifficultyProfile,
): Resources {
  const out = { ...base };
  for (const id of RESOURCE_IDS) {
    out[id] = Math.max(0, Math.round(base[id] * profile.startingResourceMult));
  }
  return out;
}

export function scaleDeadlineTurns(baseTurns: number, profile: DifficultyProfile): number {
  return Math.max(20, Math.round(baseTurns * profile.deadlineTurnsMult));
}
