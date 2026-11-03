import { applyCommand } from "./commands";
import { createInitialState, deserializeState, serializeState } from "./state";
import type { CommandResult, GameCommand, GameState } from "./types";

/**
 * Thin mutable wrapper around immutable command application.
 * Safe for console runners and future UI binding.
 */
export class Game {
  private state: GameState;

  constructor(seedOrState: number | GameState) {
    this.state =
      typeof seedOrState === "number" ? createInitialState(seedOrState) : seedOrState;
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  /** Dispatch a command; on failure state is unchanged. */
  dispatch(command: GameCommand): CommandResult {
    const result = applyCommand(this.state, command);
    if (result.ok) {
      this.state = result.state;
    }
    return result;
  }

  toJSON(): string {
    return serializeState(this.state);
  }

  static fromJSON(json: string): Game {
    return new Game(deserializeState(json));
  }
}

export function runCommand(state: GameState, command: GameCommand): CommandResult {
  return applyCommand(state, command);
}
