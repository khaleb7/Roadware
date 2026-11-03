import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "../core/state";
import {
  buildSaveFile,
  migrateSave,
  readSave,
  writeSave,
  listSaveSlots,
  deleteSave,
} from "./save";
import { SAVE_SCHEMA_VERSION } from "./types";

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  const ls = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: ls,
    configurable: true,
  });
}

describe("save schema", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it("builds versioned save file", () => {
    const state = createInitialState(7, { difficulty: "classic" });
    const file = buildSaveFile(state, 1, "Test");
    expect(file.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(file.difficulty).toBe("classic");
    expect(file.state.turn).toBe(1);
    expect(file.label).toBe("Test");
  });

  it("round-trips through storage slots", async () => {
    const state = createInitialState(11, { difficulty: "road-weary" });
    await writeSave(state, 2, "Slot two");
    const loaded = await readSave(2);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.seed).toBe(11);
    expect(loaded!.difficulty).toBe("road-weary");
    expect(loaded!.state.difficulty).toBe("road-weary");

    const slots = await listSaveSlots();
    expect(slots[2]?.occupied).toBe(true);
    expect(slots[2]?.difficulty).toBe("road-weary");

    await deleteSave(2);
    expect(await readSave(2)).toBeNull();
  });

  it("migrates bare state dump (schema 0)", () => {
    const state = createInitialState(5);
    const migrated = migrateSave({ ...state, schemaVersion: 0 });
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.state.seed).toBe(5);
  });
});
