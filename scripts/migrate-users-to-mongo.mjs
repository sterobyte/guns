import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMongoEnv } from "./mongo-env.mjs";
import {
  createUserStore,
  createFileUserStore
} from "../server/user-store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadMongoEnv(root);
const storageFile = path.join(root, "server", "data", "users.json");
const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const force = args.has("--force");
const checkTarget = args.has("--check-target") || write;
const mongoUrl = process.env.GUNS_MONGO_URL || "";
const mongoDatabase = process.env.GUNS_MONGO_DATABASE || "guns";
const mode = process.env.GUNS_USER_STORE || "mongo-collections";
const fileStore = createFileUserStore({ storageFile });
const sourceSnapshot = fileStore.loadSnapshot();
const sourceReport = inspectSnapshot(sourceSnapshot);

if (checkTarget && !mongoUrl) {
  fail("GUNS_MONGO_URL is required.");
}

if (checkTarget && mode !== "mongo" && mode !== "mongo-collections") {
  fail("GUNS_USER_STORE must be mongo or mongo-collections for migration.");
}

printReport("source file", sourceReport);

if (sourceReport.errors.length > 0) {
  fail("Source users snapshot has blocking errors.");
}

if (!write) {
  if (checkTarget) {
    const targetStore = await createUserStore({
      storageFile,
      mode,
      mongoUrl,
      mongoDatabase,
      mongoCollection: process.env.GUNS_MONGO_USER_COLLECTION || "user_snapshots",
      seedFromFile: false
    });
    const targetReport = inspectSnapshot(targetStore.loadSnapshot());

    printReport("mongo target", targetReport);
    await targetStore.close?.();
  }

  console.log("Dry run only. Add --write to seed Mongo.");
  process.exit(0);
}

const store = await createUserStore({
  storageFile,
  mode,
  mongoUrl,
  mongoDatabase,
  mongoCollection: process.env.GUNS_MONGO_USER_COLLECTION || "user_snapshots",
  seedFromFile: false
});
const targetSnapshot = store.loadSnapshot();
const targetReport = inspectSnapshot(targetSnapshot);

printReport("mongo target", targetReport);

if (targetReport.total > 0 && !force) {
  await store.close?.();
  fail("Mongo target is not empty. Add --force only after manual review.");
}

if (targetReport.errors.length > 0) {
  await store.close?.();
  fail("Mongo target has blocking errors.");
}

store.saveSnapshot(sourceSnapshot);
await store.close?.();
console.log("Mongo migration completed.");

function inspectSnapshot(snapshot) {
  const visits = Array.isArray(snapshot?.anonymousVisits)
    ? snapshot.anonymousVisits
    : [];
  const pilots = Array.isArray(snapshot?.pilots) ? snapshot.pilots : [];
  const authSessions = Array.isArray(snapshot?.authSessions)
    ? snapshot.authSessions
    : [];
  const devices = Array.isArray(snapshot?.devices) ? snapshot.devices : [];
  const errors = [];

  if (!snapshot) errors.push("snapshot_missing");
  collectDuplicateErrors(errors, "visit", visits, (visit) => visit.deviceId || visit.id);
  collectDuplicateErrors(errors, "pilot", pilots, (pilot) => pilot.normalizedNick);
  collectDuplicateErrors(errors, "session", authSessions, (session) => session.tokenHash);
  collectDuplicateErrors(errors, "device", devices, (device) => device.tokenHash);

  return {
    visits: visits.length,
    pilots: pilots.length,
    authSessions: authSessions.length,
    devices: devices.length,
    total: visits.length + pilots.length + authSessions.length + devices.length,
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

function printReport(label, report) {
  console.log(`${label}:`);
  console.log(`  visits: ${report.visits}`);
  console.log(`  pilots: ${report.pilots}`);
  console.log(`  authSessions: ${report.authSessions}`);
  console.log(`  devices: ${report.devices}`);
  console.log(`  errors: ${report.errors.length ? report.errors.join(", ") : "none"}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
