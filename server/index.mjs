import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createAcceptKey, decodeFrames, encodeFrame, safeJsonParse } from "./protocol.mjs";
import { MultiplayerHub, sanitizeNick, sanitizeRoomId } from "./rooms.mjs";
import { AUTH_COOKIE, DEVICE_COOKIE, UserRegistry, VISIT_COOKIE } from "./users.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.GUNS_HOST || "127.0.0.1";
const port = Number(process.env.GUNS_SERVER_PORT || process.env.PORT || 3000);
const version = "0.11.7";
const serverStartedAt = Date.now();
const publishedConfig = loadPublishedConfig();
const secureCookies = process.env.GUNS_COOKIE_SECURE === "1";
const hub = new MultiplayerHub({
  maxClientsPerRoom: Number(process.env.GUNS_MAX_ROOM_PLAYERS || 16)
});
const users = new UserRegistry();

process.stdout?.on?.("error", () => {});
process.stderr?.on?.("error", () => {});

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const cookies = parseCookies(req.headers.cookie || "");

  if (req.method === "OPTIONS") {
    sendEmpty(req, res, 204);
    return;
  }

  if (url.pathname === "/health") {
    sendJson(req, res, 200, {
      ok: true,
      service: "guns-multiplayer",
      version,
      startedAt: serverStartedAt,
      uptimeMs: Date.now() - serverStartedAt,
      time: Date.now()
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

  if (url.pathname === "/api/objects") {
    sendJson(req, res, 200, {
      ok: true,
      objects: publishedConfig.objects
    });
    return;
  }

  if (url.pathname === "/api/rooms") {
    sendJson(req, res, 200, {
      ok: true,
      rooms: publishedConfig.rooms
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

        if (result.visitToken) {
          setCookies.push(makeCookie(VISIT_COOKIE, result.visitToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

        if (result.deviceToken) {
          setCookies.push(makeCookie(DEVICE_COOKIE, result.deviceToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

        if (auth?.pilot) {
          const linkedVisit = users.linkVisitToPilotByToken(
            cookies[VISIT_COOKIE] || result.visitToken || "",
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

  if (url.pathname === "/visits/unclaimed-nick" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const result = users.useUnclaimedNick(
          body?.nick,
          cookies,
          body?.meta || {}
        );

        if (!result.ok) {
          sendJson(req, res, 409, result);
          return;
        }

        const setCookies = [];

        if (result.visitToken) {
          setCookies.push(makeCookie(VISIT_COOKIE, result.visitToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

        if (result.deviceToken) {
          setCookies.push(makeCookie(DEVICE_COOKIE, result.deviceToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

        sendJson(req, res, 200, {
          ok: true,
          visit: result.visit
        }, setCookies);
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

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
          makeCookie(AUTH_COOKIE, result.sessionToken, {
            maxAge: 60 * 60 * 24 * 30
          })
        ];

        if (result.visitToken) {
          setCookies.push(makeCookie(VISIT_COOKIE, result.visitToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

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
          makeCookie(AUTH_COOKIE, result.sessionToken, {
            maxAge: 60 * 60 * 24 * 30
          })
        ];

        if (result.visitToken) {
          setCookies.push(makeCookie(VISIT_COOKIE, result.visitToken, {
            maxAge: 60 * 60 * 24 * 365
          }));
        }

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
      clearCookie(AUTH_COOKIE),
      clearCookie(VISIT_COOKIE)
    ]);
    return;
  }

  if (url.pathname === "/users/register" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const user = users.register(body?.nick, {
          source: "game-start",
          visitToken: cookies[VISIT_COOKIE] || ""
        });

        sendJson(req, res, 200, {
          ok: true,
          user
        });
      })
      .catch(() => sendJson(req, res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/admin/users") {
    sendJson(req, res, 200, {
      ...users.snapshot(),
      serverStartedAt,
      uptimeMs: Date.now() - serverStartedAt
    });
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

  sendJson(req, res, 200, {
    service: "guns-multiplayer",
    version,
    websocket: "/ws?room=main&nick=pilot",
    health: "/health",
    rooms: "/rooms"
  });
});

function loadPublishedConfig() {
  const file = path.join(root, "shared", "game-config.json");

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
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
  const visitToken = cookies[VISIT_COOKIE] || "";

  client.visitToken = visitToken;
  hub.join(client, roomId, nick);
  users.register(nick, {
    source: "websocket",
    visitToken,
    connectionId: client.id,
    online: true,
    roomId
  });

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
      visitToken: client.visitToken
    });
  });
  socket.on("error", () => {
    hub.leave(client);
    users.setOnline(client.nick, false, {
      roomId: "",
      connectionId: client.id,
      visitToken: client.visitToken
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
    visitToken: "",
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

function corsHeaders(req) {
  const origin = req.headers.origin;

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

      if (body.length > 16 * 1024) {
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
