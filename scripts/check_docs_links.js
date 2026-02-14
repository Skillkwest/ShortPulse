// Repository markdown/docs integrity checks.
// Run with: node scripts/check_docs_links.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const DOCS_DIR = path.join(REPO_ROOT, "docs");
const DOCS_INDEX_PATH = path.join(DOCS_DIR, "README.md");
const API_DIR = path.join(DOCS_DIR, "api");
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "playwright-report",
  "test-results",
  "coverage",
  ".turbo",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }

    out.push(fullPath);
  }

  return out;
}

function toRepoPath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, "/");
}

function readText(absolutePath) {
  return fs.readFileSync(absolutePath, "utf8");
}

function parseMarkdownLinks(content) {
  const links = [];
  const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
  let match = linkPattern.exec(content);

  while (match) {
    links.push(match[1].trim());
    match = linkPattern.exec(content);
  }

  return links;
}

function normalizeRawLinkTarget(rawTarget) {
  if (!rawTarget) {
    return "";
  }

  let target = rawTarget.trim();

  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  }

  // Strip optional markdown title: [text](path "title")
  // Keep simple: split on first unescaped whitespace.
  const splitTarget = target.split(/\s+/)[0];
  return splitTarget.trim();
}

function isExternalTarget(target) {
  return (
    target.startsWith("#") ||
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("tel:") ||
    target.startsWith("data:")
  );
}

function resolveTarget(sourceAbsolutePath, target) {
  const cleanTarget = target.split("#")[0].split("?")[0];
  if (!cleanTarget) {
    return null;
  }

  if (cleanTarget.startsWith("/")) {
    return path.join(REPO_ROOT, cleanTarget.slice(1));
  }

  return path.resolve(path.dirname(sourceAbsolutePath), cleanTarget);
}

function fileExistsWithMarkdownFallback(absolutePath) {
  if (fs.existsSync(absolutePath)) {
    return true;
  }

  if (!path.extname(absolutePath)) {
    if (fs.existsSync(`${absolutePath}.md`)) {
      return true;
    }

    if (fs.existsSync(path.join(absolutePath, "README.md"))) {
      return true;
    }

    if (fs.existsSync(path.join(absolutePath, "index.md"))) {
      return true;
    }
  }

  return false;
}

function checkApiDocsIndexed(errors) {
  const apiDocs = fs
    .readdirSync(API_DIR)
    .filter((file) => file.startsWith("api-") && file.endsWith(".md"));
  const docsIndex = readText(DOCS_INDEX_PATH);

  for (const apiDoc of apiDocs) {
    if (!docsIndex.includes(`docs/api/${apiDoc}`)) {
      errors.push(
        `Missing API doc link in docs/README.md: docs/api/${apiDoc}`,
      );
    }
  }
}

function checkMarkdownLinks(errors) {
  const markdownFiles = walk(REPO_ROOT).filter((absolutePath) =>
    absolutePath.endsWith(".md"),
  );

  for (const markdownFile of markdownFiles) {
    const content = readText(markdownFile);
    const rawTargets = parseMarkdownLinks(content);

    for (const rawTarget of rawTargets) {
      const target = normalizeRawLinkTarget(rawTarget);
      if (!target || isExternalTarget(target)) {
        continue;
      }

      // Skip obvious placeholders.
      if (target.includes("{") || target.includes("}")) {
        continue;
      }

      const resolved = resolveTarget(markdownFile, target);
      if (!resolved) {
        continue;
      }

      if (!fileExistsWithMarkdownFallback(resolved)) {
        errors.push(
          `Broken markdown link in ${toRepoPath(markdownFile)} -> ${target}`,
        );
      }
    }
  }
}

function checkLegacyStatusPlacement(errors) {
  const docsMarkdownFiles = walk(DOCS_DIR).filter((absolutePath) =>
    absolutePath.endsWith(".md"),
  );
  const legacyStatusLinePattern = /^\s*(?:>\s*)?status:\s*legacy\b/im;

  for (const markdownFile of docsMarkdownFiles) {
    const repoPath = toRepoPath(markdownFile);
    if (repoPath.startsWith("docs/archive/")) {
      continue;
    }

    const content = readText(markdownFile);
    if (legacyStatusLinePattern.test(content)) {
      errors.push(
        `Legacy status marker must live under docs/archive/: ${repoPath}`,
      );
    }
  }
}

function runChecks() {
  const errors = [];
  checkApiDocsIndexed(errors);
  checkMarkdownLinks(errors);
  checkLegacyStatusPlacement(errors);

  if (errors.length) {
    console.error("Documentation checks failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Documentation checks passed.");
}

runChecks();
