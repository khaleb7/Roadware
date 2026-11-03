import type { DifficultyId } from "../difficulty";
import { Game } from "../game";
import type { GameState } from "../types";
import { chooseCommand } from "./aiPolicy";

export interface PlayResult {
  seed: number;
  difficulty: DifficultyId;
  phase: GameState["phase"];
  turns: number;
  lossReason: string | null;
  contacted: boolean;
  scientistsDelivered: number;
  scientistsTotal: number;
  crewEnd: number;
  outcome: "won" | "lost" | "timeout";
  lossKind: "wipe" | "leader" | "deadline" | "timeout" | "none" | "other";
}

export interface PlayOptions {
  seed: number;
  difficulty?: DifficultyId;
  maxTurns?: number;
}

function classifyLoss(reason: string | null): PlayResult["lossKind"] {
  if (!reason) return "none";
  const r = reason.toLowerCase();
  if (r.includes("wiped") || r.includes("gang wiped")) return "wipe";
  if (r.includes("leader")) return "leader";
  if (r.includes("deadline")) return "deadline";
  return "other";
}

/** Play one seeded game with the simple AI until win/loss/timeout. */
export function playSeededGame(options: PlayOptions): PlayResult {
  const difficulty = options.difficulty ?? "classic";
  const maxTurns = options.maxTurns ?? 400;
  const game = Game.newGame(options.seed, difficulty);

  let guard = 0;
  const maxSteps = maxTurns * 4; // tactical / failed cmds safety

  while (game.getState().phase === "playing" && game.getState().turn <= maxTurns) {
    guard += 1;
    if (guard > maxSteps) break;

    const cmd = chooseCommand(game.getState() as GameState);
    if (!cmd) break;

    const beforeTurn = game.getState().turn;
    const beforePhase = game.getState().phase;
    const result = game.dispatch(cmd);

    if (!result.ok) {
      // Stuck encounter (e.g. trade without food) — force evade/fight
      if (game.getState().pendingEncounter) {
        const forced = game.dispatch({
          type: "resolveEncounter",
          action: "evade",
        });
        if (!forced.ok) {
          game.dispatch({
            type: "resolveEncounter",
            action: "fight",
            mode: "quick",
          });
        }
        continue;
      }
      // Can't afford move / other failure — forage or loot instead of spinning
      const salvage =
        game.dispatch({ type: "loot" }).ok ||
        game.dispatch({ type: "search" }).ok ||
        game.dispatch({ type: "rest" }).ok;
      if (!salvage || game.getState().turn === beforeTurn) {
        break;
      }
      continue;
    }

    if (
      game.getState().phase === beforePhase &&
      game.getState().turn === beforeTurn &&
      !game.getState().pendingEncounter &&
      !game.getState().tacticalBattle
    ) {
      // Command did not advance and no encounter — force rest to avoid stall
      game.dispatch({ type: "rest" });
    }
  }

  const s = game.getState();
  const delivered = s.campaign.scientists.filter((x) => x.delivered).length;
  const outcome: PlayResult["outcome"] =
    s.phase === "won" ? "won" : s.phase === "lost" ? "lost" : "timeout";

  return {
    seed: options.seed,
    difficulty,
    phase: s.phase,
    turns: s.turn,
    lossReason: s.lossReason,
    contacted: s.campaign.contactedFederal,
    scientistsDelivered: delivered,
    scientistsTotal: s.campaign.scientists.length,
    crewEnd: s.crew.length,
    outcome,
    lossKind:
      outcome === "timeout"
        ? "timeout"
        : outcome === "won"
          ? "none"
          : classifyLoss(s.lossReason),
  };
}
