#!/usr/bin/env node
"use strict";

/**
 * Addis Maed API — plain Node entry point.
 *
 *   node server.js                    start the API (reads backend/.env)
 *   NODE_ENV=production node server.js  start the compiled build
 *
 * Outside production the TypeScript source is loaded through tsx, so editing
 * `src/` and restarting the process picks the changes up without a build step.
 * In production (Docker sets NODE_ENV=production) `dist/index.js` is used.
 */

const fs = require("node:fs");
const path = require("node:path");

const backendRoot = __dirname;
const sourceEntry = path.join(backendRoot, "src", "index.ts");
const compiledEntry = path.join(backendRoot, "dist", "index.js");

// Load backend/.env regardless of the directory this file was started from.
try {
  require("dotenv").config({ path: path.join(backendRoot, ".env") });
} catch {
  // dotenv is a runtime dependency; falling back to real environment vars is fine.
}

function canRequire(request) {
  try {
    require.resolve(request);
    return true;
  } catch {
    return false;
  }
}

function start() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction && fs.existsSync(sourceEntry) && canRequire("tsx/cjs")) {
    require("tsx/cjs");
    console.log(`[server] Starting from TypeScript source: ${path.relative(backendRoot, sourceEntry)}`);
    require(sourceEntry);
    return;
  }

  if (fs.existsSync(compiledEntry)) {
    console.log(`[server] Starting compiled build: ${path.relative(backendRoot, compiledEntry)}`);
    require(compiledEntry);
    return;
  }

  console.error("[server] No API entry point found.");
  console.error("[server] Build the backend first with `npm run build`, or install dependencies");
  console.error("[server] (including tsx) to run the TypeScript source directly.");
  process.exit(1);
}

start();
