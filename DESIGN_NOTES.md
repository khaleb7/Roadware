# Design notes

Working title lives in **one** config constant: `WORKING_TITLE` in `src/config.ts`. Product strings in Electron builder (`productName`) and `index.html` / `document.title` mirror that value; gameplay UI must import the constant.

## Stack choices

- **Phaser 3 + Vite + TypeScript strict** for the renderer; offline-only at runtime (no network calls from game code).
- **Electron** shells the game for a Windows desktop target; `contextIsolation` + `sandbox` on; empty preload bridge for now.
- **electron-builder** targets Windows x64 **NSIS** (installer) and **portable**. Full installer artifacts need Windows (or Wine).
- **Vitest** for unit tests of pure logic (`src/core`).
- **ESLint flat config + Prettier** for CI-ready lint/format.

## Architecture

| Path          | Role                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| `src/core/`   | Pure TS simulation — **no Phaser imports**                               |
| `src/scenes/` | Phaser scenes (Boot, MainMenu, StrategicMap, …)                          |
| `src/ui/`     | HTML/DOM helpers (status overlay)                                        |
| `data/`       | Balance, cities graph, terrain, factions, vehicle/specialist tables      |
| `electron/`   | Main process + preload                                                   |
| `assets/`     | Images/audio; `manifest.json` describes packs                            |
| `scripts/`    | Offline generators (e.g. `generate-cities.mjs`) — not shipped to runtime |

## Milestone 2 — simulation decisions

### Command model

- `GameState` is JSON-serializable. **All mutation goes through `applyCommand`** / `Game.dispatch`.
- **One command per turn**, except **`status`** (free).
- Command surface: `move`, `search`, `loot`, `retrieve`, `repair`, `heal`, `cache`, `rest`, `attack`, `status`, `scavengeVehicle`, `captureVehicle`.
- **attack** remains a stub pending Milestone 4 encounters.

### RNG

- **Mulberry32**; persist `rngState` for mid-run reproducibility. Campaign `seed` is for display / new games.

### Balance data only

- Rates, thresholds, XP, loot, travel, city generation, vehicle stats live under `/data` JSON.
- Core may know structural ids (`food`, `medic`, terrain ids) but not numeric balance literals.

### Resources & teeth

- Food upkeep → hunger → desertion → loss. Fuel/tire shortages **strand** movement only.

### Crew / vehicles

- Ratings + XP banks (no levels). Specialists as before. Vehicle cap from data.

## Milestone 3 — strategic map decisions

### City graph

- ~110 real continental U.S. cities in `data/cities.json` with highway edges, miles (haversine), and terrain tags.
- Regenerable via `node scripts/generate-cities.mjs` (committed JSON is the source of truth at runtime).
- Start city: **Denver, CO** (`denver-co`) — central hub for early routes.

### Terrain

- Types in `data/terrain.json`: highway, secondary, mountain, desert, coastal, ruined.
- Affect **fuel** (`fuelMultiplier / speedMultiplier`) and **tire wear chance** (scaled by miles). Move still costs **one turn** regardless of miles — speed is a cost modifier, not a multi-turn travel clock (keeps the one-command-per-turn loop readable for M3).

### Hidden city state

- Runtime `GameState.cities[id]` holds population, danger, faction, loot piles, vehicle yard, recruits, special locations.
- **Visit** (arrive via move, or start city): reveals population + danger.
- **Search**: reveals faction, loot, yard, recruits, specials; may hire a recruit; may skim city loot.
- **Loot**: drains revealed city loot when present; otherwise falls back to the generic table. **`retrieve`** is the explicit cache-pull alias (same handler as `loot` with `cacheId`).
- Unrevealed fields stay in state for determinism but status/UI shows `null` / "??".

### Status UI

- HTML overlay (`src/ui/statusOverlay.ts`) over a thin Phaser `StrategicMapScene` — intentional: full drawn map comes later; overlay keeps status readable now.
- Keyboard: `1` search, `2` loot, `3` rest, `4` attack, `M` move along first listed road, `S` refresh status.

### Fun + readable bias

- Short log lines; status lists roads with miles/terrain/fuel cost so moves feel informed.

## Clean-room

No original Roadwar 2000 / Roadwar Europa assets, dialogue, or proper names. Systems may be inspired by the genre (convoy, cities, road encounters) but content and naming are original.
