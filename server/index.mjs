import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createAcceptKey, decodeFrames, encodeFrame, safeJsonParse } from "./protocol.mjs";
import { MultiplayerHub, sanitizeNick, sanitizeRoomId } from "./rooms.mjs";
import { AUTH_COOKIE, DEVICE_COOKIE, UserRegistry } from "./users.mjs";
import { createUserStore } from "./user-store.mjs";
import { loadMongoEnv } from "../scripts/mongo-env.mjs";
import { findLatestMongoBackup } from "../scripts/mongo-backup-utils.mjs";
import { buildGameConfig, validateGameConfig } from "../scripts/config-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadMongoEnv(root);
const publishedConfigFile = path.join(root, "shared", "game-config.json");
const draftConfigFile = path.join(root, "shared", "draft", "game-config.json");
const usersStorageFile = path.join(root, "server", "data", "users.json");
const host = process.env.GUNS_HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const port = Number(process.env.GUNS_SERVER_PORT || process.env.PORT || 3000);
const version = "0.16.80";
const serverStartedAt = Date.now();
const mongoBackupRoot = process.env.GUNS_MONGO_BACKUP_DIR ||
  path.join(root, "server", "data", "mongo-backups");
let publishedConfig = loadPublishedConfig();
const secureCookies =
  process.env.GUNS_COOKIE_SECURE === "1" ||
  process.env.NODE_ENV === "production";
const adminToken = String(process.env.GUNS_ADMIN_TOKEN || "").trim();
const adminAuthRequired =
  adminToken.length > 0 ||
  process.env.NODE_ENV === "production";
const hub = new MultiplayerHub({
  maxClientsPerRoom: Number(process.env.GUNS_MAX_ROOM_PLAYERS || 16),
  getRoomConfig: (roomId) => publishedConfig.rooms?.[roomId] || null,
  getModeConfig: (modeId) => publishedConfig.modes?.[modeId] || null,
  getCannonConfig: (gunType) => publishedConfig.objects?.cannons?.[gunType] || null,
  getPilotWeaponConfig: (weaponId) => publishedConfig.objects?.pilotWeapons?.[weaponId] || null,
  recordMatchResult: (result) => users.recordMatchResult(result)
});
const userStoreMode = resolveUserStoreMode(process.env);
const usersStore = await createUserStore({
  storageFile: usersStorageFile,
  mode: userStoreMode,
  mongoUrl: process.env.GUNS_MONGO_URL || "",
  mongoDatabase: process.env.GUNS_MONGO_DATABASE || "guns",
  mongoCollection: process.env.GUNS_MONGO_USER_COLLECTION || "user_snapshots"
});
const users = new UserRegistry(getEconomyConfig(publishedConfig), {
  store: usersStore
});

process.stdout?.on?.("error", () => {});
process.stderr?.on?.("error", () => {});

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const cookies = parseCookies(req.headers.cookie || "");

  if (req.method === "OPTIONS") {
    sendEmpty(req, res, 204);
    return;
  }

  const adminAuth = getAdminAuthResult(req, url);
  if (!adminAuth.ok) {
    sendJson(req, res, adminAuth.status, {
      ok: false,
      error: adminAuth.error,
      message: adminAuth.message
    });
    return;
  }

  if (url.pathname === "/health") {
    sendJson(req, res, 200, {
      ok: true,
      service: "guns-multiplayer",
      version,
      startedAt: serverStartedAt,
      uptimeMs: Date.now() - serverStartedAt,
      time: Date.now(),
      userStore: users.storageInfo()
    });
    return;
  }

  if (url.pathname === "/rooms") {
    sendJson(req, res, 200, hub.snapshot());
    return;
  }

  if (url.pathname === "/api/config/current") {
    sendJson(req, res, 200, {
      ok: true,
      version,
      config: publishedConfig
    });
    return;
  }

  if (url.pathname === "/api/config/status") {
    sendJson(req, res, 200, {
      ok: true,
      version,
      schemaVersion: publishedConfig.schemaVersion,
      configVersion: publishedConfig.configVersion,
      status: publishedConfig.status,
      draft: getDraftStatus(),
      counts: {
        cannons: Object.keys(publishedConfig.objects?.cannons || {}).length,
        guns: Object.keys(publishedConfig.objects?.cannons || {}).length,
        pilotWeaponTypes: Object.keys(publishedConfig.objects?.pilotWeaponTypes || {}).length,
        pilotWeapons: Object.keys(publishedConfig.objects?.pilotWeapons || {}).length,
        rooms: Object.keys(publishedConfig.rooms || {}).length,
        modes: Object.keys(publishedConfig.modes || {}).length
      }
    });
    return;
  }

  if (url.pathname === "/api/config/draft") {
    if (req.method === "GET") {
      sendJson(req, res, 200, {
        ok: true,
        draft: loadDraftConfig() || publishedConfig,
        source: fs.existsSync(draftConfigFile) ? "draft" : "published"
      });
      return;
    }

    if (req.method === "PUT") {
      readJsonBody(req)
        .then((body) => {
          const draft = body?.config || body;
          validateGameConfig(draft);
          writeConfigFile(draftConfigFile, draft);
          sendJson(req, res, 200, {
            ok: true,
            draft: getDraftStatus()
          });
        })
        .catch((error) => {
          sendJson(req, res, 400, {
            ok: false,
            error: "invalid_config",
            message: error.message
          });
        });
      return;
    }
  }

  if (url.pathname === "/api/config/publish" && req.method === "POST") {
    const draft = loadDraftConfig();

    if (!draft) {
      sendJson(req, res, 404, {
        ok: false,
        error: "draft_not_found"
      });
      return;
    }

    try {
      validateGameConfig(draft);
      writeConfigSources(draft);
      const builtConfig = buildVersionedGameConfig();
      writeConfigFile(publishedConfigFile, builtConfig);
      fs.rmSync(draftConfigFile, { force: true });
      publishedConfig = builtConfig;

      sendJson(req, res, 200, {
        ok: true,
        config: publishedConfig,
        draft: getDraftStatus()
      });
    } catch (error) {
      sendJson(req, res, 400, {
        ok: false,
        error: "invalid_config",
        message: error.message
      });
    }

    return;
  }

  if (url.pathname === "/api/config/discard" && req.method === "POST") {
    fs.rmSync(draftConfigFile, { force: true });
    sendJson(req, res, 200, {
      ok: true,
      draft: getDraftStatus()
    });
    return;
  }

  if (url.pathname === "/api/objects") {
    sendJson(req, res, 200, {
      ok: true,
      objects: publishedConfig.objects
    });
    return;
  }

  if (url.pathname === "/api/settings") {
    if (req.method === "GET") {
      sendJson(req, res, 200, {
        ok: true,
        settings: publishedConfig.settings || {}
      });
      return;
    }

    if (req.method === "POST") {
      readJsonBody(req)
        .then((body) => {
          const config = setGlobalSettings(publishedConfig, body?.settings || body);

          validateGameConfig(config);
          writeConfigSources(config);
          const builtConfig = buildVersionedGameConfig();
          writeConfigFile(publishedConfigFile, builtConfig);
          publishedConfig = builtConfig;

          sendJson(req, res, 200, {
            ok: true,
            settings: publishedConfig.settings
          });
        })
        .catch((error) => {
          sendJson(req, res, 400, {
            ok: false,
            error: "invalid_settings",
            message: error.message
          });
        });
      return;
    }
  }

  if (url.pathname === "/api/economy") {
    if (req.method === "GET") {
      sendJson(req, res, 200, {
        ok: true,
        economy: getEconomyConfig(publishedConfig)
      });
      return;
    }

    if (req.method === "POST") {
      readJsonBody(req)
        .then((body) => {
          const config = setEconomySettings(publishedConfig, body?.economy || body);

          validateGameConfig(config);
          writeConfigSources(config);
          const builtConfig = buildVersionedGameConfig();
          writeConfigFile(publishedConfigFile, builtConfig);
          publishedConfig = builtConfig;
          users.setEconomyConfig(getEconomyConfig(publishedConfig));

          sendJson(req, res, 200, {
            ok: true,
            economy: getEconomyConfig(publishedConfig)
          });
        })
        .catch((error) => {
          sendJson(req, res, 400, {
            ok: false,
            error: "invalid_economy",
            message: error.message
          });
        });
      return;
    }
  }

  if (url.pathname === "/api/objects/cannons/fire-rate" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const cannonId = String(body?.cannonId || "").trim();
        const controller = String(body?.controller || "").trim();
        const value = Number(body?.value);
        const config = setCannonFireRate(
          publishedConfig,
          cannonId,
          controller,
          value
        );

        validateGameConfig(config);
        writeConfigSources(config);
        const builtConfig = buildVersionedGameConfig();
        writeConfigFile(publishedConfigFile, builtConfig);
        publishedConfig = builtConfig;

        sendJson(req, res, 200, {
          ok: true,
          cannon: publishedConfig.objects.cannons[cannonId],
          objects: publishedConfig.objects
        });
      })
      .catch((error) => {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_object",
          message: error.message
        });
      });
    return;
  }

  if (url.pathname.startsWith("/api/objects/pilot-weapons/") && req.method === "PATCH") {
    const weaponId = decodeURIComponent(
      url.pathname.slice("/api/objects/pilot-weapons/".length)
    ).trim();

    readJsonBody(req)
      .then((body) => {
        const config = setPilotWeaponConfig(
          publishedConfig,
          weaponId,
          body?.weapon || body
        );

        validateGameConfig(config);
        writeConfigSources(config);
        const builtConfig = buildVersionedGameConfig();
        writeConfigFile(publishedConfigFile, builtConfig);
        publishedConfig = builtConfig;

        sendJson(req, res, 200, {
          ok: true,
          weapon: publishedConfig.objects.pilotWeapons[weaponId],
          objects: publishedConfig.objects
        });
      })
      .catch((error) => {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_pilot_weapon",
          message: error.message
        });
      });
    return;
  }

  if (url.pathname === "/api/rooms") {
    sendJson(req, res, 200, {
      ok: true,
      rooms: publishedConfig.rooms,
      objects: publishedConfig.objects
    });
    return;
  }

  if (url.pathname.startsWith("/api/rooms/") && req.method === "DELETE") {
    const roomId = decodeURIComponent(url.pathname.slice("/api/rooms/".length)).trim();

    if (isRoomPublished(publishedConfig, roomId)) {
      sendJson(req, res, 409, {
        ok: false,
        error: "room_published",
        message: "Published rooms cannot be deleted"
      });
      return;
    }

    if (isRoomOccupied(roomId)) {
      sendJson(req, res, 409, {
        ok: false,
        error: "room_not_empty",
        message: "Room cannot be deleted while players are inside"
      });
      return;
    }

    try {
      const config = deleteRoom(publishedConfig, roomId);

      validateGameConfig(config);
      writeConfigSources(config);
      const builtConfig = buildVersionedGameConfig();
      writeConfigFile(publishedConfigFile, builtConfig);
      publishedConfig = builtConfig;

      sendJson(req, res, 200, {
        ok: true,
        rooms: publishedConfig.rooms
      });
    } catch (error) {
      sendJson(req, res, 400, {
        ok: false,
        error: "invalid_room",
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/rooms/draft" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const sourceRoomId = String(body?.sourceRoomId || "main").trim();
        const config = createDraftRoom(publishedConfig, sourceRoomId);

        validateGameConfig(config);
        writeConfigSources(config);
        const builtConfig = buildVersionedGameConfig();
        writeConfigFile(publishedConfigFile, builtConfig);
        publishedConfig = builtConfig;

        sendJson(req, res, 200, {
          ok: true,
          rooms: publishedConfig.rooms
        });
      })
      .catch((error) => {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_room",
          message: error.message
        });
      });
    return;
  }

  if (url.pathname === "/api/rooms/enabled" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const roomId = String(body?.roomId || "").trim();

        if (isRoomPublished(publishedConfig, roomId)) {
          sendJson(req, res, 409, {
            ok: false,
            error: "room_published",
            message: "Published rooms are immutable"
          });
          return;
        }

        const config = setRoomEnabled(
          publishedConfig,
          roomId,
          body?.enabled !== false
        );

        validateGameConfig(config);
        writeConfigSources(config);
        const builtConfig = buildVersionedGameConfig();
        writeConfigFile(publishedConfigFile, builtConfig);
        publishedConfig = builtConfig;

        sendJson(req, res, 200, {
          ok: true,
          rooms: publishedConfig.rooms
        });
      })
      .catch((error) => {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_room",
          message: error.message
        });
      });
    return;
  }

  if (url.pathname === "/api/rooms/publish" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const roomId = String(body?.roomId || "").trim();

        if (isRoomOccupied(roomId)) {
          sendJson(req, res, 409, {
            ok: false,
            error: "room_not_empty",
            message: "Room cannot be published while players are inside"
          });
          return;
        }

        const config = publishRoom(publishedConfig, roomId);

        validateGameConfig(config);
        writeConfigSources(config);
        const builtConfig = buildVersionedGameConfig();
        writeConfigFile(publishedConfigFile, builtConfig);
        publishedConfig = builtConfig;

        sendJson(req, res, 200, {
          ok: true,
          rooms: publishedConfig.rooms
        });
      })
      .catch((error) => {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_room",
          message: error.message
        });
      });
    return;
  }

  if (url.pathname === "/api/rooms/arena" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const roomId = String(body?.roomId || "").trim();
        const shape = String(body?.shape || "").trim();

        if (isRoomPublished(publishedConfig, roomId)) {
          sendJson(req, res, 409, {
            ok: false,
            error: "room_published",
            message: "Published rooms are immutable"
          });
          return;
        }

        if (isRoomOccupied(roomId)) {
          sendJson(req, res, 409, {
            ok: false,
            error: "room_not_empty",
            message: "Room arena cannot be changed while players are inside"
          });
          return;
        }

        const config = setRoomArena(
          publishedConfig,
          roomId,
          shape,
          body?.params || {}
        );

        validateGameConfig(config);
        writeConfigSources(config);
        const builtConfig = buildVersionedGameConfig();
        writeConfigFile(publishedConfigFile, builtConfig);
        publishedConfig = builtConfig;

        sendJson(req, res, 200, {
          ok: true,
          room: publishedConfig.rooms[roomId],
          rooms: publishedConfig.rooms
        });
      })
      .catch((error) => {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_room",
          message: error.message
        });
      });
    return;
  }

  if (url.pathname === "/api/rooms/object" && req.method === "PATCH") {
    readJsonBody(req)
      .then((body) => {
        const roomId = String(body?.roomId || "").trim();

        if (isRoomPublished(publishedConfig, roomId)) {
          sendJson(req, res, 409, {
            ok: false,
            error: "room_published",
            message: "Published rooms are immutable"
          });
          return;
        }

        const config = setRoomObjectInstanceConfig(
          publishedConfig,
          roomId,
          String(body?.instanceId || "").trim(),
          body?.object || body
        );

        validateGameConfig(config);
        writeConfigSources(config);
        const builtConfig = buildVersionedGameConfig();
        writeConfigFile(publishedConfigFile, builtConfig);
        publishedConfig = builtConfig;

        sendJson(req, res, 200, {
          ok: true,
          room: publishedConfig.rooms[roomId],
          rooms: publishedConfig.rooms
        });
      })
      .catch((error) => {
        sendJson(req, res, 400, {
          ok: false,
          error: "invalid_room_object",
          message: error.message
        });
      });
    return;
  }

  if (url.pathname === "/api/modes") {
    sendJson(req, res, 200, {
      ok: true,
      modes: publishedConfig.modes
    });
    return;
  }

  if (url.pathname === "/visits/start" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const result = users.startVisit(cookies, body?.meta || {});
        const auth = users.getAuthenticatedPilot(cookies);
        const setCookies = [];

        if (result.deviceToken) {
          setCookies.push(makeCookie(DEVICE_COOKIE, result.deviceToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

        if (auth?.pilot) {
          const linkedVisit = users.linkVisitToPilotByDeviceToken(
            cookies[DEVICE_COOKIE] || result.deviceToken || "",
            auth.pilot.id
          );

          if (linkedVisit) {
            result.visit = linkedVisit;
          }
        }

        sendJson(req, res, 200, {
          ok: true,
          visit: result.visit,
          pilot: auth?.pilot || null,
          session: auth?.session || null
        }, setCookies);
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/auth/me") {
    const auth = users.getAuthenticatedPilot(cookies);

    sendJson(req, res, 200, {
      ok: true,
      pilot: auth?.pilot || null,
      session: auth?.session || null
    });
    return;
  }

  if (url.pathname === "/pilots/check") {
    sendJson(req, res, 200, {
      ok: true,
      pilot: users.checkPilot(url.searchParams.get("nick"))
    });
    return;
  }

  if (url.pathname === "/pilots/claim" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const result = users.claimPilot(
          body?.nick,
          body?.password,
          cookies,
          body?.meta || {}
        );

        if (!result.ok) {
          sendJson(req, res, 409, result);
          return;
        }

        const setCookies = [
          makeCookie(AUTH_COOKIE, result.sessionToken)
        ];

        if (result.deviceToken) {
          setCookies.push(makeCookie(DEVICE_COOKIE, result.deviceToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

        sendJson(req, res, 200, {
          ok: true,
          pilot: result.pilot,
          visit: result.visit,
          session: result.session
        }, setCookies);
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/auth/login" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const result = users.loginPilot(body?.nick, body?.password, cookies, body?.meta || {});

        if (!result.ok) {
          sendJson(req, res, 401, result);
          return;
        }

        const setCookies = [
          makeCookie(AUTH_COOKIE, result.sessionToken)
        ];

        if (result.deviceToken) {
          setCookies.push(makeCookie(DEVICE_COOKIE, result.deviceToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

        sendJson(req, res, 200, {
          ok: true,
          pilot: result.pilot,
          visit: result.visit,
          session: result.session
        }, setCookies);
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));
    return;
  }

  if (url.pathname === "/auth/logout" && req.method === "POST") {
    users.logout(cookies);
    sendJson(req, res, 200, {
      ok: true
    }, [
      clearCookie(AUTH_COOKIE)
    ]);
    return;
  }

  if (url.pathname === "/users/register" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const user = users.register(body?.nick, {
          source: "game-start",
          roomId: sanitizeRoomId(body?.roomId),
          deviceToken: cookies[DEVICE_COOKIE] || ""
        });

        sendJson(req, res, 200, {
          ok: true,
          user
        });
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/users/garage-coins" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const result = users.collectGarageCoins(body?.nick, cookies);

        if (!result.ok) {
          sendJson(req, res, 404, result);
          return;
        }

        sendJson(req, res, 200, result);
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/users/exchange-score" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const result = users.exchangeScore(body?.nick, body?.score);

        if (!result.ok) {
          sendJson(req, res, 400, result);
          return;
        }

        sendJson(req, res, 200, result);
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/users/spend-gs" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const result = users.spendGunsCoin(
          body?.nick,
          body?.amount,
          cookies,
          body?.meta || {}
        );

        if (!result.ok) {
          sendJson(req, res, 400, result);
          return;
        }

        sendJson(req, res, 200, result);
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/users/purchase-pilot-weapon" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const weaponId = String(body?.weaponId || "").trim();
        const purchase = resolveMarketItemPurchase(
          publishedConfig,
          body?.roomId,
          body?.instanceId,
          weaponId
        );

        if (!purchase.ok) {
          sendJson(req, res, purchase.status || 400, {
            ok: false,
            error: purchase.error,
            message: purchase.message
          });
          return;
        }

        const result = users.purchasePilotWeapon(
          body?.nick,
          purchase.weapon,
          cookies,
          {
            ...(body?.meta || {}),
            roomId: purchase.roomId,
            instanceId: purchase.instanceId
          }
        );

        if (!result.ok) {
          sendJson(req, res, 400, result);
          return;
        }

        syncLiveUserInventory(result.user, cookies, body?.nick);

        sendJson(req, res, 200, {
          ...result,
          room: publishedConfig.rooms[purchase.roomId],
          stock: purchase.stock
        });
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/admin/auth-check") {
    sendJson(req, res, 200, {
      ok: true,
      authenticated: true,
      version,
      serverStartedAt,
      uptimeMs: Date.now() - serverStartedAt
    });
    return;
  }

  if (url.pathname === "/admin/users") {
    sendJson(req, res, 200, {
      ...users.snapshot(),
      serverStartedAt,
      uptimeMs: Date.now() - serverStartedAt,
      userStore: users.storageInfo()
    });
    return;
  }

  if (url.pathname === "/admin/database-status") {
    Promise.resolve(users.databaseStatus())
      .then((database) => sendJson(req, res, 200, {
        ok: true,
        version,
        serverStartedAt,
        uptimeMs: Date.now() - serverStartedAt,
        latestMongoBackup: findLatestMongoBackup(mongoBackupRoot),
        database
      }))
      .catch((error) => sendJson(req, res, 500, {
        ok: false,
        error: "database_status_failed",
        message: error.message
      }));
    return;
  }

  if (url.pathname === "/admin/wallet-transactions") {
    Promise.resolve(users.listWalletTransactions({
      limit: url.searchParams.get("limit"),
      entityType: url.searchParams.get("entityType"),
      entityId: url.searchParams.get("entityId"),
      reason: url.searchParams.get("reason")
    }))
      .then((transactions) => sendJson(req, res, 200, {
        ok: true,
        userStore: users.storageInfo(),
        transactions
      }))
      .catch((error) => sendJson(req, res, 500, {
        ok: false,
        error: "wallet_transactions_failed",
        message: error.message
      }));
    return;
  }

  if (url.pathname === "/admin/audit-log") {
    Promise.resolve(users.listAdminAudit({
      limit: url.searchParams.get("limit"),
      action: url.searchParams.get("action"),
      entityType: url.searchParams.get("entityType"),
      entityId: url.searchParams.get("entityId"),
      actor: url.searchParams.get("actor")
    }))
      .then((entries) => sendJson(req, res, 200, {
        ok: true,
        userStore: users.storageInfo(),
        entries
      }))
      .catch((error) => sendJson(req, res, 500, {
        ok: false,
        error: "admin_audit_failed",
        message: error.message
      }));
    return;
  }

  if (url.pathname === "/admin/match-results") {
    Promise.resolve(users.listMatchResults({
      limit: url.searchParams.get("limit"),
      matchId: url.searchParams.get("matchId"),
      roomId: url.searchParams.get("roomId"),
      modeId: url.searchParams.get("modeId"),
      winnerId: url.searchParams.get("winnerId")
    }))
      .then((results) => sendJson(req, res, 200, {
        ok: true,
        userStore: users.storageInfo(),
        results
      }))
      .catch((error) => sendJson(req, res, 500, {
        ok: false,
        error: "match_results_failed",
        message: error.message
      }));
    return;
  }

  if (url.pathname.startsWith("/admin/users/") && req.method === "GET") {
    const suffix = url.pathname.slice("/admin/users/".length);
    const walletSuffix = "/wallet-transactions";
    const isWalletRequest = suffix.endsWith(walletSuffix);
    const userId = decodeURIComponent(
      isWalletRequest ? suffix.slice(0, -walletSuffix.length) : suffix
    );

    Promise.resolve(users.getUserDetail(userId, {
      limit: url.searchParams.get("limit")
    }))
      .then((result) => {
        if (!result.ok) {
          sendJson(req, res, 404, result);
          return;
        }

        if (isWalletRequest) {
          sendJson(req, res, 200, {
            ok: true,
            user: result.user,
            userStore: result.userStore,
            transactions: result.walletTransactions
          });
          return;
        }

        sendJson(req, res, 200, result);
      })
      .catch((error) => sendJson(req, res, 500, {
        ok: false,
        error: "user_detail_failed",
        message: error.message
      }));
    return;
  }

  if (url.pathname.startsWith("/admin/users/") && req.method === "PATCH") {
    const suffix = url.pathname.slice("/admin/users/".length);

    if (!suffix.endsWith("/wallet")) {
      sendJson(req, res, 404, {
        ok: false,
        error: "unknown_admin_user_action"
      });
      return;
    }

    const userId = decodeURIComponent(suffix.slice(0, -"/wallet".length));

    readJsonBody(req)
      .then((body) => {
        const result = users.setUserGunsCoin(userId, body?.gunsCoin, {
          source: "admin-panel"
        });

        if (!result.ok) {
          sendJson(req, res, 404, result);
          return;
        }

        sendJson(req, res, 200, result);
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));
    return;
  }

  if (url.pathname.startsWith("/admin/users/") && req.method === "DELETE") {
    const userId = decodeURIComponent(url.pathname.slice("/admin/users/".length));
    const result = users.deleteUser(userId);

    if (!result.ok) {
      sendJson(req, res, 404, result);
      return;
    }

    sendJson(req, res, 200, {
      ...result,
      snapshot: {
        ...users.snapshot(),
        serverStartedAt,
        uptimeMs: Date.now() - serverStartedAt
      }
    });
    return;
  }

  if (url.pathname.startsWith("/admin/devices/") && req.method === "DELETE") {
    const suffix = url.pathname.slice("/admin/devices/".length);

    if (suffix.endsWith("/claim")) {
      const deviceId = decodeURIComponent(suffix.slice(0, -"/claim".length));
      const result = users.unlinkDevice(deviceId);

      sendJson(req, res, result.ok ? 200 : 404, result);
      return;
    }
  }

  if (url.pathname.startsWith("/admin/sessions/") && req.method === "DELETE") {
    const sessionId = decodeURIComponent(url.pathname.slice("/admin/sessions/".length));
    const result = users.revokeSession(sessionId);

    sendJson(req, res, result.ok ? 200 : 404, result);
    return;
  }

  sendJson(req, res, 200, {
    service: "guns-multiplayer",
    version,
    websocket: "/ws?room=main&nick=pilot",
    health: "/health",
    rooms: "/rooms"
  });
});

function loadPublishedConfig() {
  try {
    return JSON.parse(fs.readFileSync(publishedConfigFile, "utf8"));
  } catch {
    return {
      schemaVersion: 1,
      configVersion: "fallback",
      status: "fallback",
      objects: {},
      rooms: {},
      modes: {}
    };
  }
}

function loadDraftConfig() {
  try {
    return JSON.parse(fs.readFileSync(draftConfigFile, "utf8"));
  } catch {
    return null;
  }
}

function getDraftStatus() {
  const draft = loadDraftConfig();

  if (!draft) {
    return {
      exists: false,
      valid: false
    };
  }

  try {
    validateGameConfig(draft);
    return {
      exists: true,
      valid: true,
      configVersion: draft.configVersion,
      status: draft.status
    };
  } catch (error) {
    return {
      exists: true,
      valid: false,
      message: error.message
    };
  }
}

function writeConfigFile(file, config) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

function writeConfigSources(config) {
  writeConfigDirectory(
    path.join(root, "shared", "objects", "cannons"),
    config.objects?.cannons || {}
  );
  writeConfigDirectory(
    path.join(root, "shared", "objects", "pilot-weapon-types"),
    config.objects?.pilotWeaponTypes || {}
  );
  writeConfigDirectory(
    path.join(root, "shared", "objects", "pilot-weapons"),
    config.objects?.pilotWeapons || {}
  );
  writeConfigDirectory(
    path.join(root, "shared", "objects", "room-objects"),
    config.objects?.roomObjects || {}
  );
  writeConfigDirectory(path.join(root, "shared", "rooms"), config.rooms || {});
  writeConfigDirectory(path.join(root, "shared", "modes"), config.modes || {});
  writeConfigFile(path.join(root, "shared", "settings.json"), config.settings || {});
}

function writeConfigDirectory(dir, items) {
  fs.rmSync(dir, {
    recursive: true,
    force: true
  });
  fs.mkdirSync(dir, { recursive: true });

  for (const [id, item] of Object.entries(items)) {
    writeConfigFile(path.join(dir, `${id}.json`), item);
  }
}

function buildVersionedGameConfig() {
  const config = buildGameConfig(root);
  config.configVersion = bumpConfigVersion(publishedConfig.configVersion);
  return config;
}

function bumpConfigVersion(version) {
  const parts = String(version || "0.1.0")
    .split(".")
    .map((part) => Number(part));

  while (parts.length < 3) {
    parts.push(0);
  }

  parts[2] = Number.isFinite(parts[2]) ? parts[2] + 1 : 1;

  return parts
    .slice(0, 3)
    .map((part) => (Number.isFinite(part) ? part : 0))
    .join(".");
}

function setRoomEnabled(config, roomId, enabled) {
  if (!config.rooms?.[roomId]) {
    throw new Error(`Room not found: ${roomId}`);
  }

  const nextConfig = structuredClone(config);

  nextConfig.rooms[roomId].enabled = !!enabled;

  return nextConfig;
}

function setGlobalSettings(config, settings) {
  const nextConfig = structuredClone(config);

  nextConfig.settings ||= {};
  if (settings.botNameBrackets !== undefined) {
    nextConfig.settings.botNameBrackets = settings.botNameBrackets === true;
  }
  if (settings.camera !== undefined) {
    nextConfig.settings.camera ||= {};

    if (settings.camera?.height !== undefined) {
      const height = Number(settings.camera.height);

      if (!Number.isFinite(height) || height <= 0) {
        throw new Error("settings.camera.height must be a positive number");
      }

      nextConfig.settings.camera.height = Math.min(3, Math.max(0.5, height));
    }
  }

  return nextConfig;
}

function setEconomySettings(config, economy) {
  const nextConfig = structuredClone(config);
  const gunsCoin = economy?.gunsCoin || economy || {};

  nextConfig.settings ||= {};
  nextConfig.settings.economy ||= {};
  nextConfig.settings.economy.gunsCoin ||= {};

  for (const key of ["visitorGrant", "playGrant", "registrationGrant", "exchangeScorePerCoin"]) {
    if (gunsCoin[key] === undefined) continue;

    const value = Number(gunsCoin[key]);

    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`gunsCoin.${key} must be a non-negative number`);
    }

    nextConfig.settings.economy.gunsCoin[key] = Math.floor(value);
  }

  return nextConfig;
}

function getEconomyConfig(config) {
  return {
    gunsCoin: {
      visitorGrant: normalizeCoinAmount(
        config?.settings?.economy?.gunsCoin?.visitorGrant
      ),
      playGrant: normalizeCoinAmount(
        config?.settings?.economy?.gunsCoin?.playGrant
      ),
      registrationGrant: normalizeCoinAmount(
        config?.settings?.economy?.gunsCoin?.registrationGrant
      ),
      exchangeScorePerCoin: normalizePositiveInteger(
        config?.settings?.economy?.gunsCoin?.exchangeScorePerCoin,
        100
      )
    }
  };
}

function resolveUserStoreMode(env) {
  const requested = String(env.GUNS_USER_STORE || "").trim();

  if (requested) return requested;
  if (env.GUNS_MONGO_URL) return "mongo-collections";

  return "file";
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return fallback;

  return Math.floor(number);
}

function normalizeCoinAmount(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) return 0;

  return Math.floor(number);
}

function createDraftRoom(config, sourceRoomId) {
  const source = config.rooms?.[sourceRoomId];

  if (!source) {
    throw new Error(`Room not found: ${sourceRoomId}`);
  }

  const nextConfig = structuredClone(config);
  const id = nextRoomDraftId(nextConfig, sourceRoomId);
  const draft = structuredClone(source);

  draft.id = id;
  draft.title = `${source.title || source.id} Draft`;
  draft.enabled = false;
  draft.published = false;
  delete draft.inherits;
  normalizeDraftPlayerSpawn(draft);

  nextConfig.rooms[id] = draft;

  return nextConfig;
}

function normalizeDraftPlayerSpawn(room) {
  const player = room.spawns?.player;

  if (!player || player.state !== "alive") return;

  const x = Number(player.x ?? 0);
  const y = Number(player.y ?? 0);
  const cannonEntityId = player.cannonEntityId || `${room.id}-player-cannon`;
  const gunType = player.gunType || "autogun";

  room.spawns.cannons ||= [];
  room.spawns.cannons.unshift({
    unitId: cannonEntityId,
    gunType,
    x,
    y
  });

  room.spawns.player = {
    state: "pilot",
    pilotX: x,
    pilotY: y - 58
  };
}

function nextRoomDraftId(config, sourceRoomId) {
  const base = sanitizeRoomId(`${sourceRoomId}-draft`);
  let index = 1;
  let id = `${base}-${index}`;

  while (config.rooms?.[id]) {
    index += 1;
    id = `${base}-${index}`;
  }

  return id;
}

function publishRoom(config, roomId) {
  if (!config.rooms?.[roomId]) {
    throw new Error(`Room not found: ${roomId}`);
  }

  const nextConfig = structuredClone(config);

  nextConfig.rooms[roomId].published = true;

  return nextConfig;
}

function deleteRoom(config, roomId) {
  if (!config.rooms?.[roomId]) {
    throw new Error(`Room not found: ${roomId}`);
  }

  const nextConfig = structuredClone(config);
  delete nextConfig.rooms[roomId];

  return nextConfig;
}

function isRoomOccupied(roomId) {
  const room = hub.rooms.get(sanitizeRoomId(roomId));
  return (room?.clients?.size || 0) > 0;
}

function isRoomPublished(config, roomId) {
  return config.rooms?.[roomId]?.published === true;
}

function setRoomArena(config, roomId, shape, params) {
  if (!config.rooms?.[roomId]) {
    throw new Error(`Room not found: ${roomId}`);
  }

  if (!["circle", "rectangle", "five-pointed-star", "triangle"].includes(shape)) {
    throw new Error(`Room shape is not supported: ${shape}`);
  }

  const nextParams = normalizeRoomArenaParams(shape, params);

  const nextConfig = structuredClone(config);

  nextConfig.rooms[roomId].arena = {
    shape,
    params: nextParams
  };

  return nextConfig;
}

function setRoomObjectInstanceConfig(config, roomId, instanceId, patch = {}) {
  const room = config.rooms?.[roomId];

  if (!room) {
    throw new Error(`Room not found: ${roomId}`);
  }

  const objectIndex = (room.objects || [])
    .findIndex((item) => item.instanceId === instanceId);

  if (objectIndex < 0) {
    throw new Error(`Room object not found: ${instanceId}`);
  }

  const nextConfig = structuredClone(config);
  const instance = nextConfig.rooms[roomId].objects[objectIndex];

  if (patch.x !== undefined) {
    instance.x = normalizeFiniteNumber(patch.x, "x");
  }

  if (patch.y !== undefined) {
    instance.y = normalizeFiniteNumber(patch.y, "y");
  }

  if (patch.rotation !== undefined) {
    instance.rotation = normalizeFiniteNumber(patch.rotation, "rotation");
  }

  if (instance.objectId === "market-item") {
    instance.params ||= {};

    if (patch.weaponId !== undefined) {
      const weaponId = String(patch.weaponId || "").trim();

      if (!nextConfig.objects?.pilotWeapons?.[weaponId]) {
        throw new Error(`Pilot weapon not found: ${weaponId}`);
      }

      instance.params.weaponId = weaponId;
      instance.params.icon = nextConfig.objects.pilotWeapons[weaponId].typeId ||
        instance.params.icon ||
        "item";
    }

    if (patch.stock !== undefined) {
      const stock = Number(patch.stock);

      if (!Number.isFinite(stock) || stock < 0) {
        throw new Error("stock must be a non-negative number");
      }

      instance.params.stock = Math.floor(stock);
    }
  }

  return nextConfig;
}

function syncLiveRoomConfig(roomId) {
  const cleanRoomId = sanitizeRoomId(roomId);
  const room = publishedConfig.rooms?.[cleanRoomId];
  const liveRoom = hub.rooms.get(cleanRoomId);

  if (!room || !liveRoom) return;

  liveRoom.roomConfig = room;
  hub.broadcast(cleanRoomId, {
    type: "room:config",
    room,
    configVersion: publishedConfig.configVersion,
    serverTime: Date.now()
  });
}

function syncLiveUserInventory(user, cookies = {}, rawNick = "") {
  const inventory = user?.inventory || { pilotWeapons: [] };
  const deviceToken = cookies[DEVICE_COOKIE] || "";
  const nick = sanitizeNick(user?.nick || rawNick);
  const touchedRooms = new Set();

  for (const room of hub.rooms.values()) {
    for (const client of room.clients.values()) {
      const sameDevice = deviceToken && client.deviceToken === deviceToken;
      const sameNick = nick && sanitizeNick(client.nick) === nick;

      if (!sameDevice && !sameNick) continue;

      client.inventory = inventory;
      room.arena.setPlayerInventory(client.id, inventory);
      client.send({
        type: "inventory:sync",
        inventory,
        user,
        serverTime: Date.now()
      });
      touchedRooms.add(room.id);
    }
  }

  for (const roomId of touchedRooms) {
    hub.broadcastRoomState(roomId);
  }
}

function resolveMarketItemPurchase(config, roomIdValue, instanceIdValue, weaponIdValue) {
  const roomId = String(roomIdValue || "").trim();
  const instanceId = String(instanceIdValue || "").trim();
  const requestedWeaponId = String(weaponIdValue || "").trim();
  const room = config.rooms?.[roomId];

  if (!roomId || !instanceId) {
    return {
      ok: false,
      status: 400,
      error: "market_context_required",
      message: "Market purchase requires roomId and instanceId."
    };
  }

  if (!room) {
    return {
      ok: false,
      status: 404,
      error: "room_not_found",
      message: "Room was not found."
    };
  }

  const instance = (room.objects || [])
    .find(item => item.instanceId === instanceId);

  if (!instance || instance.objectId !== "market-item") {
    return {
      ok: false,
      status: 404,
      error: "market_item_not_found",
      message: "Market item was not found."
    };
  }

  const weaponId = String(instance.params?.weaponId || "").trim();

  if (!weaponId || (requestedWeaponId && requestedWeaponId !== weaponId)) {
    return {
      ok: false,
      status: 409,
      error: "market_item_mismatch",
      message: "Market item does not match requested weapon."
    };
  }

  const weapon = config.objects?.pilotWeapons?.[weaponId] || null;

  if (!weapon) {
    return {
      ok: false,
      status: 404,
      error: "weapon_not_found",
      message: "Pilot weapon was not found."
    };
  }

  const stock = Math.max(0, Math.floor(Number(instance.params?.stock) || 0));

  if (stock <= 0) {
    return {
      ok: false,
      status: 409,
      error: "market_item_sold_out",
      message: "Market item is sold out."
    };
  }

  return {
    ok: true,
    roomId,
    instanceId,
    weapon,
    stock
  };
}

function normalizeFiniteNumber(value, label) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a finite number`);
  }

  return number;
}

function normalizeRoomArenaParams(shape, params) {
  if (shape === "circle") {
    const radius = Number(params?.radius);

    if (!Number.isFinite(radius) || radius <= 0) {
      throw new Error("Circle radius must be a positive number");
    }

    return { radius };
  }

  if (shape === "triangle") {
    const radius = Number(params?.radius);
    const rotation = Number(params?.rotation ?? -90);

    if (!Number.isFinite(radius) || radius <= 0) {
      throw new Error("Triangle radius must be a positive number");
    }

    return {
      radius,
      rotation: Number.isFinite(rotation) ? rotation : -90
    };
  }

  if (shape === "five-pointed-star") {
    const outerRadius = Number(params?.outerRadius);
    const innerRadius = Number(params?.innerRadius);
    const rotation = Number(params?.rotation ?? -90);

    if (!Number.isFinite(outerRadius) || outerRadius <= 0) {
      throw new Error("Star outer radius must be a positive number");
    }

    if (!Number.isFinite(innerRadius) || innerRadius <= 0 || innerRadius >= outerRadius) {
      throw new Error("Star inner radius must be positive and less than outer radius");
    }

    return {
      outerRadius,
      innerRadius,
      rotation: Number.isFinite(rotation) ? rotation : -90
    };
  }

  const width = Number(params?.width ?? params?.x);
  const height = Number(params?.height ?? params?.y);

  if (!Number.isFinite(width) || width <= 0) {
  throw new Error("Rectangle width must be a positive number");
  }

  if (!Number.isFinite(height) || height <= 0) {
    throw new Error("Rectangle height must be a positive number");
  }

  return { width, height };
}

function setCannonFireRate(config, cannonId, controller, value) {
  if (!config.objects?.cannons?.[cannonId]) {
    throw new Error(`Cannon not found: ${cannonId}`);
  }

  if (!["player", "bot"].includes(controller)) {
    throw new Error("Controller must be player or bot");
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Fire rate must be a positive number");
  }

  const nextConfig = structuredClone(config);
  const cannon = nextConfig.objects.cannons[cannonId];

  cannon.gameplay ||= {};
  cannon.gameplay.fireRate ||= {};
  cannon.gameplay.fireRate[controller] = value;

  return nextConfig;
}

function setPilotWeaponConfig(config, weaponId, patch = {}) {
  if (!config.objects?.pilotWeapons?.[weaponId]) {
    throw new Error(`Pilot weapon not found: ${weaponId}`);
  }

  const nextConfig = structuredClone(config);
  const weapon = nextConfig.objects.pilotWeapons[weaponId];

  if (patch.title !== undefined) {
    const title = String(patch.title || "").trim();
    if (!title) throw new Error("Weapon title is required");
    weapon.title = title;
  }

  if (patch.description !== undefined) {
    const description = String(patch.description || "").trim();
    if (!description) throw new Error("Weapon description is required");
    weapon.description = description;
  }

  if (patch.priceGs !== undefined) {
    weapon.economy ||= {};
    weapon.economy.priceGs = normalizeNonNegativeNumber(
      patch.priceGs,
      "priceGs"
    );
  }

  weapon.gameplay ||= {};

  if (patch.damage !== undefined) {
    const damage = Number(patch.damage);
    if (!Number.isFinite(damage) || damage <= 0) {
      throw new Error("damage must be a positive number");
    }
    weapon.gameplay.damage = damage;
  }

  if (patch.fireRate !== undefined && weapon.typeId === "pistol") {
    weapon.gameplay.fireRate = normalizeNonNegativeNumber(
      patch.fireRate,
      "fireRate"
    );
  }

  if (patch.magazine !== undefined && weapon.typeId === "pistol") {
    const magazine = Number(patch.magazine);
    if (!Number.isFinite(magazine) || magazine <= 0) {
      throw new Error("magazine must be a positive number");
    }
    weapon.gameplay.magazine = Math.floor(magazine);
  }

  return nextConfig;
}

function normalizeNonNegativeNumber(value, label) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }

  return number;
}

globalThis.GUNS_MULTIPLAYER_SERVER = server;

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const cookies = parseCookies(req.headers.cookie || "");

  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];

  if (!key) {
    socket.destroy();
    return;
  }

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${createAcceptKey(key)}`,
      "",
      ""
    ].join("\r\n")
  );

  const client = createClient(socket);
  const roomId = sanitizeRoomId(url.searchParams.get("room"));
  const nick = sanitizeNick(url.searchParams.get("nick"));
  const deviceToken = cookies[DEVICE_COOKIE] || "";

  client.deviceToken = deviceToken;
  const room = hub.join(client, roomId, nick);

  if (!room) return;

  const user = users.register(nick, {
    source: "websocket",
    deviceToken,
    connectionId: client.id,
    online: true,
    roomId
  });
  client.inventory = user?.inventory || { pilotWeapons: [] };
  room.arena.setPlayerInventory(client.id, client.inventory);
  client.send({
    type: "inventory:sync",
    inventory: client.inventory,
    user,
    serverTime: Date.now()
  });
  hub.broadcastRoomState(roomId);

  socket.on("data", (chunk) => {
    client.lastSeenAt = Date.now();
    client.buffer = Buffer.concat([client.buffer, chunk]);

    let result;

    try {
      result = decodeFrames(client.buffer);
    } catch {
      client.close();
      return;
    }

    client.buffer = result.rest;

    for (const frame of result.frames) {
      if (frame.opcode === 0x8) {
        client.close();
        return;
      }

      if (frame.opcode === 0x9) {
        client.write(encodeFrame(frame.text, 0xA));
        continue;
      }

      if (frame.opcode !== 0x1) continue;

      hub.handleMessage(client, safeJsonParse(frame.text));
    }
  });

  socket.on("close", () => {
    hub.leave(client);
    users.setOnline(client.nick, false, {
      roomId: "",
      connectionId: client.id,
      deviceToken: client.deviceToken
    });
  });
  socket.on("error", () => {
    hub.leave(client);
    users.setOnline(client.nick, false, {
      roomId: "",
      connectionId: client.id,
      deviceToken: client.deviceToken
    });
  });
});

server.listen(port, host, () => {
  safeLog(`GUNS multiplayer server: http://${host}:${port}/`);
  safeLog(`GUNS websocket: ws://${host}:${port}/ws?room=main&nick=pilot`);
});

function createClient(socket) {
  return {
    id: randomUUID(),
    nick: "pilot",
    roomId: "",
    connectedAt: Date.now(),
    lastSeenAt: Date.now(),
    deviceToken: "",
    buffer: Buffer.alloc(0),
    socket,
    send(message) {
      this.write(JSON.stringify(message));
    },
    write(payload) {
      if (this.socket.destroyed) return;
      this.socket.write(Buffer.isBuffer(payload) ? payload : encodeFrame(payload));
    },
    close() {
      if (!this.socket.destroyed) {
        this.socket.end(encodeFrame("", 0x8));
      }
    }
  };
}

function sendJson(req, res, status, payload, setCookies = []) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(req),
    ...(setCookies.length ? { "Set-Cookie": setCookies } : {})
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(req, res, status) {
  res.writeHead(status, corsHeaders(req));
  res.end();
}

function getAdminAuthResult(req, url) {
  if (!isAdminProtectedPath(url.pathname)) {
    return { ok: true };
  }

  if (!adminAuthRequired) {
    return { ok: true };
  }

  if (!adminToken) {
    return {
      ok: false,
      status: 503,
      error: "admin_auth_not_configured",
      message: "Admin API token is not configured."
    };
  }

  if (isAdminTokenValid(getAdminRequestToken(req))) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error: "admin_auth_required",
    message: "Admin API token is required."
  };
}

function isAdminProtectedPath(pathname) {
  return (
    pathname === "/admin/users" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/objects" ||
    pathname.startsWith("/api/objects/") ||
    pathname === "/api/settings" ||
    pathname === "/api/economy" ||
    pathname === "/api/rooms" ||
    pathname.startsWith("/api/rooms/") ||
    pathname === "/api/modes" ||
    pathname === "/api/config/status" ||
    pathname === "/api/config/draft" ||
    pathname === "/api/config/publish" ||
    pathname === "/api/config/discard"
  );
}

function getAdminRequestToken(req) {
  const headerToken = String(req.headers["x-guns-admin-token"] || "").trim();
  const authorization = String(req.headers.authorization || "").trim();

  if (headerToken) return headerToken;
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return "";
}

function isAdminTokenValid(candidate) {
  const expected = Buffer.from(adminToken);
  const actual = Buffer.from(String(candidate || ""));

  if (expected.length <= 0 || actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function corsHeaders(req) {
  const origin = req.headers.origin;

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GUNS-ADMIN-TOKEN",
    "Vary": "Origin"
  };
}

function parseCookies(cookieHeader) {
  const cookies = {};

  for (const part of String(cookieHeader || "").split(";")) {
    const index = part.indexOf("=");

    if (index === -1) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    }
  }

  return cookies;
}

function makeCookie(name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (Number.isFinite(options.maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (secureCookies) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearCookie(name) {
  return makeCookie(name, "", { maxAge: 0 });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 512 * 1024) {
        reject(new Error("Body is too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function safeLog(message) {
  try {
    console.log(message);
  } catch {
    // The server can run detached without a writable console.
  }
}
