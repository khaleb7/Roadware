import type { DifficultyId } from "../core/difficulty";
import type { GameState } from "../core/types";
import type { GameSettings } from "../settings/types";

/** Bump when GameState shape changes; migrations live in save.ts. */
export const SAVE_SCHEMA_VERSION = 1;

export const SAVE_SLOT_COUNT = 5;
/** Slot index reserved for autosave (still counts within SAVE_SLOT_COUNT). */
export const AUTOSAVE_SLOT = 0;

export interface SaveSlotMeta {
  slot: number;
  occupied: boolean;
  savedAt: string | null;
  label: string | null;
  turn: number | null;
  difficulty: DifficultyId | null;
  locationId: string | null;
  schemaVersion: number | null;
}

export interface SaveFile {
  schemaVersion: number;
  savedAt: string;
  slot: number;
  label: string;
  difficulty: DifficultyId;
  state: GameState;
}

export interface HostBridge {
  platform?: string;
  getUserDataPath?: () => Promise<string>;
  readTextFile?: (relativePath: string) => Promise<string | null>;
  writeTextFile?: (relativePath: string, contents: string) => Promise<boolean>;
  deleteTextFile?: (relativePath: string) => Promise<boolean>;
  listFiles?: (relativeDir: string) => Promise<string[]>;
  setFullscreen?: (enabled: boolean) => Promise<boolean>;
  getFullscreen?: () => Promise<boolean>;
}

export type { GameSettings };
