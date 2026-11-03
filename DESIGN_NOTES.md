# Design notes (early)

Working title lives in **one** config constant: `WORKING_TITLE` in `src/config.ts`. Product strings in Electron builder (`productName`) and `index.html` / `document.title` mirror that value for Milestone 1; gameplay UI must import the constant.

## Stack choices

- **Phaser 3 + Vite + TypeScript strict** for the renderer; offline-only at runtime (no network calls from game code).
- **Electron** shells the game for a Windows desktop target; `contextIsolation` + `sandbox` on; empty preload bridge for now.
- **electron-builder** targets Windows x64 **NSIS** (installer) and **portable**. Packaging is configured now; full installer artifacts require a Windows host (or wine tooling). Linux CI can still run lint, test, Vite build, and Electron main compile.
- **Vitest** for unit tests of pure logic (seeded sim comes in Milestone 2).
- **ESLint flat config + Prettier** for CI-ready lint/format.

## Architecture stubs

| Path          | Intended role                                      |
| ------------- | -------------------------------------------------- |
| `src/core/`   | Simulation: convoy, map graph, combat resolve, RNG |
| `src/scenes/` | Phaser scenes (Boot, MainMenu, Map, Combat, …)     |
| `src/ui/`     | Reusable UI helpers / HUD widgets                  |
| `data/`       | JSON/TS tables (cities, vehicles, loot)            |
| `electron/`   | Main process + preload                             |
| `assets/`     | Images/audio; `manifest.json` describes packs      |

## Clean-room

No original Roadwar 2000 / Roadwar Europa assets, dialogue, or proper names. Systems may be inspired by the genre (convoy, cities, road encounters) but content and naming are original.
