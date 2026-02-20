// Archive manifest integrity checks for docs/planning/archive/original-plans.
// Run with: node scripts/check_archive_manifest.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO_ROOT = process.cwd();
const ARCHIVE_DIR = path.join(REPO_ROOT, "docs", "planning", "archive", "original-plans");
const MANIFEST_PATH = path.join(ARCHIVE_DIR, "manifest.json");

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function run() {
  const errors = [];

  if (!fs.existsSync(MANIFEST_PATH)) {
    errors.push("Missing archive manifest: docs/planning/archive/original-plans/manifest.json");
  }

  if (errors.length) {
    console.error("Archive manifest checks failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

  if (typeof manifest.version !== "number") {
    errors.push("Manifest missing numeric 'version'.");
  }
  if (!Array.isArray(manifest.entries)) {
    errors.push("Manifest missing 'entries' array.");
  }

  const requiredFields = [
    "id",
    "source_path",
    "archived_path",
    "sha256",
    "bytes",
    "source_commit",
    "archived_at_utc",
    "copied_by",
    "notes",
  ];

  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  for (const entry of entries) {
    for (const field of requiredFields) {
      if (!(field in entry)) {
        errors.push(`Manifest entry missing field '${field}' for id '${entry.id || "unknown"}'.`);
      }
    }

    const archivedPath = path.resolve(REPO_ROOT, entry.archived_path || "");
    if (!archivedPath.startsWith(ARCHIVE_DIR)) {
      errors.push(`Manifest archived_path must stay in docs/planning/archive/original-plans: ${entry.archived_path}`);
      continue;
    }

    if (!fs.existsSync(archivedPath)) {
      errors.push(`Archived file missing: ${entry.archived_path}`);
      continue;
    }

    const stat = fs.statSync(archivedPath);
    const digest = hashFile(archivedPath);

    if (entry.sha256 !== digest) {
      errors.push(`Checksum mismatch for ${entry.archived_path}`);
    }
    if (entry.bytes !== stat.size) {
      errors.push(`Byte-size mismatch for ${entry.archived_path}: expected ${entry.bytes}, actual ${stat.size}`);
    }
  }

  if (errors.length) {
    console.error("Archive manifest checks failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Archive manifest checks passed.");
}

run();
