# ASPHALT DOMINION

Offline convoy strategy game (working title). Clean-room original — no original Roadwar assets, text, or names.

Milestone 1: Vite + TypeScript + Phaser 3 + Electron scaffold with Boot / Main Menu scenes.

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

## Scripts

| Command             | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Electron + Vite hot reload                                       |
| `npm run build`     | Typecheck renderer, Vite production build, compile Electron main |
| `npm run dist`      | Build + package Windows x64 NSIS installer and portable exe      |
| `npm run lint`      | ESLint                                                           |
| `npm test`          | Vitest (CI-friendly, single run)                                 |
| `npm run typecheck` | Strict TypeScript for renderer and Electron                      |
| `npm run format`    | Prettier write                                                   |

## Project layout

```
src/          Phaser game (scenes, core sim, ui)
electron/     Electron main + preload
data/         Static game data (tables, defs)
assets/       Runtime assets + manifest.json
dist/         Vite renderer output
dist-electron/ Compiled Electron main process
release/      electron-builder output (Windows)
```

## Connecting a GitHub remote (later)

This repo was initialized locally with no remote. When you have a GitHub repo:

```bash
git remote add origin git@github.com:<org-or-user>/<repo>.git
git push -u origin cursor/milestone-1-scaffold-16dd
```

Then open a PR from that branch against your default branch as usual.

## License / credits

See `CREDITS.md`. Design decisions: `DESIGN_NOTES.md`.
