(function () {
  window.GUNS_ADMIN = {
    snapshot() {
      return {
        config: window.GUNS_CONFIG,
        pilots: window.GUNS_DOMAIN ? window.GUNS_DOMAIN.pilots() : [],
        cannons: window.GUNS_DOMAIN ? window.GUNS_DOMAIN.cannons() : []
      };
    },

    setScore(id, score) {
      const unit = window.GUNS_DOMAIN
        ?.rawPilots()
        .find(candidate => candidate.id === id);

      if (!unit) return false;
      unit.score = Number(score) || 0;
      return true;
    },

    repairCannons() {
      for (const unit of window.GUNS_DOMAIN?.rawCannons() || []) {
        unit.hp = unit.maxHp;
        unit.wreckRepair = 0;
        unit.cannonDestroyed = false;
      }
    }
  };
})();
