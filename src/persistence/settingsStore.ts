import { mergeSettings, SETTINGS_DEFAULTS } from "../settings/defaults";
import type { GameSettings } from "../settings/types";
import { readText, setFullscreen, writeText } from "./storage";

const SETTINGS_PATH = "settings.json";

export async function loadSettings(): Promise<GameSettings> {
  const text = await readText(SETTINGS_PATH);
  if (!text) return { ...SETTINGS_DEFAULTS };
  try {
    return mergeSettings(JSON.parse(text) as Partial<GameSettings>);
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export async function saveSettings(settings: GameSettings): Promise<boolean> {
  return writeText(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function applyDisplaySettings(settings: GameSettings): Promise<void> {
  await setFullscreen(settings.fullscreen);
}
