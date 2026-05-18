(function () {
  function shouldRandomizeRoomSpawns(room) {
    const mode = String(room?.spawns?.mode || "").toLowerCase();

    if (mode === "fixed") return false;
    if (mode === "random") return true;

    return !isUserBaseRoom(room);
  }

  function isUserBaseRoom(room) {
    return (
      room?.id === "user-cabinet" ||
      room?.roomKind === "user-base" ||
      room?.roomKind === "user-cabinet"
    );
  }

  function applyRoomSpawns(options) {
    const room = options.room;
    const units = options.units || [];
    const spawns = room?.spawns || {};
    const playerSpawn = spawns.player;
    const botSpawns = spawns.bots;
    const cannonSpawns = spawns.cannons;
    const botByUnitId = Array.isArray(botSpawns)
      ? new Map(botSpawns.map(spawn => [spawn.unitId || spawn.id, spawn]))
      : null;
    const cannonByUnitId = Array.isArray(cannonSpawns)
      ? new Map(cannonSpawns.map(spawn => [spawn.unitId, spawn]))
      : null;

    ensureRoomCannonUnits(cannonSpawns, units, options);

    for (const unit of units) {
      if (unit.isPlayer) {
        unit.roomHidden = false;
        applyActorRoomSpawn(unit, playerSpawn, room, options);
        continue;
      }

      if (unit.isCannonOnly) {
        applyCannonOnlyRoomSpawn(unit, cannonByUnitId, options);
        continue;
      }

      const botSpawn = botByUnitId?.get(unit.id);
      unit.roomHidden = botByUnitId ? !botSpawn : false;

      if (botSpawn) {
        applyActorRoomSpawn(unit, botSpawn, room, options);
      } else if (unit.roomHidden) {
        options.resetUnit?.(unit);
      }
    }
  }

  function ensureRoomCannonUnits(cannonSpawns, units, options) {
    if (!Array.isArray(cannonSpawns)) return;

    for (const spawn of cannonSpawns) {
      if (!spawn?.unitId) continue;
      if (units.some(unit => unit.id === spawn.unitId)) continue;

      const unit = options.createUnit?.(
        spawn.unitId,
        Number(spawn.x || 0),
        Number(spawn.y || 0),
        options.defaultCannonColor,
        0,
        false,
        spawn.gunType || "autogun"
      );

      if (!unit) continue;

      unit.cannonEntityId = spawn.cannonEntityId || spawn.unitId;
      options.makeCannonOnly?.(unit);
      units.push(unit);
    }
  }

  function applyCannonOnlyRoomSpawn(unit, cannonByUnitId, options) {
    const spawn = cannonByUnitId?.get(unit.id);
    unit.roomHidden = cannonByUnitId
      ? !spawn
      : !options.isCannonAllowed?.(unit.gunType);

    if (!spawn) {
      if (unit.roomHidden) {
        options.resetUnit?.(unit);
      }
      return;
    }

    options.resetUnit?.(unit);
    unit.state = "pilot";
    unit.cannonDestroyed = false;
    unit.x = Number(spawn.x || 0);
    unit.y = Number(spawn.y || 0);
    unit.pilotX = unit.x;
    unit.pilotY = unit.y;

    if (spawn.gunType) {
      options.applyCannonType?.(unit, spawn.gunType);
    }
  }

  function applyActorRoomSpawn(unit, spawn, room, options) {
    if (!spawn) return;

    options.resetUnit?.(unit);
    resetActorSpawnState(unit, options.pilotRadius);

    if (spawn.name) {
      unit.displayName = spawn.name;
    }

    if (spawn.gunType) {
      options.applyCannonType?.(unit, spawn.gunType);
    }

    if (shouldRandomizeRoomSpawns(room)) {
      applyRandomPilotSpawn(unit, options);
      return;
    }

    if (spawn.state === "pilot") {
      applyPilotSpawn(unit, spawn);
      return;
    }

    if (spawn.state === "alive") {
      applyAliveSpawn(unit, spawn);
    }
  }

  function resetActorSpawnState(unit, pilotRadius) {
    unit.knockback = null;
    unit.pilotKnockback = null;
    unit.pilotEject = null;
    unit.postEjectBrake = null;
    unit.exitRequested = false;
    unit.exitStopTimer = 0;
    unit.pilotFlyState = "ground";
    unit.pilotFlyTime = 0;
    unit.pilotRadius = pilotRadius;
  }

  function applyRandomPilotSpawn(unit, options) {
    const point = options.randomPointInRoom?.(unit.pilotRadius + 60) || {
      x: unit.x || 0,
      y: unit.y || 0
    };

    unit.state = "pilot";
    unit.cannonDestroyed = true;
    unit.cannonEntityId = null;
    unit.hp = 0;
    unit.wreckHp = 0;
    unit.wreckRepair = 0;
    unit.pilotX = point.x;
    unit.pilotY = point.y;
    unit.x = point.x;
    unit.y = point.y;
  }

  function applyPilotSpawn(unit, spawn) {
    unit.state = "pilot";
    unit.cannonDestroyed = true;
    unit.cannonEntityId = null;
    unit.hp = 0;
    unit.wreckHp = 0;
    unit.wreckRepair = 0;
    unit.pilotX = Number(spawn.pilotX ?? spawn.x ?? unit.pilotX);
    unit.pilotY = Number(spawn.pilotY ?? spawn.y ?? unit.pilotY);
    unit.x = unit.pilotX;
    unit.y = unit.pilotY;
  }

  function applyAliveSpawn(unit, spawn) {
    unit.state = "alive";
    unit.cannonDestroyed = false;
    unit.cannonEntityId =
      spawn.cannonEntityId ||
      unit.cannonEntityId ||
      `${unit.id}-${unit.gunType || "autogun"}`;
    unit.hp = Math.max(1, unit.hp || unit.maxHp);
    unit.x = Number(spawn.x ?? unit.x);
    unit.y = Number(spawn.y ?? unit.y);
    unit.pilotX = unit.x;
    unit.pilotY = unit.y;
  }

  window.GUNS_ROOM_SPAWNS = {
    shouldRandomizeRoomSpawns,
    applyRoomSpawns
  };
})();
