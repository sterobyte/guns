import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(root, "server", "data", "users.json");
const backupDir = path.join(root, "server", "data", "backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `users-${stamp}.json`);

if (!fs.existsSync(sourceFile)) {
  console.error(`Source file not found: ${sourceFile}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(sourceFile, backupFile);

console.log(backupFile);
