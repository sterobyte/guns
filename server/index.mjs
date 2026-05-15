import http from "node:http";
import { randomUUID } from "node:crypto";
import { createAcceptKey, decodeFrames, encodeFrame, safeJsonParse } from "./protocol.mjs";
import { MultiplayerHub, sanitizeNick, sanitizeRoomId } from "./rooms.mjs";
import { UserRegistry } from "./users.mjs";

const host = process.env.GUNS_HOST || "127.0.0.1";
const port = Number(process.env.GUNS_SERVER_PORT || process.env.PORT || 3000);
const version = "0.8.0";
const hub = new MultiplayerHub({
  maxClientsPerRoom: Number(process.env.GUNS_MAX_ROOM_PLAYERS || 16)
});
const users = new UserRegistry();

process.stdout?.on?.("error", () => {});
process.stderr?.on?.("error", () => {});

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);

  if (req.method === "OPTIONS") {
    sendEmpty(res, 204);
    return;
  }

  if (url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "guns-multiplayer",
      version,
      time: Date.now()
    });
    return;
  }

  if (url.pathname === "/rooms") {
    sendJson(res, 200, hub.snapshot());
    return;
  }

  if (url.pathname === "/users/register" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const user = users.register(body?.nick, {
          source: "game-start"
        });

        sendJson(res, 200, {
          ok: true,
          user
        });
      })
      .catch(() => sendJson(res, 400, { ok: false, error: "invalid_json" }));

    return;
  }

  if (url.pathname === "/admin/users") {
    sendJson(res, 200, users.snapshot());
    return;
  }

  sendJson(res, 200, {
    service: "guns-multiplayer",
    version,
    websocket: "/ws?room=main&nick=pilot",
    health: "/health",
    rooms: "/rooms"
  });
});

globalThis.GUNS_MULTIPLAYER_SERVER = server;

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);

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

  hub.join(client, roomId, nick);
  users.register(nick, {
    source: "websocket",
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
    users.setOnline(client.nick, false, { roomId: "" });
  });
  socket.on("error", () => {
    hub.leave(client);
    users.setOnline(client.nick, false, { roomId: "" });
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

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders()
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(res, status) {
  res.writeHead(status, corsHeaders());
  res.end();
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
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
