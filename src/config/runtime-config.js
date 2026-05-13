window.GUNS_CONFIG = {
  project: {
    name: "guns-next1",
    version: "0.0.36",
    brand: "GUNS.GS",
    domain: "guns.gs",
    source: "gunsdemo22.html",
    strategy: "preserve-legacy-runtime-first"
  },

  render: {
    healthBarOpacity: 0.5,
    cameraZoom: {
      min: 0.72,
      max: 1.22,
      step: 0.06
    }
  },

  migration: {
    entitySplitTarget: {
      pilots: "separate player/bot bodies and controller state from cannon bodies",
      cannons: "equipment objects with type, hp, ammo, occupantPilotId",
      controllers: "human, bot, remote-client, admin"
    },
    multiplayerTarget: {
      authority: "server-authoritative later",
      localMode: true
    }
  },

  admin: {
    enabled: true,
    consoleApiName: "GUNS_ADMIN"
  }
};
