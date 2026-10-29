/**
 * Walks the frontend source and records every phrase the build-time translator
 * would wrap, grouped by the file it came from. The output is the input for
 * translate-phrases.mjs.
 *
 *   node frontend/i18n/extract-phrases.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@babel/core";
import plugin from "./babel-auto-translate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const frontend = path.resolve(root, "frontend");
const src = path.resolve(frontend, "src");
const outFile = path.resolve(root, ".tmp/i18n-phrases.json");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.tsx$/.test(entry.name)) files.push(full);
  }
  return files;
}

const byFile = new Map();

for (const file of walk(src)) {
  const code = fs.readFileSync(file, "utf8");
  babel.transformSync(code, {
    filename: file,
    configFile: false,
    babelrc: false,
    sourceMaps: false,
    parserOpts: { plugins: ["jsx", "typescript"], sourceType: "module" },
    plugins: [
      [
        plugin,
        {
          root: frontend,
          collect(text) {
            const relative = path.relative(frontend, file).split(path.sep).join("/");
            if (!byFile.has(relative)) byFile.set(relative, new Set());
            byFile.get(relative).add(text);
          },
        },
      ],
    ],
  });
}

const byFileObject = {};
const all = new Set();
for (const [file, phrases] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  byFileObject[file] = [...phrases].sort();
  for (const phrase of phrases) all.add(phrase);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify({ byFile: byFileObject }, null, 2)}\n`);

const files = Object.keys(byFileObject).length;
console.log(`extracted ${all.size} unique phrases from ${files} files -> ${path.relative(root, outFile)}`);
