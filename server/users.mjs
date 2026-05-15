import { sanitizeNick } from "./rooms.mjs";

export class UserRegistry {
  constructor() {
    this.users = new Map();
  }

  register(rawNick, meta = {}) {
    const nick = sanitizeNick(rawNick);
    const now = Date.now();
    const existing = this.users.get(nick);

    if (existing) {
      existing.lastSeenAt = now;
      existing.sessions += 1;

      if (meta.online !== undefined) {
        existing.online = Boolean(meta.online);
      }

      existing.roomId = meta.roomId || existing.roomId || "";
      existing.source = meta.source || existing.source || "game";
      return existing;
    }

    const user = {
      nick,
      firstSeenAt: now,
      lastSeenAt: now,
      sessions: 1,
      online: meta.online === undefined ? false : Boolean(meta.online),
      roomId: meta.roomId || "",
      source: meta.source || "game"
    };

    this.users.set(nick, user);
    return user;
  }

  setOnline(rawNick, online, meta = {}) {
    const nick = sanitizeNick(rawNick);
    const user = this.users.get(nick);

    if (!user) return null;

    user.online = Boolean(online);
    user.lastSeenAt = Date.now();

    if (meta.roomId !== undefined) {
      user.roomId = meta.roomId || "";
    }

    return user;
  }

  list() {
    return Array.from(this.users.values())
      .map((user) => ({ ...user }))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.nick.localeCompare(b.nick));
  }

  snapshot() {
    return {
      users: this.list(),
      total: this.users.size,
      online: this.list().filter((user) => user.online).length,
      serverTime: Date.now()
    };
  }
}
