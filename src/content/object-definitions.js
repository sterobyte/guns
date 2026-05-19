(function () {
  const CANNON_KIND = "cannon";

  const fallbackDefinitions = {
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

        weapon: {
          barrels: [0]
        },

        render: {
          renderer: "sprite-cannon-canvas",
          sprites: {
            body: {
              src: "./assets/cannons/autogun_body.png",
              width: 512,
              height: 512,
              pivotX: 256,
              pivotY: 256,
              radiusPx: 207
            },
            turret: {
              src: "./assets/cannons/autogun_turret.png",
              width: 512,
              height: 512,
              pivotX: 256,
              pivotY: 401,
              recoilDistance: 9
            }
          },
          body: {
            renderer: "sprite",
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
      },

      doublegun: {
        id: "doublegun",
        kind: CANNON_KIND,
        title: "Double Gun",
        version: 1,

        gameplay: {
          maxHp: 100,
          maxAmmo: 60,
          entryScoreRequired: 0,
          damageMultiplier: 2,
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

        weapon: {
          barrels: [-12, 12]
        },

        render: {
          renderer: "sprite-cannon-canvas",
          sprites: {
            body: {
              src: "./assets/cannons/doublegun_body.png",
              width: 512,
              height: 512,
              pivotX: 256,
              pivotY: 256,
              radiusPx: 207
            },
            turret: {
              src: "./assets/cannons/doublegun_turret.png",
              width: 512,
              height: 512,
              pivotX: 256,
              pivotY: 401,
              recoilDistance: 9
            }
          },
          body: {
            renderer: "sprite",
            outerRadiusPath: "physics.radiusOuter",
            innerRadiusPath: "physics.radiusInner"
          }
        }
      },

      heavygun: {
        id: "heavygun",
        kind: CANNON_KIND,
        title: "Heavy Gun",
        version: 1,

        gameplay: {
          maxHp: 100,
          maxAmmo: 30,
          entryScoreRequired: 0,
          damage: 80,
          fireRate: {
            player: 0.36,
            bot: 1.05
          },
          recoilDuration: 0.14
        },

        physics: {
          radiusOuter: 34,
          radiusInner: 13,
          speed: {
            player: 230,
            bot: 112
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

        weapon: {
          barrels: [0]
        },

        render: {
          renderer: "sprite-cannon-canvas",
          sprites: {
            body: {
              src: "./assets/cannons/heavygun_body.png",
              width: 512,
              height: 512,
              pivotX: 256,
              pivotY: 256,
              radiusPx: 207
            },
            turret: {
              src: "./assets/cannons/heavygun_turret.png",
              width: 512,
              height: 512,
              pivotX: 256,
              pivotY: 411,
              recoilDistance: 13
            }
          },
          body: {
            renderer: "sprite",
            outerRadiusPath: "physics.radiusOuter",
            innerRadiusPath: "physics.radiusInner"
          }
        }
      },

      machinegun: {
        id: "machinegun",
        kind: CANNON_KIND,
        title: "Machine Gun",
        version: 1,

        gameplay: {
          maxHp: 100,
          maxAmmo: 90,
          entryScoreRequired: 0,
          damage: 10,
          fireRate: {
            player: 0.04,
            bot: 0.12
          },
          recoilDuration: 0.045
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

        weapon: {
          barrels: [0]
        },

        render: {
          renderer: "sprite-cannon-canvas",
          sprites: {
            body: {
              src: "./assets/cannons/machinegun_body.png",
              width: 512,
              height: 512,
              pivotX: 256,
              pivotY: 256,
              radiusPx: 207
            },
            turret: {
              src: "./assets/cannons/machinegun_turret.png",
              width: 512,
              height: 512,
              pivotX: 256,
              pivotY: 407,
              recoilDistance: 5
            }
          },
          body: {
            renderer: "sprite",
            outerRadiusPath: "physics.radiusOuter",
            innerRadiusPath: "physics.radiusInner"
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

  let definitions =
    window.GUNS_SHARED_CONFIG?.objects ||
    fallbackDefinitions;

  function getCannonDefinition(type) {
    return definitions.cannons[type] || definitions.cannons.autogun;
  }

  window.GUNS_OBJECTS = {
    definitions,
    byPath,
    cannons: {
      get: getCannonDefinition
    },
    refreshFromConfig(config) {
      definitions = config?.objects || fallbackDefinitions;
      this.definitions = definitions;
    }
  };
})();
