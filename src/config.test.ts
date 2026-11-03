import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH, VERSION, WORKING_TITLE } from "./config";

describe("config", () => {
  it("exposes a single working title constant", () => {
    expect(WORKING_TITLE).toBe("ASPHALT DOMINION");
  });

  it("defines a 16:9 playfield", () => {
    expect(GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(16 / 9, 5);
  });

  it("has a semver-shaped version string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
