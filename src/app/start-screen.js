(function () {
  const savedNick = localStorage.getItem("guns.playerNick") || "";

  window.GUNS_APP = {
    started: false,
    mode: "game",
    playerNick: savedNick,

    setPlayerNick(nick) {
      const cleanNick = sanitizeNick(nick);
      this.playerNick = cleanNick;
      localStorage.setItem("guns.playerNick", cleanNick);

      const player = window.GUNS_LEGACY?.player;
      if (player) {
        player.displayName = cleanNick;
      }

      return cleanNick;
    },

    start(nick, mode = "game") {
      this.setPlayerNick(nick);
      this.mode = mode;
      this.started = true;
      document.getElementById("start-screen")?.classList.add("hidden");
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("start-form");
    const input = document.getElementById("pilot-nick");
    const tutorialButton = document.querySelector(".tutorial-button");
    const version = document.getElementById("start-version");

    buildSkinButtons();
    window.GUNS_I18N?.apply();
    syncLanguageButtons();
    syncSkinButtons();

    input.value = savedNick;
    if (version) {
      version.textContent = `v${window.GUNS_CONFIG?.project?.version || "0.0.0"}`;
    }
    requestAnimationFrame(() => input.focus());

    form.addEventListener("submit", event => {
      event.preventDefault();
      window.GUNS_APP.start(input.value, "game");
    });

    tutorialButton?.addEventListener("click", () => {
      window.GUNS_APP.start(input.value, "tutorial");
    });

    document.querySelectorAll("[data-language-option]").forEach(button => {
      button.addEventListener("click", () => {
        window.GUNS_I18N?.setLanguage(button.dataset.languageOption);
        syncLanguageButtons();
      });
    });

    window.addEventListener("guns:languagechange", syncLanguageButtons);
  });

  function buildSkinButtons() {
    const switcher = document.getElementById("skin-switch");
    const visual = window.GUNS_CONFIG?.visual;
    const skins = visual?.skins || {};

    if (!switcher) return;

    switcher.textContent = "";

    Object.entries(skins).forEach(([skinId, skin]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.skinOption = skinId;
      button.textContent = skin.name || skinId;

      button.addEventListener("click", () => {
        if (visual.activeSkin === skinId) return;

        const storageKey = visual.storageKey || "guns.skin";
        localStorage.setItem(storageKey, skinId);
        visual.activeSkin = skinId;
        window.GUNS_LEGACY?.setActiveSkin?.(skinId);
        syncSkinButtons();
      });

      switcher.appendChild(button);
    });
  }

  function syncLanguageButtons() {
    const language = window.GUNS_I18N?.language || "en";

    document.querySelectorAll("[data-language-option]").forEach(button => {
      const isActive = button.dataset.languageOption === language;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function syncSkinButtons() {
    const activeSkin = window.GUNS_CONFIG?.visual?.activeSkin || "";

    document.querySelectorAll("[data-skin-option]").forEach(button => {
      const isActive = button.dataset.skinOption === activeSkin;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function sanitizeNick(nick) {
    const clean = String(nick || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 14);

    return clean || window.GUNS_I18N?.t("pilot.defaultNick") || "PILOT";
  }
})();
