import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const healthUrl = "http://127.0.0.1:3000/health";
const wsUrl = "ws://127.0.0.1:3000/ws?room=main&nick=backend_watchdog";
let backend = null;
let starting = false;

console.log("GUNS backend watchdog");
console.log("---------------------");

await ensureBackend();
setInterval(ensureBackend, 5000);

async function ensureBackend() {
  if (starting) return;
  if (await isBackendReady()) return;

  starting = true;

  try {
    startBackend();

    if (await waitForBackend(8000)) {
      console.log("backend: online");
    } else {
      console.error("backend: still offline after restart");
    }
  } finally {
    starting = false;
  }
}

function startBackend() {
  if (backend && !backend.killed) {
    backend.kill();
  }

  backend = spawn(process.execPath, ["server/index.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      GUNS_SERVER_PORT: "3000"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  prefixOutput("backend", backend.stdout);
  prefixOutput("backend", backend.stderr);

  backend.once("exit", (code, signal) => {
    console.error(`backend: stopped (${signal || code})`);
  });
}

function prefixOutput(name, stream) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();

    let lineEnd = buffer.indexOf("\n");

    while (lineEnd !== -1) {
      const line = buffer.slice(0, lineEnd).trimEnd();
      buffer = buffer.slice(lineEnd + 1);

      if (line) {
        console.log(`[${name}] ${line}`);
      }

      lineEnd = buffer.indexOf("\n");
    }
  });
}

async function waitForBackend(timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isBackendReady()) return true;
    await sleep(250);
  }

  return false;
}

async function isBackendReady() {
  if (!(await isHealthy())) return false;
  return canOpenWebSocket();
}

async function isHealthy() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);

  try {
    const response = await fetch(healthUrl, {
      signal: controller.signal
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function canOpenWebSocket() {
  return new Promise((resolve) => {
    let settled = false;
    const socket = new WebSocket(wsUrl);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
