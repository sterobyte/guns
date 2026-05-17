import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildGameConfig, validateGameConfig } from "./config-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  path.join(root, "src", "legacy", "gunsdemo22-runtime.js"),
  path.join(root, "src", "content", "object-definitions.js"),
  path.join(root, "src", "app", "start-screen.js"),
  path.join(root, "src", "net", "network-adapter.js"),
  path.join(root, "src", "config", "runtime-config.js"),
  path.join(root, "src", "config", "config-loader.js"),
  path.join(root, "scripts", "config-tools.mjs"),
  path.join(root, "scripts", "backup-users.mjs"),
  path.join(root, "scripts", "build-config.mjs"),
  path.join(root, "scripts", "compare-users-store.mjs"),
  path.join(root, "scripts", "dev-all.mjs"),
  path.join(root, "scripts", "migrate-users-to-mongo.mjs"),
  path.join(root, "scripts", "mongo-env.mjs"),
  path.join(root, "scripts", "run-users-mongo-migration.mjs"),
  path.join(root, "scripts", "watch-backend.mjs"),
  path.join(root, "server", "protocol.mjs"),
  path.join(root, "server", "arena.mjs"),
  path.join(root, "server", "rooms.mjs"),
  path.join(root, "server", "user-store.mjs"),
  path.join(root, "server", "users.mjs"),
  path.join(root, "server", "index.mjs")
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

const publishedConfig = JSON.parse(
  fs.readFileSync(path.join(root, "shared", "game-config.json"), "utf8")
);
const builtConfig = buildGameConfig(root);

validateGameConfig(publishedConfig);

if (JSON.stringify(withoutConfigVersion(publishedConfig)) !== JSON.stringify(withoutConfigVersion(builtConfig))) {
  throw new Error("shared/game-config.json is stale. Run npm run build:config.");
}

console.log("syntax ok");

function withoutConfigVersion(config) {
  return {
    ...config,
    configVersion: ""
  };
}
