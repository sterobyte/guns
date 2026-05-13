(function () {
  function allUnits() {
    const units = window.GUNS_LEGACY?.units;
    return Array.isArray(units) ? units : [];
  }

  function pilots() {
    return allUnits().filter(unit => !unit.isCannonOnly);
  }

  function cannons() {
    return allUnits();
  }

  function legacyPilotView(unit) {
    return {
      id: unit.id,
      nick: unit.nick,
      isPlayer: !!unit.isPlayer,
      controller: unit.isPlayer ? "human" : "bot",
      state: unit.state,
      score: unit.score,
      pilot: {
        x: unit.pilotX,
        y: unit.pilotY,
        radius: unit.pilotRadius,
        immune: unit.pilotImmunity > 0,
        flying: unit.pilotFlyState !== "ground"
      },
      occupiedCannon: unit.state === "alive" ? unit.id : null
    };
  }

  function legacyCannonView(unit) {
    return {
      id: unit.id,
      type: unit.gunType,
      x: unit.x,
      y: unit.y,
      hp: unit.hp,
      maxHp: unit.maxHp,
      ammo: unit.ammo,
      broken: unit.wreckRepair > 0,
      destroyed: !!unit.cannonDestroyed,
      occupantPilotId: unit.state === "alive" && !unit.isCannonOnly ? unit.id : null,
      empty: unit.state === "pilot"
    };
  }

  window.GUNS_DOMAIN = {
    allUnits,
    pilots: () => pilots().map(legacyPilotView),
    cannons: () => cannons().map(legacyCannonView),
    rawPilots: pilots,
    rawCannons: cannons
  };
})();
