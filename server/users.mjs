import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import { sanitizeNick } from "./rooms.mjs";

const AUTH_SESSION_TTL = 1000 * 60 * 60 * 24 * 30;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const SERVICE_NICK = "CADET";

export const VISIT_COOKIE = "guns_vid";
export const AUTH_COOKIE = "guns_sid";
export const DEVICE_COOKIE = "guns_did";

export class UserRegistry {
  constructor() {
    this.anonymousVisits = new Map();
    this.visitIdByTokenHash = new Map();
    this.pilots = new Map();
    this.authSessions = new Map();
    this.devices = new Map();
  }

  startVisit(cookies = {}, meta = {}) {
    const existing = this.getVisitByToken(cookies[VISIT_COOKIE]);
    const now = Date.now();
    const deviceResult = this.ensureDevice(cookies, meta, now);

    if (existing) {
      existing.lastSeenAt = now;
      existing.views += 1;
      existing.meta = mergeMeta(existing.meta, meta);

      return {
        visit: publicVisit(existing),
        deviceToken: deviceResult.deviceToken
      };
    }

    const token = createToken();
    const tokenHash = hashToken(token);
    const segment = getVisitSegment(meta);
    const visit = {
      id: randomUUID(),
      callsign: createCallsign(),
      code: segment.code,
      tokenHash,
      firstSeenAt: now,
      lastSeenAt: now,
      views: 1,
      sessions: 0,
      online: false,
      activeConnections: 0,
      connectionIds: new Set(),
      roomId: "",
      source: "anonymous",
      unclaimedNick: "",
      unclaimedNickUsedAt: 0,
      unclaimedNickSessions: 0,
      meta: {
        ...meta,
        segment: segment.label
      },
      claimedPilotId: null,
      claimedNick: "",
      convertedAt: 0
    };

    this.anonymousVisits.set(visit.id, visit);
    this.visitIdByTokenHash.set(tokenHash, visit.id);

    return {
      visit: publicVisit(visit),
      visitToken: token,
      deviceToken: deviceResult.deviceToken
    };
  }

  ensureDevice(cookies = {}, meta = {}, now = Date.now()) {
    const existing = this.getDeviceByToken(cookies[DEVICE_COOKIE]);

    if (existing) {
      existing.lastSeenAt = now;
      existing.views += 1;
      existing.meta = mergeMeta(existing.meta, meta);

      return {
        device: existing,
        deviceToken: ""
      };
    }

    const token = createToken();
    const device = {
      id: randomUUID(),
      tokenHash: hashToken(token),
      firstSeenAt: now,
      lastSeenAt: now,
      views: 1,
      claimedPilotId: "",
      claimedNick: "",
      claimedAt: 0,
      meta
    };

    this.devices.set(device.tokenHash, device);

    return {
      device,
      deviceToken: token
    };
  }

  getVisitByToken(token) {
    const tokenHash = hashToken(token || "");
    const visitId = this.visitIdByTokenHash.get(tokenHash);

    return visitId ? this.anonymousVisits.get(visitId) || null : null;
  }

  getDeviceByToken(token) {
    const tokenHash = hashToken(token || "");

    return tokenHash ? this.devices.get(tokenHash) || null : null;
  }

  getAuthenticatedPilot(cookies = {}) {
    const token = cookies[AUTH_COOKIE];
    const session = this.getSessionByToken(token);

    if (!session) return null;

    const pilot = this.getPilotById(session.pilotId);

    if (!pilot) return null;

    session.lastSeenAt = Date.now();
    pilot.lastSeenAt = session.lastSeenAt;

    return {
      pilot: publicPilot(pilot),
      session: publicSession(session)
    };
  }

  checkPilot(rawNick) {
    const nick = sanitizeNick(rawNick);
    const normalizedNick = normalizeNick(nick);
    const reserved = isReservedNick(nick);
    const pilot = this.pilots.get(normalizedNick);

    return {
      nick,
      normalizedNick,
      exists: Boolean(pilot),
      available: !reserved && !pilot,
      reserved
    };
  }

  useUnclaimedNick(rawNick, cookies = {}, meta = {}) {
    const checked = this.checkPilot(rawNick);

    if (checked.reserved) {
      return error("reserved_nick", "This pilot name is reserved.");
    }

    if (!checked.available) {
      return error("nick_taken", "This pilot name is already claimed.");
    }

    const safeMeta = { ...meta };
    delete safeMeta.visitToken;

    const currentVisit = this.getVisitByToken(cookies[VISIT_COOKIE]);
    const visitCookies = currentVisit?.claimedPilotId
      ? { [DEVICE_COOKIE]: cookies[DEVICE_COOKIE] || "" }
      : cookies;
    const visitResult = this.startVisit(
      visitCookies,
      safeMeta
    );
    const visit = this.anonymousVisits.get(visitResult.visit.id);

    if (!visit) {
      return error("visit_missing", "Anonymous visit is missing.");
    }

    const now = Date.now();

    visit.unclaimedNick = checked.nick;
    visit.unclaimedNickUsedAt = now;
    visit.unclaimedNickSessions = (visit.unclaimedNickSessions || 0) + 1;
    visit.lastSeenAt = now;

    return {
      ok: true,
      visit: publicVisit(visit),
      visitToken: visitResult.visitToken,
      deviceToken: visitResult.deviceToken || ""
    };
  }

  claimPilot(rawNick, password, cookies = {}, meta = {}) {
    const checked = this.checkPilot(rawNick);
    const now = Date.now();
    const deviceResult = this.ensureDevice(cookies, meta, now);
    const device = deviceResult.device;

    if (checked.reserved) {
      return error("reserved_nick", "This pilot name is reserved.");
    }

    if (!checked.available) {
      return error("nick_taken", "This pilot name is already claimed.");
    }

    if (device?.claimedPilotId) {
      return error("device_already_claimed", "This device already has a claimed pilot.");
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return error(passwordError, "Password is not valid.");
    }

    const visitCookies = deviceResult.deviceToken
      ? { ...cookies, [DEVICE_COOKIE]: deviceResult.deviceToken }
      : cookies;
    const visitResult = this.startVisit(visitCookies, meta);
    const visit = this.anonymousVisits.get(visitResult.visit.id);
    const pilot = {
      id: randomUUID(),
      nick: checked.nick,
      normalizedNick: checked.normalizedNick,
      passwordHash: hashPassword(password),
      createdAt: now,
      lastSeenAt: now,
      lastLoginAt: now,
      sessions: 1,
      online: false,
      activeConnections: 0,
      connectionIds: new Set(),
      roomId: "",
      source: "pilot",
      firstVisitId: visit?.id || "",
      telegramId: null,
      telegramUsername: "",
      telegramLinkedAt: 0
    };

    if (visit) {
      this.linkVisitToPilot(visit, pilot, now);
    }

    this.pilots.set(pilot.normalizedNick, pilot);

    if (device) {
      device.claimedPilotId = pilot.id;
      device.claimedNick = pilot.nick;
      device.claimedAt = now;
    }

    const session = this.createAuthSession(pilot.id, meta);

    return {
      ok: true,
      pilot: publicPilot(pilot),
      visit: visit ? publicVisit(visit) : visitResult.visit,
      visitToken: visitResult.visitToken,
      deviceToken: deviceResult.deviceToken || visitResult.deviceToken || "",
      session: publicSession(session),
      sessionToken: session.token
    };
  }

  loginPilot(rawNick, password, cookies = {}, meta = {}) {
    const nick = sanitizeNick(rawNick);
    const pilot = this.pilots.get(normalizeNick(nick));

    if (!pilot || !verifyPassword(password, pilot.passwordHash)) {
      return error("invalid_credentials", "Pilot name or password is wrong.");
    }

    pilot.sessions += 1;
    pilot.lastLoginAt = Date.now();
    pilot.lastSeenAt = pilot.lastLoginAt;

    const visitResult = this.startVisit(cookies, meta);
    const visit = this.anonymousVisits.get(visitResult.visit.id);

    if (visit) {
      this.linkVisitToPilot(visit, pilot, pilot.lastLoginAt);
    }

    const session = this.createAuthSession(pilot.id, meta);

    return {
      ok: true,
      pilot: publicPilot(pilot),
      visit: visit ? publicVisit(visit) : visitResult.visit,
      visitToken: visitResult.visitToken,
      deviceToken: visitResult.deviceToken || "",
      session: publicSession(session),
      sessionToken: session.token
    };
  }

  logout(cookies = {}) {
    const tokenHash = hashToken(cookies[AUTH_COOKIE] || "");
    const session = this.authSessions.get(tokenHash);

    if (session) {
      session.revokedAt = Date.now();
      this.authSessions.delete(tokenHash);
    }

    return {
      ok: true
    };
  }

  register(rawNick, meta = {}) {
    const nick = sanitizeNick(rawNick);
    const now = Date.now();
    const countSession = meta.source !== "game-start";
    const cookieVisit = this.getVisitByToken(meta.visitToken);

    if (cookieVisit && isReservedNick(nick)) {
      cookieVisit.unclaimedNick = "";
      cookieVisit.unclaimedNickUsedAt = 0;
      cookieVisit.lastSeenAt = now;
      cookieVisit.sessions += countSession ? 1 : 0;
      updatePresence(cookieVisit, meta);
      return publicVisit(cookieVisit);
    }

    const pilot = this.pilots.get(normalizeNick(nick));

    if (pilot) {
      pilot.lastSeenAt = now;
      updatePresence(pilot, meta);

      if (cookieVisit) {
        this.linkVisitToPilot(cookieVisit, pilot, now);
      }

      return publicPilot(pilot);
    }

    if (cookieVisit && visitMatchesNick(cookieVisit, nick)) {
      cookieVisit.lastSeenAt = now;
      cookieVisit.sessions += countSession ? 1 : 0;
      updatePresence(cookieVisit, meta);
      return publicVisit(cookieVisit);
    }

    const visit = this.getVisitByNick(nick);

    if (visit) {
      visit.lastSeenAt = now;
      visit.sessions += countSession ? 1 : 0;
      updatePresence(visit, meta);
      return publicVisit(visit);
    }

    if (cookieVisit && !isReservedNick(nick)) {
      const result = this.useUnclaimedNick(nick, {
        [VISIT_COOKIE]: meta.visitToken
      }, meta);

      if (result.ok) return result.visit;
    }

    const fallback = {
      id: `transient:${normalizeNick(nick)}`,
      callsign: nick,
      firstSeenAt: now,
      lastSeenAt: now,
      views: 0,
      sessions: countSession ? 1 : 0,
      online: meta.online === undefined ? false : Boolean(meta.online),
      activeConnections: 0,
      connectionIds: new Set(),
      roomId: meta.roomId || "",
      source: "transient",
      unclaimedNick: nick,
      unclaimedNickUsedAt: now,
      unclaimedNickSessions: 1,
      claimedPilotId: null,
      claimedNick: ""
    };

    this.anonymousVisits.set(fallback.id, fallback);
    updatePresence(fallback, meta);
    return publicVisit(fallback);
  }

  setOnline(rawNick, online, meta = {}) {
    const nick = sanitizeNick(rawNick);
    const visit = this.getVisitByToken(meta.visitToken);
    const pilot = this.pilots.get(normalizeNick(nick));
    const entity = pilot || visit || this.getVisitByNick(nick);

    if (!entity) return null;

    entity.lastSeenAt = Date.now();
    updatePresence(entity, {
      ...meta,
      online
    });

    return pilot ? publicPilot(entity) : publicVisit(entity);
  }

  list() {
    const visits = Array.from(this.anonymousVisits.values())
      .filter((visit) => !visit.claimedPilotId)
      .map(publicVisit);
    const pilots = Array.from(this.pilots.values()).map(publicPilot);

    return [...pilots, ...visits]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.nick.localeCompare(b.nick));
  }

  snapshot() {
    const users = this.list();

    return {
      users,
      total: users.length,
      anonymousTotal: this.anonymousVisits.size,
      pilotsTotal: this.pilots.size,
      devicesTotal: this.devices.size,
      online: users.filter((user) => user.online).length,
      connections: users.reduce((sum, user) => sum + (user.activeConnections || 0), 0),
      serverTime: Date.now()
    };
  }

  deleteUser(userId) {
    const id = String(userId || "");

    if (this.anonymousVisits.has(id)) {
      const visit = this.anonymousVisits.get(id);
      this.anonymousVisits.delete(id);

      if (visit?.tokenHash) {
        this.visitIdByTokenHash.delete(visit.tokenHash);
      }

      return {
        ok: true,
        deleted: {
          id,
          status: "visit"
        }
      };
    }

    for (const [normalizedNick, pilot] of this.pilots.entries()) {
      if (pilot.id !== id) continue;

      this.pilots.delete(normalizedNick);

      for (const [tokenHash, session] of this.authSessions.entries()) {
        if (session.pilotId === id) {
          this.authSessions.delete(tokenHash);
        }
      }

      return {
        ok: true,
        deleted: {
          id,
          status: "claimed"
        }
      };
    }

    return error("user_not_found", "User row was not found.");
  }

  linkVisitToPilotByToken(token, pilotId) {
    const visit = this.getVisitByToken(token);
    const pilot = this.getPilotById(pilotId);

    if (!visit || !pilot) return null;

    this.linkVisitToPilot(visit, pilot);
    return publicVisit(visit);
  }

  linkVisitToPilot(visit, pilot, now = Date.now()) {
    visit.claimedPilotId = pilot.id;
    visit.claimedNick = pilot.nick;
    visit.convertedAt = visit.convertedAt || now;
    visit.lastSeenAt = now;

    if (!pilot.firstVisitId) {
      pilot.firstVisitId = visit.id;
    }

    return visit;
  }

  getVisitByCallsign(callsign) {
    const nick = sanitizeNick(callsign);

    for (const visit of this.anonymousVisits.values()) {
      if (visit.callsign === nick) {
        return visit;
      }
    }

    return null;
  }

  getVisitByNick(rawNick) {
    const nick = sanitizeNick(rawNick);
    const normalizedNick = normalizeNick(nick);

    for (const visit of this.anonymousVisits.values()) {
      if (normalizeNick(getVisitNick(visit)) === normalizedNick) {
        return visit;
      }
    }

    return null;
  }

  getPilotById(pilotId) {
    for (const pilot of this.pilots.values()) {
      if (pilot.id === pilotId) {
        return pilot;
      }
    }

    return null;
  }

  getSessionByToken(token) {
    const tokenHash = hashToken(token || "");
    const session = this.authSessions.get(tokenHash);

    if (!session) return null;

    if (session.expiresAt <= Date.now() || session.revokedAt) {
      this.authSessions.delete(tokenHash);
      return null;
    }

    return session;
  }

  createAuthSession(pilotId, meta = {}) {
    const token = createToken();
    const now = Date.now();
    const session = {
      id: randomUUID(),
      token,
      tokenHash: hashToken(token),
      pilotId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + AUTH_SESSION_TTL,
      revokedAt: 0,
      meta
    };

    this.authSessions.set(session.tokenHash, session);
    return session;
  }
}

function publicVisit(visit) {
  const nick = getVisitNick(visit);
  const status = getVisitStatus(visit);

  return {
    id: visit.id,
    nick,
    callsign: visit.callsign,
    code: visit.code || 0,
    firstSeenAt: visit.firstSeenAt,
    lastSeenAt: visit.lastSeenAt,
    sessions: visit.sessions || 0,
    views: visit.views || 0,
    online: Boolean(visit.online),
    activeConnections: getActiveConnections(visit),
    roomId: visit.roomId || "",
    source: visit.source || "anonymous",
    status,
    unclaimedNick: visit.unclaimedNick || "",
    unclaimedNickUsedAt: visit.unclaimedNickUsedAt || 0,
    unclaimedNickSessions: visit.unclaimedNickSessions || 0,
    claimedPilotId: visit.claimedPilotId || null,
    claimedNick: visit.claimedNick || "",
    convertedAt: visit.convertedAt || 0,
    meta: visit.meta || {}
  };
}

function publicPilot(pilot) {
  return {
    id: pilot.id,
    nick: pilot.nick,
    firstSeenAt: pilot.createdAt,
    lastSeenAt: pilot.lastSeenAt,
    lastLoginAt: pilot.lastLoginAt,
    sessions: pilot.sessions || 0,
    online: Boolean(pilot.online),
    activeConnections: getActiveConnections(pilot),
    roomId: pilot.roomId || "",
    source: pilot.source || "pilot",
    status: "claimed",
    firstVisitId: pilot.firstVisitId || "",
    telegramLinked: Boolean(pilot.telegramId),
    telegramUsername: pilot.telegramUsername || ""
  };
}

function getVisitStatus(visit) {
  return visit.unclaimedNick ? "unclaimed" : "visitor";
}

function getVisitNick(visit) {
  return visit.unclaimedNick || visit.callsign;
}

function visitMatchesNick(visit, nick) {
  return normalizeNick(getVisitNick(visit)) === normalizeNick(nick);
}

function updatePresence(entity, meta = {}) {
  const hasOnline = meta.online !== undefined;
  const connectionId = String(meta.connectionId || "");

  ensureConnectionSet(entity);

  if (connectionId) {
    if (meta.online) {
      entity.connectionIds.add(connectionId);
    } else if (hasOnline) {
      entity.connectionIds.delete(connectionId);
    }

    entity.activeConnections = entity.connectionIds.size;
    entity.online = entity.activeConnections > 0;
  } else if (hasOnline) {
    entity.online = Boolean(meta.online);

    if (!entity.online) {
      entity.connectionIds.clear();
      entity.activeConnections = 0;
    } else if (!entity.activeConnections) {
      entity.activeConnections = 1;
    }
  }

  if (meta.roomId !== undefined) {
    entity.roomId = entity.online ? meta.roomId || entity.roomId || "" : "";
  }
}

function ensureConnectionSet(entity) {
  if (!(entity.connectionIds instanceof Set)) {
    entity.connectionIds = new Set();
  }

  entity.activeConnections = entity.connectionIds.size;
  return entity.connectionIds;
}

function getActiveConnections(entity) {
  ensureConnectionSet(entity);
  return entity.connectionIds.size || (entity.online ? entity.activeConnections || 1 : 0);
}

function publicSession(session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt
  };
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function hashToken(token) {
  if (!token) return "";
  return createHash("sha256").update(token).digest("hex");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const key = scryptSync(String(password), salt, 64).toString("base64url");

  return `scrypt$${salt}$${key}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");

  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, salt, key] = parts;
  const expected = Buffer.from(key, "base64url");
  const actual = scryptSync(String(password), salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function validatePassword(password) {
  const value = String(password || "");

  if (value.length < MIN_PASSWORD_LENGTH) return "password_too_short";
  if (value.length > MAX_PASSWORD_LENGTH) return "password_too_long";

  return "";
}

function normalizeNick(nick) {
  return sanitizeNick(nick).toLocaleLowerCase("en-US");
}

function isReservedNick(nick) {
  return normalizeNick(nick) === normalizeNick(SERVICE_NICK);
}

function createCallsign() {
  return SERVICE_NICK;
}

function createTail() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let tail = "";

  for (let i = 0; i < 3; i++) {
    tail += alphabet[randomBytes(1)[0] % alphabet.length];
  }

  return tail;
}

function getVisitSegment(meta = {}) {
  const browser = categoryCode(meta.browser, {
    chrome: 1,
    edge: 2,
    firefox: 3,
    safari: 4,
    opera: 5
  });
  const os = categoryCode(meta.os, {
    windows: 1,
    macos: 2,
    linux: 3,
    android: 4,
    ios: 5
  });
  const device = categoryCode(meta.device, {
    desktop: 1,
    mobile: 2,
    tablet: 3
  });
  const language = String(meta.language || "").toLowerCase().startsWith("ru")
    ? 1
    : String(meta.language || "").toLowerCase().startsWith("en")
      ? 2
      : 3;
  const source = categoryCode(meta.sourceGroup, {
    direct: 1,
    search: 2,
    social: 3,
    referral: 4,
    campaign: 5
  });
  const code = 100 + ((browser * 97 + os * 53 + device * 31 + language * 17 + source * 7) % 900);

  return {
    code,
    label: `${browser}.${os}.${device}.${language}.${source}`
  };
}

function categoryCode(value, dictionary) {
  const key = String(value || "").toLowerCase();

  return dictionary[key] || 0;
}

function mergeMeta(current = {}, next = {}) {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined && value !== "")
    )
  };
}

function error(code, message) {
  return {
    ok: false,
    error: code,
    message
  };
}
