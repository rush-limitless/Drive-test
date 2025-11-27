"use strict";

/**
 * Minimal Spec Kit compliance check: ensures each spec folder (under specs/, excluding legacy folders)
 * contains spec.md, plan.md, tasks.md and that the files are non-empty.
 */

const fs = require("fs");
const path = require("path");

const SPEC_ROOT = path.join(__dirname, "..", "specs");
const IGNORED_FOLDERS = new Set(["modules"]);
const REQUIRED_FILES = ["spec.md", "plan.md", "tasks.md"];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function checkFolder(folderPath, folderName) {
  let ok = true;
  for (const file of REQUIRED_FILES) {
    const target = path.join(folderPath, file);
    if (!fs.existsSync(target)) {
      console.error(`❌ ${folderName}: missing ${file}`);
      ok = false;
      continue;
    }
    const content = fs.readFileSync(target, "utf8").trim();
    if (!content) {
      console.error(`❌ ${folderName}: ${file} is empty`);
      ok = false;
    }
  }
  if (ok) {
    console.log(`✅ ${folderName}`);
  } else {
    process.exitCode = 1;
  }
}

function main() {
  if (!fs.existsSync(SPEC_ROOT)) {
    fail("specs/ directory is missing");
    return;
  }

  const entries = fs
    .readdirSync(SPEC_ROOT, { withFileTypes: true })
    .filter((ent) => ent.isDirectory() && !IGNORED_FOLDERS.has(ent.name));

  if (entries.length === 0) {
    fail("No spec folders found under specs/ (excluding ignored folders).");
    return;
  }

  for (const dir of entries) {
    checkFolder(path.join(SPEC_ROOT, dir.name), dir.name);
  }

  if (process.exitCode === 1) {
    fail("Spec check failed. See errors above.");
  } else {
    console.log("\nAll spec folders are valid.");
  }
}

main();
