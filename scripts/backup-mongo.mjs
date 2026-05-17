import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadMongoBackupConfig,
  MONGO_BACKUP_COLLECTIONS,
  withMongoDatabase
} from "./mongo-backup-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = loadMongoBackupConfig(root);
const createdAt = new Date().toISOString();
const stamp = createdAt.replace(/[:.]/g, "-");
const backupDir = path.join(config.backupRoot, stamp);
const manifest = {
  createdAt,
  mongoDatabase: config.mongoDatabase,
  collections: {},
  schema: "mongo-collections-v1"
};

fs.mkdirSync(backupDir, { recursive: true });

await withMongoDatabase(config, async (db) => {
  for (const collectionName of MONGO_BACKUP_COLLECTIONS) {
    const documents = await db.collection(collectionName)
      .find({})
      .sort({ _id: 1 })
      .toArray();
    const fileName = `${collectionName}.json`;

    fs.writeFileSync(
      path.join(backupDir, fileName),
      `${JSON.stringify(documents, null, 2)}\n`
    );
    manifest.collections[collectionName] = {
      file: fileName,
      count: documents.length
    };
  }
});

fs.writeFileSync(
  path.join(backupDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(backupDir);
