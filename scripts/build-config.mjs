import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGameConfig } from "./config-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = buildGameConfig(root);
const outputFile = path.join(root, "shared", "game-config.json");

fs.writeFileSync(outputFile, `${JSON.stringify(config, null, 2)}\n`);

console.log(`built ${path.relative(root, outputFile)}`);
