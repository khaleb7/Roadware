# ASPHALT DOMINION

Offline convoy strategy game (working title). Clean-room original — no original Roadwar assets, text, or names.

**Milestone 4:** road/city encounters with original factions, fight/evade/negotiate/trade resolves, and seeded quick-resolve battle reports. Built on the M3 continental map + M2 core sim.

## Requirements (Windows)

- [Node.js LTS](https://nodejs.org/) **20+** (see `.nvmrc`)
- npm (bundled with Node)
- Windows x64 for producing NSIS / portable installers via `npm run dist`

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Press any key on the main menu to open the strategic map (starts in Denver). Status overlay keys: `1` search, `2` loot, `3` rest, `4` attack, `M` move, `S` refresh. When an encounter is pending: `F` fight, `E` evade, `N` negotiate, `T` trade.

Headless sim:

```bash
npm run sim
npm run sim -- 12345
```

Regenerate the city graph (optional; committed `data/cities.json` is used at runtime):

```bash
node scripts/generate-cities.mjs
```

## Scripts

| Command             | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Electron + Vite hot reload                                       |
| `npm run sim`       | Console runner for the core simulation                           |
| `npm run build`     | Typecheck renderer, Vite production build, compile Electron main |
| `npm run dist`      | Build + package Windows x64 NSIS installer and portable exe      |
| `npm run lint`      | ESLint                                                           |
| `npm test`          | Vitest (CI-friendly, single run)                                 |
| `npm run typecheck` | Strict TypeScript for renderer and Electron                      |
| `npm run format`    | Prettier write                                                   |

## Project layout

```
src/core/     Pure simulation (RNG, commands, map, encounters, quick combat)
src/scenes/   Phaser scenes (Boot, MainMenu, StrategicMap)
src/ui/       HTML status / encounter overlay
data/         balance, cities, terrain, factions, encounters, vehicle/specialist tables
scripts/      City graph generator
electron/     Electron main + preload
assets/       Runtime assets + manifest.json
```

Balance, map, and encounter numbers belong in `/data/*.json` — keep them out of `src/core` logic.

## Connecting a GitHub remote (later)

```bash
git remote add origin git@github.com:<org-or-user>/<repo>.git
git push -u origin HEAD
```

## License / credits

See `CREDITS.md`. Design decisions: `DESIGN_NOTES.md`.
