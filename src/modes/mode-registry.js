(function () {
  const DEFAULT_MODE_ID = "classic-deathmatch";
  const DEFAULT_RULES = {
    durationSec: 0,
    showTimer: 0,
    passiveScorePerTick: 1,
    bulletHitScore: 30,
    ammoLoadScore: 40,
    pilotKillScore: 100,
    cannonBreakScore: 50
  };

  function getModes() {
    return window.GUNS_SHARED_CONFIG?.modes || {};
  }

  function getModeById(modeId) {
    const modes = getModes();
    return modes[modeId] || modes[DEFAULT_MODE_ID] || null;
  }

  function getRoomMode(room) {
    return getModeById(room?.modeId);
  }

  function getModeRule(mode, ruleName, fallbackValue = 0) {
    const value = Number(mode?.rules?.[ruleName]);

    if (Number.isFinite(value)) return value;

    const fallback = Number(DEFAULT_RULES[ruleName] ?? fallbackValue);

    return Number.isFinite(fallback) ? fallback : 0;
  }

  function getRoomModeRule(room, ruleName, fallbackValue = 0) {
    return getModeRule(getRoomMode(room), ruleName, fallbackValue);
  }

  const baseHandler = {
    createState(mode, room, now) {
      const durationMs = Math.max(0, getModeRule(mode, "durationSec", 0) * 1000);

      return {
        modeId: mode?.id || room?.modeId || DEFAULT_MODE_ID,
        modeKind: mode?.kind || "deathmatch",
        mode,
        startedAt: now,
        elapsedMs: 0,
        durationMs,
        remainingMs: durationMs,
        ended: false,
        winnerId: "",
        events: []
      };
    },
    onRoomEnter(state, context) {
      recordModeEvent(state, "room-enter", {
        roomId: context.room?.id || ""
      });
    },
    onTick(state, context) {
      if (!state || state.ended) return;

      state.elapsedMs += Math.max(0, Math.floor((context.dt || 0) * 1000));

      if (state.durationMs > 0) {
        state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

        if (state.remainingMs <= 0) {
          endMode(state, {
            reason: "timer",
            winnerId: getLeadingUnitId(context.units)
          });
        }
      }
    },
    onScore(state, context) {
      recordModeEvent(state, "score", {
        unitId: context.unit?.id || "",
        value: context.value || 0,
        reason: context.reason || ""
      });
    },
    onPilotKill(state, context) {
      recordModeEvent(state, "pilot-kill", {
        victimId: context.victim?.id || "",
        killerId: context.killer?.id || ""
      });
    },
    onCannonBreak(state, context) {
      recordModeEvent(state, "cannon-break", {
        unitId: context.unit?.id || "",
        attackerId: context.attacker?.id || ""
      });
    }
  };

  const handlers = {
    deathmatch: baseHandler
  };

  function getModeHandler(mode) {
    return handlers[mode?.kind] || baseHandler;
  }

  function createModeState(room, now = Date.now()) {
    const mode = getRoomMode(room);

    return getModeHandler(mode).createState(mode, room, now);
  }

  function recordModeEvent(state, type, payload = {}) {
    if (!state || !type) return null;

    const event = {
      type,
      at: Date.now(),
      ...payload
    };

    state.events.push(event);

    if (state.events.length > 64) {
      state.events.splice(0, state.events.length - 64);
    }

    return event;
  }

  function endMode(state, payload = {}) {
    if (!state || state.ended) return state;

    state.ended = true;
    state.endedAt = Date.now();
    state.endReason = payload.reason || "completed";
    state.winnerId = payload.winnerId || "";
    state.remainingMs = 0;
    recordModeEvent(state, "mode-ended", {
      reason: state.endReason,
      winnerId: state.winnerId
    });

    return state;
  }

  function getLeadingUnitId(units = []) {
    let leader = null;

    for (const unit of units || []) {
      if (!unit || unit.isCannonOnly) continue;
      if (!leader || (unit.score || 0) > (leader.score || 0)) {
        leader = unit;
      }
    }

    return leader?.id || "";
  }

  function onRoomEnter(state, context = {}) {
    getModeHandler(state?.mode).onRoomEnter?.(state, context);
  }

  function onTick(state, context = {}) {
    getModeHandler(state?.mode).onTick?.(state, context);
  }

  function onScore(state, context = {}) {
    getModeHandler(state?.mode).onScore?.(state, context);
  }

  function onPilotKill(state, context = {}) {
    getModeHandler(state?.mode).onPilotKill?.(state, context);
  }

  function onCannonBreak(state, context = {}) {
    getModeHandler(state?.mode).onCannonBreak?.(state, context);
  }

  window.GUNS_MODE_REGISTRY = {
    getModeById,
    getRoomMode,
    getModeRule,
    getRoomModeRule,
    getModeHandler,
    createModeState,
    endMode,
    onRoomEnter,
    onTick,
    onScore,
    onPilotKill,
    onCannonBreak,
    defaultRules: DEFAULT_RULES
  };
})();
