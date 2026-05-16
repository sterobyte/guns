(function () {
  const CANNON_KIND = "cannon";

  const definitions = {
    cannons: {
      autogun: {
        id: "autogun",
        kind: CANNON_KIND,
        title: "Auto Gun",
        version: 1,

        gameplay: {
          maxHp: 100,
          maxAmmo: 30,
          entryScoreRequired: 0,
          fireRate: {
            player: 0.12,
            bot: 0.35
          },
          recoilDuration: 0.085
        },

        physics: {
          radiusOuter: 34,
          radiusInner: 13,
          speed: {
            player: 260,
            bot: 126
          },
          slowdownRadius: {
            player: 220,
            bot: 0
          },
          stopRadius: {
            player: 50,
            bot: 0
          }
        },

        render: {
          renderer: "legacy-autogun-canvas",
          body: {
            outerRadiusPath: "physics.radiusOuter",
            innerRadiusPath: "physics.radiusInner"
          },
          barrel: {
            width: 10,
            height: 95,
            y: -85,
            innerWidth: 4,
            innerHeight: 62
          },
          core: {
            radius: 28
          },
          antenna: {
            width: 8,
            height: 28,
            radius: 4,
            swing: 0.25,
            swingSpeed: 0.003
          }
        }
      }
    }
  };

  function byPath(source, path, fallback) {
    if (!path) return fallback;

    const value = path
      .split(".")
      .reduce(
        (current, key) =>
          current && Object.prototype.hasOwnProperty.call(current, key)
            ? current[key]
            : undefined,
        source
      );

    return value ?? fallback;
  }

  function getCannonDefinition(type) {
    return definitions.cannons[type] || definitions.cannons.autogun;
  }

  window.GUNS_OBJECTS = {
    definitions,
    byPath,
    cannons: {
      get: getCannonDefinition
    }
  };
})();
