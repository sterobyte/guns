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
    this.recordMatchResult = options.recordMatchResult || (() => {});
    this.matchTick = setInterval(() => this.broadcastMatchStates(), 1000);
    this.matchTick.unref?.();
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

    if (message.type === "client:snapshot") {
      const room = this.rooms.get(client.roomId);
      if (!room) return;

      room.arena.updatePlayer(client, message.snapshot || {});

      this.broadcast(
        client.roomId,
        {
          type: "peer:snapshot",
          from: client.id,
          snapshot: message.snapshot || null,
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
        arena: new ArenaRoomState(roomId),
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
