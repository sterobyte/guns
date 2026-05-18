const PASSIVE_SCORE_INTERVAL_MS = 100;
const MAX_SERVER_BULLETS_PER_ROOM = 256;
const MAX_BULLETS_PER_SHOT_EVENT = 6;
const DEFAULT_BULLET_SPEED = 720;
const DEFAULT_BULLET_LIFE_MS = 1400;
const MAX_BULLET_SPEED = 1300;
const MAX_BULLET_LIFE_MS = 2500;
const MAX_BULLET_ORIGIN_DRIFT = 240;
const HIT_SCAN_STEP_MS = 50;
const SERVER_DAMAGE_AUTHORITY_MS = 1500;
const MELEE_COOLDOWN_MS = 650;
const MELEE_EXTRA_RANGE = 12;

export class ArenaRoomState {
  constructor(roomId, roomConfig = {}) {
    this.roomId = roomId;
    this.createdAt = Date.now();
    this.scoreEvents = [];
    this.players = new Map();
    this.bots = createRoomBots(roomConfig);
    this.bullets = new Map();
    this.nextBulletSeq = 1;
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
    const now = Date.now();
    const serverDamageActive =
      player.serverDamagedAt &&
      now - player.serverDamagedAt < SERVER_DAMAGE_AUTHORITY_MS;
    const snapshotHp = Math.max(0, finiteNumber(snapshot.hp));

    player.alive = serverDamageActive && player.alive === false
      ? false
      : snapshot.alive !== false;
    player.hp = serverDamageActive && snapshotHp > player.hp
      ? player.hp
      : snapshotHp;
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
    player.lastSeenAt = now;

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

  respawnPlayer(client, event = {}) {
    const now = Date.now();
    const player = this.join(client);
    const x = finiteNumber(event.x);
    const y = finiteNumber(event.y);

    player.x = x;
    player.y = y;
    player.state = event.state === "in-cannon" ? "in-cannon" : "on-foot";
    player.flying = Boolean(event.flying);
    player.alive = true;
    player.maxHp = Math.max(1, finiteNumber(event.maxHp) || player.maxHp || 100);
    player.hp = player.maxHp;
    player.serverDamagedAt = 0;
    player.killedAt = 0;
    player.lastSeenAt = now;

    return {
      id: `${now}-${client.id}-respawn`,
      clientId: client.id,
      nick: client.nick || player.nick,
      x: player.x,
      y: player.y,
      state: player.state,
      flying: player.flying,
      hp: player.hp,
      maxHp: player.maxHp,
      serverTime: now
    };
  }

  recordShootEvent(client, event = {}) {
    const now = Date.now();
    const player = this.join(client);
    const rawBullets = Array.isArray(event.bullets) && event.bullets.length > 0
      ? event.bullets
      : [event];
    const bullets = [];

    this.updateBullets(now);

    for (const rawBullet of rawBullets.slice(0, MAX_BULLETS_PER_SHOT_EVENT)) {
      const bullet = this.createBullet(client, player, event, rawBullet || {}, now);

      if (!bullet) continue;

      this.bullets.set(bullet.id, bullet);
      bullets.push(this.snapshotBullet(bullet, now));
    }

    while (this.bullets.size > MAX_SERVER_BULLETS_PER_ROOM) {
      const oldestId = this.bullets.keys().next().value;
      this.bullets.delete(oldestId);
    }

    return bullets;
  }

  recordMeleeEvent(client, event = {}) {
    const now = Date.now();
    const attacker = this.join(client);
    const targetId = sanitizeEventText(event.targetId, 64);
    const target = this.players.get(targetId);

    if (!target) return null;
    if (target.id === attacker.id) return null;
    if (attacker.online === false || target.online === false) return null;
    if (attacker.alive === false || target.alive === false) return null;
    if (attacker.state !== "on-foot" || target.state !== "on-foot") return null;
    if (attacker.flying || target.flying) return null;
    if (now - (attacker.lastMeleeAt || 0) < MELEE_COOLDOWN_MS) return null;

    const distance = Math.hypot(attacker.x - target.x, attacker.y - target.y);
    const maxDistance =
      Math.max(1, attacker.radiusInner) +
      Math.max(1, target.radiusInner) +
      MELEE_EXTRA_RANGE;

    if (distance > maxDistance) return null;

    attacker.lastMeleeAt = now;

    return this.applyHitDamage({
      id: `${now}-${client.id}-melee-${target.id}`,
      bulletId: "",
      ownerId: client.id,
      ownerNick: client.nick || attacker.nick,
      targetId: target.id,
      targetNick: target.nick,
      targetKind: "pilot",
      damage: clampNumber(finiteNumber(event.damage), 0, 100),
      weapon: sanitizeEventText(event.weapon || "melee", 32),
      x: target.x,
      y: target.y,
      serverTime: now
    }, now);
  }

  createBullet(client, player, event, rawBullet, now) {
    const angle = finiteNumber(rawBullet.angle ?? event.angle ?? player.angle);
    const requestedVx = finiteNumber(rawBullet.vx ?? event.vx);
    const requestedVy = finiteNumber(rawBullet.vy ?? event.vy);
    const requestedSpeed = Math.hypot(requestedVx, requestedVy);
    const fallbackSpeed = clampNumber(
      finiteNumber(rawBullet.speed ?? event.speed) || DEFAULT_BULLET_SPEED,
      1,
      MAX_BULLET_SPEED
    );
    let vx = requestedSpeed > 0 ? requestedVx : Math.cos(angle) * fallbackSpeed;
    let vy = requestedSpeed > 0 ? requestedVy : Math.sin(angle) * fallbackSpeed;
    const speed = Math.hypot(vx, vy);

    if (speed <= 0) return null;

    if (speed > MAX_BULLET_SPEED) {
      const ratio = MAX_BULLET_SPEED / speed;
      vx *= ratio;
      vy *= ratio;
    }

    const origin = this.getBulletOrigin(player, rawBullet, event);
    const lifeMs = Math.floor(clampNumber(
      finiteNumber(rawBullet.lifeMs ?? event.lifeMs) || DEFAULT_BULLET_LIFE_MS,
      100,
      MAX_BULLET_LIFE_MS
    ));

    return {
      id: `${now}-${client.id}-${this.nextBulletSeq++}`,
      ownerId: client.id,
      ownerNick: client.nick || player.nick,
      weapon: sanitizeEventText(rawBullet.weapon || event.weapon || "gun", 32),
      x: origin.x,
      y: origin.y,
      vx,
      vy,
      angle,
      radius: clampNumber(finiteNumber(rawBullet.radius ?? event.radius) || 4, 1, 8),
      damage: clampNumber(finiteNumber(rawBullet.damage ?? event.damage), 0, 100),
      createdAt: now,
      lastCheckedAt: now,
      expiresAt: now + lifeMs,
      lifeMs
    };
  }

  getBulletOrigin(player, rawBullet, event) {
    const fallback = {
      x: finiteNumber(player.x),
      y: finiteNumber(player.y)
    };
    const hasRequestedOrigin =
      Number.isFinite(Number(rawBullet.x ?? event.x)) &&
      Number.isFinite(Number(rawBullet.y ?? event.y));

    if (!hasRequestedOrigin) {
      return fallback;
    }

    const requested = {
      x: finiteNumber(rawBullet.x ?? event.x),
      y: finiteNumber(rawBullet.y ?? event.y)
    };
    const distanceFromPlayer = Math.hypot(
      requested.x - fallback.x,
      requested.y - fallback.y
    );

    if (distanceFromPlayer > 0 && distanceFromPlayer <= MAX_BULLET_ORIGIN_DRIFT) {
      return requested;
    }

    return fallback;
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

  updateBullets(now = Date.now()) {
    for (const [id, bullet] of this.bullets) {
      if (bullet.expiresAt <= now) {
        this.bullets.delete(id);
      }
    }
  }

  updateCombat(now = Date.now()) {
    const hits = [];

    for (const [id, bullet] of this.bullets) {
      if (bullet.expiresAt <= now) {
        this.bullets.delete(id);
        continue;
      }

      const hit = this.findBulletHit(bullet, now);

      bullet.lastCheckedAt = now;

      if (hit) {
        hits.push(this.applyHitDamage(hit, now));
        this.bullets.delete(id);
      }
    }

    return hits;
  }

  findBulletHit(bullet, now) {
    const fromTime = Math.max(
      bullet.createdAt,
      finiteNumber(bullet.lastCheckedAt) || bullet.createdAt,
      now - HIT_SCAN_STEP_MS
    );
    const startAge = Math.max(0, fromTime - bullet.createdAt) / 1000;
    const endAge = Math.max(0, now - bullet.createdAt) / 1000;
    const from = {
      x: bullet.x + bullet.vx * startAge,
      y: bullet.y + bullet.vy * startAge
    };
    const to = {
      x: bullet.x + bullet.vx * endAge,
      y: bullet.y + bullet.vy * endAge
    };

    for (const target of this.players.values()) {
      if (target.id === bullet.ownerId) continue;
      if (target.online === false) continue;
      if (target.alive === false) continue;
      if (target.flying) continue;

      const targetRadius = target.state === "in-cannon"
        ? target.radiusOuter
        : target.radiusInner;
      const hitRadius = Math.max(1, targetRadius) + Math.max(1, bullet.radius);

      if (distanceToSegment(target.x, target.y, from.x, from.y, to.x, to.y) > hitRadius) {
        continue;
      }

      return {
        id: `${now}-${bullet.id}-${target.id}`,
        bulletId: bullet.id,
        ownerId: bullet.ownerId,
        ownerNick: bullet.ownerNick,
        targetId: target.id,
        targetNick: target.nick,
        targetKind: target.state === "in-cannon" ? "cannon" : "pilot",
        damage: bullet.damage,
        weapon: bullet.weapon,
        x: target.x,
        y: target.y,
        serverTime: now
      };
    }

    return null;
  }

  applyHitDamage(hit, now) {
    const target = this.players.get(hit.targetId);
    const beforeHp = Math.max(0, finiteNumber(target?.hp));
    const maxHp = Math.max(1, finiteNumber(target?.maxHp) || 1);
    const damage = Math.max(0, finiteNumber(hit.damage));
    const afterHp = Math.max(0, beforeHp - damage);
    const killed = beforeHp > 0 && afterHp <= 0;

    if (target) {
      target.hp = afterHp;
      target.maxHp = maxHp;
      target.lastSeenAt = now;

      if (killed) {
        target.alive = false;
        target.killedAt = now;
      }

      target.serverDamagedAt = now;
    }

    return {
      ...hit,
      damage,
      beforeHp,
      afterHp,
      maxHp,
      killed
    };
  }

  hasActiveBullets(now = Date.now()) {
    this.updateBullets(now);
    return this.bullets.size > 0;
  }

  snapshot(match = null) {
    const now = Date.now();

    this.updateBullets(now);

    const players = Array.from(this.players.values())
      .filter((player) => player.online !== false)
      .map((player) => ({ ...player }));
    const bots = Array.from(this.bots.values())
      .map((bot) => ({ ...bot }));
    const bullets = Array.from(this.bullets.values())
      .map((bullet) => this.snapshotBullet(bullet, now));

    return {
      id: this.roomId,
      createdAt: this.createdAt,
      serverTime: now,
      match,
      players,
      bots,
      bullets,
      scoreboard: buildScoreboardRows(players, bots)
    };
  }

  snapshotBullet(bullet, now) {
    const ageSeconds = Math.max(0, now - bullet.createdAt) / 1000;

    return {
      ...bullet,
      x: bullet.x + bullet.vx * ageSeconds,
      y: bullet.y + bullet.vy * ageSeconds,
      ageMs: Math.max(0, now - bullet.createdAt)
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

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, finiteNumber(value)));
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lengthSq = abx * abx + aby * aby;

  if (lengthSq <= 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;

  return Math.hypot(px - cx, py - cy);
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
