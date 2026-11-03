import type { DifficultyId } from "../core/difficulty";
import { getDifficulty } from "../core/difficulty";
import { assertGameState, cloneState } from "../core/state";
import type { GameState } from "../core/types";
import { deleteText, readText, writeText } from "./storage";
import {
  AUTOSAVE_SLOT,
  SAVE_SCHEMA_VERSION,
  SAVE_SLOT_COUNT,
  type SaveFile,
  type SaveSlotMeta,
} from "./types";

function slotPath(slot: number): string {
  return `saves/slot-${slot}.json`;
}

function emptyMeta(slot: number): SaveSlotMeta {
  return {
    slot,
    occupied: false,
    savedAt: null,
    label: null,
    turn: null,
    difficulty: null,
    locationId: null,
    schemaVersion: null,
  };
}

function metaFromFile(file: SaveFile): SaveSlotMeta {
  return {
    slot: file.slot,
    occupied: true,
    savedAt: file.savedAt,
    label: file.label,
    turn: file.state.turn,
    difficulty: file.difficulty,
    locationId: file.state.locationId,
    schemaVersion: file.schemaVersion,
  };
}

/** Migrate older save payloads forward. Currently schema v1 only. */
export function migrateSave(raw: unknown): SaveFile {
  if (!raw || typeof raw !== "object") {
    throw new Error("Save is empty or corrupt");
  }
  const obj = raw as Record<string, unknown>;
  const version = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 0;

  if (version > SAVE_SCHEMA_VERSION) {
    throw new Error(`Save schema ${version} is newer than supported ${SAVE_SCHEMA_VERSION}`);
  }

  // v0 → v1: wrap bare GameState if someone dumped state alone
  let file: SaveFile;
  if (version === 0 && obj.seed !== undefined && obj.crew !== undefined) {
    const state = obj as unknown as GameState;
    file = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      slot: 0,
      label: "Migrated",
      difficulty: (state.difficulty as DifficultyId) ?? "classic",
      state,
    };
  } else {
    file = raw as SaveFile;
  }

  if (!file.state) throw new Error("Save missing state");
  if (!file.state.difficulty) {
    file.state.difficulty = file.difficulty ?? "classic";
  }
  file.difficulty = file.state.difficulty;
  file.schemaVersion = SAVE_SCHEMA_VERSION;
  assertGameState(file.state);
  // Validate difficulty id
  getDifficulty(file.difficulty);
  return file;
}

export function buildSaveFile(
  state: GameState,
  slot: number,
  label?: string,
): SaveFile {
  const difficulty = (state.difficulty ?? "classic") as DifficultyId;
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    slot,
    label:
      label ??
      (slot === AUTOSAVE_SLOT
        ? `Autosave · T${state.turn}`
        : `Slot ${slot} · T${state.turn}`),
    difficulty,
    state: cloneState(state),
  };
}

export async function writeSave(state: GameState, slot: number, label?: string): Promise<SaveFile> {
  if (slot < 0 || slot >= SAVE_SLOT_COUNT) {
    throw new Error(`Invalid save slot ${slot}`);
  }
  const file = buildSaveFile(state, slot, label);
  const ok = await writeText(slotPath(slot), JSON.stringify(file, null, 2));
  if (!ok) throw new Error("Failed to write save");
  return file;
}

export async function readSave(slot: number): Promise<SaveFile | null> {
  const text = await readText(slotPath(slot));
  if (!text) return null;
  try {
    return migrateSave(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export async function deleteSave(slot: number): Promise<boolean> {
  return deleteText(slotPath(slot));
}

export async function listSaveSlots(): Promise<SaveSlotMeta[]> {
  const metas: SaveSlotMeta[] = [];
  for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
    const file = await readSave(i);
    metas.push(file ? metaFromFile(file) : emptyMeta(i));
  }
  return metas;
}

export async function autosave(state: GameState): Promise<SaveFile | null> {
  try {
    return await writeSave(state, AUTOSAVE_SLOT);
  } catch {
    return null;
  }
}
