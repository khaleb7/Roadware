# Design notes

Working title lives in **one** config constant: `WORKING_TITLE` in `src/config.ts`. Product strings in Electron builder (`productName`) and `index.html` / `document.title` mirror that value for Milestone 1; gameplay UI must import the constant.

## Stack choices

- **Phaser 3 + Vite + TypeScript strict** for the renderer; offline-only at runtime (no network calls from game code).
- **Electron** shells the game for a Windows desktop target; `contextIsolation` + `sandbox` on; empty preload bridge for now.
- **electron-builder** targets Windows x64 **NSIS** (installer) and **portable**. Packaging is configured now; full installer artifacts require a Windows host (or wine tooling). Linux CI can still run lint, test, Vite build, and Electron main compile.
- **Vitest** for unit tests of pure logic (`src/core`).
- **ESLint flat config + Prettier** for CI-ready lint/format.

## Architecture

| Path          | Role                                                         |
| ------------- | ------------------------------------------------------------ |
| `src/core/`   | Pure TS simulation — **no Phaser imports**                   |
| `src/scenes/` | Phaser scenes (Boot, MainMenu, Map, Combat, …)               |
| `src/ui/`     | Reusable UI helpers / HUD widgets                            |
| `data/`       | Balance + tables (`balance.json`, `vehicle-classes.json`, …) |
| `electron/`   | Main process + preload                                       |
| `assets/`     | Images/audio; `manifest.json` describes packs                |

## Milestone 2 — simulation decisions

### Command model

- `GameState` is a plain JSON-serializable object. **All mutation goes through `applyCommand`** (or `Game.dispatch`), which clones, mutates the clone, and returns a new state.
- **One command per turn**, except **`status`**, which is free (no upkeep, no turn advance) so the UI/debug runner can inspect without burning a day.
- Command surface: `move`, `search`, `loot`, `repair`, `heal`, `cache`, `rest`, `attack`, `status`, plus stubs `scavengeVehicle` / `captureVehicle`.
- Strategic **move** uses a tiny stub map in `data/balance.json` (`stubMap`). Real map travel arrives in Milestone 3.
- **attack** is a stub: spends ammo, rolls a data-driven victory chance, grants combat XP. Full encounter/tactical combat comes later.

### RNG

- **Mulberry32** in `src/core/rng.ts`. One instance is rehydrated from `GameState.rngState` each command and written back afterward.
- Campaign `seed` is preserved for display / new-game replay; **saves must persist `rngState`** for mid-run reproducibility.

### Balance data only

- Numeric rates, thresholds, XP, loot tables, starting convoy, vehicle stats, and specialist metadata live under `/data` JSON.
- Core logic may know **structural** ids (`food`, `medic`, command type names) but not balance literals (costs, chances, caps). Caps like `maxVehicles` are read from JSON.

### Resources & teeth

- Resources: food, fuel, tires, medicine, guns, ammunition, spare parts.
- Every turn-consuming command runs **end-of-turn upkeep**: food per living crew. Shortfall raises `hungerStreak`, deals survival damage, and rolls **desertion**. Empty roster → `phase: "lost"`.
- **Stranded**: move fails (and sets `stranded`) with insufficient fuel or zero tires. Search/loot/rest still possible so the player can dig out.

### Crew

- Ratings: **combat / survival / leadership** (no class levels). **XP banks** convert into rating bumps via thresholds in `balance.experience`.
- Specialists: medic, mechanic, driver, scout, negotiator, gunner, plus a **leader** role for the starting convoy captain (flavor + future leadership hooks).

### Vehicles

- Cap `maxVehicles` from data (15). Classes and stats in `vehicle-classes.json`. Scavenge/capture are stubs that add a vehicle when under cap.

### Fun + readable bias

- Prefer short event messages on the state log over opaque codes.
- Failures return `{ ok: false, error }` without mutating state — easier to bind to UI.

## Clean-room

No original Roadwar 2000 / Roadwar Europa assets, dialogue, or proper names. Systems may be inspired by the genre (convoy, cities, road encounters) but content and naming are original.
