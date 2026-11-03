import type { DifficultyId } from "./difficulty";
import { applyCommand } from "./commands";
import {
  createInitialState,
  deserializeState,
  serializeState,
  type NewGameOptions,
} from "./state";
import { clearStaged, stageChoice, type StagedChoice } from "./undo";
import type { CommandResult, GameCommand, GameState } from "./types";

export interface GameConstructOptions extends NewGameOptions {
  seed?: number;
}

function isGameState(value: object): value is GameState {
  return (
    "crew" in value &&
    Array.isArray((value as GameState).crew) &&
    "turn" in value &&
    typeof (value as GameState).turn === "number" &&
    "resources" in value
  );
}

/**
 * Thin mutable wrapper around immutable command application.
 * Supports staged menu choices (undo before turn commit).
 */
export class Game {
  private state: GameState;
  private staged: StagedChoice | null = null;

  constructor(seedOrState: number | GameState | GameConstructOptions = 2026) {
    if (typeof seedOrState === "number") {
      this.state = createInitialState(seedOrState);
    } else if (isGameState(seedOrState)) {
      this.state = seedOrState;
    } else {
      const opts: NewGameOptions = {};
      if (seedOrState.difficulty) opts.difficulty = seedOrState.difficulty;
      this.state = createInitialState(seedOrState.seed ?? 2026, opts);
    }
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  getStaged(): StagedChoice | null {
    return this.staged;
  }

  /** Stage a command for confirm/undo without mutating sim state yet. */
  stage(command: GameCommand, label: string): StagedChoice {
    this.staged = stageChoice(this.state, command, label);
    return this.staged;
  }

  undoStage(): void {
    this.staged = clearStaged();
  }

  /** Commit staged command, or return null if none staged. */
  confirmStage(): CommandResult | null {
    if (!this.staged) return null;
    const cmd = this.staged.command;
    this.staged = null;
    return this.dispatch(cmd);
  }

  /** Dispatch a command; on failure state is unchanged. Status does not clear staging. */
  dispatch(command: GameCommand): CommandResult {
    if (command.type !== "status") {
      this.staged = null;
    }
    const result = applyCommand(this.state, command);
    if (result.ok && command.type !== "status") {
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

  static newGame(seed: number, difficulty: DifficultyId = "classic"): Game {
    return new Game({ seed, difficulty });
  }
}

export function runCommand(state: GameState, command: GameCommand): CommandResult {
  return applyCommand(state, command);
}
