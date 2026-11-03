import { describe, expect, it } from "vitest";
import { citiesData } from "./data";
import { Game, runCommand } from "./game";
import { computeTravelCost, findRoad, getNeighbors, graphStats } from "./map";
import { createInitialState } from "./state";

describe("strategic map", () => {
  it("loads a continental city graph in the target size band", () => {
    const { cityCount, edgeCount } = graphStats();
    expect(cityCount).toBeGreaterThanOrEqual(100);
    expect(cityCount).toBeLessThanOrEqual(120);
    expect(edgeCount).toBeGreaterThan(cityCount);
    expect(citiesData.startCityId).toBe("denver-co");
  });

  it("has bidirectional travel from the start city", () => {
    const neighbors = getNeighbors("denver-co");
    expect(neighbors.length).toBeGreaterThan(0);
    const first = neighbors[0]!;
    expect(findRoad("denver-co", first.to)?.miles).toBe(first.miles);
    expect(findRoad(first.to, "denver-co")?.miles).toBe(first.miles);
  });

  it("applies terrain to fuel and tire wear", () => {
    const state = createInitialState(1);
    const highway = computeTravelCost(state, 100, "highway", false);
    const mountain = computeTravelCost(state, 100, "mountain", false);
    expect(mountain.fuelCost).toBeGreaterThan(highway.fuelCost);
    expect(mountain.tireWearChance).toBeGreaterThan(highway.tireWearChance);
  });

  it("moves along real highways and reveals city basics", () => {
    const game = new Game(8);
    expect(game.getState().locationId).toBe("denver-co");
    expect(game.getState().cities["denver-co"]?.revealed.population).toBe(true);

    const destination = "colorado-springs-co";
    const fuelBefore = game.getState().resources.fuel;
    const result = game.dispatch({ type: "move", destinationId: destination });
    expect(result.ok).toBe(true);
    expect(game.getState().locationId).toBe(destination);
    expect(game.getState().resources.fuel).toBeLessThan(fuelBefore);
    expect(game.getState().cities[destination]?.visited).toBe(true);
    expect(game.getState().cities[destination]?.revealed.danger).toBe(true);
  });

  it("hides faction intel until search", () => {
    const game = new Game(9);
    const before = game.dispatch({ type: "status" });
    expect(before.status?.city.factionLabel).toBeNull();

    const search = game.dispatch({ type: "search" });
    expect(search.ok).toBe(true);
    const after = game.dispatch({ type: "status" });
    expect(after.status?.city.factionLabel).toBeTruthy();
    expect(after.status?.city.searched).toBe(true);
  });

  it("replays map travel identically from the same seed", () => {
    const destination = getNeighbors("denver-co")[0]!.to;
    const run = (seed: number) => {
      let state = createInitialState(seed);
      for (const cmd of [
        { type: "search" as const },
        { type: "move" as const, destinationId: destination },
        { type: "loot" as const },
        { type: "rest" as const },
      ]) {
        const result = runCommand(state, cmd);
        expect(result.ok).toBe(true);
        state = result.state;
      }
      return state;
    };
    expect(run(4242)).toEqual(run(4242));
  });

  it("retrieve pulls a buried cache", () => {
    const game = new Game(15);
    expect(game.dispatch({ type: "cache", deposit: { fuel: 3 } }).ok).toBe(true);
    const cacheId = game.getState().caches[0]!.id;
    const result = game.dispatch({ type: "retrieve", cacheId });
    expect(result.ok).toBe(true);
    expect(game.getState().caches).toHaveLength(0);
  });
});
