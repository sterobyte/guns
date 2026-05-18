import { PROTOCOL_VERSION, encodeJson } from "./protocol.mjs";
import { ArenaRoomState } from "./arena.mjs";
import { MatchState } from "./match.mjs";

const MAX_NICK_LENGTH = 14;
const MAX_ROOM_LENGTH = 32;

export function sanitizeNick(value) {
  const nick = String(value || "")
    .trim()
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .slice(0, MAX_NICK_LENGTH);

  return nick || "pilot";
}

export function sanitizeRoomId(value) {
  const roomId = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, MAX_ROOM_LENGTH);

  return roomId || "main";
}

export class MultiplayerHub {
  constructor(options = {}) {
    this.rooms = new Map();
    this.maxClientsPerRoom = options.maxClientsPerRoom || 16;
    this.getRoomConfig = options.getRoomConfig || (() => null);
    this.getModeConfig = options.getModeConfig || (() => null);
    this.getCannonConfig = options.getCannonConfig || (() => null);
    this.getPilotWeaponConfig = options.getPilotWeaponConfig || (() => null);
    this.recordMatchResult = options.recordMatchResult || (() => {});
    this.matchTick = setInterval(() => this.broadcastMatchStates(), 1000);
    this.combatTick = setInterval(() => this.broadcastCombatStates(), 50);
    this.matchTick.unref?.();
    this.combatTick.unref?.();
  }

  join(client, requestedRoomId, requestedNick) {
    const roomId = sanitizeRoomId(requestedRoomId);
    const nick = sanitizeNick(requestedNick);
    const room = this.getOrCreateRoom(roomId);

    if (room.clients.size >= this.maxClientsPerRoom) {
      client.send({
        type: "error",
        code: "room_full",
        message: "Room is full"
      });
      client.close();
      return null;
    }

    client.roomId = roomId;
    client.nick = nick;
    room.clients.set(client.id, client);
    room.arena.join(client);

    client.send({
      type: "welcome",
      protocol: PROTOCOL_VERSION,
      clientId: client.id,
      roomId,
      nick,
      serverTime: Date.now()
    });

    this.broadcastRoomState(roomId);
    this.broadcast(
      roomId,
      {
        type: "peer:joined",
        peer: this.describeClient(client),
        serverTime: Date.now()
      },
      client.id
    );

    return room;
  }

  leave(client) {
    if (!client.roomId) return;

    const room = this.rooms.get(client.roomId);
    if (!room) return;

    room.clients.delete(client.id);
    room.arena.leave(client.id);

    this.broadcast(client.roomId, {
      type: "peer:left",
      clientId: client.id,
      serverTime: Date.now()
    });

    if (room.clients.size === 0) {
      this.rooms.delete(client.roomId);
    } else {
      this.broadcastRoomState(client.roomId);
    }
  }

  handleMessage(client, message) {
    if (!message || typeof message.type !== "string") return;

    if (message.type === "ping") {
      client.send({
        type: "pong",
        serverTime: Date.now()
      });
      return;
    }

    if (message.type === "input") {
      this.broadcast(
        client.roomId,
        {
          type: "input",
          from: client.id,
          seq: Number(message.seq || 0),
          input: sanitizeInput(message.input),
          clientTime: Number(message.clientTime || 0),
          serverTime: Date.now()
        },
        client.id
      );
      return;
    }

    if (message.type === "score:event") {
      const room = this.rooms.get(client.roomId);
      if (!room) return;

      const event = room.arena.recordScoreEvent(client, {
        ...(message.event || {}),
        clientTime: message.clientTime
      }, room.modeConfig?.rules || {});

      if (!event) return;

      room.match.recordEvent(event.reason, {
        scoreEventId: event.id,
        clientId: event.clientId,
        nick: event.nick,
        value: event.value,
        score: event.score,
        clientTotal: event.clientTotal
      }, event.serverTime);

      this.broadcast(
        client.roomId,
        {
          type: "score:event",
          event,
          serverTime: Date.now()
        }
      );
      this.broadcastArenaState(client.roomId);
      return;
    }

    if (message.type === "combat:event") {
      const room = this.rooms.get(client.roomId);
      if (!room) return;

      const event = room.arena.recordCombatEvent(client, {
        ...(message.event || {}),
        clientTime: message.clientTime
      }, room.modeConfig?.rules || {});

      if (!event) return;

      room.match.recordEvent(event.reason, {
        scoreEventId: event.id,
        source: event.source,
        clientId: event.clientId,
        nick: event.nick,
        targetId: event.targetId,
        targetKind: event.targetKind,
        value: event.value,
        score: event.score,
        clientTotal: event.clientTotal
      }, event.serverTime);

      this.broadcast(
        client.roomId,
        {
          type: "combat:event",
          event,
          serverTime: Date.now()
        }
      );
      this.broadcastArenaState(client.roomId);
      return;
    }

    if (message.type === "shoot:event") {
      const room = this.rooms.get(client.roomId);
      if (!room) return;

      const bullets = room.arena.recordShootEvent(client, {
        ...(message.event || {}),
        clientTime: message.clientTime
      });

      if (!bullets.length) return;

      this.broadcast(
        client.roomId,
        {
          type: "shoot:event",
          from: client.id,
          bullets,
          serverTime: Date.now()
        }
      );
      this.broadcastArenaState(client.roomId);
      return;
    }

    if (message.type === "melee:event") {
      const room = this.rooms.get(client.roomId);
      if (!room) return;

      const hit = room.arena.recordMeleeEvent(client, {
        ...(message.event || {}),
        clientTime: message.clientTime
      });

      if (!hit) return;

      this.broadcast(
        client.roomId,
        {
          type: "melee:event",
          from: client.id,
          hit,
          serverTime: Date.now()
        }
      );
      this.processCombatHits(room, [hit]);
      this.broadcastArenaState(client.roomId);
      return;
    }

    if (message.type === "respawn:event") {
      const room = this.rooms.get(client.roomId);
      if (!room) return;

      const respawn = room.arena.respawnPlayer(client, message.event || {});

      this.broadcast(client.roomId, {
        type: "respawn:event",
        respawn,
        serverTime: Date.now()
      });
      this.broadcastArenaState(client.roomId);
      return;
    }

    if (message.type === "client:snapshot") {
      const room = this.rooms.get(client.roomId);
      if (!room) return;

      const player = room.arena.updatePlayer(client, message.snapshot || {});
      const acceptedSnapshot = player
        ? { ...player, clientId: player.id }
        : message.snapshot || null;

      client.send({
        type: "server:snapshot",
        snapshot: acceptedSnapshot,
        serverTime: Date.now()
      });

      this.broadcast(
        client.roomId,
        {
          type: "peer:snapshot",
          from: client.id,
          snapshot: acceptedSnapshot,
          serverTime: Date.now()
        },
        client.id
      );

      this.broadcastArenaState(client.roomId);
    }
  }

  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      const roomConfig = this.getRoomConfig(roomId) || {};
      const modeConfig = this.getModeConfig(roomConfig.modeId) || {};
      this.rooms.set(roomId, {
        id: roomId,
        createdAt: Date.now(),
        roomConfig,
        modeConfig,
        clients: new Map(),
        arena: new ArenaRoomState(roomId, roomConfig, {
          getCannonConfig: this.getCannonConfig,
          getPilotWeaponConfig: this.getPilotWeaponConfig
        }),
        match: new MatchState(roomId, roomConfig, modeConfig)
      });
    }

    return this.rooms.get(roomId);
  }

  broadcastRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.broadcast(roomId, {
      type: "room:state",
      room: this.describeRoom(room),
      serverTime: Date.now()
    });
  }

  broadcastArenaState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.broadcast(roomId, {
      type: "arena:state",
      arena: room.arena.snapshot(this.getMatchSnapshot(room)),
      serverTime: Date.now()
    });
  }

  broadcastMatchStates() {
    for (const room of this.rooms.values()) {
      if (room.clients.size <= 0) continue;
      if (!room.match?.durationMs) continue;

      room.match.update(Date.now(), room.arena.scoreboardRows());
      this.broadcastArenaState(room.id);
    }
  }

  broadcastCombatStates() {
    const now = Date.now();

    for (const room of this.rooms.values()) {
      if (room.clients.size <= 0) continue;
      const hits = room.arena.updateCombat(now);
      const hasBullets = room.arena.hasActiveBullets(now);

      if (hits.length) {
        this.processCombatHits(room, hits);
      }

      if (hits.length || hasBullets) {
        this.broadcastArenaState(room.id);
      }
    }
  }

  processCombatHits(room, hits) {
    for (const hit of hits) {
      const shooter = room.clients.get(hit.ownerId);

      if (shooter) {
        const event = room.arena.recordCombatEvent(shooter, {
          reason: "bullet-hit",
          targetId: hit.targetId,
          targetKind: hit.targetKind,
          clientTime: hit.serverTime
        }, room.modeConfig?.rules || {});

        if (event) {
          room.match.recordEvent(event.reason, {
            scoreEventId: event.id,
            source: event.source,
            clientId: event.clientId,
            nick: event.nick,
            targetId: event.targetId,
            targetKind: event.targetKind,
            value: event.value,
            score: event.score,
            clientTotal: event.clientTotal
          }, event.serverTime);
        }
      }

      this.broadcast(room.id, {
        type: "hit:event",
        hit,
        serverTime: Date.now()
      });

      this.broadcast(room.id, {
        type: "damage:event",
        damage: {
          id: hit.id,
          sourceId: hit.ownerId,
          sourceNick: hit.ownerNick,
          targetId: hit.targetId,
          targetNick: hit.targetNick,
          targetKind: hit.targetKind,
          weapon: hit.weapon,
          damage: hit.damage,
          beforeHp: hit.beforeHp,
          afterHp: hit.afterHp,
          maxHp: hit.maxHp,
          serverTime: hit.serverTime
        },
        serverTime: Date.now()
      });

      if (hit.killed) {
        this.processCombatDeath(room, hit);
      }
    }
  }

  processCombatDeath(room, hit) {
    const shooter = room.clients.get(hit.ownerId);
    const victim = room.clients.get(hit.targetId);
    const killReason = hit.targetKind === "cannon" ? "cannon-break" : "pilot-kill";

    if (shooter) {
      const killEvent = room.arena.recordCombatEvent(shooter, {
        reason: killReason,
        targetId: hit.targetId,
        targetKind: hit.targetKind,
        clientTime: hit.serverTime
      }, room.modeConfig?.rules || {});

      if (killEvent) {
        room.match.recordEvent(killEvent.reason, {
          scoreEventId: killEvent.id,
          source: killEvent.source,
          clientId: killEvent.clientId,
          nick: killEvent.nick,
          targetId: killEvent.targetId,
          targetKind: killEvent.targetKind,
          value: killEvent.value,
          score: killEvent.score,
          clientTotal: killEvent.clientTotal
        }, killEvent.serverTime);
      }
    }

    if (victim && hit.targetKind === "pilot") {
      const deathEvent = room.arena.recordCombatEvent(victim, {
        reason: "pilot-death",
        targetId: hit.targetId,
        targetKind: hit.targetKind,
        clientTime: hit.serverTime
      }, room.modeConfig?.rules || {});

      if (deathEvent) {
        room.match.recordEvent(deathEvent.reason, {
          scoreEventId: deathEvent.id,
          source: deathEvent.source,
          clientId: deathEvent.clientId,
          nick: deathEvent.nick,
          targetId: deathEvent.targetId,
          targetKind: deathEvent.targetKind,
          value: deathEvent.value,
          score: deathEvent.score,
          clientTotal: deathEvent.clientTotal
        }, deathEvent.serverTime);
      }
    }

    this.broadcast(room.id, {
      type: "death:event",
      death: {
        id: `${hit.id}-death`,
        sourceId: hit.ownerId,
        sourceNick: hit.ownerNick,
        targetId: hit.targetId,
        targetNick: hit.targetNick,
        targetKind: hit.targetKind,
        reason: killReason,
        weapon: hit.weapon,
        serverTime: hit.serverTime
      },
      serverTime: Date.now()
    });
  }

  broadcast(roomId, message, exceptClientId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const frame = encodeJson(message);

    for (const client of room.clients.values()) {
      if (client.id === exceptClientId) continue;
      client.write(frame);
    }
  }

  describeClient(client) {
    return {
      id: client.id,
      nick: client.nick,
      inventory: client.inventory || { pilotWeapons: [] },
      connectedAt: client.connectedAt,
      lastSeenAt: client.lastSeenAt
    };
  }

  describeRoom(room) {
    return {
      id: room.id,
      createdAt: room.createdAt,
      match: this.getMatchSnapshot(room),
      arena: room.arena.snapshot(this.getMatchSnapshot(room)),
      players: Array.from(room.clients.values()).map((client) =>
        this.describeClient(client)
      )
    };
  }

  snapshot() {
    return {
      protocol: PROTOCOL_VERSION,
      rooms: Array.from(this.rooms.values()).map((room) =>
        this.describeRoom(room)
      )
    };
  }

  getMatchSnapshot(room) {
    const snapshot = room.match.snapshot(Date.now(), room.arena.scoreboardRows());

    this.persistFinishedMatch(room, snapshot);
    return snapshot;
  }

  persistFinishedMatch(room, matchSnapshot) {
    if (matchSnapshot.state !== "finished") return;
    if (!matchSnapshot.results || room.match.resultPersisted) return;

    this.recordMatchResult({
      matchId: matchSnapshot.id,
      roomId: matchSnapshot.roomId,
      modeId: matchSnapshot.modeId,
      modeKind: matchSnapshot.modeKind,
      state: matchSnapshot.state,
      createdAt: matchSnapshot.createdAt,
      startedAt: matchSnapshot.startedAt,
      finishedAt: matchSnapshot.finishedAt,
      finishReason: matchSnapshot.finishReason,
      durationMs: matchSnapshot.durationMs,
      leaderboard: matchSnapshot.results.leaderboard || [],
      winnerId: matchSnapshot.results.winnerId || "",
      winnerNick: matchSnapshot.results.winnerNick || "",
      events: matchSnapshot.events || []
    });
    room.match.markResultPersisted();
  }
}

function sanitizeInput(input) {
  if (!input || typeof input !== "object") return {};

  return {
    up: Boolean(input.up),
    down: Boolean(input.down),
    left: Boolean(input.left),
    right: Boolean(input.right),
    fire: Boolean(input.fire),
    fly: Boolean(input.fly),
    aimX: finiteNumber(input.aimX),
    aimY: finiteNumber(input.aimY)
  };
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
