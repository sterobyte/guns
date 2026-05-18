(function () {
  const AUTH_MIN_PASSWORD_LENGTH = 6;
  const SERVICE_NICK_PREFIX = "visitor-";
  const FALLBACK_SERVICE_NICK = "visitor-0000";
  const USER_BASE_ROOM_ID = "user-cabinet";
  const USER_BASE_ROOM_KIND = "user-base";
  const LEGACY_USER_BASE_ROOM_KIND = "user-cabinet";
  const state = {
    visit: null,
    pilot: null,
    authMode: "",
    pendingMode: "game",
    pendingNick: "",
    localCallsign: "",
    exchangeScore: 0,
    walletGunsCoin: 0,
    pilotWeapons: [],
    walletConfirmedByPickup: false
  };
  const teleportConfirm = {
    onYes: null,
    onNo: null
  };
  const cabinetMessageButtons = {
    ok: null
  };

  window.GUNS_APP = {
    started: false,
    mode: "game",
    playerNick: "",
    roomId: "",

    openPilotDialog() {
      openPilotDialog();
    },

    isPilotDialogOpen() {
      return (
        !document.getElementById("pilot-dialog")?.classList.contains("hidden") ||
        !document.getElementById("cabinet-message-dialog")?.classList.contains("hidden") ||
        !document.getElementById("teleport-confirm-dialog")?.classList.contains("hidden")
      );
    },

    getWalletGunsCoin() {
      return state.walletGunsCoin;
    },

    spendWalletGunsCoin(amount) {
      const value = Math.max(0, Math.floor(Number(amount) || 0));

      if (value <= 0) return true;
      if (state.walletGunsCoin < value) return false;

      state.walletGunsCoin -= value;
      return true;
    },

    notifyWalletIncrease(entity) {
      notifyWalletIncrease(entity);
    },

    addPilotWeapon(weaponId) {
      const id = String(weaponId || "").trim();

      if (id && !state.pilotWeapons.includes(id)) {
        state.pilotWeapons.push(id);
      }
    },

    hasPilotWeapon(weaponId) {
      return state.pilotWeapons.includes(String(weaponId || "").trim());
    },

    getPilotWeapons() {
      return [...state.pilotWeapons];
    },

    syncInventory(entityOrInventory) {
      syncKnownInventory(
        entityOrInventory?.inventory
          ? entityOrInventory
          : { inventory: entityOrInventory }
      );
    },

    async purchasePilotWeapon(weaponId, priceGs, context = {}) {
      const id = String(weaponId || "").trim();
      const price = Math.max(0, Math.floor(Number(priceGs) || 0));

      if (!id || price <= 0 || state.walletGunsCoin < price) {
        return false;
      }

      const result = await window.GUNS_NET?.purchasePilotWeapon?.(
        this.playerNick || getCallsign(),
        id,
        {
          reason: "market-purchase",
          itemType: "pilot-weapon",
          itemId: id,
          roomId: context.roomId,
          instanceId: context.instanceId
        }
      );

      if (!result?.ok) return false;

      syncKnownWallet(result.user);
      syncKnownInventory(result.user);
      return result;
    },

    bankExchangeScore(score) {
      const value = Math.max(0, Math.floor(Number(score) || 0));

      state.exchangeScore = value;
    },

    addExchangeScore(score) {
      const value = Math.floor(Number(score) || 0);

      if (value !== 0) {
        state.exchangeScore = Math.max(0, state.exchangeScore + value);
      }
    },

    getExchangeScore() {
      return state.exchangeScore;
    },

    handleBaseExchange() {
      handleBaseExchange();
    },

    showBaseMessage(message) {
      showBaseMessage(message);
    },

    confirmServiceTeleport(options = {}) {
      showTeleportConfirm(options);
    },

    isLoggedIn() {
      return Boolean(state.pilot);
    },

    getBasePilotActionLabel() {
      return state.pilot ? "LOGOUT" : "CHANGE CALLSIGN";
    },

    handleBasePilotAction() {
      if (state.pilot) {
        logoutPilot();
      } else {
        window.GUNS_LEGACY?.bouncePlayerFromRoomObject?.("settings-terminal");
      }
    },

    syncBaseRoomPanel() {
      syncBaseRoomPanel();
    },

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
      const selectedRoomId = getSelectedRoomId();

      this.roomId = selectedRoomId;
      window.GUNS_LEGACY?.clearPlayerDeathPrompt?.();
      window.GUNS_LEGACY?.setActiveRoom?.(selectedRoomId);
      this.mode = mode;
      this.started = true;
      window.GUNS_NET?.registerUser?.(cleanNick)
        ?.then((result) => {
          syncKnownWallet(result?.user);
        })
        .catch(() => {});
      window.GUNS_NET?.connect?.({
        roomId: selectedRoomId,
        nick: cleanNick
      }).catch(() => {});
      document.getElementById("start-screen")?.classList.add("hidden");
      syncBaseRoomPanel();
    },

    stop() {
      this.started = true;
      this.mode = "game";
      window.GUNS_NET?.disconnect?.();
      window.GUNS_LEGACY?.setActiveRoom?.(USER_BASE_ROOM_ID);
      document.getElementById("start-screen")?.classList.add("cabinet-start");
      syncBaseRoomPanel();
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
    const choiceRegister = document.getElementById("nick-choice-register");
    const choiceClose = document.getElementById("nick-choice-close");
    const loggedInPlay = document.getElementById("logged-in-play");
    const logout = document.getElementById("auth-logout");
    const pilotDialogNick = document.getElementById("pilot-dialog-nick");
    const pilotDialogPassword = document.getElementById("pilot-dialog-password");
    const pilotDialogPasswordRepeat = document.getElementById("pilot-dialog-password-repeat");
    const pilotDialogConfirm = document.getElementById("pilot-dialog-confirm");
    const pilotDialogBack = document.getElementById("pilot-dialog-back");
    const pilotDialogClose = document.getElementById("pilot-dialog-close");
    const cabinetMessageOk = document.getElementById("cabinet-message-ok");
    const cabinetMessageClose = document.getElementById("cabinet-message-close");
    const teleportConfirmYes = document.getElementById("teleport-confirm-yes");
    const teleportConfirmNo = document.getElementById("teleport-confirm-no");
    const cabinetRoomGo = document.getElementById("cabinet-room-go");

    applyRandomStartBackground();
    buildSkinButtons();
    buildRoomSelect();
    buildBaseRoomSelect();
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

    window.addEventListener("guns:languagechange", () => {
      syncLanguageButtons();
      syncLogoutButton();
    });

    if (isUnsupportedPlayDevice()) {
      showUnsupportedDeviceWarning();
      return;
    }

    input.value = "";
    setStatus(t("identity.loading"));
    initializeIdentity().finally(() => {
      enterBaseStart();
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
      hideNickChoicePanel();
      if (state.pilot && normalize(input.value) !== normalize(state.pilot.nick)) {
        setStatus("");
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

    choiceRegister?.addEventListener("click", () => {
      hideNickChoicePanel();
      showAuthPanel("claim", t("identity.claim", { nick: state.pendingNick }));
    });

    choiceClose?.addEventListener("click", () => {
      hideNickChoicePanel();
      setStatus("");
      requestAnimationFrame(() => input.focus());
    });

    loggedInPlay?.addEventListener("click", () => {
      if (state.pilot?.nick) {
        window.GUNS_APP.start(state.pilot.nick, "game");
      }
    });

    logout?.addEventListener("click", () => {
      logoutPilot();
    });

    pilotDialogConfirm?.addEventListener("click", () => {
      submitPilotDialog();
    });

    pilotDialogBack?.addEventListener("click", () => {
      resetPilotDialogToCheck(pilotDialogNick?.value || "", { force: true });
      requestAnimationFrame(() => pilotDialogNick?.focus());
    });

    pilotDialogNick?.addEventListener("input", () => {
      resetPilotDialogToCheck(pilotDialogNick.value);
    });

    pilotDialogNick?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitPilotDialog();
      }
    });

    pilotDialogPassword?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitPilotDialog();
      }
    });

    pilotDialogPasswordRepeat?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitPilotDialog();
      }
    });

    pilotDialogClose?.addEventListener("click", () => {
      closePilotDialog();
    });

    cabinetMessageOk?.addEventListener("click", () => {
      if (cabinetMessageButtons.ok) {
        cabinetMessageButtons.ok();
      } else {
        closeCabinetMessage();
      }
    });

    cabinetMessageClose?.addEventListener("click", () => {
      closeCabinetMessage();
    });

    teleportConfirmYes?.addEventListener("click", () => {
      closeTeleportConfirm();
      teleportConfirm.onYes?.();
    });

    teleportConfirmNo?.addEventListener("click", () => {
      closeTeleportConfirm();
      teleportConfirm.onNo?.();
    });

    cabinetRoomGo?.addEventListener("click", () => {
      goToBaseSelectedRoom();
    });

  });

  function enterBaseStart() {
    window.GUNS_APP.setPlayerNick(state.pilot?.nick || getCallsign(), {
      persist: Boolean(state.pilot?.nick)
    });
    window.GUNS_APP.roomId = USER_BASE_ROOM_ID;
    window.GUNS_APP.started = true;
    window.GUNS_LEGACY?.clearPlayerDeathPrompt?.();
    window.GUNS_LEGACY?.setActiveRoom?.(USER_BASE_ROOM_ID);
    document.getElementById("start-screen")?.classList.add("cabinet-start");
    syncBaseRoomPanel();
  }

  let pilotDialogCheckTimer = 0;
  let pilotDialogMode = "guest";
  let pilotDialogNick = "";

  function openPilotDialog() {
    const dialog = document.getElementById("pilot-dialog");
    const nickInput = document.getElementById("pilot-dialog-nick");
    const passwordInput = document.getElementById("pilot-dialog-password");
    const passwordRepeatInput = document.getElementById("pilot-dialog-password-repeat");
    const backButton = document.getElementById("pilot-dialog-back");

    if (dialog && !dialog.classList.contains("hidden")) {
      requestAnimationFrame(() => nickInput?.focus());
      return;
    }

    pilotDialogMode = "guest";
    pilotDialogNick = "";
    setPilotDialogMessage("Hello, stranger. Enter your callsign.");
    setPilotDialogConfirm("CHECK");
    passwordInput?.classList.add("hidden");
    passwordRepeatInput?.classList.add("hidden");
    backButton?.classList.add("hidden");
    if (nickInput) nickInput.disabled = false;
    if (passwordInput) passwordInput.value = "";
    if (passwordRepeatInput) passwordRepeatInput.value = "";
    if (nickInput) nickInput.value = "";
    dialog?.classList.remove("hidden");
    requestAnimationFrame(() => nickInput?.focus());
  }

  function closePilotDialog() {
    document.getElementById("pilot-dialog")?.classList.add("hidden");
    window.clearTimeout(pilotDialogCheckTimer);
  }

  let cabinetMessageOnClose = null;

  function showBaseMessage(message, options = {}) {
    const dialog = document.getElementById("cabinet-message-dialog");
    const text = document.getElementById("cabinet-message-text");

    cabinetMessageOnClose =
      typeof options.onClose === "function" ? options.onClose : null;
    if (text) text.textContent = message || "";
    setCabinetMessageButtons(options.buttons);
    dialog?.classList.remove("hidden");
  }

  function closeCabinetMessage() {
    document.getElementById("cabinet-message-dialog")?.classList.add("hidden");
    const onClose = cabinetMessageOnClose;
    cabinetMessageOnClose = null;
    setCabinetMessageButtons();
    onClose?.();
  }

  function setCabinetMessageButtons(buttons = {}) {
    const okButton = document.getElementById("cabinet-message-ok");
    const okLabel = buttons.okLabel || "OK";

    cabinetMessageButtons.ok =
      typeof buttons.onOk === "function" ? buttons.onOk : null;

    if (okButton) okButton.textContent = okLabel;
  }

  function showTeleportConfirm(options = {}) {
    teleportConfirm.onYes = typeof options.onYes === "function" ? options.onYes : null;
    teleportConfirm.onNo = typeof options.onNo === "function" ? options.onNo : null;
    document.getElementById("teleport-confirm-dialog")?.classList.remove("hidden");
  }

  function closeTeleportConfirm() {
    document.getElementById("teleport-confirm-dialog")?.classList.add("hidden");
  }

  function resetPilotDialogToCheck(rawNick = "", options = {}) {
    const passwordInput = document.getElementById("pilot-dialog-password");
    const passwordRepeatInput = document.getElementById("pilot-dialog-password-repeat");
    const nickInput = document.getElementById("pilot-dialog-nick");
    const backButton = document.getElementById("pilot-dialog-back");
    const nextNick = sanitizeNick(rawNick);

    if (
      !options.force &&
      pilotDialogMode !== "guest" &&
      normalize(nextNick) === normalize(pilotDialogNick)
    ) {
      return;
    }

    pilotDialogMode = "guest";
    pilotDialogNick = "";
    passwordInput?.classList.add("hidden");
    passwordRepeatInput?.classList.add("hidden");
    backButton?.classList.add("hidden");
    if (nickInput) nickInput.disabled = false;
    if (passwordInput) passwordInput.value = "";
    if (passwordRepeatInput) passwordRepeatInput.value = "";
    setPilotDialogConfirm("CHECK");
    setPilotDialogMessage("Hello, stranger. Enter your callsign.");
  }

  async function checkPilotDialogNick() {
    const nick = sanitizeNick(document.getElementById("pilot-dialog-nick")?.value);
    const passwordInput = document.getElementById("pilot-dialog-password");
    const passwordRepeatInput = document.getElementById("pilot-dialog-password-repeat");
    const nickInput = document.getElementById("pilot-dialog-nick");
    const backButton = document.getElementById("pilot-dialog-back");

    pilotDialogNick = nick;

    if (!nick || isServiceNick(nick)) {
      pilotDialogMode = "guest";
      passwordInput?.classList.add("hidden");
      passwordRepeatInput?.classList.add("hidden");
      backButton?.classList.add("hidden");
      if (nickInput) nickInput.disabled = false;
      setPilotDialogConfirm("CHECK");
      setPilotDialogMessage("Hello, stranger. Enter your callsign.");
      return;
    }

    const result = await window.GUNS_NET?.checkPilot?.(nick);
    const pilotInfo = result?.pilot;

    if (pilotInfo?.exists) {
      pilotDialogMode = "login";
      pilotDialogNick = pilotInfo.nick || nick;
      passwordInput?.classList.remove("hidden");
      passwordRepeatInput?.classList.add("hidden");
      backButton?.classList.remove("hidden");
      if (nickInput) nickInput.disabled = true;
      if (passwordInput) passwordInput.autocomplete = "current-password";
      if (passwordInput) passwordInput.placeholder = "PASSWORD";
      if (passwordRepeatInput) passwordRepeatInput.value = "";
      setPilotDialogConfirm("WELCOME BACK");
      setPilotDialogMessage("");
      return;
    }

    if (pilotInfo?.available) {
      pilotDialogMode = "register";
      pilotDialogNick = pilotInfo.nick || nick;
      passwordInput?.classList.remove("hidden");
      passwordRepeatInput?.classList.remove("hidden");
      backButton?.classList.remove("hidden");
      if (nickInput) nickInput.disabled = true;
      if (passwordInput) passwordInput.autocomplete = "new-password";
      if (passwordInput) passwordInput.placeholder = "CREATE PASSWORD";
      setPilotDialogConfirm("REGISTER");
      setPilotDialogMessage("NEW PILOT: CREATE PASSWORD");
      return;
    }

    pilotDialogMode = "guest";
    passwordInput?.classList.add("hidden");
    passwordRepeatInput?.classList.add("hidden");
    backButton?.classList.add("hidden");
    if (nickInput) nickInput.disabled = false;
    setPilotDialogConfirm("CHECK");
    setPilotDialogMessage(t("identity.reserved"));
  }

  async function submitPilotDialog() {
    if (pilotDialogMode === "guest") {
      await checkPilotDialogNick();
      return;
    }

    const nick = sanitizeNick(pilotDialogNick || document.getElementById("pilot-dialog-nick")?.value);
    const password = document.getElementById("pilot-dialog-password")?.value || "";
    const passwordRepeat = document.getElementById("pilot-dialog-password-repeat")?.value || "";

    if (!nick || isServiceNick(nick)) {
      setPilotDialogMessage("ENTER PILOT CALLSIGN");
      return;
    }

    setPilotDialogMessage(t("identity.authWorking"));

    if (String(password || "").length < AUTH_MIN_PASSWORD_LENGTH) {
      setPilotDialogMessage(t("identity.passwordShort"));
      return;
    }

    if (pilotDialogMode === "register" && password !== passwordRepeat) {
      setPilotDialogMessage(t("identity.passwordMismatch"));
      return;
    }

    if (pilotDialogMode === "login" || pilotDialogMode === "register") {
      const result = pilotDialogMode === "login"
        ? await window.GUNS_NET?.loginPilot?.(nick, password, collectVisitMeta())
        : await window.GUNS_NET?.claimPilot?.(nick, password, collectVisitMeta());

      if (!result?.ok || !result?.pilot) {
        setPilotDialogMessage(t(getAuthErrorKey(result?.error)));
        return;
      }

      state.pilot = result.pilot;
      syncKnownWallet(result.pilot);
      window.GUNS_APP.setPlayerNick(result.pilot.nick, { persist: true });
      syncLogoutButton();
      closePilotDialog();
      return;
    }
  }

  function setPilotDialogConfirm(label) {
    const button = document.getElementById("pilot-dialog-confirm");
    if (button) button.textContent = label;
  }

  function setPilotDialogMessage(message) {
    const element = document.getElementById("pilot-dialog-message");
    if (element) element.textContent = message || "";
  }

  async function initializeIdentity() {
    const result = await window.GUNS_NET?.startAnonymousVisit?.(collectVisitMeta());

    if (result?.visit) {
      state.visit = result.visit;
      syncKnownWallet(result.visit);
    } else {
      state.localCallsign = createLocalCallsign();
      state.visit = {
        callsign: state.localCallsign,
        source: "local-fallback"
      };
    }

    if (result?.pilot) {
      state.pilot = result.pilot;
      syncKnownWallet(result.pilot);
      document.getElementById("pilot-nick").value = result.pilot.nick;
      window.GUNS_APP.setPlayerNick(result.pilot.nick, { persist: true });
      setStatus(t("identity.welcome", { nick: result.pilot.nick }));
    } else {
      document.getElementById("pilot-nick").value = getCallsign();
      window.GUNS_APP.setPlayerNick(getCallsign());
      setStatus(t("identity.guestReady"));
    }

    syncLogoutButton();
  }

  function syncKnownWallet(entity) {
    syncKnownInventory(entity);

    const coins = Number(entity?.wallet?.gunsCoin);

    if (!Number.isFinite(coins)) return;

    state.walletGunsCoin = Math.max(0, Math.floor(coins));
  }

  function syncKnownInventory(entity) {
    const weapons = entity?.inventory?.pilotWeapons;

    if (!Array.isArray(weapons)) return;

    state.pilotWeapons = Array.from(
      new Set(weapons.map((weaponId) => String(weaponId || "").trim()).filter(Boolean))
    );
  }

  function notifyWalletIncrease(entity) {
    if (isServiceNick(window.GUNS_APP?.playerNick)) return;

    const coins = Number(entity?.wallet?.gunsCoin);

    if (!Number.isFinite(coins)) return;

    state.walletConfirmedByPickup = true;
    const delta = coins - state.walletGunsCoin;
    state.walletGunsCoin = Math.max(0, Math.floor(coins));

    if (delta <= 0) return;
  }

  async function handleBaseExchange() {
    window.GUNS_APP.bankExchangeScore(
      window.GUNS_LEGACY?.player?.score || state.exchangeScore
    );

    const score = Math.max(0, Math.floor(state.exchangeScore || 0));

    if (score <= 0) {
      window.GUNS_LEGACY?.bouncePlayerFromRoomObject?.("exchange-terminal");
      return;
    }

    showBaseMessage(`EXCHANGE ${score} SCORE?`, {
      buttons: {
        okLabel: "CHANGE",
        onOk: () => confirmBaseExchange(score)
      }
    });
  }

  async function confirmBaseExchange(score) {
    setCabinetMessageButtons();

    try {
      const result = await window.GUNS_NET?.exchangeScore?.(
        state.pilot?.nick || window.GUNS_APP.playerNick,
        score
      );

      if (!result?.ok) {
        throw new Error(result?.message || result?.error || "Exchange rejected");
      }

      state.exchangeScore = Math.max(0, Math.floor(result.remainingScore || 0));
      if (window.GUNS_LEGACY?.player) {
        window.GUNS_LEGACY.player.score = state.exchangeScore;
      }
      const previousCoins = state.walletGunsCoin;
      syncKnownWallet(result.user);
      if (state.walletGunsCoin <= previousCoins && result.gunsCoinAdded > 0) {
        state.walletGunsCoin = previousCoins + Math.floor(result.gunsCoinAdded);
      }
      showBaseMessage(
        `EXCHANGED ${result.exchangedScore} SCORE FOR ${result.gunsCoinAdded} GS`,
        {
          onClose: () => window.GUNS_LEGACY?.bouncePlayerFromRoomObject?.("exchange-terminal")
        }
      );
    } catch (error) {
      showBaseMessage(String(error?.message || "EXCHANGE FAILED").toUpperCase(), {
        onClose: () => window.GUNS_LEGACY?.bouncePlayerFromRoomObject?.("exchange-terminal")
      });
    }
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
      input.value = getCallsign();
      window.GUNS_APP.start(getCallsign(), mode);
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
      showAuthPanel("claim", t("identity.claim", { nick: state.pendingNick }));
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
      setAuthMessage(t(getAuthErrorKey(result?.error)));
      return;
    }

    state.pilot = result.pilot;
    syncKnownWallet(result.pilot);
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

  function showNickChoicePanel(nick) {
    const panel = document.getElementById("nick-choice-panel");

    hideAuthPanel();
    setStatus("");
    setNickChoiceMessage(t("identity.freeNick", { nick }));
    panel?.classList.remove("hidden");
  }

  function hideNickChoicePanel() {
    document.getElementById("nick-choice-panel")?.classList.add("hidden");
  }

  function setNickChoiceMessage(message) {
    const element = document.getElementById("nick-choice-message");
    if (element) {
      element.textContent = message || "";
    }
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

  function getAuthErrorKey(errorCode) {
    if (errorCode === "nick_taken") return "identity.nickTaken";
    if (errorCode === "device_already_claimed") return "identity.deviceAlreadyClaimed";
    return "identity.authFailed";
  }

  function syncLogoutButton() {
    const loggedIn = Boolean(state.pilot);
    const loggedInPanel = document.getElementById("logged-in-panel");
    const message = document.getElementById("logged-in-message");
    const input = document.getElementById("pilot-nick");
    const status = document.getElementById("auth-status");
    const guestGo = document.getElementById("guest-go");
    const tutorial = document.querySelector(".tutorial-button");

    loggedInPanel?.classList.toggle("hidden", !loggedIn);
    input?.classList.toggle("hidden", loggedIn);
    status?.classList.toggle("hidden", loggedIn);
    guestGo?.classList.toggle("hidden", loggedIn);
    tutorial?.classList.toggle("hidden", loggedIn);

    if (message) {
      message.textContent = loggedIn ? t("identity.loggedInAs", { nick: state.pilot.nick }) : "";
    }

    if (loggedIn) {
      hideAuthPanel();
      hideNickChoicePanel();
      setStatus("");
    }
  }

  function logoutPilot() {
    window.GUNS_NET?.logout?.()
      .finally(async () => {
        state.pilot = null;
        state.walletGunsCoin = 0;
        const result = await window.GUNS_NET?.startAnonymousVisit?.(collectVisitMeta());
        if (result?.visit) {
          state.visit = result.visit;
          syncKnownWallet(result.visit);
        } else {
          state.localCallsign = createLocalCallsign();
          state.visit = {
            callsign: state.localCallsign,
            source: "local-fallback"
          };
        }
        const callsign = getCallsign();
        document.getElementById("pilot-nick").value = callsign;
        window.GUNS_APP.setPlayerNick(callsign);
        hideAuthPanel();
        hideNickChoicePanel();
        syncLogoutButton();
        setStatus(t("identity.loggedOut"));
      });
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
      skin: window.GUNS_CONFIG?.visual?.activeSkin || "",
      roomId: getSelectedRoomId()
    };
  }

  function buildRoomSelect() {
    const select = document.getElementById("room-select");
    const rooms = window.GUNS_SHARED_CONFIG?.rooms || {};

    if (!select) return;

    fillRoomSelect(select, rooms);

    const defaultRoomId = getDefaultRoomId(rooms);
    const roomId = isSelectableRoom(rooms[defaultRoomId])
      ? defaultRoomId
      : select.options[0]?.value || "main";

    select.value = roomId;
    window.GUNS_APP.roomId = roomId;

    select.addEventListener("change", () => {
      const nextRoomId = getSelectedRoomId();
      window.GUNS_APP.roomId = nextRoomId;
    });
  }

  function buildBaseRoomSelect() {
    const select = document.getElementById("cabinet-room-select");
    const rooms = window.GUNS_SHARED_CONFIG?.rooms || {};

    if (!select) return;

    fillRoomSelect(select, rooms);
    select.value = getDefaultRoomId(rooms);
  }

  function fillRoomSelect(select, rooms) {
    select.textContent = "";

    Object.values(rooms)
      .filter(isSelectableRoom)
      .filter(room => !isUserBaseRoom(room))
      .sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)))
      .forEach(room => {
        const option = document.createElement("option");
        option.value = room.id;
        option.textContent = getRoomOptionLabel(room);
        select.appendChild(option);
      });
  }

  function getRoomOptionLabel(room) {
    const roomId = String(room?.id || "");
    const titleKey = `room.${roomId}.title`;
    const descriptionKey = `room.${roomId}.description`;
    const translatedTitle = window.GUNS_I18N?.t?.(titleKey);
    const translatedDescription = window.GUNS_I18N?.t?.(descriptionKey);
    const title =
      translatedTitle && translatedTitle !== titleKey
        ? translatedTitle
        : room?.title || roomId;
    const description =
      translatedDescription && translatedDescription !== descriptionKey
        ? translatedDescription
        : room?.description || "";

    return description ? `${title} - ${description}` : title;
  }

  function getSelectedRoomId() {
    const select = document.getElementById("room-select");
    const roomId = select?.value;
    const rooms = window.GUNS_SHARED_CONFIG?.rooms || {};

    return rooms[roomId]
      ? roomId
      : getDefaultRoomId(rooms);
  }

  function getDefaultRoomId(rooms) {
    const defaultRoomId =
      window.GUNS_CONFIG?.multiplayer?.defaultRoomId || "main";
    return (
      isSelectableRoom(rooms?.[defaultRoomId])
        ? defaultRoomId
        : Object.values(rooms || {}).find(isSelectableRoom)?.id ||
          defaultRoomId
    );
  }

  function goToBaseSelectedRoom() {
    const roomId = document.getElementById("cabinet-room-select")?.value || getSelectedRoomId();
    const rooms = window.GUNS_SHARED_CONFIG?.rooms || {};

    if (!rooms[roomId] || !isSelectableRoom(rooms[roomId])) return;

    window.GUNS_APP.roomId = roomId;
    window.GUNS_LEGACY?.clearPlayerDeathPrompt?.();
    window.GUNS_LEGACY?.setActiveRoom?.(roomId);
    window.GUNS_NET?.disconnect?.();
    window.GUNS_NET?.connect?.({
      roomId,
      nick: window.GUNS_APP.playerNick || getCallsign()
    }).catch(() => {});
    syncBaseRoomPanel();
  }

  function syncBaseRoomPanel() {
    const panel = document.getElementById("cabinet-room-panel");
    const activeRoom = window.GUNS_LEGACY?.getActiveRoom?.();
    const isBase = isUserBaseRoom(activeRoom);

    panel?.classList.toggle("hidden", !isBase);
  }

  function isUserBaseRoom(room) {
    return (
      room?.id === USER_BASE_ROOM_ID ||
      room?.roomKind === USER_BASE_ROOM_KIND ||
      room?.roomKind === LEGACY_USER_BASE_ROOM_KIND
    );
  }

  function isSelectableRoom(room) {
    return (
      !!room &&
      room.enabled !== false &&
      (room.published === true || window.GUNS_CONFIG?.admin?.enabled === true)
    );
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
    if (isValidLocalCallsign(state.localCallsign)) return state.localCallsign;

    try {
      const stored = localStorage.getItem("guns.localCallsign") || "";
      if (isValidLocalCallsign(stored)) {
        state.localCallsign = stored;
        return state.localCallsign;
      }
    } catch {}

    state.localCallsign = `visitor-${createLocalVisitCode()}`;
    try {
      localStorage.setItem("guns.localCallsign", state.localCallsign);
    } catch {}
    return state.localCallsign;
  }

  function isValidLocalCallsign(callsign) {
    return /^visitor-\d{4}$/u.test(String(callsign || "")) &&
      callsign !== FALLBACK_SERVICE_NICK;
  }

  function createLocalVisitCode() {
    const firstSeenKey = "guns.localFirstSeenAt";
    let firstSeenAt = 0;

    try {
      firstSeenAt = Number(localStorage.getItem(firstSeenKey) || 0);
      if (!Number.isFinite(firstSeenAt) || firstSeenAt <= 0) {
        firstSeenAt = Date.now();
        localStorage.setItem(firstSeenKey, String(firstSeenAt));
      }
    } catch {
      firstSeenAt = Date.now();
    }

    const meta = collectVisitMeta();
    const source = [
      meta.browser,
      meta.os,
      meta.device,
      meta.language,
      meta.timezone,
      meta.screenWidth,
      meta.screenHeight,
      meta.pixelRatio,
      firstSeenAt
    ].join("|");

    return String(1000 + (hashStringToNumber(source) % 9000)).padStart(4, "0");
  }

  function hashStringToNumber(value) {
    let hash = 2166136261;

    for (let i = 0; i < String(value || "").length; i++) {
      hash ^= String(value).charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return Math.abs(hash >>> 0);
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
    return normalize(value).startsWith(SERVICE_NICK_PREFIX);
  }

  function t(key, params = {}) {
    const lang = window.GUNS_I18N?.language === "ru" ? "ru" : "en";
    const dictionary = {
      en: {
        "identity.loading": "CONTACTING SERVER...",
        "identity.guestReady": "TEMPORARY PILOT READY",
        "identity.emptyNick": "ENTER PILOT CALLSIGN",
        "identity.welcome": "WELCOME BACK, {nick}",
        "identity.checking": "CHECKING PILOT...",
        "identity.freeNick": "{nick} IS FREE",
        "identity.claim": "REGISTER {nick}: CREATE PASSWORD",
        "identity.login": "{nick} IS CLAIMED: ENTER PASSWORD",
        "identity.claimButton": "REGISTER",
        "identity.loginButton": "LOGIN",
        "identity.passwordShort": "PASSWORD: 6+ SYMBOLS",
        "identity.passwordMismatch": "PASSWORDS DO NOT MATCH",
        "identity.authWorking": "WORKING...",
        "identity.authFailed": "ACCESS DENIED",
        "identity.nickTaken": "PILOT IS ALREADY CLAIMED",
        "identity.deviceAlreadyClaimed": "THIS DEVICE ALREADY HAS A CLAIMED PILOT",
        "identity.reserved": "THIS CALLSIGN IS RESERVED",
        "identity.loggedInAs": "SIGNED IN AS {nick}",
        "identity.loggedOut": "LOGGED OUT. PASSWORD REQUIRED NEXT TIME."
      },
      ru: {
        "identity.loading": "СВЯЗЬ С СЕРВЕРОМ...",
        "identity.guestReady": "ВРЕМЕННЫЙ ПИЛОТ ГОТОВ",
        "identity.emptyNick": "ВВЕДИ ПОЗЫВНОЙ ПИЛОТА",
        "identity.welcome": "С ВОЗВРАЩЕНИЕМ, {nick}",
        "identity.checking": "ПРОВЕРЯЕМ ПИЛОТА...",
        "identity.freeNick": "{nick} СВОБОДЕН",
        "identity.claim": "РЕГИСТРАЦИЯ {nick}: СОЗДАЙ ПАРОЛЬ",
        "identity.login": "{nick} УЖЕ ЗАНЯТ: ВВЕДИ ПАРОЛЬ",
        "identity.claimButton": "РЕГИСТРАЦИЯ",
        "identity.loginButton": "ВОЙТИ",
        "identity.passwordShort": "ПАРОЛЬ: 6+ СИМВОЛОВ",
        "identity.passwordMismatch": "ПАРОЛИ НЕ СОВПАЛИ",
        "identity.authWorking": "РАБОТАЕМ...",
        "identity.authFailed": "ВХОД ЗАПРЕЩЕН",
        "identity.nickTaken": "ПИЛОТ УЖЕ ЗАСТОЛБЛЕН",
        "identity.deviceAlreadyClaimed": "НА ЭТОМ УСТРОЙСТВЕ УЖЕ ЕСТЬ ПИЛОТ",
        "identity.reserved": "СЛУЖЕБНЫЙ ПОЗЫВНОЙ ЗАРЕЗЕРВИРОВАН",
        "identity.loggedInAs": "ВХОД: {nick}",
        "identity.loggedOut": "ВЫХОД ВЫПОЛНЕН. ДАЛЬШЕ НУЖЕН ПАРОЛЬ."
      }
    };
    const template = dictionary[lang][key] || dictionary.en[key] || key;

    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    );
  }
})();
