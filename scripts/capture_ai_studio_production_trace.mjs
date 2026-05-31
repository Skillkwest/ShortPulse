#!/usr/bin/env node
/**
 * Captures a compact production AI Studio load trace with API request timing.
 * This is for latency packet evidence; it does not change application behavior.
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__dirname, "..");
const requireFromFrontend = createRequire(
  path.join(REPO_ROOT, "frontend/package.json"),
);
const { chromium } = requireFromFrontend("playwright");

const DEFAULT_BASE_URL = "https://www.shortpulse.ai";
const DEFAULT_READY_TEXT = "What do you want to make?";
const DEFAULT_TIMEOUT_MS = 45_000;

const printUsage = () => {
  console.log(`Usage:
  node scripts/capture_ai_studio_production_trace.mjs [options]

Options:
  --base-url <url>          Production app origin. Default: ${DEFAULT_BASE_URL}
  --path <path>             Path to load. Default: /ai-studio
  --project-id <uuid>       Convenience option for /ai-studio?projectId=<uuid>.
  --sid <uuid>              Optional sid query param when using --project-id.
  --email <email>           Optional login email for /auth.
  --password <password>     Optional login password for /auth.
  --storage-state <path>    Optional Playwright storage state JSON.
  --user-data-dir <path>    Optional persistent Chromium profile directory.
  --ready-text <text>       Text marker for first useful AI Studio shell. Default: ${DEFAULT_READY_TEXT}
  --timeout-ms <n>          Navigation/readiness timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --headed                  Launch visible Chromium.
  --output <path>           Write JSON summary to a file as well as stdout.
  --help                    Show this message.
`);
};

const parseArgs = (argv) => {
  const parsed = {
    baseUrl: DEFAULT_BASE_URL,
    path: "/ai-studio",
    projectId: "",
    sid: "",
    email: "",
    password: "",
    storageState: "",
    userDataDir: "",
    readyText: DEFAULT_READY_TEXT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    headed: false,
    output: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--headed") {
      parsed.headed = true;
      continue;
    }
    const valueOptions = new Set([
      "--base-url",
      "--path",
      "--project-id",
      "--sid",
      "--email",
      "--password",
      "--storage-state",
      "--user-data-dir",
      "--ready-text",
      "--timeout-ms",
      "--output",
    ]);
    if (!valueOptions.has(arg)) throw new Error(`Unknown option: ${arg}`);
    const value = argv[index + 1]?.trim();
    if (!value) throw new Error(`${arg} requires a value`);
    index += 1;
    if (arg === "--base-url") parsed.baseUrl = value;
    if (arg === "--path") parsed.path = value;
    if (arg === "--project-id") parsed.projectId = value;
    if (arg === "--sid") parsed.sid = value;
    if (arg === "--email") parsed.email = value;
    if (arg === "--password") parsed.password = value;
    if (arg === "--storage-state") parsed.storageState = value;
    if (arg === "--user-data-dir") parsed.userDataDir = value;
    if (arg === "--ready-text") parsed.readyText = value;
    if (arg === "--timeout-ms") {
      const timeoutMs = Number.parseInt(value, 10);
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
        throw new Error(`Invalid timeout: ${value}`);
      parsed.timeoutMs = timeoutMs;
    }
    if (arg === "--output") parsed.output = value;
  }

  if (parsed.projectId) {
    const params = new URLSearchParams({ projectId: parsed.projectId });
    if (parsed.sid) params.set("sid", parsed.sid);
    parsed.path = `/ai-studio?${params.toString()}`;
  }

  return parsed;
};

const loginIfNeeded = async ({
  page,
  baseUrl,
  targetPath,
  email,
  password,
  timeoutMs,
}) => {
  if (!email && !password)
    return { attempted: false, reachedProtectedRoute: true };
  if (!email || !password)
    throw new Error(
      "Both --email and --password are required when logging in.",
    );

  await page.goto(`${baseUrl}/auth?next=${encodeURIComponent(targetPath)}`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  if (!page.url().includes("/auth")) {
    return { attempted: true, reachedProtectedRoute: true };
  }

  const signInTab = page.getByRole("tab", { name: /^Sign in$/i }).first();
  if (await signInTab.isVisible().catch(() => false)) {
    await signInTab.click().catch(() => undefined);
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button.auth-submit").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
    timeout: timeoutMs,
  });
  return { attempted: true, reachedProtectedRoute: true };
};

const summarizeApiRequests = (requests) => {
  const byPath = new Map();
  for (const request of requests) {
    const key = request.path;
    const entry = byPath.get(key) ?? {
      path: key,
      count: 0,
      statuses: new Map(),
      totalMs: 0,
      maxMs: 0,
    };
    entry.count += 1;
    entry.statuses.set(
      request.status,
      (entry.statuses.get(request.status) ?? 0) + 1,
    );
    entry.totalMs += request.elapsedMs;
    entry.maxMs = Math.max(entry.maxMs, request.elapsedMs);
    byPath.set(key, entry);
  }

  return [...byPath.values()]
    .map((entry) => ({
      path: entry.path,
      count: entry.count,
      avgMs: Math.round((entry.totalMs / entry.count) * 100) / 100,
      maxMs: Math.round(entry.maxMs * 100) / 100,
      statuses: Object.fromEntries(
        [...entry.statuses.entries()].sort((a, b) => a[0] - b[0]),
      ),
    }))
    .sort(
      (left, right) => right.count - left.count || right.maxMs - left.maxMs,
    );
};

const createBrowserContext = async (args) => {
  if (args.userDataDir) {
    const context = await chromium.launchPersistentContext(
      path.resolve(args.userDataDir),
      {
        headless: !args.headed,
        viewport: { width: 1440, height: 1000 },
      },
    );
    return { browser: null, context };
  }

  const browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...(args.storageState
      ? { storageState: path.resolve(args.storageState) }
      : {}),
  });
  return { browser, context };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const targetUrl = new URL(args.path, args.baseUrl);
  const { browser, context } = await createBrowserContext(args);
  const page = await context.newPage();
  const requestStarts = new Map();
  const apiRequests = [];
  const consoleErrors = [];

  page.on("request", (request) => {
    requestStarts.set(request, performance.now());
  });
  page.on("response", (response) => {
    const request = response.request();
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/")) return;
    const start = requestStarts.get(request) ?? performance.now();
    apiRequests.push({
      method: request.method(),
      path: url.pathname,
      status: response.status(),
      elapsedMs: Math.round((performance.now() - start) * 100) / 100,
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const startedAt = performance.now();
  let auth = { attempted: false, reachedProtectedRoute: true };
  let ready = false;
  let failure = null;

  try {
    auth = await loginIfNeeded({
      page,
      baseUrl: args.baseUrl,
      targetPath: `${targetUrl.pathname}${targetUrl.search}`,
      email: args.email,
      password: args.password,
      timeoutMs: args.timeoutMs,
    });
    await page.goto(targetUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: args.timeoutMs,
    });
    await page
      .getByText(args.readyText, { exact: false })
      .first()
      .waitFor({ timeout: args.timeoutMs });
    ready = true;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const summary = {
    ok: ready,
    generatedAt: new Date().toISOString(),
    baseUrl: args.baseUrl,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    readyText: args.readyText,
    elapsedMs,
    auth,
    failure,
    apiRequestCount: apiRequests.length,
    protectedApiRequestCount: apiRequests.filter(
      (request) => !request.path.startsWith("/api/internal/"),
    ).length,
    apiSummary: summarizeApiRequests(apiRequests),
    slowestApiRequests: [...apiRequests]
      .sort((left, right) => right.elapsedMs - left.elapsedMs)
      .slice(0, 20),
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 10),
  };

  const json = `${JSON.stringify(summary, null, 2)}\n`;
  process.stdout.write(json);
  if (args.output) {
    fs.writeFileSync(path.resolve(args.output), json);
  }

  await context.close();
  if (browser) await browser.close();
  if (!ready) process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(
      "[capture_ai_studio_production_trace] Failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
