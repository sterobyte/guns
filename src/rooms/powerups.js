(function () {
  const POWERUP_AMMO = "ammo";
  const POWERUP_REPAIR = "repair";

  function addPowerup(roomRuntimeState, x, y, type, value) {
    roomRuntimeState.ammoPacks.push({
      x,
      y,
      radius: 16,
      type,
      value,
      time: 0
    });
  }

  function addAmmoPack(options, x, y, value = options.ammoPackValue) {
    addPowerup(options.roomRuntimeState, x, y, POWERUP_AMMO, value);
  }

  function addRepairPack(options, x, y, value = options.repairPackHealRatio) {
    addPowerup(options.roomRuntimeState, x, y, POWERUP_REPAIR, value);
  }

  function spawnPowerup(options) {
    const point = options.randomPointInRoom(90);

    if (Math.random() < 0.28) {
      addRepairPack(options, point.x, point.y);
      return;
    }

    addAmmoPack(options, point.x, point.y);
  }

  function spawnInitialRoomPowerups(options) {
    const countValue = Number(options.room?.powerups?.initialCount ?? 0);
    const count = Number.isFinite(countValue)
      ? Math.max(0, Math.floor(countValue))
      : 0;

    for (let i = 0; i < count; i++) {
      spawnPowerup(options);
    }
  }

  function getCarriedPowerup(unit) {
    if (unit.carriedAmmoValue > 0) {
      return {
        type: POWERUP_AMMO,
        value: unit.carriedAmmoValue
      };
    }

    if (unit.carriedRepairValue > 0) {
      return {
        type: POWERUP_REPAIR,
        value: unit.carriedRepairValue
      };
    }

    return null;
  }

  function clearCarriedPowerups(unit) {
    unit.carriedAmmoValue = 0;
    unit.carriedRepairValue = 0;
  }

  function setCarriedPowerup(unit, type, value) {
    clearCarriedPowerups(unit);

    if (type === POWERUP_AMMO) {
      unit.carriedAmmoValue = value;
    } else if (type === POWERUP_REPAIR) {
      unit.carriedRepairValue = value;
    }
  }

  function dropCarriedPowerups(options, unit) {
    if (unit.carriedAmmoValue > 0) {
      const point = options.clampPointToRoom(unit.pilotX, unit.pilotY, 90);
      addAmmoPack(options, point.x, point.y, unit.carriedAmmoValue);
      unit.carriedAmmoValue = 0;
    }

    if (unit.carriedRepairValue > 0) {
      const point = options.clampPointToRoom(unit.pilotX, unit.pilotY, 90);
      addRepairPack(options, point.x, point.y, unit.carriedRepairValue);
      unit.carriedRepairValue = 0;
    }
  }

  function getPowerupSwapDropPoint(options, unit, pack) {
    const speed = Math.hypot(
      unit.pilotLastMoveVx || 0,
      unit.pilotLastMoveVy || 0
    );
    const angle =
      speed > 4
        ? Math.atan2(unit.pilotLastMoveVy, unit.pilotLastMoveVx) + Math.PI
        : Math.atan2(
            unit.pilotY - pack.y,
            unit.pilotX - pack.x
          );

    return options.clampPointToRoom(
      unit.pilotX + Math.cos(angle) * 42,
      unit.pilotY + Math.sin(angle) * 42,
      pack.radius
    );
  }

  function applyCarriedPowerupToCannon(options, pilotUnit, cannonUnit) {
    const carried = getCarriedPowerup(pilotUnit);

    if (!carried) return false;

    if (carried.type === POWERUP_AMMO) {
      cannonUnit.ammo = Math.min(
        options.getMaxAmmo(cannonUnit),
        cannonUnit.ammo + carried.value
      );

      options.addScore?.(
        cannonUnit,
        options.getActiveModeRule("ammoLoadScore", 40),
        "ammo-load"
      );
    } else if (carried.type === POWERUP_REPAIR) {
      cannonUnit.hp = Math.min(
        cannonUnit.maxHp,
        cannonUnit.hp + cannonUnit.maxHp * carried.value
      );

      if (cannonUnit.wreckRepair > 0) {
        cannonUnit.wreckRepair =
          cannonUnit.hp >= cannonUnit.maxHp
            ? 0
            : options.wreckRepairTime *
              (1 - options.clamp(cannonUnit.hp / cannonUnit.maxHp, 0, 1));
      }
    }

    clearCarriedPowerups(pilotUnit);

    return true;
  }

  function updatePowerupPickup(options) {
    const packs = options.roomRuntimeState.ammoPacks;

    for (let i = packs.length - 1; i >= 0; i--) {
      const pack = packs[i];

      for (const unit of options.units) {
        if (options.isUnitHidden(unit)) continue;

        if (tryPickupByCannon(options, unit, pack)) {
          packs.splice(i, 1);
          break;
        }

        if (tryPickupByPilot(options, unit, pack)) {
          if (pack.swapped) {
            delete pack.swapped;
          } else {
            packs.splice(i, 1);
          }
          break;
        }
      }
    }
  }

  function tryPickupByCannon(options, unit, pack) {
    if (unit.state !== "alive") return false;
    if (options.distance(unit, pack) > unit.radiusOuter + pack.radius) return false;

    if (pack.type === POWERUP_AMMO) {
      if (unit.ammo >= options.getMaxAmmo(unit)) return false;

      unit.ammo = Math.min(
        options.getMaxAmmo(unit),
        unit.ammo + pack.value
      );
      options.addScore?.(
        unit,
        options.getActiveModeRule("ammoPickupScore", 40),
        "ammo-pickup"
      );
      options.onAmmoPicked?.(unit);
      return true;
    }

    if (pack.type === POWERUP_REPAIR) {
      if (unit.hp >= unit.maxHp) return false;

      unit.hp = Math.min(
        unit.maxHp,
        unit.hp + unit.maxHp * pack.value
      );
      return true;
    }

    return false;
  }

  function tryPickupByPilot(options, unit, pack) {
    if (unit.state !== "pilot") return false;
    if (unit.isCannonOnly) return false;
    if (options.isPilotAirborne(unit)) return false;
    if (unit.pilotImmunity > 0) return false;

    if (
      Math.hypot(
        unit.pilotX - pack.x,
        unit.pilotY - pack.y
      ) > unit.pilotRadius + pack.radius
    ) {
      return false;
    }

    const carried = getCarriedPowerup(unit);

    if (carried) {
      const dropPoint = getPowerupSwapDropPoint(options, unit, pack);

      setCarriedPowerup(unit, pack.type, pack.value);
      pack.x = dropPoint.x;
      pack.y = dropPoint.y;
      pack.type = carried.type;
      pack.value = carried.value;
      pack.time = 0;
      pack.swapped = true;
      return true;
    }

    setCarriedPowerup(unit, pack.type, pack.value);

    if (pack.type === POWERUP_AMMO) {
      options.onAmmoPicked?.(unit);
    }

    return true;
  }

  function updatePowerupTimers(options, dt) {
    const packs = options.roomRuntimeState.ammoPacks;

    for (let i = packs.length - 1; i >= 0; i--) {
      const pack = packs[i];

      pack.time += dt;

      if (pack.time >= options.packLifeTime + options.packFadeTime) {
        packs.splice(i, 1);
      }
    }
  }

  function updatePowerupSpawning(options, dt) {
    if (options.isUserCabinetRoom()) return options.spawnTimer;

    let nextTimer = options.spawnTimer - dt;

    if (nextTimer <= 0) {
      spawnPowerup(options);
      nextTimer = 4 + Math.random() * 3;
    }

    return nextTimer;
  }

  window.GUNS_POWERUPS = {
    POWERUP_AMMO,
    POWERUP_REPAIR,
    addAmmoPack,
    addRepairPack,
    spawnPowerup,
    spawnInitialRoomPowerups,
    getCarriedPowerup,
    clearCarriedPowerups,
    setCarriedPowerup,
    dropCarriedPowerups,
    applyCarriedPowerupToCannon,
    updatePowerupPickup,
    updatePowerupTimers,
    updatePowerupSpawning
  };
})();
