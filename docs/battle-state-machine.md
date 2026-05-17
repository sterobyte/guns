# Battle State Machine

This document describes player behavior outside the cabinet. It separates actual player states from events and consequences so new arenas/modes can use the same rules.

## Core States

### `pilot_ground`

Pilot is on foot, on the field, not carrying a powerup.

Allowed actions/events:

- idle
- move
- pick up powerup -> `pilot_carrying_powerup`
- start flying -> `pilot_flying_rising`
- enter free repaired cannon -> `in_cannon`
- bounce from enemy occupied cannon
- bounce from free cannon if entry is not allowed
- bounce from broken cannon
- die from bullet -> `pilot_dead`
- die from cannon runover -> `pilot_dead`

### `pilot_carrying_powerup`

Pilot is on foot and carries one powerup.

Allowed actions/events:

- idle
- move
- swap carried powerup with field powerup
- drop powerup by starting flight -> `pilot_flying_rising`
- apply ammo/repair to cannon
- apply powerup and enter cannon -> `in_cannon`
- bounce from enemy occupied cannon
- bounce from free cannon if entry is not allowed
- bounce from broken cannon
- die from bullet, dropping/clearing carried powerup by death rules -> `pilot_dead`
- die from cannon runover, dropping/clearing carried powerup by death rules -> `pilot_dead`

### `pilot_flying_rising`

Pilot is transitioning from ground to flight.

Allowed actions/events:

- move with flight rules
- finish rising -> `pilot_flying`
- request landing -> `pilot_flying_falling`

Blocked:

- pick up powerup
- enter cannon
- die from normal ground collision

### `pilot_flying`

Pilot is airborne.

Allowed actions/events:

- move/fly
- request landing -> `pilot_flying_falling`

Blocked:

- pick up powerup
- enter cannon
- die from normal ground collision

### `pilot_flying_falling`

Pilot is transitioning from flight to ground.

Allowed actions/events:

- move with falling rules
- finish falling -> `pilot_ground`

Blocked:

- pick up powerup until grounded
- enter cannon until grounded

### `pilot_ejected`

Pilot was forced out of a destroyed cannon and is moving along eject arc.

Allowed actions/events:

- finish eject -> `pilot_ground`

Blocked:

- manual cannon entry
- powerup pickup
- normal runover death during eject immunity

### `pilot_dead`

Pilot death state before the player chooses what to do.

Allowed actions/events:

- continue -> `pilot_flying_falling`
- exit arena -> cabinet

Notes:

- current player death prompt uses fly/fall behavior so the player can choose where to fall back.

### `in_cannon`

Pilot occupies and controls a cannon.

Allowed actions/events:

- idle
- drive forward
- drive backward
- rotate body
- rotate turret
- shoot
- wait fire cooldown/reload cycle
- run out of ammo
- pick up ammo if not full
- pick up repair if not full HP
- touch powerup without activation if it cannot be applied
- hit occupied cannon
- hit free cannon
- hit broken cannon
- hit pilot
- hit pilot carrying powerup
- run over pilot
- run over pilot carrying powerup
- bullet hits pilot
- bullet hits pilot carrying powerup
- bullet hits occupied cannon
- bullet hits free cannon
- bullet hits broken cannon
- break occupied cannon -> target `pilot_ejected`
- break free cannon -> broken/reparing cannon
- own cannon breaks -> `pilot_ejected`
- voluntary eject -> `pilot_ejected`

## Important Event Groups

### Powerup Events

- field powerup spawns
- pilot picks up powerup
- pilot swaps carried powerup
- pilot drops carried powerup on flight start
- pilot applies ammo to cannon
- pilot applies repair to cannon
- cannon picks up ammo directly
- cannon picks up repair directly
- powerup expires

### Cannon Events

- free repaired cannon accepts pilot
- entry denied by score/lock
- occupied cannon is damaged
- occupied cannon breaks and ejects pilot
- free cannon breaks
- broken cannon repairs over time
- broken cannon is repaired by carried repair powerup
- cannon is fully destroyed

### Death Events

- pilot dies from bullet
- pilot dies from cannon runover
- pilot dies while carrying powerup
- player death prompt starts
- player continues after death
- player exits arena after death

### Scoring Events

- passive score tick
- ammo pickup score
- ammo load score
- cannon break score
- pilot kill score
- exchangeable score sync
- scoreboard update

### Arena Lifecycle Events

- enter arena
- leave arena to cabinet
- timer starts
- timer ticks
- timer ends
- match ends
- room runtime state resets

## Current Runtime Mapping

- Ground/flying/eject/death logic: `src/legacy/gunsdemo22-runtime.js`
- Death prompt and player death transitions: `src/rooms/death-flow.js`
- Powerup carry/apply/drop/pickup: `src/rooms/powerups.js`
- Mode scoring hooks and timer rules: `src/modes/mode-registry.js`

## Open Design Questions

- Should death drop the carried powerup back to the field or clear it permanently?
- Should voluntary eject and forced eject be separate states for scoring and immunity?
- Should `score` be arena-local, session-local, or wallet-like before exchange?
- Should powerup activation be explicit later, or stay automatic on contact?
