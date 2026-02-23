// Naming canonical drift checks for active documentation surfaces.
// Run with: node scripts/check_naming_canonical_drift.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const DOCS_DIR = path.join(REPO_ROOT, "docs");

const ACTIVE_DOC_DIRS = [path.join(DOCS_DIR, "sops"), path.join(DOCS_DIR, "product")];
const ACTIVE_DOC_FILES = [
  path.join(DOCS_DIR, "README.md"),
  path.join(DOCS_DIR, "documentation_overview.md"),
  path.join(DOCS_DIR, "troubleshooting.md"),
  path.join(DOCS_DIR, "frontend-architecture.md"),
  path.join(DOCS_DIR, "architecture-overview.md"),
];

const BANNED_PATTERNS = [
  {
    regex: /\breference canvas\b/i,
    canonical: "Reference Grid",
  },
  {
    regex: /\btext properties panel\b/i,
    canonical: "Create Properties Panel",
  },
  {
    regex: /\bReferenceCanvas\b/,
    canonical: "ReferenceGrid",
  },
  {
    regex: /\bTextPropertiesPanel\b/,
    canonical: "CreatePropertiesPanel",
  },
];

function walkMarkdownFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdownFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".md")) {
      out.push(fullPath);
    }
  }
  return out;
}

function listActiveDocs() {
  const files = new Set();
  for (const file of ACTIVE_DOC_FILES) {
    if (fs.existsSync(file)) files.add(file);
  }
  for (const dir of ACTIVE_DOC_DIRS) {
    for (const file of walkMarkdownFiles(dir)) {
      files.add(file);
    }
  }
  return [...files];
}

function run() {
  const violations = [];
  const files = listActiveDocs();

  for (const filePath of files) {
    const rel = path.relative(REPO_ROOT, filePath);
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const rule of BANNED_PATTERNS) {
        rule.regex.lastIndex = 0;
        if (!rule.regex.test(line)) continue;
        violations.push(
          `${rel}:${i + 1} legacy naming found; use canonical term "${rule.canonical}" instead.`
        );
      }
    }
  }

  if (violations.length > 0) {
    console.error("Naming canonical drift check failed:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("Naming canonical drift checks passed.");
}

run();
