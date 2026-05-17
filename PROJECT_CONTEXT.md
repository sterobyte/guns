# GUNS Project Context

Use this file when continuing the project in a fresh Codex chat.

> This file is older historical context. For current state and handoff instructions, read `NEXT_CHAT_HANDOFF.md` first.

## Current project

- Workspace: `C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1`
- Repository: `https://github.com/sterobyte/guns`
- Public site target: `https://guns.gs`
- Current deployed/local version: `0.11.3`
- Main branch: `main`

## Local run

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
npm run dev:all
```

URLs:

- Game: `http://127.0.0.1:5178/`
- Backend health: `http://127.0.0.1:3000/health`
- Admin panel: `http://127.0.0.1:5179/`

Stop local stack:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
stop-local.cmd
```

Check syntax:

```cmd
npm run check
```

## Current architecture

- The active game runtime is `src/legacy/gunsdemo22-runtime.js`.
- `gunsdemo22-runtime.js` is still the main canvas game engine: arena, physics, bots, player, bullets, fly mode, scoring, FPS, death flow.
- `src/legacy/gunsdemo22-original.html` is archival source, not the active runtime.
- `index.html` loads the game, start screen, network adapter, config, i18n, and runtime.
- Backend lives in `server/`.
- Admin panel is a separate local project at sibling path `..\guns-panel`.

## Product direction

We are moving from “one game file” toward a modular engine:

- Canvas game engine stays for the battle arena.
- React may be useful later for admin/account/shop UI, not for 60 FPS arena rendering.
- Future target structure:
  - game client / canvas engine
  - authoritative multiplayer backend
  - database
  - admin panel as object/room/mode constructor
  - shared configs/types
- Long-term core idea: build an engine and assemble the game through admin-controlled objects, rooms, skins, physics, modes, users.

## Important product rules

- Pilots and cannons are separate entities.
- Pilots can be human-controlled or bot-controlled.
- Cannons are tools/vehicles, not players.
- Current public service nickname is exactly `CADET`.
- Any free visible nickname can eventually be used/claimed except reserved service behavior around plain `CADET`.
- Multilogin into the same claimed account is allowed.
- Multi-registration from the same browser device is blocked.
- Tutorial is currently paused/disabled. Do not rebuild tutorial before object standardization.
- Start screen Tutorial button was temporarily removed/hidden.
- White login/register hint line was temporarily removed/hidden.

## Current 0.11.3 changes

- FPS is shown in the scoreboard and recalculates every 250 ms.
- Death blur is removed.
- On player death, the pilot is forced into fly-like state.
- Top-right badge shows `YOU ARE DEAD`.
- Under the dead pilot, canvas buttons appear:
  - `CONTINUE`: fall back to the arena with immunity.
  - `EXIT`: return to the start screen.
- `FLY MODE` badge has a contrast panel so it is visible over outside-arena areas.

## Git/deploy workflow

Normal local development:

```cmd
npm run check
git status --short --branch
git add .
git commit -m "..."
git push origin main
```

Do not deploy every tiny experiment unless the user asks.

## Communication preference

Answer in Russian, short and strictly practical.
