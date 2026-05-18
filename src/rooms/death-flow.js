(function () {
  function createPlayerDeathPrompt() {
    return {
      active: false,
      buttons: []
    };
  }

  function isDeathPromptActive(prompt) {
    return !!prompt?.active;
  }

  function clearPlayerDeathPrompt(prompt, roomRuntimeState) {
    if (!prompt) return;

    prompt.active = false;
    prompt.buttons = [];

    if (roomRuntimeState?.deathOverlays) {
      roomRuntimeState.deathOverlays.length = 0;
    }
  }

  function startPlayerDeathPrompt(options) {
    const prompt = options.prompt;
    const player = options.player;

    clearPlayerDeathPrompt(prompt, options.roomRuntimeState);
    prompt.active = true;

    if (options.mouse) {
      options.mouse.down = false;
    }

    player.state = "pilot";
    player.pilotFlyState = "rising";
    player.pilotFlyTime = 0;
    player.pilotKnockback = null;
    player.pilotEject = null;
    player.pilotImmunity = Math.max(
      player.pilotImmunity,
      options.pilotImmunityTime
    );
  }

  function continuePlayerAfterDeath(options) {
    const prompt = options.prompt;
    const player = options.player;

    prompt.active = false;
    prompt.buttons = [];

    if (options.mouse) {
      options.mouse.down = false;
    }

    player.pilotFlyState = "falling";
    player.pilotFlyTime = 0;
    player.pilotKnockback = null;
    player.pilotEject = null;
    player.pilotImmunity = options.pilotImmunityTime;
  }

  function exitPlayerAfterDeath(options) {
    const prompt = options.prompt;
    const player = options.player;

    prompt.active = false;
    prompt.buttons = [];

    if (options.mouse) {
      options.mouse.down = false;
    }

    player.pilotFlyState = "ground";
    player.pilotFlyTime = 0;
    player.pilotRadius = options.pilotRadius;
    player.pilotImmunity = options.pilotImmunityTime;

    if (window.GUNS_APP?.stop) {
      window.GUNS_APP.stop();
      return;
    }

    if (window.GUNS_APP) {
      window.GUNS_APP.started = false;
    }

    window.GUNS_NET?.disconnect?.();
    document.getElementById("start-screen")?.classList.remove("hidden");
  }

  function applyPilotDeathState(options) {
    const victim = options.victim;

    victim.pilotHp = 1;
    victim.pilotImmunity = options.pilotImmunityTime;
    victim.pilotKnockback = null;
    victim.pilotEject = null;
    victim.pilotWeaponCooldown = 0;
    victim.pilotRadius = options.pilotRadius;
    victim.pilotFlyState = "ground";
    victim.pilotFlyTime = 0;
    victim.carriedAmmoValue = 0;
    victim.carriedRepairValue = 0;
    victim.pilotLastMoveVx = 0;
    victim.pilotLastMoveVy = 0;
    options.clampPilotToRoom?.(victim);
    victim.state = "pilot";
  }

  window.GUNS_DEATH_FLOW = {
    createPlayerDeathPrompt,
    isDeathPromptActive,
    clearPlayerDeathPrompt,
    startPlayerDeathPrompt,
    continuePlayerAfterDeath,
    exitPlayerAfterDeath,
    applyPilotDeathState
  };
})();
