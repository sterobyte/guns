window.GUNS_CONFIG = {
  project: {
    name: "guns-next1",
    version: "0.11.7",
    brand: "GUNS.GS",
    domain: "guns.gs",
    source: "gunsdemo22.html",
    strategy: "preserve-legacy-runtime-first"
  },

  i18n: {
    defaultLanguage: "ru",
    fallbackLanguage: "en",
    storageKey: "guns.language"
  },

  render: {
    healthBarOpacity: 0.5,
    canvasMaxDevicePixelRatio: 1,
    arenaBackgroundCacheScale: 1,
    cameraZoom: {
      min: 0.72,
      max: 1.22,
      step: 0.06
    }
  },

  visual: {
    activeSkin: "lcd",
    storageKey: "guns.skin",
    startBackgrounds: [
      {
        image: "./assets/start-background.png",
        accent: "#363a14"
      },
      {
        image: "./assets/start-background-2.png",
        accent: "#550b0b"
      },
      {
        image: "./assets/start-background-3.png",
        accent: "#183f4d"
      }
    ],
    skins: {
      lcd: {
        name: "LCD",
        pageBackground: "#1b2414",
        roomOutside: "#223018",
        roomTop: "#bdd08a",
        roomMiddle: "#a9bd78",
        roomBottom: "#7f9558",
        ink: "#1f2b16",
        ink2: "#33451f",
        ink3: "#4b5f2f",
        faint: "rgba(31, 43, 22, 0.16)",
        soft: "rgba(31, 43, 22, 0.32)",
        panel: "rgba(189, 208, 138, 0.62)",
        tutorialPanel: "rgba(189, 208, 138, 0.86)",
        gridMinor: "rgba(31, 43, 22, 0.08)",
        gridMajor: "rgba(31, 43, 22, 0.14)",
        roomVignette: "rgba(31, 43, 22, 0.09)",
        headerShade: "rgba(31, 43, 22, 0.12)",
        player: "#1f2b16",
        bot1: "#33451f",
        bot2: "#4b5f2f",
        bot3: "#26391b",
        bot4: "#6a7f47",
        bot5: "#405629"
      },

      cgaNight: {
        name: "CGA NIGHT",
        pageBackground: "#090d11",
        roomOutside: "#050608",
        roomTop: "#1a2026",
        roomMiddle: "#10161b",
        roomBottom: "#090d11",
        ink: "#f8f7e8",
        ink2: "#33f0ff",
        ink3: "#ff4fe8",
        faint: "rgba(248, 247, 232, 0.14)",
        soft: "rgba(248, 247, 232, 0.28)",
        panel: "rgba(5, 6, 8, 0.72)",
        tutorialPanel: "rgba(10, 15, 18, 0.9)",
        gridMinor: "rgba(248, 247, 232, 0.08)",
        gridMajor: "rgba(248, 247, 232, 0.16)",
        roomVignette: "rgba(0, 0, 0, 0.22)",
        headerShade: "rgba(248, 247, 232, 0.12)",
        player: "#f8f7e8",
        bot1: "#33f0ff",
        bot2: "#ff4fe8",
        bot3: "#fff23d",
        bot4: "#4dff59",
        bot5: "#ff5a52"
      }
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

  multiplayer: {
    enabled: true,
    localHttpUrl: "http://127.0.0.1:3000",
    localWebSocketUrl: "ws://127.0.0.1:3000/ws",
    defaultRoomId: "main",
    maxRoomPlayers: 16,
    protocolVersion: 1,
    snapshotRateMs: 100,
    authoritativeArena: true,
    serverAuthorityTarget: true
  },

  admin: {
    enabled: true,
    consoleApiName: "GUNS_ADMIN"
  }
};

(function applySavedSkin() {
  const visual = window.GUNS_CONFIG.visual;
  const storageKey = visual.storageKey || "guns.skin";
  let savedSkin = "";

  try {
    savedSkin = localStorage.getItem(storageKey) || "";
  } catch {
    savedSkin = "";
  }

  if (visual.skins[savedSkin]) {
    visual.activeSkin = savedSkin;
  }
})();
