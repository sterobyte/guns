# GUNS Next1

This project inherits `gunsdemo22.html`.
The public brand/domain target is `guns.gs`.

The first goal is preservation: keep the existing graphics, feel, scoring, fly mode,
doublegun gate, blur, ammo powerups, bot behavior, and LCD style.

## Run locally

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
node scripts\serve.mjs
```

Open:

```txt
http://127.0.0.1:5178/
```

To start the full local stack in one terminal:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
npm run dev:all
```

This starts or reuses:

```txt
http://127.0.0.1:3000/health
http://127.0.0.1:5178/
http://127.0.0.1:5179/
```

## Multiplayer server

The first multiplayer layer is a local Node.js WebSocket room server. It does
not own game physics yet. It is the connection, room, and input relay foundation
for the later authoritative server.

Start it in a second terminal:

```cmd
cd C:\Users\stero\Documents\Codex\2026-05-12\files-mentioned-by-the-user-guns\guns-next1
npm run server
```

Server endpoints:

```txt
http://127.0.0.1:3000/health
http://127.0.0.1:3000/rooms
http://127.0.0.1:3000/admin/users
ws://127.0.0.1:3000/ws?room=main&nick=pilot
```

Manual browser console smoke test:

```js
await GUNS_NET.connect({ roomId: "main", nick: "kuni1" })
GUNS_NET.describe()
GUNS_NET.sendInput({ fire: true, aimX: 100, aimY: 200 })
```

In `0.6.0`, game clients auto-connect on game start and exchange lightweight
player snapshots. A second browser tab in the same room is drawn as a remote
pilot ghost on the arena.

In `0.7.0`, each room also has a first server-authoritative arena state. The
server owns the connected human players and shared scoreboard rows. The old
local simulation still owns bots, cannons, bullets, and pickups until those
systems are migrated one by one.

In `0.7.1`, the server arena owns shared bot rows in the scoreboard too:
Yuriy, Sidorova, Kirk, Lara, and Danila.

In `0.7.2`, nickname registration no longer marks an active WebSocket player
offline. Online status is owned by WebSocket connect/disconnect events.

In `0.7.3`, the client accepts arena scoreboard updates from both the stable
`arena:state` message and the temporary local `arena` message.

In `0.7.4`, `npm run dev:all` starts the backend, game, and admin panel as one
local stack with readiness checks.

In `0.7.5`, clients send local bot scoreboard stats to the server so bot rows
keep gaining points while the bot simulation is still client-side.

In `0.7.6`, `dev:all` verifies backend WebSocket readiness instead of only
checking HTTP health.

In `0.7.7`, the Windows local launcher uses `start-local.cmd` to start only
missing ports through stable `cmd /k` service windows.

In `0.7.8`, the Windows launcher starts a backend watchdog that checks HTTP
and WebSocket readiness and restarts the backend if it drops.

In `0.7.9`, the Windows launcher returns to the stable direct backend window
after the watchdog proved unreliable in hidden shell mode.

In `0.7.10`, the backend runs through `backend-loop.cmd`, which writes logs and
automatically restarts `server/index.mjs` if it exits.

In `0.7.11`, public HTTPS pages do not attempt to call local `127.0.0.1`
HTTP/WebSocket endpoints, avoiding browser mixed-content warnings.

In `0.8.0`, remote human players are drawn as arena participants instead of
ghost markers: on-foot pilots show a pilot body and nick, and pilots inside
cannons show a cannon body, nick, health bar, and ammo count.

In `0.9.0`, the start screen gets the first registration/login prototype:
anonymous visitors receive a `CADET-...` callsign through a visit cookie,
claimed pilots use password auth, and backend sessions are stored in HttpOnly
cookies.

In `0.9.1`, a free real nickname can be used once without claiming it. The
anonymous visit stores that nickname as `unclaimedNick`, and if the visitor
types it again later the start screen suggests claiming it.

In `0.9.2`, clearing the pilot input no longer silently falls back to the
anonymous callsign. Empty pilot input blocks game start until the visitor types
a callsign or refreshes the page.

In `0.9.3`, the pilot input no longer shows a gray `PILOT` placeholder after
the visitor manually clears the callsign field.

In `0.9.4`, pilot/cannon contact and powerup handling are more physical:
moving cannons only crush pilots when driving toward them, crushed pilots apply
carried powerups to the crushing cannon, cannon collisions remove 5% HP from
each body, and pilots swap carried powerups when running over a new one.

In `0.9.5`, bots keep fighting with 3 ammo instead of immediately switching to
ammo-seeking mode, and camera clamping uses per-axis overscan so the north and
south arena edges reveal more outside area.

In `0.9.6`, pilots killed by bullets drop carried powerups back onto the field,
and immune/faded pilots cannot pick up powerups until immunity ends.

In `0.9.7`, the start screen randomly chooses one background from a configured
set of three images on each page load.

In `0.9.8`, every start background carries its own accent color, and the start
screen controls inherit that accent from the randomly selected image.

In `0.9.9`, the legacy tutorial is disabled. The start button remains visible,
but it is a no-op until the new tutorial flow is scripted.

In `0.9.10`, mobile, tablet, touch-only, and mobile in-app browsers are blocked
on the start screen with a bilingual desktop-only warning instead of the nick
form and buttons.

In `0.10.0`, the new tutorial shell starts. The tutorial button opens lesson 1:
a mouse-only cadet movement corridor with two auto-opening barriers, a final
cannon room, an exit button, and a completion popup.

In `0.10.1`, lesson 1 uses the standard GUNS pilot/cannon visual language,
extends the corridor, adds the third barrier before the cannon room, enlarges
the room, and removes the center artifact left by opening barriers.

In `0.10.2`, the new tutorial implementation is paused and commented out while
the project moves toward shared object definitions. The tutorial button remains
visible, but it is a no-op.

The identity prototype uses these local endpoints:

```txt
POST http://127.0.0.1:3000/visits/start
POST http://127.0.0.1:3000/visits/unclaimed-nick
GET  http://127.0.0.1:3000/pilots/check?nick=...
POST http://127.0.0.1:3000/pilots/claim
POST http://127.0.0.1:3000/auth/login
POST http://127.0.0.1:3000/auth/logout
GET  http://127.0.0.1:3000/auth/me
POST http://127.0.0.1:3000/users/register
```

The backend keeps anonymous visits, claimed pilots, and auth sessions in memory
for now. The admin panel in `..\guns-panel` reads the combined snapshot from
`/admin/users`.

## Structure

- `src/legacy/gunsdemo22-runtime.js` is the preserved game runtime.
- `src/styles.css` is the preserved page/canvas style.
- `src/config/runtime-config.js` is the first external config surface.
- `src/domain/entity-access.js` exposes pilot/cannon views over the legacy `units`.
- `src/admin/admin-api.js` exposes console admin helpers.
- `src/net/network-adapter.js` is the future multiplayer adapter slot.
- `server/index.mjs` is the local multiplayer room server.
- `server/users.mjs` is the in-memory identity registry for anonymous visits,
  claimed pilots, and auth sessions.

## Console helpers

```js
GUNS_ADMIN.snapshot()
GUNS_ADMIN.setScore("player", 3000)
GUNS_ADMIN.repairCannons()
GUNS_NET.describe()
```

The start screen receives anonymous callsigns from the backend and stores
claimed pilot sessions in HttpOnly cookies. The internal legacy player id
remains `player`, while the scoreboard shows the chosen nickname.

## Migration Rule

Do not rewrite the runtime all at once. Move one behavior at a time from
`src/legacy/gunsdemo22-runtime.js` into explicit pilot, cannon, controller,
render, combat, pickup, and network modules.
