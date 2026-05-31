#!/usr/bin/env node
/**
 * Builds a static inventory of AI Studio client-side API references.
 * The output is a planning aid for latency packets, not runtime authority.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__dirname, "..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const DEFAULT_SCAN_ROOTS = [
  "features/ai-studio",
  "features/compliance",
  "lib/authenticatedFetch.ts",
  "lib/appErrorReporter.ts",
  "lib/growthTelemetry.ts",
  "pages/_app.tsx",
  "pages/ai-studio.tsx",
];

const printUsage = () => {
  console.log(`Usage:
  node scripts/inventory_ai_studio_latency_routes.mjs [options]

Options:
  --json               Emit JSON instead of a markdown-style report.
  --include-tests      Include __tests__, test files, and fixtures.
  --root <path>        Frontend-relative file or directory to scan. Repeatable.
  --help               Show this message.
`);
};

const readProtectedApiRules = () => {
  const sourcePath = path.join(
    FRONTEND_ROOT,
    "lib/server/api/protectedApiPaths.ts",
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  const exactSection =
    source.match(
      /PROTECTED_API_EXACT_PATHS\s*=\s*new Set\(\[([\s\S]*?)\]\)/,
    )?.[1] ?? "";
  const prefixSection =
    source.match(/PROTECTED_API_PREFIXES\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  const exact = new Set(
    [...exactSection.matchAll(/["'](\/api\/[^"']+)["']/g)].map(
      (match) => match[1],
    ),
  );
  const prefixes = [...prefixSection.matchAll(/["'](\/api\/[^"']+)["']/g)].map(
    (match) => match[1],
  );
  return { exact, prefixes };
};

const isTestLikePath = (value) =>
  value.includes("__tests__") ||
  value.includes("/tests/") ||
  /\.(test|spec)\.[cm]?[tj]sx?$/.test(value) ||
  /\.fixtures\.[cm]?[tj]sx?$/.test(value);

const walkFiles = (targetPath, { includeTests = false } = {}) => {
  const absolutePath = path.join(FRONTEND_ROOT, targetPath);
  if (!fs.existsSync(absolutePath)) return [];
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    const normalized = targetPath.replaceAll("\\", "/");
    if (!includeTests && isTestLikePath(normalized)) return [];
    return /\.(tsx?|jsx?)$/.test(absolutePath) ? [absolutePath] : [];
  }

  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === "__snapshots__") return [];
    if (!includeTests && entry.name === "__tests__") return [];
    return walkFiles(path.join(targetPath, entry.name), { includeTests });
  });
};

const normalizeApiPath = (raw) => {
  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/, "");
  const [pathname] = withoutOrigin.split(/[?#]/);
  return (
    pathname.replace(/\/:[^/]+/g, "/:param").replace(/\/$/, "") || pathname
  ).trim();
};

export const extractApiReferences = (source) => {
  const references = new Set();
  const literalPattern =
    /["']((?:https?:\/\/[^"'`\s]+)?\/api\/[^"'`\s${}]*)["']/g;
  for (const match of source.matchAll(literalPattern)) {
    const route = normalizeApiPath(match[1] ?? "");
    if (route.startsWith("/api/")) references.add(route);
  }
  const templatePattern = /`([^`]*\/api\/[^`]*)`/g;
  for (const match of source.matchAll(templatePattern)) {
    const route = normalizeApiPath(
      (match[1] ?? "").replace(/\$\{[^}]+\}/g, ":param"),
    );
    if (route.startsWith("/api/")) references.add(route);
  }
  return [...references].sort();
};

const classifyTrigger = ({ relativePath, source, route }) => {
  const haystack = `${relativePath}\n${source}`.toLowerCase();
  if (relativePath.includes("useMediaComplianceGate")) return "startup";
  if (route === "/api/log/client-error") return "error-reporting";
  if (route.includes("-status") || haystack.includes("poll")) return "polling";
  if (haystack.includes("autosave") || haystack.includes("workspace"))
    return "workspace";
  if (
    haystack.includes("focus") ||
    haystack.includes("visibilitychange") ||
    haystack.includes("interval")
  ) {
    return "background-refresh";
  }
  if (
    relativePath.includes("appErrorReporter") ||
    relativePath.includes("authenticatedFetch")
  ) {
    return "error-reporting";
  }
  if (
    relativePath.includes("PageBaseRuntime") ||
    relativePath.includes("_app") ||
    haystack.includes("useeffect")
  ) {
    return "startup";
  }
  return "unknown";
};

const isProtectedRoute = ({ route, exact, prefixes }) =>
  exact.has(route) || prefixes.some((prefix) => route.startsWith(prefix));

export const buildAiStudioLatencyInventory = ({
  roots = DEFAULT_SCAN_ROOTS,
  includeTests = false,
} = {}) => {
  const protectedRules = readProtectedApiRules();
  const files = roots.flatMap((root) => walkFiles(root, { includeTests }));
  const routeMap = new Map();

  for (const absolutePath of files) {
    const source = fs.readFileSync(absolutePath, "utf8");
    const relativePath = path
      .relative(FRONTEND_ROOT, absolutePath)
      .replaceAll("\\", "/");
    for (const route of extractApiReferences(source)) {
      const entry = routeMap.get(route) ?? {
        route,
        protected: isProtectedRoute({ route, ...protectedRules }),
        triggers: new Set(),
        files: new Set(),
      };
      entry.triggers.add(classifyTrigger({ relativePath, source, route }));
      entry.files.add(relativePath);
      routeMap.set(route, entry);
    }
  }

  return [...routeMap.values()]
    .map((entry) => ({
      route: entry.route,
      protected: entry.protected,
      triggers: [...entry.triggers].sort(),
      files: [...entry.files].sort(),
    }))
    .sort((left, right) => {
      if (left.protected !== right.protected) return left.protected ? -1 : 1;
      return left.route.localeCompare(right.route);
    });
};

const formatReport = (inventory) => {
  const protectedCount = inventory.filter((entry) => entry.protected).length;
  const lines = [
    "# AI Studio Latency Route Inventory",
    "",
    `- Routes found: ${inventory.length}`,
    `- Protected routes: ${protectedCount}`,
    "",
    "| Route | Protected | Trigger hints | Files |",
    "| --- | --- | --- | --- |",
  ];
  for (const entry of inventory) {
    lines.push(
      `| \`${entry.route}\` | ${entry.protected ? "yes" : "no"} | ${entry.triggers.join(", ")} | ${entry.files
        .slice(0, 4)
        .map((file) => `\`${file}\``)
        .join("<br>")} |`,
    );
  }
  return `${lines.join("\n")}\n`;
};

export const parseArgs = (argv) => {
  const parsed = { json: false, includeTests: false, roots: [], help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--include-tests") {
      parsed.includeTests = true;
      continue;
    }
    if (arg === "--root") {
      const value = argv[index + 1]?.trim();
      if (!value) throw new Error("--root requires a value");
      parsed.roots.push(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  const inventory = buildAiStudioLatencyInventory({
    roots: args.roots.length > 0 ? args.roots : DEFAULT_SCAN_ROOTS,
    includeTests: args.includeTests,
  });
  if (args.json) {
    console.log(
      JSON.stringify(
        { generatedAt: new Date().toISOString(), inventory },
        null,
        2,
      ),
    );
    return;
  }
  process.stdout.write(formatReport(inventory));
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
