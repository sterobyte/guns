import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadMongoBackupConfig,
  MONGO_BACKUP_COLLECTIONS,
  parseArgValue,
  withMongoDatabase
} from "./mongo-backup-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = loadMongoBackupConfig(root);
const backupDir = path.resolve(parseArgValue("--from") || "");
const confirmed = process.argv.includes("--yes");

if (!backupDir || !fs.existsSync(backupDir)) {
  console.error("Backup directory is required: npm run restore:mongo -- --from <path> --yes");
  process.exit(1);
}

if (!confirmed) {
  console.error("Restore replaces Mongo collections. Re-run with --yes.");
  process.exit(1);
}

const manifestFile = path.join(backupDir, "manifest.json");

if (!fs.existsSync(manifestFile)) {
  console.error(`manifest.json not found: ${manifestFile}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const restored = {};

await withMongoDatabase(config, async (db) => {
  for (const collectionName of MONGO_BACKUP_COLLECTIONS) {
    const entry = manifest.collections?.[collectionName];
    const fileName = entry?.file || `${collectionName}.json`;
    const file = path.join(backupDir, fileName);

    if (!fs.existsSync(file)) {
      console.error(`Backup file not found: ${file}`);
      process.exit(1);
    }

    const documents = JSON.parse(fs.readFileSync(file, "utf8"));
    const collection = db.collection(collectionName);

    await collection.deleteMany({});

    if (documents.length > 0) {
      await collection.insertMany(documents, { ordered: false });
    }

    restored[collectionName] = documents.length;
  }
});

console.log(JSON.stringify({
  ok: true,
  restoredFrom: backupDir,
  mongoDatabase: config.mongoDatabase,
  restored
}, null, 2));
