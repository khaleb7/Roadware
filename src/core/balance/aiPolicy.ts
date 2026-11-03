import { livingCrew, hasSpecialist } from "../crew";
import { gangStrength, meetsFederalContactThreshold } from "../campaign";
import { computeTravelCost, findRoad, getNeighbors, nextHop } from "../map";
import type { GameCommand, GameState, Resources } from "../types";

/**
 * Survival-first AI for balance sims.
 * Stocks food before long scientist hauls; protects the leader; evades when hurt.
 */
export function chooseCommand(state: GameState): GameCommand | null {
  if (state.phase !== "playing") return null;
  if (state.tacticalBattle) return chooseTactical(state);
  if (state.pendingEncounter) return chooseEncounter(state);

  const crew = livingCrew(state.crew);
  const crewN = Math.max(1, crew.length);
  const food = state.resources.food;
  const city = state.cities[state.locationId];
  const leader = crew.find((c) => c.id === state.campaign.leaderCrewId);
  const criticalFood = food < crewN;
  const lowFood = food < crewN * 4;
  const stocked = food >= crewN * 6;
  const canTravel = food >= Math.ceil(crewN * 0.5);

  // Protect leader
  if (leader && leader.health < 70 && state.resources.medicine > 0) {
    return { type: "heal", crewId: leader.id };
  }

  // Only hard-interrupt the mission when critically out of rations
  if (criticalFood) {
    const foodCmd = chooseFood(state);
    if (foodCmd) return foodCmd;
  }

  // Bank scientists at bunker whenever carrying any and stocked enough to reach
  const aboard = state.campaign.scientists.filter((s) => s.aboard && !s.delivered);
  if (
    state.campaign.contactedFederal &&
    state.locationId === state.campaign.bunkerCityId &&
    aboard.length > 0
  ) {
    return { type: "deliverScientists" };
  }

  // Act on scientists in this city
  const here = state.campaign.scientists.filter(
    (s) => s.cityId === state.locationId && !s.delivered && !s.aboard,
  );
  for (const sci of here) {
    if (sci.revealed) return { type: "extractScientist", scientistId: sci.id };
  }
  if (here.some((s) => !s.revealed)) return { type: "search" };

  // Heal others / repair when safe
  if (!lowFood) {
    const wounded = crew.find((c) => c.health < 55);
    if (wounded && state.resources.medicine > 0) {
      return { type: "heal", crewId: wounded.id };
    }
    const damaged = state.vehicles.find((v) => v.durability < v.maxDurability * 0.45);
    if (damaged && state.resources.spareParts > 0) {
      return { type: "repair", vehicleId: damaged.id };
    }
  }

  // Light stockpile only at mission start (no scientists secured yet)
  if (
    state.campaign.contactedFederal &&
    !stocked &&
    aboard.length === 0 &&
    state.campaign.scientists.every((s) => !s.delivered)
  ) {
    const foodCmd = chooseFood(state);
    if (foodCmd) return foodCmd;
  }

  if (state.campaign.contactedFederal && canTravel) {
    const pendingLeft = state.campaign.scientists.filter(
      (s) => !s.delivered && !s.aboard,
    ).length;
    const deadlineSoon =
      state.campaign.deadlineTurn !== null &&
      state.campaign.deadlineTurn - state.turn <= 60;
    const shouldBank =
      aboard.length > 0 &&
      (aboard.length >= 2 ||
        pendingLeft === 0 ||
        deadlineSoon ||
        (aboard.length >= 1 && lowFood));

    // Hunt next scientist when not banking
    if (!shouldBank) {
      const target = pickScientistTarget(state);
      if (target && target !== state.locationId) {
        const hop = nextHop(state.locationId, target);
        if (hop && canAffordMove(state, hop)) {
          return { type: "move", destinationId: hop };
        }
      }
    }

    // Bank at bunker
    if (aboard.length > 0) {
      const hop = nextHop(state.locationId, state.campaign.bunkerCityId);
      if (hop && canAffordMove(state, hop)) {
        return { type: "move", destinationId: hop };
      }
    }

    // Continue hunt if empty-handed
    const target = pickScientistTarget(state);
    if (target && target !== state.locationId) {
      const hop = nextHop(state.locationId, target);
      if (hop && canAffordMove(state, hop)) {
        return { type: "move", destinationId: hop };
      }
    }
  }

  // Fuel-stranded: search (guaranteed fuel siphon) or loot — avoid rest-loops
  if (!canAffordAnyMove(state)) {
    if (city && city.revealed.loot && resourceOf(city.loot, "fuel") > 0) {
      return { type: "loot" };
    }
    // Re-search for siphon even if already searched
    return { type: "search" };
  }

  // Grow toward contact (avoid hiring when food tight)
  if (!meetsFederalContactThreshold(state) && !lowFood) {
    const grow = chooseGrowth(state);
    if (grow) return grow;
  }

  if (city && !city.searched) return { type: "search" };
  if (city && city.revealed.loot && sumLoot(city.loot) > 0) return { type: "loot" };

  return chooseRoam(state) ?? { type: "rest" };
}

function canAffordAnyMove(state: GameState): boolean {
  return getNeighbors(state.locationId).some((n) => canAffordMove(state, n.to));
}

function chooseFood(state: GameState): GameCommand | null {
  const city = state.cities[state.locationId];
  // Need fuel for the next hop — loot/search for fuel too
  if (state.resources.fuel < 8) {
    if (city && !city.searched) return { type: "search" };
    if (city && city.revealed.loot && resourceOf(city.loot, "fuel") > 0) {
      return { type: "loot" };
    }
  }
  if (city && !city.searched) return { type: "search" };
  if (city && city.revealed.loot && resourceOf(city.loot, "food") > 0) {
    return { type: "loot" };
  }
  // Forage via rest when the city is dry — guaranteed food from balance.rest
  if (city?.searched && state.resources.food < livingCrew(state.crew).length * 2) {
    return { type: "rest" };
  }
  const hop = moveTowardFood(state);
  if (hop) return hop;
  if (city && city.revealed.loot && sumLoot(city.loot) > 0) return { type: "loot" };
  return { type: "rest" };
}

function chooseEncounter(state: GameState): GameCommand {
  const pending = state.pendingEncounter!;
  const actions = pending.actions;
  const crew = livingCrew(state.crew);
  const leader = crew.find((c) => c.id === state.campaign.leaderCrewId);
  const strength = gangStrength(state);
  const lowFood = state.resources.food < crew.length * 4;
  const hurt = Boolean(leader && leader.health < 75) || crew.some((c) => c.health < 45);
  const outgunned = pending.strength > strength * 0.65;

  // Prefer non-lethal resolutions — simple AI dies too often in fights
  if (actions.includes("trade") && state.resources.food >= 4 && lowFood) {
    return { type: "resolveEncounter", action: "trade" };
  }
  if (actions.includes("evade") && (hurt || lowFood || outgunned || !actions.includes("negotiate"))) {
    return { type: "resolveEncounter", action: "evade" };
  }
  if (actions.includes("negotiate")) {
    return { type: "resolveEncounter", action: "negotiate" };
  }
  if (actions.includes("evade")) {
    return { type: "resolveEncounter", action: "evade" };
  }
  if (actions.includes("fight")) {
    return { type: "resolveEncounter", action: "fight", mode: "quick" };
  }
  return { type: "resolveEncounter", action: actions[0]! };
}

function chooseTactical(state: GameState): GameCommand {
  const battle = state.tacticalBattle!;
  if (battle.phase === "deploy") {
    const undeployed = battle.units.some((u) => u.side === "player" && !u.deployed);
    if (undeployed) return { type: "tactical", action: { type: "autoDeploy" } };
    return { type: "tactical", action: { type: "beginCombat" } };
  }
  return { type: "tactical", action: { type: "fleeQuick" } };
}

function chooseGrowth(state: GameState): GameCommand | null {
  const city = state.cities[state.locationId];
  if (!city) return null;

  if (state.vehicles.length < 3) {
    if (city.revealed.vehicles && city.vehicleYard.length > 0) {
      return { type: "scavengeVehicle" };
    }
    if (!city.searched) return { type: "search" };
  }

  // Only recruit if food can support another mouth
  if (
    livingCrew(state.crew).length < 7 &&
    state.resources.food >= livingCrew(state.crew).length * 10
  ) {
    if (!city.searched) return { type: "search" };
  }

  if (!city.searched) return { type: "search" };
  if (city.revealed.loot && sumLoot(city.loot) > 0) return { type: "loot" };

  const target = findGrowthCity(state);
  if (target) {
    const hop = nextHop(state.locationId, target);
    if (hop && canAffordMove(state, hop)) return { type: "move", destinationId: hop };
  }
  return chooseRoam(state);
}

function pickScientistTarget(state: GameState): string | null {
  const pending = state.campaign.scientists.filter((s) => !s.delivered && !s.aboard);
  if (pending.length === 0) return state.campaign.bunkerCityId;

  const revealed = pending.filter((s) => s.revealed);
  const pool = revealed.length > 0 ? revealed : pending;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const sci of pool) {
    const dist = estimateDist(state.locationId, sci.cityId);
    if (dist < bestDist) {
      bestDist = dist;
      best = sci.cityId;
    }
  }
  return best;
}

function moveTowardFood(state: GameState): GameCommand | null {
  const neighbors = getNeighbors(state.locationId);
  const ranked = [...neighbors].sort((a, b) => scoreFoodCity(state, b.to) - scoreFoodCity(state, a.to) || a.miles - b.miles);
  for (const n of ranked) {
    if (canAffordMove(state, n.to)) return { type: "move", destinationId: n.to };
  }
  return null;
}

function scoreFoodCity(state: GameState, id: string): number {
  const c = state.cities[id];
  if (!c) return 0;
  return (
    (!c.visited ? 3 : 0) +
    (!c.searched ? 4 : 0) +
    (resourceOf(c.loot, "food") > 0 ? 6 : 0) +
    (c.danger <= 4 ? 1 : 0)
  );
}

function findGrowthCity(state: GameState): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const city of Object.values(state.cities)) {
    if (city.id === state.locationId) continue;
    let score = scoreFoodCity(state, city.id);
    if (city.revealed.vehicles && city.vehicleYard.length > 0) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = city.id;
    }
  }
  return bestScore > 0 ? best : null;
}

function estimateDist(from: string, to: string): number {
  if (from === to) return 0;
  const seen = new Set<string>([from]);
  const q: Array<{ id: string; d: number }> = [{ id: from, d: 0 }];
  while (q.length > 0) {
    const cur = q.shift()!;
    for (const n of getNeighbors(cur.id)) {
      if (seen.has(n.to)) continue;
      if (n.to === to) return cur.d + 1;
      seen.add(n.to);
      q.push({ id: n.to, d: cur.d + 1 });
    }
  }
  return 999;
}

function chooseRoam(state: GameState): GameCommand | null {
  const neighbors = getNeighbors(state.locationId);
  if (neighbors.length === 0) return null;
  const unvisited = neighbors.filter((n) => !state.cities[n.to]?.visited);
  const pool = unvisited.length > 0 ? unvisited : neighbors;
  const sorted = [...pool].sort((a, b) => {
    const da = state.cities[a.to]?.danger ?? 5;
    const db = state.cities[b.to]?.danger ?? 5;
    return da - db || a.miles - b.miles;
  });
  for (const n of sorted) {
    if (canAffordMove(state, n.to)) return { type: "move", destinationId: n.to };
  }
  return null;
}

function canAffordMove(state: GameState, destinationId: string): boolean {
  if (state.stranded) return false;
  if (state.resources.tires < 1) return false;
  const road = findRoad(state.locationId, destinationId);
  if (!road) return false;
  const hasDriver = hasSpecialist(state.crew, "driver");
  const { fuelCost } = computeTravelCost(state, road.miles, road.terrain, hasDriver);
  return state.resources.fuel >= fuelCost;
}

function sumLoot(loot: Resources): number {
  return Object.values(loot).reduce((s, v) => s + (v > 0 ? v : 0), 0);
}

function resourceOf(loot: Partial<Resources>, id: keyof Resources): number {
  return loot[id] ?? 0;
}
