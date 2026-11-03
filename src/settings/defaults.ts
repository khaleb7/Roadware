import defaultsJson from "../../data/settings-defaults.json";
import type { GameSettings } from "./types";

export const SETTINGS_DEFAULTS: GameSettings = {
  ...(defaultsJson as GameSettings),
};

export function mergeSettings(partial: Partial<GameSettings> | null | undefined): GameSettings {
  return { ...SETTINGS_DEFAULTS, ...(partial ?? {}) };
}
