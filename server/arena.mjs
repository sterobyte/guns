const PASSIVE_SCORE_INTERVAL_MS = 100;

export class ArenaRoomState {
  constructor(roomId, roomConfig = {}) {
    this.roomId = roomId;
    this.createdAt = Date.now();
    this.scoreEvents = [];
    this.players = new Map();
    this.bots = createRoomBots(roomConfig);
  }

  join(client) {
    if (!this.players.has(client.id)) {
      this.players.set(client.id, {
        id: client.id,
        nick: client.nick,
        x: 0,
        y: 0,
        angle: 0,
        state: "on-foot",
        flying: false,
        alive: true,
        hp: 0,
        maxHp: 100,
        ammo: 0,
        maxAmmo: 0,
        radiusOuter: 34,
        radiusInner: 13,
        score: 0,
        clientScore: 0,
        lastPassiveScoreAt: 0,
        pilotKills: 0,
        cannonBreaks: 0,
        pilotDeaths: 0,
        connectedAt: Date.now(),
        lastSeenAt: Date.now(),
        online: true
      });
    }

    return this.players.get(client.id);
  }

  leave(clientId) {
    const player = this.players.get(clientId);

    if (!player) return;

    player.online = false;
    player.lastSeenAt = Date.now();
  }

  updatePlayer(client, snapshot = {}) {
    const player = this.join(client);

    player.nick = snapshot.nick || client.nick || player.nick;
    player.x = finiteNumber(snapshot.x);
    player.y = finiteNumber(snapshot.y);
    player.angle = finiteNumber(snapshot.angle);
    player.state = snapshot.state === "in-cannon" ? "in-cannon" : "on-foot";
    player.flying = Boolean(snapshot.flying);
    player.alive = snapshot.alive !== false;
    player.hp = Math.max(0, finiteNumber(snapshot.hp));
    player.maxHp = Math.max(1, finiteNumber(snapshot.maxHp) || 100);
    player.ammo = Math.max(0, Math.floor(finiteNumber(snapshot.ammo)));
    player.maxAmmo = Math.max(0, Math.floor(finiteNumber(snapshot.maxAmmo)));
    player.radiusOuter = Math.max(1, finiteNumber(snapshot.radiusOuter) || 34);
    player.radiusInner = Math.max(1, finiteNumber(snapshot.radiusInner) || 13);
    player.clientScore = Math.max(0, Math.floor(finiteNumber(snapshot.score)));
    player.clientPilotKills = Math.max(0, Math.floor(finiteNumber(snapshot.pilotKills)));
    player.clientCannonBreaks = Math.max(0, Math.floor(finiteNumber(snapshot.cannonBreaks)));
    player.clientPilotDeaths = Math.max(0, Math.floor(finiteNumber(snapshot.pilotDeaths)));
    player.online = true;
    player.lastSeenAt = Date.now();

    this.updateBots(snapshot.bots);

    return player;
  }

  recordScoreEvent(client, event = {}, rules = {}) {
    return this.recordPointEvent(client, event, rules, "score");
  }

  recordCombatEvent(client, event = {}, rules = {}) {
    const reason = normalizeCombatReason(event.reason);

    if (!reason) return null;

    return this.recordPointEvent(client, {
      ...event,
      reason
    }, rules, "combat");
  }

  recordPointEvent(client, event = {}, rules = {}, source = "score") {
    const player = this.join(client);
    const reason = normalizeScoreReason(event.reason);
    const value = getServerScoreValue(reason, rules);
    const now = Date.now();

    if (!reason) return null;
    if (value <= 0 && reason !== "pilot-death") return null;

    if (reason === "passive" && now - player.lastPassiveScoreAt < PASSIVE_SCORE_INTERVAL_MS) {
      return null;
    }

    const scoreEvent = {
      id: `${now}-${client.id}-${this.scoreEvents.length}`,
      clientId: client.id,
      nick: client.nick || player.nick,
      value,
      reason,
      source,
      targetId: sanitizeEventText(event.targetId, 64),
      targetKind: sanitizeEventText(event.targetKind, 32),
      clientTotal: Math.max(0, Math.floor(finiteNumber(event.total))),
      clientTime: Math.max(0, Math.floor(finiteNumber(event.clientTime))),
      serverTime: now
    };

    if (reason === "passive") {
      player.lastPassiveScoreAt = now;
    }

    player.score += value;
    applyServerCounter(player, reason);
    player.lastSeenAt = now;
    scoreEvent.score = player.score;
    scoreEvent.pilotKills = player.pilotKills;
    scoreEvent.cannonBreaks = player.cannonBreaks;
    scoreEvent.pilotDeaths = player.pilotDeaths;
    this.scoreEvents.push(scoreEvent);

    if (this.scoreEvents.length > 256) {
      this.scoreEvents.splice(0, this.scoreEvents.length - 256);
    }

    return scoreEvent;
  }

  updateBots(rawBots) {
    if (!Array.isArray(rawBots)) return;

    for (const rawBot of rawBots) {
      const botId = String(rawBot?.id || "");
      const bot = this.bots.get(botId);

      if (!bot) continue;

      bot.nick = String(rawBot.nick || bot.nick).slice(0, 24);
      bot.score = Math.max(bot.score, positiveInt(rawBot.score));
      bot.pilotKills = Math.max(bot.pilotKills, positiveInt(rawBot.pilotKills));
      bot.cannonBreaks = Math.max(bot.cannonBreaks, positiveInt(rawBot.cannonBreaks));
      bot.pilotDeaths = Math.max(bot.pilotDeaths, positiveInt(rawBot.pilotDeaths));
      bot.lastSeenAt = Date.now();
    }
  }

  scoreboardRows() {
    return buildScoreboardRows(
      Array.from(this.players.values())
        .filter((player) => player.online !== false),
      Array.from(this.bots.values())
    );
  }

  snapshot(match = null) {
    const players = Array.from(this.players.values())
      .filter((player) => player.online !== false)
      .map((player) => ({ ...player }));
    const bots = Array.from(this.bots.values())
      .map((bot) => ({ ...bot }));

    return {
      id: this.roomId,
      createdAt: this.createdAt,
      serverTime: Date.now(),
      match,
      players,
      bots,
      scoreboard: buildScoreboardRows(players, bots)
    };
  }
}

function buildScoreboardRows(players, bots) {
  return [
    ...players.map((player) => ({
      id: player.id,
      nick: player.nick,
      score: player.score,
      pilotKills: player.pilotKills,
      cannonBreaks: player.cannonBreaks,
      pilotDeaths: player.pilotDeaths,
      color: "remote",
      kind: "human"
    })),
    ...bots.map((bot) => ({
      id: bot.id,
      nick: bot.nick,
      score: bot.score,
      pilotKills: bot.pilotKills,
      cannonBreaks: bot.cannonBreaks,
      pilotDeaths: bot.pilotDeaths,
      color: bot.id,
      kind: "bot"
    }))
  ].sort((a, b) => b.score - a.score || a.nick.localeCompare(b.nick));
}

function createRoomBots(roomConfig = {}) {
  const botSpawns = Array.isArray(roomConfig?.spawns?.bots)
    ? roomConfig.spawns.bots
    : [];
  const now = Date.now();

  return new Map(
    botSpawns.map((bot, index) => {
      const id = String(bot.unitId || bot.id || `bot${index + 1}`);

      return [
        id,
        {
          id,
          nick: String(bot.name || bot.nick || id),
          score: 0,
          pilotKills: 0,
          cannonBreaks: 0,
          pilotDeaths: 0,
          online: true,
          serverControlled: true,
          createdAt: now,
          lastSeenAt: now
        }
      ];
    })
  );
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function positiveInt(value) {
  return Math.max(0, Math.floor(finiteNumber(value)));
}

function normalizeScoreReason(reason) {
  const value = String(reason || "").trim();

  return SCORE_REASON_TO_RULE[value] ? value : "";
}

function normalizeCombatReason(reason) {
  const value = normalizeScoreReason(reason);

  return COMBAT_SCORE_REASONS.has(value) ? value : "";
}

function sanitizeEventText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/[^\p{L}\p{N}_:.-]/gu, "")
    .slice(0, maxLength);
}

function getServerScoreValue(reason, rules = {}) {
  const ruleName = SCORE_REASON_TO_RULE[reason];

  if (!ruleName) return 0;

  const fallback = DEFAULT_SCORE_VALUES[reason] || 0;
  const value = Number(rules[ruleName] ?? fallback);

  if (!Number.isFinite(value) || value <= 0) return 0;

  return Math.floor(value);
}

const SCORE_REASON_TO_RULE = {
  passive: "passiveScorePerTick",
  "bullet-hit": "bulletHitScore",
  "ammo-load": "ammoLoadScore",
  "pilot-kill": "pilotKillScore",
  "cannon-break": "cannonBreakScore",
  "pilot-death": "pilotDeathScore"
};

const COMBAT_SCORE_REASONS = new Set([
  "bullet-hit",
  "pilot-kill",
  "cannon-break",
  "pilot-death"
]);

const DEFAULT_SCORE_VALUES = {
  passive: 1,
  "bullet-hit": 30,
  "ammo-load": 40,
  "pilot-kill": 100,
  "cannon-break": 50,
  "pilot-death": 0
};

function applyServerCounter(player, reason) {
  if (reason === "pilot-kill") {
    player.pilotKills++;
  }

  if (reason === "cannon-break") {
    player.cannonBreaks++;
  }

  if (reason === "pilot-death") {
    player.pilotDeaths++;
  }
}
