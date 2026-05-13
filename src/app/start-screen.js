(function () {
  const savedNick = localStorage.getItem("guns.playerNick") || "";

  window.GUNS_APP = {
    started: false,
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

    start(nick) {
      this.setPlayerNick(nick);
      this.started = true;
      document.getElementById("start-screen")?.classList.add("hidden");
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("start-form");
    const input = document.getElementById("pilot-nick");
    const version = document.getElementById("start-version");

    input.value = savedNick;
    if (version) {
      version.textContent = `v${window.GUNS_CONFIG?.project?.version || "0.0.0"}`;
    }
    requestAnimationFrame(() => input.focus());

    form.addEventListener("submit", event => {
      event.preventDefault();
      window.GUNS_APP.start(input.value);
    });
  });

  function sanitizeNick(nick) {
    const clean = String(nick || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 14);

    return clean || "PILOT";
  }
})();
