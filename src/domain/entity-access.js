(function () {
  function sync() {
    window.GUNS_LEGACY?.syncDomainEntities?.();
  }

  function allUnits() {
    const units = window.GUNS_LEGACY?.units;
    return Array.isArray(units) ? units : [];
  }

  function pilots() {
    sync();
    const pilots = window.GUNS_LEGACY?.pilots;
    return Array.isArray(pilots) ? pilots : [];
  }

  function cannons() {
    sync();
    const cannons = window.GUNS_LEGACY?.cannons;
    return Array.isArray(cannons) ? cannons : [];
  }

  function rawPilots() {
    return allUnits().filter(unit => !!unit.pilotEntityId);
  }

  function rawCannons() {
    return allUnits().filter(unit => !!unit.cannonEntityId);
  }

  window.GUNS_DOMAIN = {
    allUnits,
    pilots: () => pilots().map(pilot => ({ ...pilot })),
    cannons: () => cannons().map(cannon => ({ ...cannon })),
    rawPilots,
    rawCannons,
    pilotById(id) {
      sync();
      return window.GUNS_LEGACY?.getPilotEntityById?.(id);
    },
    cannonById(id) {
      sync();
      return window.GUNS_LEGACY?.getCannonEntityById?.(id);
    }
  };
})();
