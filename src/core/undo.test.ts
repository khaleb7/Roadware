import { describe, expect, it } from "vitest";
import { Game } from "./game";

describe("staged undo before turn commit", () => {
  it("stages without mutating turn", () => {
    const game = Game.newGame(42, "classic");
    const turn = game.getState().turn;
    game.stage({ type: "rest" }, "Rest");
    expect(game.getState().turn).toBe(turn);
    expect(game.getStaged()?.label).toBe("Rest");
  });

  it("undo clears stage without advancing", () => {
    const game = new Game(42);
    const before = game.toJSON();
    game.stage({ type: "search" }, "Search");
    game.undoStage();
    expect(game.getStaged()).toBeNull();
    expect(game.toJSON()).toBe(before);
  });

  it("confirm applies and advances turn", () => {
    const game = new Game(42);
    const turn = game.getState().turn;
    game.stage({ type: "rest" }, "Rest");
    const result = game.confirmStage();
    expect(result?.ok).toBe(true);
    expect(result?.turnAdvanced).toBe(true);
    expect(game.getState().turn).toBe(turn + 1);
    expect(game.getStaged()).toBeNull();
  });

  it("status does not clear staged choice", () => {
    const game = new Game(42);
    game.stage({ type: "loot" }, "Loot");
    game.dispatch({ type: "status" });
    expect(game.getStaged()?.label).toBe("Loot");
  });
});
