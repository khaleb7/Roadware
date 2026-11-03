import { describe, expect, it } from "vitest";
import { encounters } from "./data";
import { Game, runCommand } from "./game";
import { getNeighbors } from "./map";
import { createInitialState } from "./state";
import type { EncounterKind } from "./encounterTypes";
import type { EncounterAction, GameState } from "./types";

const KINDS: EncounterKind[] = [
  "rival_gang",
  "mutants",
  "cannibals",
  "militia",
  "cult",
  "plague_zone",
  "friendly_enclave",
  "trader",
  "healer",
];

function resolveIfNeeded(
  state: GameState,
  preferred: EncounterAction = "fight",
): GameState {
  if (!state.pendingEncounter) return state;
  const action = state.pendingEncounter.actions.includes(preferred)
    ? preferred
    : state.pendingEncounter.actions[0]!;
  const result = runCommand(state, { type: "resolveEncounter", action });
  expect(result.ok).toBe(true);
  return result.state;
}

describe("encounters", () => {
  it("defines original archetypes covering required kinds", () => {
    const kinds = new Set(Object.values(encounters).map((e) => e.kind));
    for (const k of KINDS) {
      expect(kinds.has(k), `missing kind ${k}`).toBe(true);
    }
    for (const e of Object.values(encounters)) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(10);
      expect(e.lootTable.length).toBeGreaterThan(0);
      expect(e.actions.length).toBeGreaterThan(0);
    }
  });

  it("blocks other commands while an encounter is pending", () => {
    const game = new Game(77);
    const attack = game.dispatch({ type: "attack" });
    expect(attack.ok).toBe(true);
    expect(game.getState().pendingEncounter).not.toBeNull();

    const blocked = game.dispatch({ type: "rest" });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/Resolve encounter/i);

    const status = game.dispatch({ type: "status" });
    expect(status.ok).toBe(true);
    expect(status.status?.pendingEncounter?.name).toBeTruthy();
  });

  it("quick-resolves a fight into a battle report", () => {
    const game = new Game(88);
    expect(game.dispatch({ type: "attack" }).ok).toBe(true);
    const pending = game.getState().pendingEncounter!;
    expect(pending.actions).toContain("fight");

    const result = game.dispatch({ type: "resolveEncounter", action: "fight" });
    expect(result.ok).toBe(true);
    expect(game.getState().pendingEncounter).toBeNull();
    expect(game.getState().lastBattleReport).not.toBeNull();
    expect(game.getState().lastBattleReport!.lines.length).toBeGreaterThan(0);
    expect(result.events.some((e) => e.kind === "battle")).toBe(true);
  });

  it("supports evade / negotiate / trade when the archetype allows", () => {
    // Force a trader via attack retries across seeds until trade is available
    let resolvedTrade = false;
    for (let seed = 200; seed < 260; seed += 1) {
      const game = new Game(seed);
      game.dispatch({ type: "attack" });
      const pending = game.getState().pendingEncounter;
      if (!pending?.actions.includes("trade")) continue;
      const topped = game.getState();
      // Ensure trade currency
      topped.resources.ammunition = 40;
      topped.resources.food = 40;
      topped.resources.spareParts = 10;
      const g2 = new Game(topped);
      const trade = g2.dispatch({ type: "resolveEncounter", action: "trade" });
      expect(trade.ok).toBe(true);
      expect(trade.events.some((e) => e.kind === "trade")).toBe(true);
      resolvedTrade = true;
      break;
    }
    expect(resolvedTrade).toBe(true);

    let resolvedEvade = false;
    for (let seed = 300; seed < 360; seed += 1) {
      const game = new Game(seed);
      game.dispatch({ type: "attack" });
      const pending = game.getState().pendingEncounter;
      if (!pending?.actions.includes("evade")) continue;
      const evade = game.dispatch({ type: "resolveEncounter", action: "evade" });
      expect(evade.ok).toBe(true);
      expect(evade.events.some((e) => e.kind === "evade")).toBe(true);
      resolvedEvade = true;
      break;
    }
    expect(resolvedEvade).toBe(true);
  });

  it("can spawn road encounters after move and resolve them", () => {
    let saw = false;
    for (let seed = 1; seed < 80; seed += 1) {
      let state = createInitialState(seed);
      const dest = getNeighbors(state.locationId)[0]!.to;
      const moved = runCommand(state, { type: "move", destinationId: dest });
      expect(moved.ok).toBe(true);
      state = moved.state;
      if (!state.pendingEncounter) continue;
      saw = true;
      state = resolveIfNeeded(state, "evade");
      expect(state.pendingEncounter).toBeNull();
      break;
    }
    expect(saw).toBe(true);
  });

  it("replays encounter resolution identically from the same seed", () => {
    const run = (seed: number): GameState => {
      let state = createInitialState(seed);
      const dest = getNeighbors(state.locationId)[0]!.to;
      for (const cmd of [
        { type: "move" as const, destinationId: dest },
        { type: "attack" as const },
      ]) {
        // Clear pending before attack if move spawned one
        state = resolveIfNeeded(state, "fight");
        const result = runCommand(state, cmd);
        if (!result.ok && result.error?.includes("Resolve")) {
          state = resolveIfNeeded(state, "fight");
          const retry = runCommand(state, cmd);
          expect(retry.ok).toBe(true);
          state = retry.state;
        } else {
          expect(result.ok).toBe(true);
          state = result.state;
        }
      }
      state = resolveIfNeeded(state, "fight");
      return state;
    };

    expect(run(1234)).toEqual(run(1234));
  });
});
