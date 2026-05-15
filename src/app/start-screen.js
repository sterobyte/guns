(function () {
  const AUTH_MIN_PASSWORD_LENGTH = 6;
  const state = {
    visit: null,
    pilot: null,
    authMode: "",
    pendingMode: "game",
    pendingNick: "",
    localCallsign: ""
  };

  window.GUNS_APP = {
    started: false,
    mode: "game",
    playerNick: "",

    setPlayerNick(nick, options = {}) {
      const cleanNick = sanitizeNick(nick);
      this.playerNick = cleanNick;

      try {
        if (options.persist) {
          localStorage.setItem("guns.playerNick", cleanNick);
        } else if (isServiceNick(cleanNick)) {
          localStorage.removeItem("guns.playerNick");
        }
      } catch {}

      const player = window.GUNS_LEGACY?.player;
      if (player) {
        player.displayName = cleanNick;
      }

      return cleanNick;
    },

    start(nick, mode = "game") {
      const cleanNick = this.setPlayerNick(nick, {
        persist: state.pilot?.nick === sanitizeNick(nick)
      });
      this.mode = mode;
      this.started = true;
      window.GUNS_NET?.registerUser?.(cleanNick);
      window.GUNS_NET?.connect?.({
        roomId: window.GUNS_CONFIG?.multiplayer?.defaultRoomId || "main",
        nick: cleanNick
      }).catch(() => {});
      document.getElementById("start-screen")?.classList.add("hidden");
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("start-form");
    const input = document.getElementById("pilot-nick");
    const tutorialButton = document.querySelector(".tutorial-button");
    const version = document.getElementById("start-version");
    const password = document.getElementById("pilot-password");
    const passwordRepeat = document.getElementById("pilot-password-repeat");
    const authConfirm = document.getElementById("auth-confirm");
    const authCancel = document.getElementById("auth-cancel");
    const logout = document.getElementById("auth-logout");

    applyRandomStartBackground();
    buildSkinButtons();
    window.GUNS_I18N?.apply();
    syncLanguageButtons();
    syncSkinButtons();

    if (version) {
      version.textContent = `v${window.GUNS_CONFIG?.project?.version || "0.0.0"}`;
    }

    document.querySelectorAll("[data-language-option]").forEach(button => {
      button.addEventListener("click", () => {
        window.GUNS_I18N?.setLanguage(button.dataset.languageOption);
        syncLanguageButtons();
      });
    });

    window.addEventListener("guns:languagechange", syncLanguageButtons);

    if (isUnsupportedPlayDevice()) {
      showUnsupportedDeviceWarning();
      return;
    }

    input.value = "";
    setStatus(t("identity.loading"));
    initializeIdentity().finally(() => {
      requestAnimationFrame(() => input.focus());
    });

    form.addEventListener("submit", event => {
      event.preventDefault();
      handlePlay("game");
    });

    tutorialButton?.addEventListener("click", () => {
      // Legacy tutorial is intentionally disabled while the new guided flow is designed.
    });

    input.addEventListener("input", () => {
      hideAuthPanel();
      if (state.pilot && normalize(input.value) !== normalize(state.pilot.nick)) {
        setStatus(t("identity.nickChanged"));
      } else if (!state.pilot && isKnownUnclaimedNick(input.value)) {
        setStatus(t("identity.unclaimedReturn", { nick: state.visit.unclaimedNick }));
      } else if (!state.pilot && isServiceNick(input.value)) {
        setStatus(t("identity.guestReady"));
      } else {
        setStatus("");
      }
    });

    authConfirm?.addEventListener("click", () => {
      finishAuth(password.value, passwordRepeat.value);
    });

    authCancel?.addEventListener("click", () => {
      hideAuthPanel();
      password.value = "";
      passwordRepeat.value = "";
      setStatus(state.pilot ? t("identity.welcome", { nick: state.pilot.nick }) : t("identity.guestReady"));
    });

    logout?.addEventListener("click", () => {
      window.GUNS_NET?.logout?.()
        .finally(() => {
          state.pilot = null;
          input.value = getCallsign();
          hideAuthPanel();
          syncLogoutButton();
          setStatus(t("identity.loggedOut"));
        });
    });

  });

  async function initializeIdentity() {
    const result = await window.GUNS_NET?.startAnonymousVisit?.(collectVisitMeta());

    if (result?.visit) {
      state.visit = result.visit;
    } else {
      state.localCallsign = createLocalCallsign();
      state.visit = {
        callsign: state.localCallsign,
        source: "local-fallback"
      };
    }

    if (result?.pilot) {
      state.pilot = result.pilot;
      document.getElementById("pilot-nick").value = result.pilot.nick;
      window.GUNS_APP.setPlayerNick(result.pilot.nick, { persist: true });
      setStatus(t("identity.welcome", { nick: result.pilot.nick }));
    } else {
      document.getElementById("pilot-nick").value = getCallsign();
      setStatus(
        state.visit?.unclaimedNick
          ? t("identity.unclaimedHint", { nick: state.visit.unclaimedNick })
          : t("identity.guestReady")
      );
    }

    syncLogoutButton();
  }

  async function handlePlay(mode) {
    const input = document.getElementById("pilot-nick");
    const nick = sanitizeNick(input.value);

    if (!nick) {
      input.value = "";
      hideAuthPanel();
      setStatus(t("identity.emptyNick"));
      requestAnimationFrame(() => input.focus());
      return;
    }

    input.value = nick;

    if (state.pilot && normalize(nick) === normalize(state.pilot.nick)) {
      window.GUNS_APP.start(nick, mode);
      return;
    }

    if (isServiceNick(nick)) {
      window.GUNS_APP.start(nick, mode);
      return;
    }

    setStatus(t("identity.checking"));
    const result = await window.GUNS_NET?.checkPilot?.(nick);
    const pilotInfo = result?.pilot;

    if (!pilotInfo) {
      window.GUNS_APP.start(nick, mode);
      return;
    }

    state.pendingMode = mode;
    state.pendingNick = pilotInfo.nick || nick;

    if (pilotInfo.exists) {
      showAuthPanel("login", t("identity.login", { nick: state.pendingNick }));
      return;
    }

    if (pilotInfo.available) {
      if (isKnownUnclaimedNick(state.pendingNick)) {
        showAuthPanel("claim", t("identity.claim", { nick: state.pendingNick }));
        return;
      }

      const unclaimed = await window.GUNS_NET?.useUnclaimedNick?.(state.pendingNick, collectVisitMeta());

      if (unclaimed?.ok && unclaimed.visit) {
        state.visit = unclaimed.visit;
      }

      window.GUNS_APP.start(state.pendingNick, mode);
      return;
    }

    setStatus(t("identity.reserved"));
  }

  async function finishAuth(password, passwordRepeat) {
    const meta = collectVisitMeta();

    if (String(password || "").length < AUTH_MIN_PASSWORD_LENGTH) {
      setAuthMessage(t("identity.passwordShort"));
      return;
    }

    if (state.authMode === "claim" && password !== passwordRepeat) {
      setAuthMessage(t("identity.passwordMismatch"));
      return;
    }

    setAuthMessage(t("identity.authWorking"));

    const result =
      state.authMode === "login"
        ? await window.GUNS_NET?.loginPilot?.(state.pendingNick, password, meta)
        : await window.GUNS_NET?.claimPilot?.(state.pendingNick, password, meta);

    if (!result?.ok || !result?.pilot) {
      setAuthMessage(t(result?.error === "nick_taken" ? "identity.nickTaken" : "identity.authFailed"));
      return;
    }

    state.pilot = result.pilot;
    document.getElementById("pilot-nick").value = result.pilot.nick;
    window.GUNS_APP.setPlayerNick(result.pilot.nick, { persist: true });
    syncLogoutButton();
    window.GUNS_APP.start(result.pilot.nick, state.pendingMode);
  }

  function showAuthPanel(mode, message) {
    state.authMode = mode;
    const panel = document.getElementById("auth-panel");
    const password = document.getElementById("pilot-password");
    const passwordRepeat = document.getElementById("pilot-password-repeat");
    const confirm = document.getElementById("auth-confirm");

    setStatus("");
    setAuthMessage(message);
    panel?.classList.remove("hidden");
    password.value = "";
    passwordRepeat.value = "";
    passwordRepeat.style.display = mode === "claim" ? "" : "none";
    password.autocomplete = mode === "login" ? "current-password" : "new-password";
    confirm.textContent = t(mode === "login" ? "identity.loginButton" : "identity.claimButton");
    requestAnimationFrame(() => password.focus());
  }

  function hideAuthPanel() {
    const panel = document.getElementById("auth-panel");
    panel?.classList.add("hidden");
    state.authMode = "";
  }

  function setStatus(message) {
    const status = document.getElementById("auth-status");
    if (status) {
      status.textContent = message || "";
    }
  }

  function setAuthMessage(message) {
    const element = document.getElementById("auth-message");
    if (element) {
      element.textContent = message || "";
    }
  }

  function syncLogoutButton() {
    document.getElementById("auth-logout")?.classList.toggle("hidden", !state.pilot);
  }

  function isKnownUnclaimedNick(value) {
    return Boolean(
      state.visit?.unclaimedNick &&
        normalize(value) === normalize(state.visit.unclaimedNick)
    );
  }

  function getCallsign() {
    return state.visit?.callsign || state.localCallsign || createLocalCallsign();
  }

  function collectVisitMeta() {
    const ua = navigator.userAgent || "";
    const params = new URLSearchParams(window.location.search || "");

    return {
      browser: detectBrowser(ua),
      os: detectOs(ua),
      device: detectDevice(ua),
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      screenWidth: window.screen?.width || 0,
      screenHeight: window.screen?.height || 0,
      viewportWidth: window.innerWidth || 0,
      viewportHeight: window.innerHeight || 0,
      pixelRatio: window.devicePixelRatio || 1,
      touch: navigator.maxTouchPoints > 0,
      referrer: document.referrer || "",
      landingPath: window.location.pathname || "/",
      sourceGroup: getSourceGroup(params, document.referrer),
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      clientVersion: window.GUNS_CONFIG?.project?.version || "",
      skin: window.GUNS_CONFIG?.visual?.activeSkin || ""
    };
  }

  function detectBrowser(ua) {
    if (/Edg\//.test(ua)) return "edge";
    if (/OPR\//.test(ua)) return "opera";
    if (/Firefox\//.test(ua)) return "firefox";
    if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) return "chrome";
    if (/Safari\//.test(ua)) return "safari";
    return "unknown";
  }

  function detectOs(ua) {
    if (/Windows/i.test(ua)) return "windows";
    if (/Android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Mac OS X/i.test(ua)) return "macos";
    if (/Linux/i.test(ua)) return "linux";
    return "unknown";
  }

  function detectDevice(ua) {
    if (/iPad|Tablet/i.test(ua)) return "tablet";
    if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
    return "desktop";
  }

  function getSourceGroup(params, referrer) {
    if (params.get("utm_source") || params.get("utm_campaign")) return "campaign";
    if (!referrer) return "direct";
    if (/google|bing|yandex|duckduckgo/i.test(referrer)) return "search";
    if (/t\.co|twitter|facebook|vk\.com|telegram|reddit/i.test(referrer)) return "social";
    return "referral";
  }

  function createLocalCallsign() {
    if (state.localCallsign) return state.localCallsign;

    state.localCallsign = `CADET-000-${createTail()}`;
    return state.localCallsign;
  }

  function createTail() {
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let tail = "";

    for (let i = 0; i < 3; i++) {
      tail += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return tail;
  }

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

  function applyRandomStartBackground() {
    const screen = document.getElementById("start-screen");
    const backgrounds = window.GUNS_CONFIG?.visual?.startBackgrounds || [];

    if (!screen || !backgrounds.length) return;

    const selected = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const path = typeof selected === "string" ? selected : selected.image;
    const accent = typeof selected === "string" ? "" : selected.accent;

    if (!path) return;

    const url = new URL(path, window.location.href).href;
    screen.style.setProperty("--start-background-image", `url("${url}")`);

    if (accent) {
      screen.style.setProperty("--start-accent", accent);
    }
  }

  function showUnsupportedDeviceWarning() {
    document.getElementById("start-form")?.classList.add("hidden");
    document.getElementById("unsupported-device")?.classList.remove("hidden");
  }

  function isUnsupportedPlayDevice() {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const touchPoints = navigator.maxTouchPoints || 0;
    const mobileUa = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    const tabletUa = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    const iPadDesktopMode = /Macintosh/i.test(ua) && /Mac/i.test(platform) && touchPoints > 1;
    const coarsePrimary = hasMediaQuery("(pointer: coarse)");
    const anyFinePointer = hasMediaQuery("(any-pointer: fine)");
    const anyHover = hasMediaQuery("(any-hover: hover)");
    const touchOnly = touchPoints > 0 && coarsePrimary && !anyFinePointer && !anyHover;

    return mobileUa || tabletUa || iPadDesktopMode || touchOnly;
  }

  function hasMediaQuery(query) {
    return Boolean(window.matchMedia && window.matchMedia(query).matches);
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
    return String(nick || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 14);
  }

  function normalize(value) {
    return sanitizeNick(value).toLocaleLowerCase("en-US");
  }

  function isServiceNick(value) {
    return /^CADET-\d{3}-[A-Z0-9]{3}$/i.test(String(value || "").trim());
  }

  function t(key, params = {}) {
    const lang = window.GUNS_I18N?.language === "ru" ? "ru" : "en";
    const dictionary = {
      en: {
        "identity.loading": "CONTACTING SERVER...",
        "identity.guestReady": "TEMPORARY PILOT READY",
        "identity.emptyNick": "ENTER PILOT CALLSIGN",
        "identity.welcome": "WELCOME BACK, {nick}",
        "identity.nickChanged": "ENTER PASSWORD OR CLAIM THIS PILOT",
        "identity.unclaimedHint": "YOU PLAYED AS {nick}. TYPE IT TO CLAIM.",
        "identity.unclaimedReturn": "{nick} IS STILL UNCLAIMED. CLAIM IT?",
        "identity.checking": "CHECKING PILOT...",
        "identity.claim": "CLAIM {nick}: CREATE PASSWORD",
        "identity.login": "{nick} IS CLAIMED: ENTER PASSWORD",
        "identity.claimButton": "CLAIM",
        "identity.loginButton": "LOGIN",
        "identity.passwordShort": "PASSWORD: 6+ SYMBOLS",
        "identity.passwordMismatch": "PASSWORDS DO NOT MATCH",
        "identity.authWorking": "WORKING...",
        "identity.authFailed": "ACCESS DENIED",
        "identity.nickTaken": "PILOT IS ALREADY CLAIMED",
        "identity.reserved": "THIS CALLSIGN IS RESERVED",
        "identity.loggedOut": "LOGGED OUT. PASSWORD REQUIRED NEXT TIME."
      },
      ru: {
        "identity.loading": "СВЯЗЬ С СЕРВЕРОМ...",
        "identity.guestReady": "ВРЕМЕННЫЙ ПИЛОТ ГОТОВ",
        "identity.emptyNick": "ВВЕДИ ПОЗЫВНОЙ ПИЛОТА",
        "identity.welcome": "С ВОЗВРАЩЕНИЕМ, {nick}",
        "identity.nickChanged": "ВВЕДИ ПАРОЛЬ ИЛИ ЗАСТОЛБИ ПИЛОТА",
        "identity.unclaimedHint": "ТЫ ИГРАЛ КАК {nick}. ВВЕДИ ЕГО, ЧТОБЫ ЗАСТОЛБИТЬ.",
        "identity.unclaimedReturn": "{nick} ВСЕ ЕЩЕ НЕ ЗАСТОЛБЛЕН. ЗАСТОЛБИМ?",
        "identity.checking": "ПРОВЕРЯЕМ ПИЛОТА...",
        "identity.claim": "ЗАСТОЛБИТЬ {nick}: СОЗДАЙ ПАРОЛЬ",
        "identity.login": "{nick} УЖЕ ЗАНЯТ: ВВЕДИ ПАРОЛЬ",
        "identity.claimButton": "ЗАСТОЛБИТЬ",
        "identity.loginButton": "ВОЙТИ",
        "identity.passwordShort": "ПАРОЛЬ: 6+ СИМВОЛОВ",
        "identity.passwordMismatch": "ПАРОЛИ НЕ СОВПАЛИ",
        "identity.authWorking": "РАБОТАЕМ...",
        "identity.authFailed": "ВХОД ЗАПРЕЩЕН",
        "identity.nickTaken": "ПИЛОТ УЖЕ ЗАСТОЛБЛЕН",
        "identity.reserved": "СЛУЖЕБНЫЙ ПОЗЫВНОЙ ЗАРЕЗЕРВИРОВАН",
        "identity.loggedOut": "ВЫХОД ВЫПОЛНЕН. ДАЛЬШЕ НУЖЕН ПАРОЛЬ."
      }
    };
    const template = dictionary[lang][key] || dictionary.en[key] || key;

    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    );
  }
})();
