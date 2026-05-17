# GUNS Next Chat Handoff

Use this file to continue the project in a fresh Codex chat without losing context.

## Working Folders

Main game/backend project:

```text
C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
```

Admin panel project:

```text
C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-panel
```

Public repository:

```text
https://github.com/sterobyte/guns
```

Public domain target:

```text
https://guns.gs
```

## Current Versions

At the moment of this handoff:

- game/backend: `0.14.1`
- admin panel: `0.1.34`

Important rule: after every code fix, bump the relevant version by one patch step.

For the main game/backend, update all three files together:

```text
package.json
server/index.mjs
src/config/runtime-config.js
```

For the panel, update:

```text
..\guns-panel\package.json
```

If shared config files under `shared/` are changed, run:

```cmd
npm.cmd run build:config
```

Then always run:

```cmd
npm.cmd run check
```

For the panel, run:

```cmd
npm.cmd run check
```

## Local Run

From the main project:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
npm run dev:all
```

URLs:

- game: `http://127.0.0.1:5178/`
- backend health: `http://127.0.0.1:3000/health`
- admin panel: `http://127.0.0.1:5179/`

Stop local stack:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
stop-local.cmd
```

If UI looks stale, restart the local stack and ask the user to hard refresh with `Ctrl+F5`.

## Git Rules

- Do not push to GitHub unless the user explicitly says `деплой`, `push`, or similar.
- The user often wants local-only work.
- The worktree may be dirty. Do not revert unrelated changes.
- Never use destructive git commands unless explicitly requested.

## Communication Rules

- Answer in Russian.
- Keep answers short and practical.
- The user asked: before code edits, ask or proceed only when the user clearly says `делай`, `правь`, `погнали`, `+`, or equivalent.
- The user dislikes patches that hide prototype problems. Prefer structural cleanup.

## Current Architecture

The game is still partly prototype-based.

Active runtime:

```text
src/legacy/gunsdemo22-runtime.js
```

This is still the big canvas runtime: player, bots, room rendering, bullets, collisions, FPS, cabinet, arena, effects.

Modular pieces already started:

```text
src/rooms/room-entry.js
src/rooms/room-session.js
src/rooms/geometry.js
shared/rooms/*.json
shared/objects/cannons/*.json
shared/objects/room-objects/*.json
shared/settings.json
```

Admin panel is separate:

```text
..\guns-panel
```

Backend:

```text
server/index.mjs
server/users.mjs
server/arena.mjs
server/rooms.mjs
```

## Current Product Direction

We are moving step by step from prototype to a large structured project:

- rooms are data-driven;
- cannons are data-driven objects;
- room objects should become reusable objects;
- admin panel should become the main constructor/source of truth;
- later MongoDB should become the persistent source of truth;
- eventually Codex should be able to act as an agent that changes game data through admin/API without deploys.

Do not rush Mongo until local data/config structure is clean enough.

## Important Product Concepts

- The main entity is the player/pilot, not the cannon.
- Cannons are expendable vehicles/tools.
- User cabinet/garage is a private room, separate from public battle arenas.
- Public arenas and cabinet must be isolated.
- Room objects like teleport/menu terminals should be reusable objects, not one-off room hacks.
- Tutorial is still paused until object/room structure is cleaner.

## Identity And Callsign Rules

Current visitor naming:

- service visitor callsigns are `visitor-<number>`;
- example: `visitor-4832`;
- `visitor-...` is reserved and cannot be registered by a user;
- plain `visitor` is allowed for registration;
- old `CADET` is obsolete and should not appear anymore.

The numeric part comes from the visit segment code:

```js
code = 1000 + ((browser * 997 + os * 541 + device * 307 + language * 173 + source * 79 + deviceSeed + firstSeenSeed) % 9000)
```

This is a device-influenced segment code, not a unique ID.

Real technical IDs:

- `device.id`: browser/device identity and anonymous visitor key, cookie `guns_did`;
- `pilot.id`: registered account ID;
- `session.id`: auth session ID, cookie `guns_sid`.

Admin users table currently shows:

- `Type`
- callsign/status/online/etc.
- `Device ID`
- `Pilot ID`
- `Session ID`
- device/session counts for pilot rows

Login rules:

- logged in means the user entered a password and has valid `guns_sid`;
- a visitor is not logged in;
- a registered nick without password auth in current session is not logged in;
- multilogin is allowed;
- multi-registration from the same device is blocked.

Auth session rule:

- session is intended to be effectively permanent;
- `expiresAt` is currently `0`;
- server should not expire auth sessions by TTL;
- logout/admin action/deletion should invalidate it.

## Cabinet Current Behavior

The user cabinet is the first screen.

Cabinet room:

```text
shared/rooms/user-cabinet.json
```

The top terminal is dynamic:

- not logged in: `CHANGE CALLSIGN`;
- logged in: `LOGOUT`;
- `LOGOUT` calls logout directly;
- `CHANGE CALLSIGN` opens the callsign dialog.

The callsign dialog flow:

1. User enters callsign.
2. User presses `CHECK`.
3. Only then backend checks the nick.
4. Existing nick: one password field and `WELCOME BACK`.
5. New nick: two password fields and `REGISTER`.
6. Nick field is disabled after `CHECK`.
7. `BACK` returns to the `CHECK` state.
8. No live/autocomplete checking while typing.

Text currently requested:

- check hint: `Hello, stranger. Enter your callsign.`
- visitor coin failure: `This callsign cannot collect gs.`

Currency is called:

```text
gs
```

Not `guns coin` in UI.

## Recent UI/Gameplay Details

- Language buttons `РУС` / `ENG` were removed from the cabinet room.
- Menu/teleport activation now requires the pilot to go deeper into the object, not just touch the boundary.
- Machinegun bullets are no longer forced red; they use owner/cannon color.
- Cabinet version is drawn on the top background.
- Cabinet uses cycling/pulsing background.
- Cabinet effects from arenas should not leak into the cabinet; room runtime state exists to isolate effects.

## Cannons

Current cannon types:

- `autogun`
- `doublegun`
- `heavygun`
- `machinegun`

Graphics are mostly PNG assets from the user, recolored programmatically.

Machinegun:

- damage like autogun;
- fire rate 3x autogun;
- no longer has red bullets.

Heavygun:

- lower fire rate;
- damage 80 HP.

Doublegun:

- double shot visuals;
- higher damage/magazine than autogun.

## Rooms

Current room configs include:

```text
shared/rooms/main.json
shared/rooms/main-draft-1.json
shared/rooms/test-range.json
shared/rooms/user-cabinet.json
```

Room shapes currently include:

- circle
- rectangle
- five-pointed-star
- triangle

Rooms have:

- `enabled`
- `published`
- `arena.shape`
- shape params
- `spawns`
- room objects
- `powerups.initialCount`

Published-room idea:

- draft room can be edited/tested;
- published/public room should become immutable later.

## Shared Config Workflow

If changing files under:

```text
shared/
```

run:

```cmd
npm.cmd run build:config
npm.cmd run check
```

This rebuilds:

```text
shared/game-config.json
```

## Current Admin Panel Notes

Panel path:

```text
C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-panel
```

Panel URL:

```text
http://127.0.0.1:5179/
```

Panel reads users from:

```text
http://127.0.0.1:3000/admin/users
```

Panel version is currently `0.1.28`.

Run panel check:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-panel
npm.cmd run check
```

## Known Risks / Things To Watch

- `src/legacy/gunsdemo22-runtime.js` is still too large.
- Avoid growing it with new one-off behavior.
- Prefer moving data to `shared/` and reusable behavior to focused modules.
- Some old helper code remains unused, especially around older UI ideas.
- If old UI text appears, suspect:
  - stale dev server;
  - stale browser cache;
  - old `server/data/users.json`;
  - old localStorage/cookies.

## Current Verification Commands

Main project:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
npm.cmd run check
```

Panel:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-panel
npm.cmd run check
```

Health check:

```cmd
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/health
```

## Recommended First Message In New Chat

Paste this:

```text
Это проект GUNS. Работай в папке:
C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1

Сначала прочитай:
NEXT_CHAT_HANDOFF.md
PROJECT_CONTEXT.md
и git status.

Важно: после каждого фикса увеличиваем версию на единичку. Без моей команды не пушим на GitHub.
Продолжаем оттуда.
```
