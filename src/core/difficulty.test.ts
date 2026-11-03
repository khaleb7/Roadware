import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import {
  getDifficulty,
  listDifficulties,
  scaleDeadlineTurns,
  scaleStartingResources,
} from "./difficulty";
import { createInitialState } from "./state";
import { emptyResources, balance } from "./data";

describe("difficulty", () => {
  it("lists Classic and Road-Weary", () => {
    const ids = listDifficulties().map((d) => d.id).sort();
    expect(ids).toEqual(["classic", "road-weary"]);
  });

  it("scales starting resources for Road-Weary", () => {
    const classic = createInitialState(42, { difficulty: "classic" });
    const weary = createInitialState(42, { difficulty: "road-weary" });
    expect(weary.difficulty).toBe("road-weary");
    expect(weary.resources.food).toBeLessThan(classic.resources.food);
    expect(weary.resources.fuel).toBeLessThan(classic.resources.fuel);
  });

  it("scaleStartingResources is deterministic", () => {
    const base = { ...emptyResources(), ...balance.startingResources };
    const a = scaleStartingResources(base, getDifficulty("road-weary"));
    const b = scaleStartingResources(base, getDifficulty("road-weary"));
    expect(a).toEqual(b);
  });

  it("shortens deadline under Road-Weary", () => {
    const classic = scaleDeadlineTurns(120, getDifficulty("classic"));
    const weary = scaleDeadlineTurns(120, getDifficulty("road-weary"));
    expect(weary).toBeLessThan(classic);
  });

  it("same seed same cities across difficulties", () => {
    const a = createInitialState(99, { difficulty: "classic" });
    const b = createInitialState(99, { difficulty: "road-weary" });
    expect(Object.keys(a.cities).sort()).toEqual(Object.keys(b.cities).sort());
    expect(a.campaign.scientists.map((s) => s.cityId).sort()).toEqual(
      b.campaign.scientists.map((s) => s.cityId).sort(),
    );
  });

  it("exposes difficulty on status", () => {
    const state = createInitialState(3, { difficulty: "road-weary" });
    const status = applyCommand(state, { type: "status" }).status!;
    expect(status.difficulty).toBe("road-weary");
  });
});
