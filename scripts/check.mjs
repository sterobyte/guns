import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimePath = path.join(root, "src", "legacy", "gunsdemo22-runtime.js");
const runtime = fs.readFileSync(runtimePath, "utf8");

new vm.Script(runtime, {
  filename: runtimePath,
  displayErrors: true
});

console.log("legacy runtime syntax ok");
