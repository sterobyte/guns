import { randomUUID } from "node:crypto";

export class MatchState {
  constructor(roomId, roomConfig = {}, modeConfig = {}, now = Date.now()) {
    const durationSec = Number(modeConfig?.rules?.durationSec || 0);
    const durationMs = Math.max(0, Math.floor(durationSec * 1000));

    this.id = `${roomId}-${now}-${randomUUID().slice(0, 8)}`;
    this.roomId = roomId;
    this.modeId = roomConfig?.modeId || modeConfig?.id || "";
    this.modeKind = modeConfig?.kind || "deathmatch";
    this.state = durationMs > 0 ? "active" : "waiting";
    this.createdAt = now;
    this.startedAt = this.state === "active" ? now : 0;
    this.countdownStartedAt = 0;
    this.countdownMs = 0;
    this.durationMs = durationMs;
    this.endsAt = this.startedAt && durationMs > 0 ? this.startedAt + durationMs : 0;
    this.finishedAt = 0;
    this.finishReason = "";
    this.results = null;
    this.events = [];
    this.resultPersisted = false;
  }

  update(now = Date.now(), leaderboard = []) {
    if (this.state === "countdown" && this.countdownStartedAt > 0) {
      const countdownEndsAt = this.countdownStartedAt + this.countdownMs;

      if (now >= countdownEndsAt) {
        this.start(now);
      }
    }

    if (this.state === "active" && this.endsAt > 0 && now >= this.endsAt) {
      this.finish("timer", now, leaderboard);
    }

    return this;
  }

  start(now = Date.now()) {
    if (this.state === "finished") return this;

    this.state = "active";
    this.startedAt ||= now;
    this.endsAt = this.durationMs > 0 ? this.startedAt + this.durationMs : 0;
    return this;
  }

  finish(reason = "completed", now = Date.now(), leaderboard = []) {
    if (this.state === "finished") return this;

    this.state = "finished";
    this.finishedAt = now;
    this.finishReason = reason;
    this.recordEvent("match-finished", {
      reason
    }, now);
    this.results = createMatchResults(leaderboard, reason, now, this.events);
    return this;
  }

  recordEvent(type, payload = {}, now = Date.now()) {
    const event = {
      type,
      at: now,
      ...payload
    };

    this.events.push(event);

    if (this.events.length > 200) {
      this.events.splice(0, this.events.length - 200);
    }

    return event;
  }

  markResultPersisted() {
    this.resultPersisted = true;
  }

  snapshot(now = Date.now(), leaderboard = []) {
    this.update(now, leaderboard);

    return {
      id: this.id,
      roomId: this.roomId,
      modeId: this.modeId,
      modeKind: this.modeKind,
      state: this.state,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      countdownStartedAt: this.countdownStartedAt,
      countdownMs: this.countdownMs,
      durationMs: this.durationMs,
      endsAt: this.endsAt,
      remainingMs: this.getRemainingMs(now),
      finishedAt: this.finishedAt,
      finishReason: this.finishReason,
      results: this.results,
      events: this.events,
      resultPersisted: this.resultPersisted
    };
  }

  getRemainingMs(now = Date.now()) {
    if (this.state === "finished") return 0;
    if (this.state === "countdown") {
      return Math.max(0, this.countdownStartedAt + this.countdownMs - now);
    }
    if (this.state !== "active" || this.endsAt <= 0) return this.durationMs;

    return Math.max(0, this.endsAt - now);
  }
}

function createMatchResults(leaderboard = [], reason = "completed", now = Date.now(), events = []) {
  const rows = Array.isArray(leaderboard)
    ? leaderboard.map((row, index) => ({
      rank: index + 1,
      id: row.id || "",
      nick: row.nick || "",
      score: Math.max(0, Math.floor(Number(row.score) || 0)),
      pilotKills: Math.max(0, Math.floor(Number(row.pilotKills) || 0)),
      cannonBreaks: Math.max(0, Math.floor(Number(row.cannonBreaks) || 0)),
      pilotDeaths: Math.max(0, Math.floor(Number(row.pilotDeaths) || 0)),
      kind: row.kind || "",
      color: row.color || ""
    }))
    : [];
  const winner = rows[0] || null;

  return {
    finishedAt: now,
    finishReason: reason,
    winnerId: winner?.id || "",
    winnerNick: winner?.nick || "",
    leaderboard: rows,
    events
  };
}
