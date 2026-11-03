import { applyCampaignUpkeep, campaignData } from "./campaign";
import { balance } from "./data";
import { clampHealth, grantXp, livingCrew } from "./crew";
import type { SeededRng } from "./rng";
import type { GameEvent, GameState } from "./types";

/**
 * End-of-turn upkeep: food burn, hunger, desertion, campaign hooks.
 * Call after a turn-consuming command succeeds. Does not mutate the log —
 * the command dispatcher appends returned events.
 */
export function applyEndOfTurn(state: GameState, rng: SeededRng): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.phase !== "playing") return events;

  const alive = livingCrew(state.crew);
  const foodNeeded = balance.consumption.foodPerCrewPerTurn * alive.length;
  const foodAvailable = state.resources.food;
  const fed = Math.min(foodAvailable, foodNeeded);
  state.resources.food -= fed;

  if (fed < foodNeeded) {
    state.hungerStreak += 1;
    const shortfall = foodNeeded - fed;
    events.push(
      event(
        state,
        "hunger",
        `Rations short by ${shortfall}. Hunger streak ${state.hungerStreak}.`,
      ),
    );

    for (const member of alive) {
      member.health -= balance.starvation.healthLossWhenHungry;
      clampHealth(member);
      grantXp(member, balance.experience.surviveHungryTurnXp, {
        survival: balance.experience.surviveHungryTurnXp,
        combat: 0,
        leadership: 0,
      });
    }

    if (state.hungerStreak >= balance.starvation.hungerStreakBeforeDesertion) {
      const stillAlive = livingCrew(state.crew);
      for (const member of [...stillAlive]) {
        if (rng.chance(balance.starvation.desertionChancePerHungryCrew)) {
          member.health = 0;
          events.push(
            event(
              state,
              "desertion",
              `${member.name} walks into the dust (desertion).`,
            ),
          );
        }
      }
    }
  } else {
    state.hungerStreak = 0;
  }

  const before = state.crew.length;
  state.crew = state.crew.filter((c) => c.health > 0);
  if (state.crew.length < before) {
    events.push(
      event(state, "roster", `Roster down to ${state.crew.length} after losses.`),
    );
  }

  if (state.crew.length === 0) {
    state.phase = "lost";
    state.lossReason = campaignData.loss.wiped;
    events.push(event(state, "loss", state.lossReason));
    return events;
  }

  events.push(...applyCampaignUpkeep(state));
  return events;
}

function event(state: GameState, kind: string, message: string): GameEvent {
  return { turn: state.turn, kind, message };
}
