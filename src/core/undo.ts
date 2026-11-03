import { cloneState } from "./state";
import type { GameCommand, GameState } from "./types";

/**
 * Stage a menu choice before turn commit. Player can undo (clear) the draft
 * without mutating sim state; confirming applies the command once.
 */
export interface StagedChoice {
  command: GameCommand;
  label: string;
  snapshot: GameState;
}

export function stageChoice(
  state: GameState,
  command: GameCommand,
  label: string,
): StagedChoice {
  return {
    command,
    label,
    snapshot: cloneState(state),
  };
}

export function clearStaged(): null {
  return null;
}
