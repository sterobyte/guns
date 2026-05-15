import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(gameRoot, "..");
const panelRoot = path.join(workspaceRoot, "guns-panel");
const ownedServers = [];

const services = [
  {
    name: "backend",
    url: "http://127.0.0.1:3000/health",
    wsUrl: "ws://127.0.0.1:3000/ws?room=main&nick=dev_all_probe",
    start: startBackend
  },
  {
    name: "game",
    url: "http://127.0.0.1:5178/",
    start: () => startStaticServer("game", gameRoot, 5178)
  },
  {
    name: "panel",
    url: "http://127.0.0.1:5179/",
    start: () => startStaticServer("panel", panelRoot, 5179)
  }
];

main().catch((error) => {
  console.error(error?.stack || error);
  shutdown(1);
});

async function main() {
  console.log("GUNS local stack");
  console.log("----------------");

  for (const service of services) {
    await ensureService(service);
  }

  console.log("");
  console.log("Ready:");
  console.log("  game    http://127.0.0.1:5178/");
  console.log("  backend http://127.0.0.1:3000/health");
  console.log("  panel   http://127.0.0.1:5179/");
  console.log("");
  console.log("Press Ctrl+C to stop services started by this script.");

  setInterval(checkServices, 5000);
}

async function ensureService(service) {
  if (await isServiceReady(service)) {
    console.log(`${service.name}: already running (${service.url})`);
    return;
  }

  await service.start();

  if (!(await waitForService(service, 8000))) {
    throw new Error(`${service.name}: did not become ready at ${service.url}`);
  }

  console.log(`${service.name}: started (${service.url})`);
}

async function startBackend() {
  process.env.GUNS_SERVER_PORT = process.env.GUNS_SERVER_PORT || "3000";

  await import(pathToFileURL(path.join(gameRoot, "server", "index.mjs")).href);
}

function startStaticServer(name, root, port) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.normalize(path.join(root, rel));

    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream"
      });
      res.end(data);
    });
  });

  ownedServers.push({
    name,
    server
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

async function waitForService(service, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isServiceReady(service)) {
      return true;
    }

    await sleep(250);
  }

  return false;
}

async function isServiceReady(service) {
  if (!(await isHealthy(service.url))) return false;
  if (!service.wsUrl) return true;
  return canOpenWebSocket(service.wsUrl);
}

async function isHealthy(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function canOpenWebSocket(url) {
  return new Promise((resolve) => {
    let settled = false;
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => done(false), 900);

    socket.addEventListener("open", () => {
      socket.close();
      done(true);
    });

    socket.addEventListener("error", () => done(false));

    function done(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    }
  });
}

let monitorBusy = false;

async function checkServices() {
  if (monitorBusy) return;
  monitorBusy = true;

  try {
    for (const service of services) {
      if (await isServiceReady(service)) continue;

      console.error(`${service.name}: not ready`);
    }
  } finally {
    monitorBusy = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const entry of ownedServers) {
    entry.server.close();
  }

  globalThis.GUNS_MULTIPLAYER_SERVER?.close?.();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
