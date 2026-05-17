import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMongoEnv } from "./mongo-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

loadMongoEnv(root);

const force = process.argv.includes("--force");
const env = {
  ...process.env,
  GUNS_USER_STORE: process.env.GUNS_USER_STORE || "mongo-collections"
};

if (!env.GUNS_MONGO_URL) {
  fail("GUNS_MONGO_URL is required.");
}

run("backup", ["scripts/backup-users.mjs"]);
run("dry run", ["scripts/migrate-users-to-mongo.mjs"]);
run("target check", ["scripts/migrate-users-to-mongo.mjs", "--check-target"]);
run(
  "write",
  [
    "scripts/migrate-users-to-mongo.mjs",
    "--write",
    ...(force ? ["--force"] : [])
  ]
);
run("compare", ["scripts/compare-users-store.mjs"]);

console.log("Users Mongo migration pipeline completed.");

function run(label, args) {
  console.log(`\n== ${label} ==`);

  const result = spawnSync(process.execPath, args, {
    env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
