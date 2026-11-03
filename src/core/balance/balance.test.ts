import { describe, expect, it } from "vitest";
import { shortestPath, nextHop } from "../map";
import { playSeededGame } from "./playGame";
import { aggregateResults } from "./aggregate";
import { chooseCommand } from "./aiPolicy";
import { createInitialState } from "../state";

describe("balance harness", () => {
  it("shortestPath reaches neighbors", () => {
    const path = shortestPath("denver-co", "colorado-springs-co");
    expect(path[0]).toBe("denver-co");
    expect(path[path.length - 1]).toBe("colorado-springs-co");
    expect(nextHop("denver-co", "colorado-springs-co")).toBeTruthy();
  });

  it("AI returns a command on a fresh game", () => {
    const state = createInitialState(42);
    const cmd = chooseCommand(state);
    expect(cmd).not.toBeNull();
    expect(cmd?.type).not.toBe("status");
  });

  it("plays a short seeded game without throwing", () => {
    const result = playSeededGame({ seed: 7, maxTurns: 25, difficulty: "classic" });
    expect(result.seed).toBe(7);
    expect(result.turns).toBeGreaterThanOrEqual(1);
    expect(["won", "lost", "timeout"]).toContain(result.outcome);
  });

  it("aggregates a tiny batch", () => {
    const results = [1, 2, 3].map((s) =>
      playSeededGame({ seed: s, maxTurns: 15, difficulty: "classic" }),
    );
    const report = aggregateResults(results, { difficulty: "classic", maxTurns: 15 });
    expect(report.games).toBe(3);
    expect(report.wins + report.losses + report.timeouts).toBe(3);
  });
});
