import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadMongoEnv(root = defaultRoot()) {
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
}

function defaultRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");

    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = unquote(trimmed.slice(eq + 1).trim());

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
