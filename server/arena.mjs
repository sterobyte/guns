const SERVER_BOTS = [
  { id: "bot1", nick: "Yuriy" },
  { id: "bot2", nick: "Sidorova" },
  { id: "bot3", nick: "Kirk" },
  { id: "bot4", nick: "Lara" },
  { id: "bot5", nick: "Danila" }
];

export class ArenaRoomState {
  constructor(roomId) {
    this.roomId = roomId;
    this.createdAt = Date.now();
    this.players = new Map();
    this.bots = new Map(
      SERVER_BOTS.map((bot) => [
        bot.id,
        {
          ...bot,
          score: 0,
          pilotKills: 0,
          cannonBreaks: 0,
          pilotDeaths: 0,
          online: true,
          serverControlled: true,
          createdAt: Date.now(),
          lastSeenAt: Date.now()
        }
      ])
    );
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
        score: 0,
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
    player.score = Math.max(0, Math.floor(finiteNumber(snapshot.score)));
    player.pilotKills = Math.max(0, Math.floor(finiteNumber(snapshot.pilotKills)));
    player.cannonBreaks = Math.max(0, Math.floor(finiteNumber(snapshot.cannonBreaks)));
    player.pilotDeaths = Math.max(0, Math.floor(finiteNumber(snapshot.pilotDeaths)));
    player.online = true;
    player.lastSeenAt = Date.now();

    this.updateBots(snapshot.bots);

    return player;
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

  snapshot() {
    const players = Array.from(this.players.values())
      .filter((player) => player.online !== false)
      .map((player) => ({ ...player }));
    const bots = Array.from(this.bots.values())
      .map((bot) => ({ ...bot }));
    const rows = [
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
    ];

    return {
      id: this.roomId,
      createdAt: this.createdAt,
      serverTime: Date.now(),
      players,
      bots,
      scoreboard: rows
        .sort((a, b) => b.score - a.score || a.nick.localeCompare(b.nick))
    };
  }
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function positiveInt(value) {
  return Math.max(0, Math.floor(finiteNumber(value)));
}
