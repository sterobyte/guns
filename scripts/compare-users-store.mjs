import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMongoEnv } from "./mongo-env.mjs";
import {
  createFileUserStore,
  createUserStore
} from "../server/user-store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadMongoEnv(root);
const storageFile = path.join(root, "server", "data", "users.json");
const mongoUrl = process.env.GUNS_MONGO_URL || "";
const mongoDatabase = process.env.GUNS_MONGO_DATABASE || "guns";
const mode = process.env.GUNS_USER_STORE || "mongo-collections";
const direction = getArgValue("--direction") || "file-to-mongo";

if (!mongoUrl) {
  console.error("GUNS_MONGO_URL is required.");
  process.exit(1);
}

if (mode !== "mongo" && mode !== "mongo-collections") {
  console.error("GUNS_USER_STORE must be mongo or mongo-collections.");
  process.exit(1);
}

const fileStore = createFileUserStore({ storageFile });
const mongoStore = await createUserStore({
  storageFile,
  mode,
  mongoUrl,
  mongoDatabase,
  mongoCollection: process.env.GUNS_MONGO_USER_COLLECTION || "user_snapshots",
  seedFromFile: false
});
const fileSnapshot = normalizeSnapshot(fileStore.loadSnapshot());
const mongoSnapshot = normalizeSnapshot(mongoStore.loadSnapshot());
const diff = direction === "mongo-live"
  ? compareLiveMongo(mongoSnapshot)
  : compareSnapshots(fileSnapshot, mongoSnapshot);

await mongoStore.close?.();

printDiff(diff);

if (diff.errors.length > 0) {
  process.exit(1);
}

function normalizeSnapshot(snapshot = {}) {
  return {
    anonymousVisits: sortByKey(snapshot.anonymousVisits || [], (item) => item.deviceId || item.id),
    pilots: sortByKey(snapshot.pilots || [], (item) => item.normalizedNick),
    authSessions: sortByKey(snapshot.authSessions || [], (item) => item.tokenHash),
    devices: sortByKey(snapshot.devices || [], (item) => item.tokenHash)
  };
}

function sortByKey(items, getKey) {
  return items
    .map((item) => normalizeObject(item))
    .sort((a, b) => String(getKey(a)).localeCompare(String(getKey(b))));
}

function normalizeObject(value) {
  if (Array.isArray(value)) return value.map(normalizeObject);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "online" && key !== "activeConnections" && key !== "roomId")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalizeObject(item)])
    );
  }

  return value;
}

function compareSnapshots(left, right) {
  const errors = [];

  for (const key of Object.keys(left)) {
    const leftJson = JSON.stringify(left[key]);
    const rightJson = JSON.stringify(right[key]);

    if (leftJson !== rightJson) {
      errors.push(`${key}_mismatch`);
    }
  }

  return {
    file: countSnapshot(left),
    mongo: countSnapshot(right),
    errors
  };
}

function compareLiveMongo(snapshot) {
  const errors = [];

  collectDuplicateErrors(errors, "visit", snapshot.anonymousVisits, (item) => item.deviceId || item.id);
  collectDuplicateErrors(errors, "pilot", snapshot.pilots, (item) => item.normalizedNick);
  collectDuplicateErrors(errors, "session", snapshot.authSessions, (item) => item.tokenHash);
  collectDuplicateErrors(errors, "device", snapshot.devices, (item) => item.tokenHash);

  return {
    file: {
      visits: 0,
      pilots: 0,
      authSessions: 0,
      devices: 0
    },
    mongo: countSnapshot(snapshot),
    errors
  };
}

function collectDuplicateErrors(errors, label, items, getKey) {
  const seen = new Set();

  for (const item of items) {
    const key = String(getKey(item) || "");

    if (!key) {
      errors.push(`${label}_key_missing`);
      continue;
    }

    if (seen.has(key)) {
      errors.push(`${label}_duplicate:${key}`);
    }

    seen.add(key);
  }
}

function countSnapshot(snapshot) {
  return {
    visits: snapshot.anonymousVisits.length,
    pilots: snapshot.pilots.length,
    authSessions: snapshot.authSessions.length,
    devices: snapshot.devices.length
  };
}

function printDiff(diff) {
  console.log("file:", JSON.stringify(diff.file));
  console.log("mongo:", JSON.stringify(diff.mongo));
  console.log(`errors: ${diff.errors.length ? diff.errors.join(", ") : "none"}`);
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((item) => item.startsWith(prefix));

  return match ? match.slice(prefix.length) : "";
}
