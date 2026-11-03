# ASPHALT DOMINION

Offline convoy strategy game (working title). Clean-room original — no original Roadwar assets, text, or names.

**Milestone 2:** pure TypeScript core simulation (seeded RNG, resources, crew, vehicles, command turn loop) under `src/core`, with Vitest coverage. Phaser UI remains the Milestone 1 Boot / Main Menu shell.

## Requirements (Windows)

- [Node.js LTS](https://nodejs.org/) **20+** (see `.nvmrc`)
- npm (bundled with Node)
- Windows x64 for producing NSIS / portable installers via `npm run dist`

## Setup

```bash
npm install
```

## Development

Opens an Electron window loading the Vite dev server:

```bash
npm run dev
```

Headless sim smoke (no window):

```bash
npm run sim
npm run sim -- 12345
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
src/core/     Pure simulation (no Phaser) — state, RNG, commands
src/scenes/   Phaser scenes
src/ui/       UI helpers (stub)
data/         Balance + vehicle/specialist tables (JSON)
electron/     Electron main + preload
assets/       Runtime assets + manifest.json
dist/         Vite renderer output
dist-electron/ Compiled Electron main process
release/      electron-builder output (Windows)
```

Balance numbers belong in `/data/*.json` — keep them out of `src/core` logic.

## Connecting a GitHub remote (later)

This repo was initialized locally with no remote. When you have a GitHub repo:

```bash
git remote add origin git@github.com:<org-or-user>/<repo>.git
git push -u origin HEAD
```

Then open a PR against your default branch as usual.

## License / credits

See `CREDITS.md`. Design decisions: `DESIGN_NOTES.md`.
