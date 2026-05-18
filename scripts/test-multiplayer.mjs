const roomId = process.env.GUNS_TEST_ROOM || `mp-smoke-${Date.now()}`;
const wsUrl = process.env.GUNS_TEST_WS_URL ||
  `ws://127.0.0.1:3000/ws?room=${encodeURIComponent(roomId)}&nick=`;
const timeoutMs = Number(process.env.GUNS_TEST_TIMEOUT_MS || 5000);

const clients = [
  createTestClient("smokeA", {
    x: -120,
    y: 0,
    score: 11,
    pilotKills: 1
  }),
  createTestClient("smokeB", {
    x: 120,
    y: 0,
    score: 7,
    cannonBreaks: 1
  })
];
const emptyRoomClient = createTestClient("solo", {
  x: 0,
  y: 0,
  score: 0
}, {
  roomId: "multiplayer-test"
});

const timeout = setTimeout(() => fail("timeout"), timeoutMs);

try {
  await Promise.all(clients.map((client) => client.open()));
  clients.forEach((client) => client.sendSnapshot());
  await waitFor(() => clients.every((client) => client.matchId), "match id");
  assert(
    clients[0].matchId === clients[1].matchId,
    `match id mismatch: ${clients[0].matchId} !== ${clients[1].matchId}`
  );
  await waitFor(() => clients.every((client) => client.players.size === 2), "players=2");
  await waitFor(() => clients.every((client) => client.remoteSnapshots.size >= 1), "remote snapshots");
  clients[0].sendSnapshot({
    state: "in-cannon",
    gunType: "autogun"
  });
  clients[0].sendShootEvent();
  await waitFor(() => clients.every((client) => client.bullets.length >= 1), "server bullets");
  await waitFor(() => clients.every((client) => client.hits.length >= 1), "server bullet hit");
  await waitFor(() => clients.every((client) => client.damageEvents.length >= 1), "server damage event");
  await waitFor(() => clients.every((client) => client.deaths.length >= 1), "server death event");
  clients[1].sendRespawnEvent();
  await waitFor(() => clients.every((client) => client.respawns.length >= 1), "server respawn event");
  clients[0].sendCombatEvent(999999, "pilot-kill");
  clients[0].sendCombatEvent(999999, "cannon-break");
  clients[0].sendCombatEvent(999999, "pilot-death");
  clients[0].sendCombatEvent(999999, "ammo-load");
  clients[0].sendScoreEvent(999999, "unknown-score");
  await waitFor(() => clients.every((client) => client.scoreboard.some((row) =>
    row.nick === "smokeA" &&
    row.score === 280 &&
    row.pilotKills === 2 &&
    row.cannonBreaks === 1 &&
    row.pilotDeaths === 1
  )), "server score event counters");
  await waitFor(() => clients.every((client) =>
    ["pilot-kill", "cannon-break", "pilot-death"].every((type) =>
      client.matchEvents.some((event) => event.type === type)
    )
  ), "match event log");
  clients[0].sendSnapshot({
    x: 120,
    y: 45,
    hp: 100,
    maxHp: 100
  });
  clients[1].sendSnapshot({
    x: 120,
    y: 30,
    hp: 100,
    maxHp: 100
  });
  clients[1].sendMeleeEvent(clients[0], 120);
  await waitFor(() => clients.every((client) =>
    client.meleeEvents.length >= 1 &&
    client.damageEvents.length >= 2 &&
    client.deaths.length >= 2
  ), "server melee kill");
  await waitFor(() => clients.every((client) => client.scoreboard.some((row) =>
    row.nick === "smokeB" &&
    row.score === 130 &&
    row.pilotKills === 1
  )), "server melee scoring");
  await emptyRoomClient.open();
  emptyRoomClient.sendSnapshot();
  await waitFor(() => emptyRoomClient.scoreboard.length === 1, "empty room solo scoreboard");
  assert(
    emptyRoomClient.scoreboard[0]?.nick === "solo",
    `solo room scoreboard mismatch: ${JSON.stringify(emptyRoomClient.scoreboard)}`
  );

  clearTimeout(timeout);
  clients.forEach((client) => client.close());
  emptyRoomClient.close();
  console.log(JSON.stringify({
    ok: true,
    roomId,
    matchId: clients[0].matchId,
    players: clients.map((client) => client.players.size),
    remoteSnapshots: clients.map((client) => client.remoteSnapshots.size),
    scoreboards: clients.map((client) => client.scoreboard.length),
    bullets: clients.map((client) => client.bullets.length),
    hits: clients.map((client) => client.hits.length),
    damageEvents: clients.map((client) => client.damageEvents.length),
    deaths: clients.map((client) => client.deaths.length),
    respawns: clients.map((client) => client.respawns.length),
    meleeEvents: clients.map((client) => client.meleeEvents.length),
    soloScoreboard: emptyRoomClient.scoreboard.length,
    matchEvents: clients.map((client) => client.matchEvents.length)
  }, null, 2));
} catch (error) {
  fail(error.message);
}

function createTestClient(nick, snapshot, options = {}) {
  const clientWsUrl = options.roomId
    ? `ws://127.0.0.1:3000/ws?room=${encodeURIComponent(options.roomId)}&nick=`
    : wsUrl;
  const state = {
    nick,
    socket: null,
    clientId: "",
    matchId: "",
    players: new Set(),
    remoteSnapshots: new Set(),
    scoreboard: [],
    bullets: [],
    hits: [],
    damageEvents: [],
    deaths: [],
    respawns: [],
    meleeEvents: [],
    matchEvents: [],
    open() {
      return new Promise((resolve, reject) => {
        const socket = new WebSocket(`${clientWsUrl}${encodeURIComponent(nick)}`);
        const onError = () => reject(new Error(`${nick}: websocket error`));

        state.socket = socket;
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", onError, { once: true });
        socket.addEventListener("message", (event) => handleMessage(state, event));
      });
    },
    sendSnapshot(overrides = {}) {
      state.socket?.send(JSON.stringify({
        type: "client:snapshot",
        snapshot: {
          nick,
          alive: true,
          hp: 100,
          maxHp: 100,
          angle: 0,
          state: "on-foot",
          ...snapshot,
          ...overrides
        },
        clientTime: Date.now()
      }));
    },
    sendScoreEvent(value, reason) {
      state.socket?.send(JSON.stringify({
        type: "score:event",
        event: {
          value,
          reason,
          total: value
        },
        clientTime: Date.now()
      }));
    },
    sendCombatEvent(value, reason) {
      state.socket?.send(JSON.stringify({
        type: "combat:event",
        event: {
          value,
          reason,
          targetId: "test-target",
          targetKind: "test"
        },
        clientTime: Date.now()
      }));
    },
    sendShootEvent() {
      state.socket?.send(JSON.stringify({
        type: "shoot:event",
        event: {
          weapon: "gun",
          bullets: [{
            x: snapshot.x + 20,
            y: snapshot.y,
            vx: 720,
            vy: 0,
            radius: 4,
            damage: 120,
            lifeMs: 1000
          }]
        },
        clientTime: Date.now()
      }));
    },
    sendRespawnEvent() {
      state.socket?.send(JSON.stringify({
        type: "respawn:event",
        event: {
          x: snapshot.x,
          y: snapshot.y + 30,
          state: "on-foot",
          flying: false,
          maxHp: 100
        },
        clientTime: Date.now()
      }));
    },
    sendMeleeEvent(targetClient, damage = 1) {
      state.socket?.send(JSON.stringify({
        type: "melee:event",
        event: {
          targetId: targetClient.clientId,
          weapon: "basic-knife",
          damage
        },
        clientTime: Date.now()
      }));
    },
    close() {
      state.socket?.close?.();
    }
  };

  return state;
}

function handleMessage(client, event) {
  const message = JSON.parse(event.data);

  if (message.type === "welcome") {
    client.clientId = message.clientId || "";
  }

  if (message.type === "room:state") {
    client.matchId = message.room?.match?.id || client.matchId;
    client.matchEvents = message.room?.match?.events || client.matchEvents;
    client.players = new Set((message.room?.players || []).map((player) => player.id));
  }

  if (message.type === "arena:state") {
    client.matchId = message.arena?.match?.id || client.matchId;
    client.matchEvents = message.arena?.match?.events || client.matchEvents;
    client.scoreboard = message.arena?.scoreboard || client.scoreboard;
    client.bullets = message.arena?.bullets || client.bullets;
    for (const player of message.arena?.players || []) {
      client.players.add(player.id);
      if (player.id !== client.clientId) {
        client.remoteSnapshots.add(player.id);
      }
    }
  }

  if (message.type === "hit:event" && message.hit) {
    client.hits.push(message.hit);
  }

  if (message.type === "damage:event" && message.damage) {
    client.damageEvents.push(message.damage);
  }

  if (message.type === "death:event" && message.death) {
    client.deaths.push(message.death);
  }

  if (message.type === "respawn:event" && message.respawn) {
    client.respawns.push(message.respawn);
  }

  if (message.type === "melee:event" && message.hit) {
    client.meleeEvents.push(message.hit);
  }

  if (message.type === "peer:snapshot" && message.from && message.from !== client.clientId) {
    client.remoteSnapshots.add(message.from);
  }
}

function waitFor(predicate, label) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        resolve();
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`wait failed: ${label}`));
      }
    }, 50);
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fail(message) {
  clearTimeout(timeout);
  clients.forEach((client) => client.close());
  emptyRoomClient.close();
  console.error(JSON.stringify({
    ok: false,
    error: message,
    clients: [...clients, emptyRoomClient].map((client) => ({
      nick: client.nick,
      clientId: client.clientId,
      matchId: client.matchId,
      players: client.players.size,
      remoteSnapshots: client.remoteSnapshots.size,
      matchEvents: client.matchEvents,
      scoreboard: client.scoreboard
    }))
  }, null, 2));
  process.exit(1);
}
