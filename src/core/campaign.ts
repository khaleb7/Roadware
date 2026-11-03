import campaignJson from "../../data/campaign.json";
import { citiesData, getCityDef } from "./data";
import { clampHealth, hasSpecialist, livingCrew } from "./crew";
import type {
  CampaignState,
  CampaignStatusView,
  ScientistState,
  ScientistStatus,
} from "./campaignTypes";
import { getDifficulty, scaleDeadlineTurns } from "./difficulty";
import { getNeighbors } from "./map";
import type { SeededRng } from "./rng";
import type { GameEvent, GameState } from "./types";

export interface CampaignData {
  scientistCount: number;
  scientistNames: string[];
  placement: {
    minDistanceFromStart: number;
    avoidBunker: boolean;
    statusWeights: Array<{ status: ScientistStatus; weight: number }>;
  };
  federalContact: {
    minCrew: number;
    minVehicles: number;
    minTotalCombat: number;
    minGuns: number;
    crewWeight: number;
    vehicleWeight: number;
    combatWeight: number;
    gunWeight: number;
    strengthThreshold: number;
    factionId: string;
    factionLabel: string;
    briefing: string;
  };
  discovery: {
    hiddenFindChance: number;
    scoutBonus: number;
    guardedRevealChance: number;
    factionRevealChance: number;
    negotiatorRevealBonus: number;
  };
  extract: {
    guardedBaseChance: number;
    gunnerBonus: number;
    combatScale: number;
    factionBaseChance: number;
    negotiatorBonus: number;
    leadershipScale: number;
    failDamageMin: number;
    failDamageMax: number;
    ammoCostGuarded: number;
  };
  deadline: {
    enabled: boolean;
    turnsAfterContact: number;
  };
  bunker: {
    specialLocationId: string;
    revealOnContact: boolean;
  };
  win: { message: string };
  loss: { wiped: string; leaderDead: string; deadline: string };
  xp: {
    findScientist: number;
    extractScientist: number;
    deliverScientist: number;
    contactBonus: number;
  };
}

export const campaignData = campaignJson as CampaignData;

function ev(state: GameState, kind: string, message: string): GameEvent {
  return { turn: state.turn, kind, message };
}

function bfsDistance(fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  const seen = new Set<string>([fromId]);
  const q: Array<{ id: string; d: number }> = [{ id: fromId, d: 0 }];
  while (q.length > 0) {
    const cur = q.shift()!;
    for (const n of getNeighbors(cur.id)) {
      if (seen.has(n.to)) continue;
      if (n.to === toId) return cur.d + 1;
      seen.add(n.to);
      q.push({ id: n.to, d: cur.d + 1 });
    }
  }
  return 999;
}

/** Place bunker + scientists using campaign RNG (same stream as city gen continuation). */
export function createCampaignState(
  rng: SeededRng,
  startCityId: string,
  leaderCrewId: string,
): CampaignState {
  const cfg = campaignData;
  const cityIds = citiesData.cities.map((c) => c.id).filter((id) => id !== startCityId);
  if (cityIds.length < cfg.scientistCount + 1) {
    throw new Error("Not enough cities for campaign placement");
  }

  // Pick bunker far-ish from start
  const bunkerCandidates = cityIds
    .map((id) => ({ id, d: bfsDistance(startCityId, id) }))
    .filter((c) => c.d >= cfg.placement.minDistanceFromStart)
    .sort((a, b) => b.d - a.d);
  const bunkerPool = bunkerCandidates.slice(
    0,
    Math.max(8, Math.floor(bunkerCandidates.length / 3)),
  );
  const bunkerCityId =
    bunkerPool[rng.int(0, Math.max(0, bunkerPool.length - 1))]?.id ??
    cityIds[rng.int(0, cityIds.length - 1)]!;

  const available = cityIds.filter((id) =>
    cfg.placement.avoidBunker ? id !== bunkerCityId : true,
  );
  // Shuffle via RNG
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const tmp = available[i]!;
    available[i] = available[j]!;
    available[j] = tmp;
  }

  const names = [...cfg.scientistNames];
  for (let i = names.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const tmp = names[i]!;
    names[i] = names[j]!;
    names[j] = tmp;
  }

  const scientists: ScientistState[] = [];
  for (let i = 0; i < cfg.scientistCount; i += 1) {
    const cityId = available[i % available.length]!;
    const status = rng.pickWeighted(cfg.placement.statusWeights).status;
    scientists.push({
      id: `sci-${i + 1}`,
      name: names[i % names.length]!,
      cityId,
      status,
      revealed: false,
      aboard: false,
      delivered: false,
    });
  }

  return {
    stage: "survival",
    contactedFederal: false,
    bunkerCityId,
    deadlineTurn: null,
    leaderCrewId,
    scientists,
  };
}

export function gangStrength(state: GameState): number {
  const f = campaignData.federalContact;
  const crew = livingCrew(state.crew);
  const combat = crew.reduce((s, c) => s + c.combat, 0);
  return (
    crew.length * f.crewWeight +
    state.vehicles.length * f.vehicleWeight +
    combat * f.combatWeight +
    state.resources.guns * f.gunWeight
  );
}

export function meetsFederalContactThreshold(state: GameState): boolean {
  const f = campaignData.federalContact;
  const crew = livingCrew(state.crew);
  const combat = crew.reduce((s, c) => s + c.combat, 0);
  if (crew.length < f.minCrew) return false;
  if (state.vehicles.length < f.minVehicles) return false;
  if (combat < f.minTotalCombat) return false;
  if (state.resources.guns < f.minGuns) return false;
  return gangStrength(state) >= f.strengthThreshold;
}

/** End-of-turn campaign hooks: contact, deadline, leader death, win. */
export function applyCampaignUpkeep(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.phase !== "playing") return events;

  // Leader death
  const leaderAlive = state.crew.some((c) => c.id === state.campaign.leaderCrewId);
  if (!leaderAlive) {
    state.phase = "lost";
    state.lossReason = campaignData.loss.leaderDead;
    events.push(ev(state, "loss", state.lossReason));
    return events;
  }

  // Federal contact
  if (!state.campaign.contactedFederal && meetsFederalContactThreshold(state)) {
    state.campaign.contactedFederal = true;
    state.campaign.stage = "briefed";
    if (campaignData.deadline.enabled) {
      const turns = scaleDeadlineTurns(
        campaignData.deadline.turnsAfterContact,
        getDifficulty(state.difficulty),
      );
      state.campaign.deadlineTurn = state.turn + turns;
    }
    if (campaignData.bunker.revealOnContact) {
      const bunker = state.cities[state.campaign.bunkerCityId];
      if (bunker) {
        const id = campaignData.bunker.specialLocationId;
        if (!bunker.specialLocations.includes(id)) {
          bunker.specialLocations.push(id);
        }
        bunker.revealed.specials = true;
        bunker.visited = true;
      }
    }
    events.push(
      ev(
        state,
        "federal",
        `${campaignData.federalContact.factionLabel}: ${campaignData.federalContact.briefing}`,
      ),
    );
    events.push(
      ev(
        state,
        "bunker",
        `Bunker marked at ${getCityDef(state.campaign.bunkerCityId).name}. Deadline: ${state.campaign.deadlineTurn ?? "none"}.`,
      ),
    );
  }

  // Deadline
  if (
    state.campaign.contactedFederal &&
    state.campaign.deadlineTurn !== null &&
    state.turn >= state.campaign.deadlineTurn &&
    state.campaign.scientists.some((s) => !s.delivered)
  ) {
    state.phase = "lost";
    state.lossReason = campaignData.loss.deadline;
    events.push(ev(state, "loss", state.lossReason));
    return events;
  }

  // Win check
  if (
    state.campaign.scientists.length > 0 &&
    state.campaign.scientists.every((s) => s.delivered)
  ) {
    state.phase = "won";
    state.campaign.stage = "complete";
    state.lossReason = null;
    events.push(ev(state, "win", campaignData.win.message));
  }

  return events;
}

export function tryDiscoverScientists(state: GameState, rng: SeededRng): GameEvent[] {
  const events: GameEvent[] = [];
  const cfg = campaignData.discovery;
  const here = state.campaign.scientists.filter(
    (s) => s.cityId === state.locationId && !s.revealed && !s.delivered && !s.aboard,
  );
  for (const sci of here) {
    let chance =
      sci.status === "hidden"
        ? cfg.hiddenFindChance
        : sci.status === "guarded"
          ? cfg.guardedRevealChance
          : cfg.factionRevealChance;
    if (hasSpecialist(state.crew, "scout")) chance += cfg.scoutBonus;
    if (sci.status === "faction_held" && hasSpecialist(state.crew, "negotiator")) {
      chance += cfg.negotiatorRevealBonus;
    }
    if (!rng.chance(Math.min(0.95, chance))) continue;

    sci.revealed = true;
    events.push(
      ev(
        state,
        "scientist",
        `Located ${sci.name} (${sci.status.replaceAll("_", " ")}) in ${getCityDef(sci.cityId).name}.`,
      ),
    );

    if (sci.status === "hidden") {
      sci.aboard = true;
      events.push(ev(state, "scientist", `${sci.name} boards the convoy.`));
    }
  }
  return events;
}

export function extractScientist(
  state: GameState,
  rng: SeededRng,
  scientistId: string,
): GameEvent[] {
  const sci = state.campaign.scientists.find((s) => s.id === scientistId);
  if (!sci) throw new Error(`Unknown scientist: ${scientistId}`);
  if (sci.cityId !== state.locationId) {
    throw new Error("Scientist is not in this city");
  }
  if (!sci.revealed) throw new Error("Scientist not yet located — search first");
  if (sci.aboard || sci.delivered) throw new Error("Scientist already secured");
  if (sci.status === "hidden") {
    sci.aboard = true;
    return [ev(state, "scientist", `${sci.name} was already free to board.`)];
  }

  const cfg = campaignData.extract;
  const events: GameEvent[] = [];
  let chance = sci.status === "guarded" ? cfg.guardedBaseChance : cfg.factionBaseChance;
  const crew = livingCrew(state.crew);
  const combat = crew.reduce((s, c) => s + c.combat, 0);
  const leadership =
    crew.reduce((s, c) => s + c.leadership, 0) / Math.max(1, crew.length);

  if (sci.status === "guarded") {
    if (state.resources.ammunition < cfg.ammoCostGuarded) {
      throw new Error(
        `Need ${cfg.ammoCostGuarded} ammo to extract a guarded scientist`,
      );
    }
    state.resources.ammunition -= cfg.ammoCostGuarded;
    if (hasSpecialist(state.crew, "gunner")) chance += cfg.gunnerBonus;
    chance += combat * cfg.combatScale;
  } else {
    if (hasSpecialist(state.crew, "negotiator")) chance += cfg.negotiatorBonus;
    chance += leadership * cfg.leadershipScale;
  }

  if (rng.chance(Math.min(0.92, Math.max(0.08, chance)))) {
    sci.aboard = true;
    events.push(ev(state, "scientist", `Extracted ${sci.name} — now aboard.`));
    return events;
  }

  const dmg = rng.int(cfg.failDamageMin, cfg.failDamageMax);
  const victim = crew[rng.int(0, crew.length - 1)];
  if (victim) {
    victim.health -= dmg;
    clampHealth(victim);
    events.push(
      ev(state, "scientist", `Extraction failed. ${victim.name} took ${dmg} damage.`),
    );
  } else {
    events.push(ev(state, "scientist", "Extraction failed."));
  }
  return events;
}

export function deliverScientists(state: GameState): GameEvent[] {
  if (state.locationId !== state.campaign.bunkerCityId) {
    throw new Error("Not at the vaccine bunker");
  }
  if (!state.campaign.contactedFederal) {
    throw new Error(
      "No bunker mission yet — grow the gang until the remnant contacts you",
    );
  }
  const aboard = state.campaign.scientists.filter((s) => s.aboard && !s.delivered);
  if (aboard.length === 0) {
    throw new Error("No scientists aboard to deliver");
  }
  const events: GameEvent[] = [];
  for (const sci of aboard) {
    sci.aboard = false;
    sci.delivered = true;
    events.push(ev(state, "deliver", `Delivered ${sci.name} to the bunker.`));
  }

  if (state.campaign.scientists.every((s) => s.delivered)) {
    state.phase = "won";
    state.campaign.stage = "complete";
    events.push(ev(state, "win", campaignData.win.message));
  }
  return events;
}

export function campaignStatusView(state: GameState): CampaignStatusView {
  const sci = state.campaign.scientists;
  const bunkerId = state.campaign.contactedFederal ? state.campaign.bunkerCityId : null;
  const turnsRemaining =
    state.campaign.deadlineTurn !== null
      ? Math.max(0, state.campaign.deadlineTurn - state.turn)
      : null;
  return {
    stage: state.campaign.stage,
    contactedFederal: state.campaign.contactedFederal,
    bunkerCityId: bunkerId,
    bunkerName: bunkerId ? getCityDef(bunkerId).name : null,
    deadlineTurn: state.campaign.deadlineTurn,
    turnsRemaining,
    scientistsTotal: sci.length,
    scientistsRevealed: sci.filter((s) => s.revealed).length,
    scientistsAboard: sci.filter((s) => s.aboard).length,
    scientistsDelivered: sci.filter((s) => s.delivered).length,
    gangStrength: Math.round(gangStrength(state)),
    strengthThreshold: campaignData.federalContact.strengthThreshold,
    scientistsHere: sci
      .filter((s) => s.cityId === state.locationId)
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        revealed: s.revealed,
        aboard: s.aboard,
        delivered: s.delivered,
      })),
  };
}
