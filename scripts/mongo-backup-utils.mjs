import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";
import { loadMongoEnv } from "./mongo-env.mjs";

export const MONGO_BACKUP_COLLECTIONS = [
  "devices",
  "visits",
  "pilots",
  "auth_sessions",
  "wallet_transactions",
  "admin_audit_log"
];

export function loadMongoBackupConfig(root) {
  loadMongoEnv(root);

  const mongoUrl = process.env.GUNS_MONGO_URL || "";

  if (!mongoUrl) {
    throw new Error("GUNS_MONGO_URL is required.");
  }

  return {
    mongoUrl,
    mongoDatabase: process.env.GUNS_MONGO_DATABASE || "guns",
    backupRoot: process.env.GUNS_MONGO_BACKUP_DIR ||
      path.join(root, "server", "data", "mongo-backups")
  };
}

export async function withMongoDatabase(config, callback) {
  const client = new MongoClient(config.mongoUrl);

  await client.connect();

  try {
    return await callback(client.db(config.mongoDatabase));
  } finally {
    await client.close();
  }
}

export function findLatestMongoBackup(backupRoot) {
  if (!fs.existsSync(backupRoot)) return null;

  const entries = fs.readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = path.join(backupRoot, entry.name);
      const manifestFile = path.join(directory, "manifest.json");

      if (!fs.existsSync(manifestFile)) return null;

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));

        return {
          ...manifest,
          directory
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return entries[0] || null;
}

export function parseArgValue(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));

  if (direct) return direct.slice(name.length + 1);

  const index = process.argv.indexOf(name);

  return index >= 0 ? process.argv[index + 1] : "";
}
