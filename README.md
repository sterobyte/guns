# GUNS Next1

This project inherits `gunsdemo22.html`.

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

## Structure

- `src/legacy/gunsdemo22-runtime.js` is the preserved game runtime.
- `src/styles.css` is the preserved page/canvas style.
- `src/config/runtime-config.js` is the first external config surface.
- `src/domain/entity-access.js` exposes pilot/cannon views over the legacy `units`.
- `src/admin/admin-api.js` exposes console admin helpers.
- `src/net/network-adapter.js` is the future multiplayer adapter slot.

## Console helpers

```js
GUNS_ADMIN.snapshot()
GUNS_ADMIN.setScore("player", 3000)
GUNS_ADMIN.repairCannons()
GUNS_NET.describe()
```

## Migration Rule

Do not rewrite the runtime all at once. Move one behavior at a time from
`src/legacy/gunsdemo22-runtime.js` into explicit pilot, cannon, controller,
render, combat, pickup, and network modules.
