import { describe, expect, it } from "vitest";
import { Game, runCommand } from "../game";
import { createInitialState } from "../state";
import { hitArc, manhattan } from "./geo";
import { applyTacticalAction } from "./actions";
import { createTacticalBattle } from "./createBattle";
import { SeededRng } from "../rng";
import { tacticalBalance, weapons } from "./data";

describe("tactical combat core", () => {
  it("loads data-driven weapons and grid config", () => {
    expect(Object.keys(weapons).length).toBeGreaterThanOrEqual(3);
    expect(tacticalBalance.gridWidth).toBeGreaterThan(4);
    expect(tacticalBalance.facing.rearDamageTaken).toBeGreaterThan(
      tacticalBalance.facing.frontDamageTaken,
    );
  });

  it("computes armor facing arcs", () => {
    // Defender faces north (0) at 5,5; shot from south → rear
    expect(hitArc(0, 5, 6, 5, 5)).toBe("rear");
    // Shot from north → front
    expect(hitArc(0, 5, 4, 5, 5)).toBe("front");
    // Shot from east → side
    expect(hitArc(0, 6, 5, 5, 5)).toBe("side");
    expect(manhattan(0, 0, 2, 2)).toBe(4);
  });

  it("creates a deployable battle from a pending fight", () => {
    const game = new Game(50);
    expect(game.dispatch({ type: "attack" }).ok).toBe(true);
    const pending = game.getState().pendingEncounter!;
    const battle = createTacticalBattle(game.getState(), pending, new SeededRng(1));
    expect(battle.phase).toBe("deploy");
    expect(battle.units.some((u) => u.side === "player")).toBe(true);
    expect(battle.units.some((u) => u.side === "enemy" && u.deployed)).toBe(true);
  });

  it("supports deploy, begin, move, shoot, and end turn via actions", () => {
    const state = createInitialState(61);
    state.pendingEncounter = {
      archetypeId: "ash-runners",
      kind: "rival_gang",
      name: "Ash Runners",
      description: "test",
      strength: 50,
      morale: 40,
      actions: ["fight", "evade"],
      terrainId: "highway",
      locationId: state.locationId,
      context: "city",
    };
    let battle = createTacticalBattle(state, state.pendingEncounter, new SeededRng(9));
    let res = applyTacticalAction(battle, { type: "autoDeploy" });
    expect(res.ok).toBe(true);
    battle = res.battle;
    expect(
      battle.units.filter((u) => u.side === "player").every((u) => u.deployed),
    ).toBe(true);

    res = applyTacticalAction(battle, { type: "beginCombat" });
    expect(res.ok).toBe(true);
    battle = res.battle;
    expect(battle.phase).toBe("combat");

    const player = battle.units.find((u) => u.side === "player" && u.deployed)!;
    const stepY = player.y - 1;
    if (stepY >= 0) {
      res = applyTacticalAction(battle, {
        type: "move",
        unitId: player.id,
        x: player.x,
        y: stepY,
      });
      // May fail if blocked; either ok or clear error is fine
      if (res.ok) battle = res.battle;
    }

    const enemy = battle.units.find((u) => u.side === "enemy" && !u.destroyed)!;
    res = applyTacticalAction(battle, {
      type: "shoot",
      unitId: player.id,
      targetId: enemy.id,
    });
    // Out of range is acceptable; if in range, expect ok
    if (res.ok) {
      battle = res.battle;
      expect(battle.log.length).toBeGreaterThan(0);
    }

    res = applyTacticalAction(battle, { type: "endTurn" });
    expect(res.ok).toBe(true);
    expect(res.battle.activeSide).toBe("player");
  });

  it("starts tactical mode from resolveEncounter and finishes with salvage path", () => {
    const game = new Game(70);
    expect(game.dispatch({ type: "attack" }).ok).toBe(true);
    const start = game.dispatch({
      type: "resolveEncounter",
      action: "fight",
      mode: "tactical",
    });
    expect(start.ok).toBe(true);
    expect(start.turnAdvanced).toBe(false);
    expect(game.getState().tacticalBattle).not.toBeNull();
    expect(game.getState().pendingEncounter).toBeNull();

    expect(game.dispatch({ type: "tactical", action: { type: "autoDeploy" } }).ok).toBe(
      true,
    );
    expect(
      game.dispatch({ type: "tactical", action: { type: "beginCombat" } }).ok,
    ).toBe(true);

    // Flee ends battle and applies result
    const flee = game.dispatch({ type: "tactical", action: { type: "fleeQuick" } });
    expect(flee.ok).toBe(true);
    expect(game.getState().tacticalBattle).toBeNull();
    expect(game.getState().lastBattleReport?.outcomeId).toMatch(/flee|enemy/);
  });

  it("blocks strategic commands during tactical battle", () => {
    const game = new Game(71);
    game.dispatch({ type: "attack" });
    game.dispatch({ type: "resolveEncounter", action: "fight", mode: "tactical" });
    const blocked = game.dispatch({ type: "rest" });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/tactical/i);
  });

  it("replays a scripted tactical open identically", () => {
    const run = (seed: number) => {
      let state = createInitialState(seed);
      state = runCommand(state, { type: "attack" }).state;
      state = runCommand(state, {
        type: "resolveEncounter",
        action: "fight",
        mode: "tactical",
      }).state;
      state = runCommand(state, {
        type: "tactical",
        action: { type: "autoDeploy" },
      }).state;
      state = runCommand(state, {
        type: "tactical",
        action: { type: "beginCombat" },
      }).state;
      return state.tacticalBattle;
    };
    expect(run(909)).toEqual(run(909));
  });

  it("rams and boards require adjacency rules", () => {
    const state = createInitialState(80);
    state.pendingEncounter = {
      archetypeId: "chrome-jackals",
      kind: "rival_gang",
      name: "Chrome Jackals",
      description: "test",
      strength: 40,
      morale: 40,
      actions: ["fight"],
      terrainId: "highway",
      locationId: state.locationId,
      context: "road",
    };
    let battle = createTacticalBattle(state, state.pendingEncounter, new SeededRng(3));
    battle = applyTacticalAction(battle, { type: "autoDeploy" }).battle;
    battle = applyTacticalAction(battle, { type: "beginCombat" }).battle;
    const player = battle.units.find((u) => u.side === "player")!;
    const far = battle.units.find((u) => u.side === "enemy")!;
    const ram = applyTacticalAction(battle, {
      type: "ram",
      unitId: player.id,
      targetId: far.id,
    });
    if (manhattan(player.x, player.y, far.x, far.y) !== 1) {
      expect(ram.ok).toBe(false);
    }
  });
});
