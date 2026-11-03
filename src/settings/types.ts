export interface GameSettings {
  fullscreen: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  showTutorialTips: boolean;
  showStatTooltips: boolean;
  autosave: boolean;
  /** Logical design resolution — scale mode FIT keeps this independent of window. */
  targetWidth: number;
  targetHeight: number;
}
