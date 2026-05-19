import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import { sanitizeNick } from "./rooms.mjs";
import { createFileUserStore } from "./user-store.mjs";

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const SERVICE_NICK_PREFIX = "visitor-";

export const AUTH_COOKIE = "guns_sid";
export const DEVICE_COOKIE = "guns_did";

export class UserRegistry {
  constructor(economyConfig = {}, options = {}) {
    this.economyConfig = normalizeEconomyConfig(economyConfig);
    this.store = options.store || createFileUserStore({
      storageFile: options.storageFile || ""
    });
    this.anonymousVisits = new Map();
    this.pilots = new Map();
    this.authSessions = new Map();
    this.devices = new Map();
    this.loadStorage();
  }

  setEconomyConfig(economyConfig = {}) {
    this.economyConfig = normalizeEconomyConfig(economyConfig);
  }

  startVisit(cookies = {}, meta = {}) {
    const now = Date.now();
    const deviceResult = this.ensureDevice(cookies, meta, now);
    const device = deviceResult.device;
    const existing = this.getVisitByDevice(device);

    if (existing) {
      normalizeVisitCallsign(existing);
      ensureWallet(existing);
      existing.deviceId = device?.id || existing.deviceId || "";
      existing.lastSeenAt = now;
      existing.views += 1;
      existing.meta = mergeMeta(existing.meta, meta);
      this.persist();

      return {
        visit: publicVisit(existing),
        deviceToken: deviceResult.deviceToken
      };
    }

    const segment = getVisitSegment({
      ...meta,
      stableDeviceId: device?.id || "",
      firstSeenAt: now
    });
    const visit = {
      id: device?.id || randomUUID(),
      callsign: createCallsign(segment),
      code: segment.code,
      firstSeenAt: now,
      lastSeenAt: now,
      views: 1,
      sessions: 0,
      online: false,
      activeConnections: 0,
      connectionIds: new Set(),
      roomId: "",
      source: "anonymous",
      deviceId: device?.id || "",
      meta: {
        ...meta,
        segment: segment.label
      },
      claimedPilotId: null,
      claimedNick: "",
      convertedAt: 0
    };

    ensureWallet(visit);

    this.anonymousVisits.set(visit.id, visit);
    this.persist();

    return {
      visit: publicVisit(visit),
      deviceToken: deviceResult.deviceToken
    };
  }

  ensureDevice(cookies = {}, meta = {}, now = Date.now()) {
    const existing = this.getDeviceByToken(cookies[DEVICE_COOKIE]);

    if (existing) {
      existing.lastSeenAt = now;
      existing.views += 1;
      existing.meta = mergeMeta(existing.meta, meta);
      this.persist();

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
    this.persist();

    return {
      device,
      deviceToken: token
    };
  }

  getDeviceByToken(token) {
    const tokenHash = hashToken(token || "");

    return tokenHash ? this.devices.get(tokenHash) || null : null;
  }

  getVisitByDevice(device) {
    if (!device?.id) return null;

    return this.anonymousVisits.get(device.id) || null;
  }

  getVisitByDeviceToken(token) {
    return this.getVisitByDevice(this.getDeviceByToken(token));
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

    if (device?.claimedPilotId && !this.getPilotById(device.claimedPilotId)) {
      this.clearDeviceClaim(device);
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
      firstDeviceId: device?.id || visit?.deviceId || "",
      telegramId: null,
      telegramUsername: "",
      telegramLinkedAt: 0
    };
    ensureWallet(pilot);

    if (visit) {
      const transferred = transferWallet(visit, pilot);
      const transferredInventory = transferInventory(visit, pilot);

      if (transferred > 0) {
        this.recordWalletTransaction(visit, -transferred, "pilot-claim-transfer-out", {
          pilotId: pilot.id
        });
        this.recordWalletTransaction(pilot, transferred, "pilot-claim-transfer-in", {
          visitId: visit.id
        });
      }

      if (transferredInventory > 0) {
        this.recordAdminAudit("transfer-inventory", "pilot", pilot.id, {
          visitId: visit.id,
          pilotWeapons: publicInventory(pilot).pilotWeapons
        });
      }

      this.linkVisitToPilot(visit, pilot, now);
    }

    const session = this.createAuthSession(pilot.id, meta, device);
    this.pilots.set(pilot.normalizedNick, pilot);
    this.linkDeviceToPilot(device, pilot, now);
    this.persist();

    return {
      ok: true,
      pilot: publicPilot(pilot),
      visit: visit ? publicVisit(visit) : visitResult.visit,
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
    const device = this.getDeviceByToken(cookies[DEVICE_COOKIE] || visitResult.deviceToken || "");

    if (visit) {
      transferInventory(visit, pilot);
      this.linkVisitToPilot(visit, pilot, pilot.lastLoginAt);
    }

    this.linkDeviceToPilot(device, pilot, pilot.lastLoginAt);

    const session = this.createAuthSession(pilot.id, meta, device);
    this.persist();

    return {
      ok: true,
      pilot: publicPilot(pilot),
      visit: visit ? publicVisit(visit) : visitResult.visit,
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
      this.persist();
    }

    return {
      ok: true
    };
  }

  register(rawNick, meta = {}) {
    const nick = sanitizeNick(rawNick);
    const now = Date.now();
    const countSession = meta.source !== "game-start";
    const cookieVisit = this.getVisitByDeviceToken(meta.deviceToken);

    if (cookieVisit && isReservedNick(nick)) {
      ensureWallet(cookieVisit);
      cookieVisit.lastSeenAt = now;
      cookieVisit.sessions += countSession ? 1 : 0;
      updatePresence(cookieVisit, meta);
      this.persist();
      return publicVisit(cookieVisit);
    }

    const pilot = this.pilots.get(normalizeNick(nick));

    if (pilot) {
      ensureWallet(pilot);
      pilot.lastSeenAt = now;
      updatePresence(pilot, meta);

      if (cookieVisit) {
        transferInventory(cookieVisit, pilot);
        this.linkVisitToPilot(cookieVisit, pilot, now);
      }

      this.persist();
      return publicPilot(pilot);
    }

    const fallback = cookieVisit || this.startVisit({
      [DEVICE_COOKIE]: meta.deviceToken || ""
    }, meta).visit;
    const visit = fallback?.id
      ? this.anonymousVisits.get(fallback.id) || cookieVisit
      : cookieVisit;

    if (!visit) return publicVisit(fallback);

    ensureWallet(visit);
    visit.lastSeenAt = now;
    visit.sessions += countSession ? 1 : 0;
    updatePresence(visit, meta);
    this.persist();
    return publicVisit(visit);
  }

  setOnline(rawNick, online, meta = {}) {
    const nick = sanitizeNick(rawNick);
    const visit = this.getVisitByDeviceToken(meta.deviceToken);
    const pilot = this.pilots.get(normalizeNick(nick));
    const entity = pilot || visit || this.getVisitByNick(nick);

    if (!entity) return null;

    ensureWallet(entity);
    entity.lastSeenAt = Date.now();
    updatePresence(entity, {
      ...meta,
      online
    });
    this.persist();

    return pilot ? publicPilot(entity) : publicVisit(entity);
  }

  collectGarageCoins(rawNick, cookies = {}) {
    const nick = sanitizeNick(rawNick);

    if (isReservedNick(nick)) {
      return error("reserved_nick", "This pilot name is reserved.");
    }

    const pilot = this.pilots.get(normalizeNick(nick));
    const entity = pilot;

    if (!entity) return error("pilot_required", "Only registered pilots can collect gs.");

    const awarded = awardGunsCoinOnce(
      entity,
      "garageCoinsPickup",
      this.economyConfig.gunsCoin.visitorGrant
    );

    this.recordWalletTransaction(entity, awarded, "garage-coins-pickup", {
      awardKey: "garageCoinsPickup"
    });
    this.persist();

    return {
      ok: true,
      user: pilot ? publicPilot(entity) : publicVisit(entity)
    };
  }

  exchangeScore(rawNick, score) {
    const nick = sanitizeNick(rawNick);
    const pilot = this.pilots.get(normalizeNick(nick));
    const entity = pilot || this.getVisitByNick(nick);

    if (!entity) return error("user_required", "User is required to exchange score.");

    const scoreValue = Math.max(0, Math.floor(Number(score) || 0));
    const rate = Math.max(1, this.economyConfig.gunsCoin.exchangeScorePerCoin || 100);
    const coins = Math.floor(scoreValue / rate);

    if (coins <= 0) {
      return error("not_enough_score", `At least ${rate} score is required for 1 gs.`);
    }

    ensureWallet(entity);
    entity.wallet.gunsCoin += coins;
    entity.lastSeenAt = Date.now();
    this.persist();
    this.recordWalletTransaction(entity, coins, "score-exchange", {
      exchangedScore: coins * rate,
      score: scoreValue,
      rate
    });

    return {
      ok: true,
      user: pilot ? publicPilot(entity) : publicVisit(entity),
      exchangedScore: coins * rate,
      remainingScore: scoreValue - coins * rate,
      gunsCoinAdded: coins,
      rate
    };
  }

  spendGunsCoin(rawNick, amount, cookies = {}, meta = {}) {
    const nick = sanitizeNick(rawNick);
    const session = this.getSessionByToken(cookies[AUTH_COOKIE]);
    const sessionPilot = session ? this.getPilotById(session.pilotId) : null;
    const pilot = sessionPilot || this.pilots.get(normalizeNick(nick));
    const visit = this.getVisitByDeviceToken(cookies[DEVICE_COOKIE]) || this.getVisitByNick(nick);
    const entity = pilot || visit;
    const value = Math.max(0, Math.floor(Number(amount) || 0));

    if (!entity) return error("user_required", "User is required to spend gs.");
    if (value <= 0) return error("invalid_amount", "Spend amount must be positive.");

    ensureWallet(entity);

    if (entity.wallet.gunsCoin < value) {
      return error("not_enough_gs", "Not enough gs.");
    }

    entity.wallet.gunsCoin -= value;
    entity.lastSeenAt = Date.now();
    this.persist();
    this.recordWalletTransaction(entity, -value, String(meta.reason || "gs-spend"), {
      ...meta,
      amount: value
    });

    return {
      ok: true,
      user: pilot ? publicPilot(entity) : publicVisit(entity),
      spentGs: value,
      balanceGs: normalizeCoinAmount(entity.wallet.gunsCoin)
    };
  }

  purchasePilotWeapon(rawNick, weapon, cookies = {}, meta = {}) {
    const weaponId = String(weapon?.id || "").trim();
    const price = normalizeCoinAmount(weapon?.economy?.priceGs);
    const nick = sanitizeNick(rawNick);
    const session = this.getSessionByToken(cookies[AUTH_COOKIE]);
    const sessionPilot = session ? this.getPilotById(session.pilotId) : null;
    const pilot = sessionPilot || this.pilots.get(normalizeNick(nick));
    const visit = this.getVisitByDeviceToken(cookies[DEVICE_COOKIE]) || this.getVisitByNick(nick);
    const entity = pilot || visit;

    if (!weaponId) return error("weapon_required", "Weapon is required.");
    if (!entity) return error("user_required", "User is required to buy items.");
    if (price <= 0) return error("invalid_price", "Weapon price must be positive.");

    ensureWallet(entity);
    ensureInventory(entity);

    if (hasInventoryPilotWeapon(entity, weaponId)) {
      return {
        ok: true,
        alreadyOwned: true,
        user: pilot ? publicPilot(entity) : publicVisit(entity),
        weaponId,
        spentGs: 0,
        balanceGs: normalizeCoinAmount(entity.wallet.gunsCoin),
        inventory: publicInventory(entity)
      };
    }

    if (entity.wallet.gunsCoin < price) {
      return error("not_enough_gs", "Not enough gs.");
    }

    entity.wallet.gunsCoin -= price;
    addInventoryPilotWeapon(entity, weaponId);
    entity.lastSeenAt = Date.now();
    this.persist();
    this.recordWalletTransaction(entity, -price, "market-purchase", {
      ...meta,
      itemType: "pilot-weapon",
      itemId: weaponId,
      amount: price
    });

    return {
      ok: true,
      user: pilot ? publicPilot(entity) : publicVisit(entity),
      weaponId,
      spentGs: price,
      balanceGs: normalizeCoinAmount(entity.wallet.gunsCoin),
      inventory: publicInventory(entity)
    };
  }

  list() {
    const visits = Array.from(this.anonymousVisits.values())
      .map((visit) => this.withPublicIds(publicVisit(visit), {
        deviceId: visit.deviceId || "",
        deviceIds: visit.deviceId ? [visit.deviceId] : [],
        pilotId: "",
        sessionId: "",
        sessionIds: []
      }));
    const pilots = Array.from(this.pilots.values()).map((pilot) =>
      this.withPublicIds(publicPilot(pilot), {
        deviceIds: this.getDeviceIdsByPilotId(pilot.id),
        pilotId: pilot.id,
        sessions: this.getSessionsByPilotId(pilot.id)
      })
    );

    return [...pilots, ...visits]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.nick.localeCompare(b.nick));
  }

  snapshot() {
    const users = this.list();
    const devices = Array.from(this.devices.values()).map(publicDevice);
    const sessions = Array.from(this.authSessions.values()).map(publicAuthSession);

    return {
      users,
      devices,
      sessions,
      total: users.length,
      anonymousTotal: this.anonymousVisits.size,
      pilotsTotal: this.pilots.size,
      devicesTotal: devices.length,
      sessionsTotal: sessions.length,
      online: users.filter((user) => user.online).length,
      connections: users.reduce((sum, user) => sum + (user.activeConnections || 0), 0),
      serverTime: Date.now()
    };
  }

  async getUserDetail(userId, options = {}) {
    const id = String(userId || "");
    const user = this.list().find((item) => item.id === id);

    if (!user) {
      return error("user_not_found", "User row was not found.");
    }

    const isPilot = user.status === "claimed";
    const devices = Array.from(this.devices.values())
      .filter((device) => isPilot
        ? device.claimedPilotId === id
        : device.id === id || device.id === user.deviceId)
      .map(publicDevice);
    const sessions = Array.from(this.authSessions.values())
      .filter((session) => isPilot
        ? session.pilotId === id
        : session.deviceId === id || session.deviceId === user.deviceId)
      .map(publicAuthSession);
    const linkedVisits = isPilot
      ? Array.from(this.anonymousVisits.values())
        .filter((visit) => visit.claimedPilotId === id)
        .map((visit) => this.withPublicIds(publicVisit(visit), {
          deviceId: visit.deviceId || "",
          deviceIds: visit.deviceId ? [visit.deviceId] : [],
          pilotId: id,
          sessionIds: []
        }))
      : [];
    const walletTransactions = await this.listWalletTransactions({
      limit: options.limit || 50,
      entityType: isPilot ? "pilot" : "visit",
      entityId: id
    });

    return {
      ok: true,
      user,
      devices,
      sessions,
      linkedVisits,
      walletTransactions,
      userStore: this.storageInfo()
    };
  }

  withPublicIds(user, ids) {
    const deviceIds = Array.isArray(ids.deviceIds) ? ids.deviceIds : [];
    const sessions = Array.isArray(ids.sessions) ? ids.sessions : [];
    const explicitSessionIds = Array.isArray(ids.sessionIds) ? ids.sessionIds : [];
    const sessionIds = sessions.map((session) => session.id).filter(Boolean);
    const visibleSessionIds = sessionIds.length ? sessionIds : explicitSessionIds;

    return {
      ...user,
      deviceId: ids.deviceId || deviceIds[0] || "",
      deviceIds,
      deviceCount: deviceIds.length,
      pilotId: ids.pilotId || "",
      sessionId: ids.sessionId || visibleSessionIds[0] || "",
      sessionIds: visibleSessionIds,
      authSessions: sessions,
      sessionCount: visibleSessionIds.length
    };
  }

  getDeviceIdsByPilotId(pilotId) {
    const ids = [];

    for (const device of this.devices.values()) {
      if (device.claimedPilotId === pilotId) {
        ids.push(device.id || "");
      }
    }

    return ids.filter(Boolean);
  }

  getSessionsByPilotId(pilotId) {
    return Array.from(this.authSessions.values())
      .filter((session) => session.pilotId === pilotId && !session.revokedAt)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .map((session) => ({
        id: session.id,
        deviceId: session.deviceId || "",
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt
      }));
  }

  linkDeviceToPilot(device, pilot, now = Date.now()) {
    if (!device || !pilot) return null;

    device.claimedPilotId = pilot.id;
    device.claimedNick = pilot.nick;
    device.claimedAt ||= now;
    device.lastLoginAt = now;

    if (!pilot.firstDeviceId) {
      pilot.firstDeviceId = device.id || "";
    }

    return device;
  }

  clearDeviceClaim(device) {
    if (!device) return null;

    device.claimedPilotId = "";
    device.claimedNick = "";
    device.claimedAt = 0;
    device.lastLoginAt = 0;

    return device;
  }

  reconcileIdentityLinks() {
    for (const device of this.devices.values()) {
      if (device.claimedPilotId && !this.getPilotById(device.claimedPilotId)) {
        this.clearDeviceClaim(device);
      }
    }

    for (const visit of this.anonymousVisits.values()) {
      if (visit.claimedPilotId && !this.getPilotById(visit.claimedPilotId)) {
        visit.claimedPilotId = null;
        visit.claimedNick = "";
        visit.convertedAt = 0;
      }
    }
  }

  deleteUser(userId) {
    const id = String(userId || "");

    if (this.anonymousVisits.has(id)) {
      const before = publicVisit(this.anonymousVisits.get(id));

      this.anonymousVisits.delete(id);

      this.persist();
      this.recordAdminAudit("delete-user", "visit", id, {
        before,
        after: null
      });
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

      const before = publicPilot(pilot);
      const beforeSessions = Array.from(this.authSessions.values())
        .filter((session) => session.pilotId === id)
        .map(publicAuthSession);
      const beforeDevices = Array.from(this.devices.values())
        .filter((device) => device.claimedPilotId === id)
        .map(publicDevice);
      const beforeLinkedVisits = Array.from(this.anonymousVisits.values())
        .filter((visit) => visit.claimedPilotId === id)
        .map(publicVisit);

      this.pilots.delete(normalizedNick);

      for (const [tokenHash, session] of this.authSessions.entries()) {
        if (session.pilotId === id) {
          this.authSessions.delete(tokenHash);
        }
      }

      for (const device of this.devices.values()) {
        if (device.claimedPilotId === id) {
          this.clearDeviceClaim(device);
        }
      }

      for (const visit of this.anonymousVisits.values()) {
        if (visit.claimedPilotId === id) {
          visit.claimedPilotId = null;
          visit.claimedNick = "";
          visit.convertedAt = 0;
        }
      }

      this.persist();
      this.recordAdminAudit("delete-user", "pilot", id, {
        before: {
          pilot: before,
          sessions: beforeSessions,
          devices: beforeDevices,
          linkedVisits: beforeLinkedVisits
        },
        after: null
      });
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

  setUserGunsCoin(userId, gunsCoin, meta = {}) {
    const id = String(userId || "");
    const nextBalance = normalizeCoinAmount(gunsCoin);
    const visit = this.anonymousVisits.get(id);

    if (visit) {
      return this.setEntityGunsCoin(visit, "visit", id, nextBalance, meta);
    }

    for (const pilot of this.pilots.values()) {
      if (pilot.id !== id) continue;

      return this.setEntityGunsCoin(pilot, "pilot", id, nextBalance, meta);
    }

    return error("user_not_found", "User row was not found.");
  }

  setEntityGunsCoin(entity, entityType, entityId, nextBalance, meta = {}) {
    ensureWallet(entity);

    const before = entityType === "pilot"
      ? publicPilot(entity)
      : publicVisit(entity);
    const previousBalance = normalizeCoinAmount(entity.wallet.gunsCoin);
    const delta = nextBalance - previousBalance;

    entity.wallet.gunsCoin = nextBalance;
    this.persist();

    if (delta !== 0) {
      this.recordWalletTransaction(entity, delta, "admin-gs-set", {
        previousBalance,
        nextBalance,
        ...(meta || {})
      });
    }

    const after = entityType === "pilot"
      ? publicPilot(entity)
      : publicVisit(entity);

    this.recordAdminAudit("set-gs-balance", entityType, entityId, {
      before,
      after,
      delta
    });

    return {
      ok: true,
      user: this.list().find((item) => item.id === entityId) || after,
      previousBalance,
      balanceGs: nextBalance,
      delta
    };
  }

  unlinkDevice(deviceId) {
    const id = String(deviceId || "");
    const device = this.devices.get(id);

    if (!device) return error("device_not_found", "Device was not found.");

    const before = publicDevice(device);
    this.clearDeviceClaim(device);
    this.persist();
    this.recordAdminAudit("unlink-device", "device", id, {
      before,
      after: publicDevice(device)
    });

    return {
      ok: true,
      device: publicDevice(device)
    };
  }

  revokeSession(sessionId) {
    const id = String(sessionId || "");

    for (const [tokenHash, session] of this.authSessions.entries()) {
      if (session.id !== id) continue;

      const before = publicAuthSession(session);
      session.revokedAt = Date.now();
      this.authSessions.delete(tokenHash);
      this.persist();
      this.recordAdminAudit("revoke-session", "session", id, {
        before,
        after: publicAuthSession(session)
      });

      return {
        ok: true,
        session: publicAuthSession(session)
      };
    }

    return error("session_not_found", "Session was not found.");
  }

  linkVisitToPilotByDeviceToken(token, pilotId) {
    const visit = this.getVisitByDeviceToken(token);
    const pilot = this.getPilotById(pilotId);

    if (!visit || !pilot) return null;

    this.linkVisitToPilot(visit, pilot);
    this.persist();
    return publicVisit(visit);
  }

  linkVisitToPilot(visit, pilot, now = Date.now()) {
    visit.claimedPilotId = pilot.id;
    visit.claimedNick = pilot.nick;
    visit.convertedAt = visit.convertedAt || now;
    visit.lastSeenAt = now;

    if (!pilot.firstDeviceId) {
      pilot.firstDeviceId = visit.deviceId || visit.id;
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

    if (session.revokedAt) {
      this.authSessions.delete(tokenHash);
      this.persist();
      return null;
    }

    return session;
  }

  createAuthSession(pilotId, meta = {}, device = null) {
    const token = createToken();
    const now = Date.now();
    const session = {
      id: randomUUID(),
      token,
      tokenHash: hashToken(token),
      pilotId,
      deviceId: device?.id || "",
      createdAt: now,
      lastSeenAt: now,
      expiresAt: 0,
      revokedAt: 0,
      meta
    };

    this.authSessions.set(session.tokenHash, session);
    return session;
  }

  loadStorage() {
    try {
      const data = this.store?.loadSnapshot?.();

      if (!data) return;

      this.anonymousVisits = new Map(
        (data.anonymousVisits || []).map((visit) => [
          visit.deviceId || visit.id,
          normalizeVisitCallsign(hydratePresenceEntity({
            ...visit,
            id: visit.deviceId || visit.id
          }))
        ])
      );
      this.pilots = new Map(
        (data.pilots || []).map((pilot) => [
          pilot.normalizedNick,
          hydratePresenceEntity(pilot)
        ])
      );
      this.authSessions = new Map(
        (data.authSessions || []).map((session) => [session.tokenHash, session])
      );
      this.devices = new Map(
        (data.devices || []).map((device) => [device.tokenHash, device])
      );
      this.reconcileIdentityLinks();
    } catch (error) {
      console.warn(`Failed to load users storage: ${error.message}`);
    }
  }

  persist() {
    this.store?.saveSnapshot?.({
      anonymousVisits: Array.from(this.anonymousVisits.values()).map(dehydratePresenceEntity),
      pilots: Array.from(this.pilots.values()).map(dehydratePresenceEntity),
      authSessions: Array.from(this.authSessions.values()),
      devices: Array.from(this.devices.values())
    });
  }

  recordWalletTransaction(entity, amount, reason, meta = {}) {
    ensureWallet(entity);
    this.store?.recordWalletTransaction?.({
      entityType: getWalletEntityType(entity),
      entityId: entity.id || entity.deviceId || entity.normalizedNick || "",
      currency: "gs",
      amount,
      balanceAfter: normalizeCoinAmount(entity.wallet?.gunsCoin),
      reason,
      createdAt: Date.now(),
      meta
    });
  }

  listWalletTransactions(options = {}) {
    return Promise.resolve(
      this.store?.listWalletTransactions?.(options) || []
    );
  }

  recordAdminAudit(action, entityType, entityId, details = {}) {
    this.store?.recordAdminAudit?.({
      action,
      entityType,
      entityId,
      actor: "admin-api",
      createdAt: Date.now(),
      before: details.before ?? null,
      after: details.after ?? null,
      meta: details.meta || {}
    });
  }

  listAdminAudit(options = {}) {
    return Promise.resolve(
      this.store?.listAdminAudit?.(options) || []
    );
  }

  recordMatchResult(result = {}) {
    this.store?.recordMatchResult?.(result);
  }

  listMatchResults(options = {}) {
    return Promise.resolve(
      this.store?.listMatchResults?.(options) || []
    );
  }

  databaseStatus() {
    return Promise.resolve(
      this.store?.getDatabaseStatus?.() || {
        ...this.storageInfo(),
        healthy: false,
        warning: "database-status-unavailable",
        counts: {}
      }
    );
  }

  storageInfo() {
    return this.store?.describe?.() || {
      mode: "unknown"
    };
  }
}

function publicVisit(visit) {
  const nick = getVisitNick(visit);
  const status = getVisitStatus(visit);
  ensureWallet(visit);
  ensureInventory(visit);

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
    claimedPilotId: visit.claimedPilotId || null,
    claimedNick: visit.claimedNick || "",
    convertedAt: visit.convertedAt || 0,
    wallet: publicWallet(visit),
    inventory: publicInventory(visit),
    meta: visit.meta || {}
  };
}

function hydratePresenceEntity(entity = {}) {
  const hydrated = {
    ...entity,
    online: false,
    activeConnections: 0,
    connectionIds: new Set(),
    roomId: ""
  };
  ensureWallet(hydrated);
  ensureInventory(hydrated);

  return hydrated;
}

function dehydratePresenceEntity(entity = {}) {
  const { connectionIds, firstVisitId, tokenHash, ...stored } = entity;

  return {
    ...stored,
    online: false,
    activeConnections: 0,
    roomId: ""
  };
}

function publicPilot(pilot) {
  ensureWallet(pilot);
  ensureInventory(pilot);

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
    firstDeviceId: pilot.firstDeviceId || "",
    wallet: publicWallet(pilot),
    inventory: publicInventory(pilot),
    telegramLinked: Boolean(pilot.telegramId),
    telegramUsername: pilot.telegramUsername || ""
  };
}

function publicDevice(device = {}) {
  return {
    id: device.id || "",
    tokenHash: device.tokenHash || "",
    firstSeenAt: device.firstSeenAt || 0,
    lastSeenAt: device.lastSeenAt || 0,
    views: device.views || 0,
    claimedPilotId: device.claimedPilotId || "",
    claimedNick: device.claimedNick || "",
    claimedAt: device.claimedAt || 0,
    lastLoginAt: device.lastLoginAt || 0,
    meta: device.meta || {}
  };
}

function publicAuthSession(session = {}) {
  return {
    id: session.id || "",
    tokenHash: session.tokenHash || "",
    pilotId: session.pilotId || "",
    deviceId: session.deviceId || "",
    createdAt: session.createdAt || 0,
    lastSeenAt: session.lastSeenAt || 0,
    expiresAt: session.expiresAt || 0,
    revokedAt: session.revokedAt || 0,
    meta: session.meta || {}
  };
}

function ensureWallet(entity) {
  entity.wallet ||= {};
  entity.wallet.gunsCoin = normalizeCoinAmount(entity.wallet.gunsCoin);
  entity.economyAwards ||= {};
  return entity.wallet;
}

function ensureInventory(entity) {
  entity.inventory ||= {};
  if (!Array.isArray(entity.inventory.pilotWeapons)) {
    entity.inventory.pilotWeapons = [];
  }

  entity.inventory.pilotWeapons = Array.from(
    new Set(entity.inventory.pilotWeapons.map((id) => String(id || "").trim()).filter(Boolean))
  );

  return entity.inventory;
}

function publicWallet(entity = {}) {
  ensureWallet(entity);

  return {
    gunsCoin: normalizeCoinAmount(entity.wallet?.gunsCoin)
  };
}

function publicInventory(entity = {}) {
  const inventory = ensureInventory(entity);

  return {
    pilotWeapons: [...inventory.pilotWeapons]
  };
}

function hasInventoryPilotWeapon(entity, weaponId) {
  return ensureInventory(entity).pilotWeapons.includes(String(weaponId || "").trim());
}

function addInventoryPilotWeapon(entity, weaponId) {
  const id = String(weaponId || "").trim();
  const inventory = ensureInventory(entity);

  if (id && !inventory.pilotWeapons.includes(id)) {
    inventory.pilotWeapons.push(id);
  }

  return inventory;
}

function awardGunsCoinOnce(entity, awardKey, amount) {
  ensureWallet(entity);

  if (entity.economyAwards[awardKey]) return 0;

  const value = normalizeCoinAmount(amount);

  entity.wallet.gunsCoin += value;
  entity.economyAwards[awardKey] = {
    amount: value,
    awardedAt: Date.now()
  };

  return value;
}

function awardRoomEntryCoins(entity, meta = {}, economyConfig = {}) {
  if (meta.source !== "game-start") return 0;
  if (meta.roomId !== "user-cabinet") return 0;

  return awardGunsCoinOnce(
    entity,
    "visitorGrant",
    economyConfig.gunsCoin?.visitorGrant
  );
}

function transferWallet(from, to) {
  ensureWallet(from);
  ensureWallet(to);

  const value = from.wallet.gunsCoin;

  to.wallet.gunsCoin += value;
  from.wallet.gunsCoin = 0;

  return value;
}

function transferInventory(from, to) {
  const fromInventory = ensureInventory(from);
  const toInventory = ensureInventory(to);
  let transferred = 0;

  for (const weaponId of fromInventory.pilotWeapons) {
    if (toInventory.pilotWeapons.includes(weaponId)) continue;
    toInventory.pilotWeapons.push(weaponId);
    transferred++;
  }

  fromInventory.pilotWeapons = [];

  return transferred;
}

function getWalletEntityType(entity = {}) {
  return entity.normalizedNick ? "pilot" : "visit";
}

function normalizeEconomyConfig(config = {}) {
  const gunsCoin = config.gunsCoin || config.economy?.gunsCoin || {};

  return {
    gunsCoin: {
      visitorGrant: normalizeCoinAmount(gunsCoin.visitorGrant),
      playGrant: normalizeCoinAmount(gunsCoin.playGrant),
      registrationGrant: normalizeCoinAmount(gunsCoin.registrationGrant),
      exchangeScorePerCoin: normalizeExchangeRate(gunsCoin.exchangeScorePerCoin)
    }
  };
}

function normalizeExchangeRate(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return 100;

  return Math.floor(number);
}

function normalizeCoinAmount(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) return 0;

  return Math.floor(number);
}

function getVisitStatus(visit) {
  return "visitor";
}

function getVisitNick(visit) {
  return visit.callsign;
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
  return normalizeNick(nick).startsWith(SERVICE_NICK_PREFIX);
}

function createCallsign(segment = {}) {
  const code = Number(segment.code);
  const suffix = Number.isFinite(code) && code > 0
    ? Math.floor(code)
    : 0;

  return `${SERVICE_NICK_PREFIX}${String(suffix).padStart(4, "0")}`;
}

function normalizeVisitCallsign(visit) {
  if (!visit) return visit;

  const current = normalizeNick(visit.callsign);

  if (current === "cadet" || !current || /^visitor-\d{1,3}$/u.test(current)) {
    const segment = getVisitSegment({
      ...visit.meta,
      stableDeviceId: visit.deviceId || visit.id || "",
      firstSeenAt: visit.firstSeenAt || 0
    });
    visit.code = segment.code;
    visit.callsign = createCallsign(segment);
  }

  return visit;
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
  const stableDeviceId = String(meta.stableDeviceId || "");
  const firstSeenSecond = Math.floor(Number(meta.firstSeenAt || 0) / 1000);
  const deviceSeed = hashStringToNumber(stableDeviceId);
  const firstSeenSeed = hashStringToNumber(String(firstSeenSecond || ""));
  const code = 1000 + ((
    browser * 997 +
    os * 541 +
    device * 307 +
    language * 173 +
    source * 79 +
    deviceSeed +
    firstSeenSeed
  ) % 9000);

  return {
    code,
    label: `${browser}.${os}.${device}.${language}.${source}.${deviceSeed % 997}.${firstSeenSecond % 997}`
  };
}

function hashStringToNumber(value) {
  if (!value) return 0;

  const hash = createHash("sha256").update(value).digest();

  return hash.readUInt32BE(0);
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
