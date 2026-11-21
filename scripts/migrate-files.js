import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "./env.js";

loadEnvFile();
const { DATA, importImageFiles } = await import("../lib/db.js");
const dir = process.env.LEGACY_FILES_DIR || path.join(DATA, "files");
if (!fs.existsSync(dir))
    throw new Error(`Image-file directory not found: ${dir}`);

const names = fs.readdirSync(dir);
const pngIds = new Set(names.filter(name => name.endsWith(".png")).map(name => name.slice(0, -4)));
const fpIds = new Set(names.filter(name => name.endsWith(".fp")).map(name => name.slice(0, -3)));
const files = [];
let missing = 0;
for (const id of pngIds) {
    const png = fs.readFileSync(path.join(dir, id + ".png"));
    const fp = fpIds.has(id) ? fs.readFileSync(path.join(dir, id + ".fp")) : null;
    if (!fp)
        missing++;
    files.push({ id, png, fp });
}
for (const id of fpIds)
    if (!pngIds.has(id))
        missing++;

const imported = await importImageFiles(files);
console.log(JSON.stringify({ imported, skipped: files.length - imported, missing }, null, 2));
