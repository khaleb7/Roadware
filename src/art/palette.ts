/**
 * Clean-room post-collapse palette — rust / sand / oil / amber / faded green.
 * Sourced from assets/manifest.json conceptually; kept as constants for runtime.
 */
export const PALETTE = {
  rust: 0x8b4513,
  sand: 0xc2a878,
  oil: 0x1a1c1e,
  amber: 0xd4a017,
  fadedGreen: 0x6b7f5a,
  asphalt: 0x2a2e32,
  dust: 0xa89878,
  bloodRust: 0x6a2e1f,
  chrome: 0x9aa3ad,
  night: 0x0b0d10,
} as const;

export const PALETTE_CSS = {
  rust: "#8B4513",
  sand: "#C2A878",
  oil: "#1A1C1E",
  amber: "#D4A017",
  fadedGreen: "#6B7F5A",
  asphalt: "#2A2E32",
  dust: "#A89878",
  bloodRust: "#6A2E1F",
  chrome: "#9AA3AD",
  night: "#0B0D10",
} as const;

export type PaletteKey = keyof typeof PALETTE;
