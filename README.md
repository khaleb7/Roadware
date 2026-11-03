# ASPHALT DOMINION

Offline convoy strategy game (working title). Clean-room original — no original Roadwar assets, text, or names.

**Milestone 7:** art/audio polish, versioned save/load + autosave, settings (fullscreen / 1080p FIT), Classic vs Road-Weary, mouse-first UI with tooltips, log, staged undo, tutorial tips.

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

Main menu: **New Game** (pick Classic / Road-Weary), **Continue** (autosave), **Load**, **Settings**.

Strategic overlay is mouse-first (action buttons + road buttons). Stage a choice, then **Enter** to commit or **U** / **Esc** to undo before the turn advances. Keys still work: `1` search, `2` loot, `3` rest, `4` attack, `M` move, `S` refresh, `X` extract, `D` deliver; encounters `F`/`V`/`E`/`N`/`T`.

Saves: Electron → `%APPDATA%/<app>/saves/` (via `userData`); web/dev → `localStorage`. Slot 0 autosaves each turn.

Headless sim:

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
src/core/           Pure simulation (RNG, map, encounters, tactical, campaign, difficulty)
src/art/            Palette + procedural textures
src/audio/          Procedural SFX hooks
src/persistence/    Versioned saves + settings store (Electron / localStorage)
src/settings/       Settings types/defaults
src/scenes/         Boot, MainMenu, Settings, StrategicMap, TacticalCombat
src/ui/             Status overlay (mouse + tooltips + tutorial)
data/               balance, cities, difficulty, settings-defaults, campaign, …
electron/           Main + preload (userData IPC)
assets/             SVG + manifest.json (Vite publicDir)
```

## Connecting a GitHub remote (later)

```bash
git remote add origin git@github.com:<org-or-user>/<repo>.git
git push -u origin HEAD
```

## License / credits

See `CREDITS.md`. Design decisions: `DESIGN_NOTES.md`.
