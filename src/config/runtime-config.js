window.GUNS_CONFIG = {
  project: {
    name: "guns-next1",
    source: "gunsdemo22.html",
    strategy: "preserve-legacy-runtime-first"
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
