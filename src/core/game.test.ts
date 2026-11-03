import { describe, expect, it } from "vitest";
import { balance } from "./data";
import { Game, runCommand } from "./game";
import { createInitialState, deserializeState, serializeState } from "./state";
import type { GameState } from "./types";

describe("core simulation", () => {
  it("creates a serializable starting convoy from data", () => {
    const state = createInitialState(42);
    expect(state.crew).toHaveLength(balance.startingConvoy.crew.length);
    expect(state.vehicles).toHaveLength(balance.startingConvoy.vehicles.length);
    expect(state.vehicles.length).toBeLessThanOrEqual(balance.maxVehicles);
    expect(state.resources.food).toBe(balance.startingResources.food);

    const roundTrip = deserializeState(serializeState(state));
    expect(roundTrip).toEqual(state);
  });

  it("replays identically from the same seed", () => {
    const commands = [
      { type: "search" as const },
      { type: "rest" as const },
      { type: "move" as const, destinationId: "ash-crossroads" },
      { type: "loot" as const },
      { type: "attack" as const },
    ];

    const run = (seed: number): GameState => {
      let state = createInitialState(seed);
      for (const cmd of commands) {
        const result = runCommand(state, cmd);
        expect(result.ok).toBe(true);
        state = result.state;
      }
      return state;
    };

    expect(run(9001)).toEqual(run(9001));
    expect(run(9001)).not.toEqual(run(9002));
  });

  it("treats status as a free command", () => {
    const game = new Game(1);
    const before = game.getState().turn;
    const result = game.dispatch({ type: "status" });
    expect(result.ok).toBe(true);
    expect(result.turnAdvanced).toBe(false);
    expect(game.getState().turn).toBe(before);
    expect(result.status?.crewCount).toBe(balance.startingConvoy.crew.length);
  });

  it("consumes food each turn and starves the convoy to a loss", () => {
    let state = createInitialState(3);
    state = {
      ...state,
      resources: { ...state.resources, food: 0 },
    };

    // healthLossWhenHungry from data will zero the roster within a few dozen turns.
    for (let i = 0; i < 40; i += 1) {
      const result = runCommand(state, { type: "rest" });
      expect(result.ok).toBe(true);
      state = result.state;
      if (state.phase === "lost") break;
    }

    expect(state.hungerStreak).toBeGreaterThan(0);
    expect(state.phase).toBe("lost");
    expect(state.crew).toHaveLength(0);
    expect(state.lossReason).toMatch(/deserted|dead/i);
  });

  it("blocks move when out of fuel (stranded)", () => {
    let state = createInitialState(5);
    state = {
      ...state,
      resources: { ...state.resources, fuel: 0 },
    };
    const result = runCommand(state, {
      type: "move",
      destinationId: "ash-crossroads",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Stranded/i);
    expect(result.turnAdvanced).toBe(false);
  });

  it("moves along stub map links and burns fuel", () => {
    const game = new Game(8);
    const fuelBefore = game.getState().resources.fuel;
    const result = game.dispatch({
      type: "move",
      destinationId: "ash-crossroads",
    });
    expect(result.ok).toBe(true);
    expect(game.getState().locationId).toBe("ash-crossroads");
    expect(game.getState().resources.fuel).toBeLessThan(fuelBefore);
    expect(game.getState().turn).toBe(2);
  });

  it("repairs vehicles using spare parts", () => {
    const game = new Game(11);
    const vehicle = game.getState().vehicles[0]!;
    // Damage via direct state clone through dispatch failure path — mutate via JSON
    const damaged = deserializeState(game.toJSON());
    damaged.vehicles[0]!.durability = 10;
    const g2 = new Game(damaged);
    const partsBefore = g2.getState().resources.spareParts;
    const result = g2.dispatch({ type: "repair", vehicleId: vehicle.id });
    expect(result.ok).toBe(true);
    expect(g2.getState().resources.spareParts).toBe(
      partsBefore - balance.repair.sparePartsCost,
    );
    expect(g2.getState().vehicles[0]!.durability).toBeGreaterThan(10);
  });

  it("heals crew using medicine", () => {
    const damaged = createInitialState(12);
    damaged.crew[0]!.health = 40;
    const game = new Game(damaged);
    const medBefore = game.getState().resources.medicine;
    const result = game.dispatch({ type: "heal", crewId: damaged.crew[0]!.id });
    expect(result.ok).toBe(true);
    expect(game.getState().resources.medicine).toBe(
      medBefore - balance.heal.medicineCost,
    );
    expect(game.getState().crew[0]!.health).toBeGreaterThan(40);
  });

  it("caches and retrieves supplies", () => {
    const game = new Game(13);
    const cacheResult = game.dispatch({ type: "cache", deposit: { food: 5 } });
    expect(cacheResult.ok).toBe(true);
    expect(game.getState().caches).toHaveLength(1);
    const cacheId = game.getState().caches[0]!.id;

    const topped = deserializeState(game.toJSON());
    topped.resources.food = 100;
    const g2 = new Game(topped);
    const loot = g2.dispatch({ type: "loot", cacheId });
    expect(loot.ok).toBe(true);
    expect(g2.getState().caches).toHaveLength(0);
    expect(loot.events.some((e) => e.kind === "loot")).toBe(true);
  });

  it("respects vehicle cap on scavenge/capture stubs", () => {
    let state = createInitialState(14);
    // Fill to cap
    while (state.vehicles.length < balance.maxVehicles) {
      const result = runCommand(state, {
        type: "scavengeVehicle",
        classId: "bike",
      });
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(state.vehicles).toHaveLength(balance.maxVehicles);
    const blocked = runCommand(state, { type: "captureVehicle", classId: "bike" });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/cap/i);
  });

  it("does not import Phaser from core modules", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src/core");
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.includes(".test."),
    );
    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf8");
      expect(source, file).not.toMatch(/from\s+['"]phaser['"]/i);
      expect(source, file).not.toMatch(/require\(['"]phaser['"]\)/i);
    }
  });
});
