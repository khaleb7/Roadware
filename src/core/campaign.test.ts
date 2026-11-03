import { describe, expect, it } from "vitest";
import { campaignData, gangStrength, meetsFederalContactThreshold } from "./campaign";
import { Game, runCommand } from "./game";
import { createInitialState } from "./state";

describe("campaign arc", () => {
  it("places eight scientists and a bunker from the seed", () => {
    const a = createInitialState(42);
    const b = createInitialState(42);
    expect(a.campaign.scientists).toHaveLength(campaignData.scientistCount);
    expect(a.campaign.scientists).toEqual(b.campaign.scientists);
    expect(a.campaign.bunkerCityId).toBe(b.campaign.bunkerCityId);
    expect(a.campaign.stage).toBe("survival");
    expect(a.campaign.contactedFederal).toBe(false);

    const c = createInitialState(99);
    expect(c.campaign.scientists).not.toEqual(a.campaign.scientists);
  });

  it("keeps scientist cities off the bunker when configured", () => {
    const state = createInitialState(7);
    for (const sci of state.campaign.scientists) {
      expect(sci.cityId).not.toBe(state.campaign.bunkerCityId);
    }
  });

  it("does not contact the remnant below crew/vehicle gates", () => {
    const state = createInitialState(11);
    // Starting convoy is under minCrew even if raw strength is high
    expect(state.crew.length).toBeLessThan(campaignData.federalContact.minCrew);
    expect(meetsFederalContactThreshold(state)).toBe(false);
    expect(gangStrength(state)).toBeGreaterThan(0);
  });

  it("contacts federal remnant once gang strength clears data thresholds", () => {
    const game = new Game(12);
    const state = game.getState();
    // Inflate gang to clear thresholds without relying on long play
    while (state.crew.length < campaignData.federalContact.minCrew) {
      state.crew.push({
        ...state.crew[0]!,
        id: `crew-boost-${state.crew.length}`,
        name: `Boost ${state.crew.length}`,
      });
    }
    while (state.vehicles.length < campaignData.federalContact.minVehicles) {
      state.vehicles.push({
        id: `veh-boost-${state.vehicles.length}`,
        classId: "hardtop",
        name: "Boost Car",
        durability: 50,
        maxDurability: 50,
      });
    }
    state.resources.guns = Math.max(
      state.resources.guns,
      campaignData.federalContact.minGuns,
    );
    for (const c of state.crew) {
      c.combat = 60;
    }

    expect(meetsFederalContactThreshold(state)).toBe(true);
    const result = game.dispatch({ type: "rest" });
    expect(result.ok).toBe(true);
    expect(game.getState().campaign.contactedFederal).toBe(true);
    expect(game.getState().campaign.stage).toBe("briefed");
    expect(game.getState().campaign.deadlineTurn).not.toBeNull();
    expect(result.events.some((e) => e.kind === "federal")).toBe(true);
  });

  it("discovers and extracts scientists, then wins on full delivery", () => {
    const game = new Game(33);
    // Force briefed + known scientists at start city for a tight test
    const s = game.getState();
    s.campaign.contactedFederal = true;
    s.campaign.stage = "briefed";
    s.campaign.deadlineTurn = s.turn + 50;
    // Move all scientists to current location as revealed/aboard except last
    for (let i = 0; i < s.campaign.scientists.length; i += 1) {
      const sci = s.campaign.scientists[i]!;
      sci.cityId = s.locationId;
      sci.revealed = true;
      if (i < s.campaign.scientists.length - 1) {
        sci.aboard = true;
      } else {
        sci.status = "guarded";
        sci.aboard = false;
      }
    }
    s.resources.ammunition = 40;
    s.campaign.bunkerCityId = s.locationId;

    const last = s.campaign.scientists[s.campaign.scientists.length - 1]!;
    const extract = game.dispatch({
      type: "extractScientist",
      scientistId: last.id,
    });
    // May fail once — retry a few times with ammo
    let extracted =
      extract.ok &&
      game.getState().campaign.scientists.find((x) => x.id === last.id)?.aboard;
    for (let i = 0; i < 12 && !extracted; i += 1) {
      game.getState().resources.ammunition = 40;
      const again = game.dispatch({
        type: "extractScientist",
        scientistId: last.id,
      });
      extracted = Boolean(
        again.ok &&
        game.getState().campaign.scientists.find((x) => x.id === last.id)?.aboard,
      );
    }
    expect(extracted).toBe(true);

    const deliver = game.dispatch({ type: "deliverScientists" });
    expect(deliver.ok).toBe(true);
    expect(game.getState().phase).toBe("won");
    expect(game.getState().campaign.scientists.every((x) => x.delivered)).toBe(true);
  });

  it("loses when the leader dies", () => {
    const base = createInitialState(21);
    const leaderId = base.campaign.leaderCrewId;
    base.resources.food = 200;
    base.crew = base.crew.map((c) =>
      c.id === leaderId ? { ...c, health: 0 } : { ...c, health: 100 },
    );
    const game = new Game(base);
    const result = game.dispatch({ type: "rest" });
    expect(result.ok).toBe(true);
    expect(game.getState().phase).toBe("lost");
    expect(game.getState().lossReason).toMatch(/leader/i);
  });

  it("loses when the deadline expires with undelivered scientists", () => {
    const game = new Game(22);
    const s = game.getState();
    s.campaign.contactedFederal = true;
    s.campaign.stage = "briefed";
    s.campaign.deadlineTurn = s.turn; // expires this upkeep
    s.resources.food = 500;
    const result = game.dispatch({ type: "rest" });
    expect(result.ok).toBe(true);
    expect(game.getState().phase).toBe("lost");
    expect(game.getState().lossReason).toMatch(/Deadline/i);
  });

  it("exposes campaign progress on status", () => {
    const game = new Game(5);
    const status = game.dispatch({ type: "status" });
    expect(status.status?.campaign.scientistsTotal).toBe(campaignData.scientistCount);
    expect(status.status?.campaign.stage).toBe("survival");
  });

  it("search can reveal a scientist at their city", () => {
    let found = false;
    for (let seed = 100; seed < 160; seed += 1) {
      const state = createInitialState(seed);
      const target = state.campaign.scientists[0]!;
      state.locationId = target.cityId;
      const result = runCommand(state, { type: "search" });
      expect(result.ok).toBe(true);
      const sci = result.state.campaign.scientists.find((s) => s.id === target.id)!;
      if (sci.revealed) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
