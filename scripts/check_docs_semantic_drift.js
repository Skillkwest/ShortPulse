// Semantic drift checks between runtime/code and documentation.
// Run with: node scripts/check_docs_semantic_drift.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const ROUTES_DOC = path.join(REPO_ROOT, "docs", "routes.md");
const README_DOC = path.join(REPO_ROOT, "README.md");
const SECURITY_DOC = path.join(REPO_ROOT, "docs", "security-checklist.md");
const API_DOC = path.join(REPO_ROOT, "docs", "api", "api-internal-routes.md");
const AUTH_GUARD_PATH = path.join(REPO_ROOT, "frontend", "lib", "authGuard.ts");
const PAGES_DIR = path.join(REPO_ROOT, "frontend", "pages");
const SKILLS_DIR = path.join(REPO_ROOT, "skills");
const CHANGELOG_PATH = path.join(REPO_ROOT, "docs", "change_log.md");

const IGNORE_PAGE_FILES = new Set(["_app.tsx", "_document.tsx", "_error.tsx"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    out.push(fullPath);
  }
  return out;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listPageRoutes() {
  const files = walk(PAGES_DIR).filter((fullPath) => /\.tsx?$/.test(fullPath));
  const routes = new Set();

  for (const fullPath of files) {
    const rel = path.relative(PAGES_DIR, fullPath).replace(/\\/g, "/");
    if (rel.startsWith("api/")) continue;
    const fileName = path.basename(rel);
    if (IGNORE_PAGE_FILES.has(fileName)) continue;

    const noExt = rel.replace(/\.tsx?$/, "");
    const parts = noExt.split("/");
    if (parts.some((part) => part.startsWith("["))) continue;

    if (parts.length === 1 && parts[0] === "index") {
      routes.add("/");
      continue;
    }

    const normalizedParts = [...parts];
    if (normalizedParts[normalizedParts.length - 1] === "index") {
      normalizedParts.pop();
    }
    routes.add(`/${normalizedParts.join("/")}`);
  }

  return routes;
}

function listApiRoutes() {
  const apiDir = path.join(PAGES_DIR, "api");
  const files = walk(apiDir).filter((fullPath) => /\.tsx?$/.test(fullPath));
  const routes = new Set();

  for (const fullPath of files) {
    const rel = path.relative(apiDir, fullPath).replace(/\\/g, "/");
    if (rel.startsWith("_utils/")) continue;
    if (rel === "_utils.ts" || rel === "_utils/index.ts") continue;

    const noExt = rel.replace(/\.tsx?$/, "");
    const parts = noExt.split("/");
    if (parts.some((part) => part.startsWith("["))) continue;

    if (parts[parts.length - 1] === "index") {
      parts.pop();
    }

    routes.add(`/api/${parts.join("/")}`);
  }

  return routes;
}

function parseRoutesDoc() {
  const text = readText(ROUTES_DOC);
  const entries = [];
  const pattern = /\|\s*`([^`]+)`\s*\|\s*(Yes|No)\s*\|/gi;
  let match = pattern.exec(text);
  while (match) {
    entries.push({ route: match[1].trim(), authRequired: match[2].toLowerCase() === "yes" });
    match = pattern.exec(text);
  }
  return entries;
}

function parseProtectedPrefixes() {
  const text = readText(AUTH_GUARD_PATH);
  const arrayMatch = text.match(/export const PROTECTED_ROUTES\s*=\s*\[([\s\S]*?)\];/m);
  if (!arrayMatch) return [];
  const values = [];
  const pattern = /"([^"]+)"/g;
  let match = pattern.exec(arrayMatch[1]);
  while (match) {
    values.push(match[1]);
    match = pattern.exec(arrayMatch[1]);
  }
  return values;
}

function isProtectedByPrefix(route, prefixes) {
  return prefixes.some((prefix) => route === prefix || route.startsWith(prefix));
}

function parseReadmeRouteProtectionList() {
  const text = readText(README_DOC);
  const lineMatch = text.match(/Route protection:\s*([^\n]+)/i);
  if (!lineMatch) return new Set();
  const routes = lineMatch[1].match(/\/[a-z0-9\-/]*/gi) || [];
  return new Set(routes.map((value) => value.toLowerCase()));
}

function parseSecurityRouteProtectionList() {
  const text = readText(SECURITY_DOC);
  const lineMatch = text.match(/Frontend route protection[^\n]*/i);
  if (!lineMatch) return new Set();
  const routes = lineMatch[0].match(/\/[a-z0-9\-/*]*/gi) || [];
  return new Set(routes.map((value) => value.toLowerCase()));
}

function parseApiDocPatterns() {
  const text = readText(API_DOC);
  const patterns = [];
  const linePattern = /^\|\s*([^|]+)\s*\|/gm;
  let match = linePattern.exec(text);
  while (match) {
    const firstColumn = match[1];
    const routeMatches = firstColumn.match(/\/api\/[a-z0-9\-/*]+/gi) || [];
    for (const route of routeMatches) {
      patterns.push(route.trim());
    }
    match = linePattern.exec(text);
  }
  return patterns;
}

function routeMatchesPattern(route, pattern) {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return route.startsWith(prefix);
  }
  return route === pattern;
}

function checkSkillPathValidity(errors) {
  if (!fs.existsSync(SKILLS_DIR)) return;
  const skillFiles = walk(SKILLS_DIR).filter((fullPath) => fullPath.endsWith("SKILL.md"));

  for (const skillFile of skillFiles) {
    const text = readText(skillFile);
    const pattern = /`([^`\n]+)`/g;
    let match = pattern.exec(text);
    while (match) {
      const candidate = match[1].trim();
      if (!candidate.includes("/")) {
        match = pattern.exec(text);
        continue;
      }
      if (/^https?:\/\//i.test(candidate) || candidate.includes("*") || candidate.includes("{")) {
        match = pattern.exec(text);
        continue;
      }
      if (candidate.includes(" ")) {
        match = pattern.exec(text);
        continue;
      }
      if (!/\.[a-z0-9]+$/i.test(candidate)) {
        match = pattern.exec(text);
        continue;
      }

      const resolvedPaths = [];
      if (path.isAbsolute(candidate)) {
        resolvedPaths.push(candidate);
      } else {
        resolvedPaths.push(path.resolve(path.dirname(skillFile), candidate));
        resolvedPaths.push(path.resolve(REPO_ROOT, candidate));
      }

      const exists = resolvedPaths.some((resolved) => fs.existsSync(resolved));
      if (!exists) {
        errors.push(
          `Missing referenced path in ${path.relative(REPO_ROOT, skillFile)} -> ${candidate}`
        );
      }

      match = pattern.exec(text);
    }
  }
}

function checkChangelogDates(errors) {
  const text = readText(CHANGELOG_PATH);
  if (!/^##\s+Unreleased\b/im.test(text)) {
    // Chronology/future-date enforcement activates after changelog normalization.
    return;
  }
  const legacySectionMatch = /^##\s+Legacy Imported Entries\b.*$/im.exec(text);
  const activeTimelineText = legacySectionMatch ? text.slice(0, legacySectionMatch.index) : text;
  const headingPattern = /^##\s+(\d{4}-\d{2}-\d{2})(?:\b|$)/gm;
  const dates = [];
  let match = headingPattern.exec(activeTimelineText);
  while (match) {
    dates.push(match[1]);
    match = headingPattern.exec(activeTimelineText);
  }

  const today = new Date();
  const todayIso = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(
    today.getUTCDate()
  ).padStart(2, "0")}`;

  let previous = null;
  for (const dateText of dates) {
    const asDate = new Date(`${dateText}T00:00:00Z`);
    if (Number.isNaN(asDate.getTime())) {
      errors.push(`Invalid changelog ISO date heading: ${dateText}`);
      continue;
    }
    if (dateText > todayIso) {
      errors.push(`Future-dated changelog entry found: ${dateText} > ${todayIso}`);
    }
    if (previous && dateText > previous) {
      errors.push(`Changelog chronology drift: ${dateText} appears after older date ${previous}`);
    }
    previous = dateText;
  }
}

function run() {
  const errors = [];

  const pageRoutes = listPageRoutes();
  const routeDocEntries = parseRoutesDoc();
  const routeDocSet = new Set(routeDocEntries.map((entry) => entry.route));
  const protectedDocRoutes = routeDocEntries
    .filter((entry) => entry.authRequired)
    .map((entry) => entry.route);

  for (const route of pageRoutes) {
    if (!routeDocSet.has(route)) {
      errors.push(`Route missing from docs/routes.md: ${route}`);
    }
  }
  for (const route of routeDocSet) {
    if (!pageRoutes.has(route)) {
      errors.push(`Route listed in docs/routes.md but missing in frontend/pages: ${route}`);
    }
  }

  const protectedPrefixes = parseProtectedPrefixes();
  for (const route of protectedDocRoutes) {
    if (!isProtectedByPrefix(route, protectedPrefixes)) {
      errors.push(
        `Route marked auth-required in docs/routes.md but not protected by runtime prefixes: ${route}`
      );
    }
  }

  const readmeRoutes = parseReadmeRouteProtectionList();
  const securityRoutes = parseSecurityRouteProtectionList();
  for (const prefix of protectedPrefixes) {
    const docHasExact =
      readmeRoutes.has(prefix.toLowerCase()) || readmeRoutes.has(`${prefix.toLowerCase()}*`);
    const docHasDerived = [...pageRoutes].some(
      (route) => (route === prefix || route.startsWith(prefix)) && readmeRoutes.has(route.toLowerCase())
    );
    if (!docHasExact && !docHasDerived) {
      errors.push(`README route protection list missing protected prefix coverage: ${prefix}`);
    }

    const securityHasExact =
      securityRoutes.has(prefix.toLowerCase()) || securityRoutes.has(`${prefix.toLowerCase()}*`);
    const securityHasDerived = [...pageRoutes].some(
      (route) =>
        (route === prefix || route.startsWith(prefix)) && securityRoutes.has(route.toLowerCase())
    );
    if (!securityHasExact && !securityHasDerived) {
      errors.push(`docs/security-checklist.md missing protected prefix coverage: ${prefix}`);
    }
  }

  const apiRoutes = listApiRoutes();
  const apiDocPatterns = parseApiDocPatterns();
  for (const route of apiRoutes) {
    const covered = apiDocPatterns.some((pattern) => routeMatchesPattern(route, pattern));
    if (!covered) {
      errors.push(`API route missing from docs/api/api-internal-routes.md: ${route}`);
    }
  }

  checkSkillPathValidity(errors);
  checkChangelogDates(errors);

  if (errors.length) {
    console.error("Semantic drift checks failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Semantic drift checks passed.");
}

run();
