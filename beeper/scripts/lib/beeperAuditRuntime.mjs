#!/usr/bin/env node

/**
 * Shared Beeper runtime helpers for local product-testing scripts.
 * Responsibilities:
 * - Resolve audit credentials from Beeper/operator env.
 * - Resolve the active frontend runtime env from frontend/.env.local.
 * - Keep the dedicated Beeper audit user aligned with the active runtime project.
 * - Provide repeatable auth, compliance-gate, and browser-observer helpers.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const createNodeRequire = createRequire(import.meta.url);

const DEFAULT_BASE_URL = "http://localhost:3000";
const SUPPORTED_ENVIRONMENTS = new Set([
  "local",
  "development",
  "staging",
  "production",
]);
const DEFAULT_AUDIT_ROUTES = [
  "/dashboard",
  "/ai-studio",
  "/character",
  "/profile",
];

const ROUTE_ALIASES = new Map(
  DEFAULT_AUDIT_ROUTES.map((routePath) => [
    routePath.replace(/^\//, ""),
    routePath,
  ]),
);

const IGNORED_CONSOLE_PATTERNS = [
  /\[hmr\]\s+invalid message/i,
  /\[hmr\]\s+connected/i,
  /\[fast refresh\]\s+(rebuilding|done)/i,
  /react devtools/i,
  /favicon\.ico/i,
];

const SEVERE_SIGNAL_PATTERNS = [
  /maximum update depth exceeded/i,
  /too many re-renders/i,
  /page is unresponsive/i,
  /long[- ]running script/i,
  /resizeobserver loop limit exceeded/i,
];

const GENERIC_RESOURCE_FAILURE_PATTERN =
  /^failed to load resource: the server responded with a status of \d+/i;

const parseLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const withoutExport = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length)
    : trimmed;
  const eqIndex = withoutExport.indexOf("=");
  if (eqIndex <= 0) return null;

  const key = withoutExport.slice(0, eqIndex).trim();
  const rawValue = withoutExport.slice(eqIndex + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = rawValue;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
};

const readEnvFileMap = (filePath) => {
  if (!fs.existsSync(filePath)) return new Map();
  return new Map(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => parseLine(line))
      .filter(Boolean)
      .map((entry) => [entry.key, entry.value]),
  );
};

const parseCliValue = (argv, flag) => {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value.`);
    }
    return value.trim();
  }
  return null;
};

const parseRepeatableCliValues = (argv, flag) => {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value.`);
    }
    values.push(value.trim());
    index += 1;
  }
  return values;
};

const parseEnvironmentArg = (argv) => {
  const explicit = parseCliValue(argv, "--environment");
  const normalized = explicit ? explicit.toLowerCase() : "local";
  if (!SUPPORTED_ENVIRONMENTS.has(normalized)) {
    throw new Error(
      `Unsupported environment "${explicit}". Use one of: ${Array.from(
        SUPPORTED_ENVIRONMENTS,
      ).join(", ")}.`,
    );
  }
  return normalized;
};

const parseBooleanLike = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeBaseUrl = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\/+$/, "");

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
};

const requireNonEmpty = (value, label) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Missing required ${label}.`);
  }
  return normalized;
};

const authHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
});

/**
 * Resolves the active Beeper runtime config from repo-local env files and CLI overrides.
 * Runtime auth/project values come from frontend/.env.local; audit credentials come from .env.agent.local.
 * @param {{ argv?: string[] }} options
 */
export const resolveBeeperRuntimeConfig = ({ argv = [] } = {}) => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const frontendRoot = path.join(repoRoot, "frontend");
  const agentEnvPath = path.join(repoRoot, ".env.agent.local");
  const frontendEnvPath = path.join(frontendRoot, ".env.local");
  const environment = parseEnvironmentArg(argv);

  const agentEnv = readEnvFileMap(agentEnvPath);
  const frontendEnv = readEnvFileMap(frontendEnvPath);

  const envPrefixByEnvironment = {
    staging: "SHORTPULSE_STAGING",
    production: "SHORTPULSE_PRODUCTION",
  };

  const runtimeSupabaseUrl =
    environment === "local" || environment === "development"
      ? requireNonEmpty(
          pickFirstNonEmpty(
            frontendEnv.get("NEXT_PUBLIC_SUPABASE_URL"),
            process.env.NEXT_PUBLIC_SUPABASE_URL,
          ),
          "runtime NEXT_PUBLIC_SUPABASE_URL in frontend/.env.local",
        )
      : requireNonEmpty(
          pickFirstNonEmpty(
            agentEnv.get(`${envPrefixByEnvironment[environment]}_SUPABASE_URL`),
            process.env[`${envPrefixByEnvironment[environment]}_SUPABASE_URL`],
          ),
          `${environment} Supabase URL in .env.agent.local`,
        );

  const runtimeAnonKey =
    environment === "local" || environment === "development"
      ? requireNonEmpty(
          pickFirstNonEmpty(
            frontendEnv.get("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          ),
          "runtime NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local",
        )
      : requireNonEmpty(
          pickFirstNonEmpty(
            agentEnv.get(
              `${envPrefixByEnvironment[environment]}_SUPABASE_ANON_KEY`,
            ),
            process.env[
              `${envPrefixByEnvironment[environment]}_SUPABASE_ANON_KEY`
            ],
          ),
          `${environment} Supabase anon key in .env.agent.local`,
        );

  const runtimeServiceRoleKey =
    environment === "local" || environment === "development"
      ? requireNonEmpty(
          pickFirstNonEmpty(
            frontendEnv.get("SUPABASE_SERVICE_ROLE_KEY"),
            process.env.SUPABASE_SERVICE_ROLE_KEY,
          ),
          "runtime SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local",
        )
      : requireNonEmpty(
          pickFirstNonEmpty(
            agentEnv.get(
              `${envPrefixByEnvironment[environment]}_SUPABASE_SERVICE_ROLE_KEY`,
            ),
            process.env[
              `${envPrefixByEnvironment[environment]}_SUPABASE_SERVICE_ROLE_KEY`
            ],
          ),
          `${environment} Supabase service-role key in .env.agent.local`,
        );

  const baseUrl = normalizeBaseUrl(
    pickFirstNonEmpty(
      parseCliValue(argv, "--base-url"),
      process.env.PLAYWRIGHT_BEEPER_BASE_URL,
      process.env.SHORTPULSE_API_BASE_URL,
      environment === "staging"
        ? agentEnv.get("SHORTPULSE_STAGING_LIVE_URL")
        : environment === "production"
          ? agentEnv.get("SHORTPULSE_PRODUCTION_LIVE_URL")
          : "",
      frontendEnv.get("SHORTPULSE_PUBLIC_API_BASE_URL"),
      frontendEnv.get("APP_BASE_URL"),
      DEFAULT_BASE_URL,
    ),
  );

  const auditEmail = requireNonEmpty(
    pickFirstNonEmpty(
      agentEnv.get("PLAYWRIGHT_AUDIT_EMAIL"),
      process.env.PLAYWRIGHT_AUDIT_EMAIL,
    ),
    "PLAYWRIGHT_AUDIT_EMAIL in .env.agent.local",
  );
  const auditPassword = requireNonEmpty(
    pickFirstNonEmpty(
      agentEnv.get("PLAYWRIGHT_AUDIT_PASSWORD"),
      process.env.PLAYWRIGHT_AUDIT_PASSWORD,
      "AuditPass!12345",
    ),
    "PLAYWRIGHT_AUDIT_PASSWORD",
  );

  return {
    repoRoot,
    frontendRoot,
    agentEnvPath,
    frontendEnvPath,
    environment,
    baseUrl,
    runtimeSupabaseUrl: normalizeBaseUrl(runtimeSupabaseUrl),
    runtimeAnonKey,
    runtimeServiceRoleKey,
    runtimeProjectRef: new URL(runtimeSupabaseUrl).host.split(".")[0],
    auditEmail,
    auditPassword,
  };
};

/**
 * Resolves route paths from CLI route aliases or explicit paths.
 * @param {string[]} values
 * @returns {string[]}
 */
export const resolveAuditRoutes = (values) => {
  if (!Array.isArray(values) || values.length === 0) {
    return [...DEFAULT_AUDIT_ROUTES];
  }
  return values.map((value) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      throw new Error("Route values must be non-empty.");
    }
    if (trimmed.startsWith("/")) return trimmed;
    return ROUTE_ALIASES.get(trimmed) ?? `/${trimmed}`;
  });
};

/**
 * Reads repeatable --route values from a CLI argv list.
 * @param {string[]} argv
 * @returns {string[]}
 */
export const parseRouteArgs = (argv) =>
  parseRepeatableCliValues(argv, "--route");

/**
 * Launches the repo's Playwright runtime from frontend/node_modules.
 * @param {{ headless?: boolean }} options
 */
export const launchBeeperBrowser = async ({ headless = true } = {}) => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const playwrightRequire = createRequire(
    path.join(repoRoot, "frontend", "package.json"),
  );
  const { chromium } = playwrightRequire("playwright");
  return await chromium.launch({ headless });
};

const listAllUsers = async ({ runtimeSupabaseUrl, runtimeServiceRoleKey }) => {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const url = new URL(`${runtimeSupabaseUrl}/auth/v1/admin/users`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const response = await fetch(url, {
      method: "GET",
      headers: authHeaders(runtimeServiceRoleKey),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to list auth users (${response.status}): ${body.slice(0, 240)}`,
      );
    }

    const payload = await response.json();
    const pageUsers = Array.isArray(payload?.users) ? payload.users : [];
    users.push(...pageUsers);
    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
};

/**
 * Ensures the dedicated Beeper audit user exists in the active frontend runtime project.
 * @param {ReturnType<typeof resolveBeeperRuntimeConfig>} config
 * @param {{ apply?: boolean }} options
 */
export const ensureBeeperAuditUser = async (config, { apply = false } = {}) => {
  const users = await listAllUsers(config);
  const match = users.find(
    (user) =>
      String(user?.email ?? "")
        .trim()
        .toLowerCase() === config.auditEmail.trim().toLowerCase(),
  );

  if (!apply) {
    return {
      apply,
      found: Boolean(match),
      userId: match?.id ?? null,
      emailConfirmed: Boolean(match?.email_confirmed_at),
      action: match ? "check-only" : "missing",
    };
  }

  if (!match?.id) {
    const response = await fetch(
      `${config.runtimeSupabaseUrl}/auth/v1/admin/users`,
      {
        method: "POST",
        headers: authHeaders(config.runtimeServiceRoleKey),
        body: JSON.stringify({
          email: config.auditEmail,
          password: config.auditPassword,
          email_confirm: true,
          user_metadata: {
            role: "audit_tester",
            source: "beeper",
          },
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to create audit user (${response.status}): ${body.slice(0, 240)}`,
      );
    }
    const created = await response.json();
    return {
      apply,
      found: true,
      userId: created?.id ?? null,
      emailConfirmed: Boolean(created?.email_confirmed_at),
      action: "created",
    };
  }

  const response = await fetch(
    `${config.runtimeSupabaseUrl}/auth/v1/admin/users/${match.id}`,
    {
      method: "PUT",
      headers: authHeaders(config.runtimeServiceRoleKey),
      body: JSON.stringify({
        password: config.auditPassword,
        email_confirm: true,
        user_metadata: {
          ...(match.user_metadata ?? {}),
          role: "audit_tester",
          source: "beeper",
        },
      }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to update audit user (${response.status}): ${body.slice(0, 240)}`,
    );
  }

  const updated = await response.json();
  return {
    apply,
    found: true,
    userId: updated?.id ?? match.id,
    emailConfirmed: Boolean(
      updated?.email_confirmed_at ?? match.email_confirmed_at,
    ),
    action: "updated",
  };
};

const shouldIgnoreConsole = (text) =>
  IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));

const hasSevereSignal = (text) =>
  SEVERE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));

/**
 * Attaches browser observers for later report summarization.
 * @param {import("playwright").Page} page
 */
export const attachRuntimeObservers = async (page) => {
  const consoleEntries = [];
  const pageErrors = [];
  const httpFailures = [];
  const requestFailures = [];

  page.on("console", (message) => {
    const text = message.text();
    if (shouldIgnoreConsole(text)) return;
    consoleEntries.push({
      type: message.type(),
      text,
    });
  });

  page.on("pageerror", (error) => {
    pageErrors.push({
      text: String(error?.message || error),
    });
  });

  page.on("response", (response) => {
    if (response.status() < 400) return;
    httpFailures.push({
      status: response.status(),
      url: response.url(),
      method: response.request().method(),
    });
  });

  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      errorText: request.failure()?.errorText ?? "Request failed",
    });
  });

  return { consoleEntries, pageErrors, httpFailures, requestFailures };
};

/**
 * Reduces raw browser observer data into a small signal summary.
 * @param {{ consoleEntries: Array<{type: string, text: string}>, pageErrors: Array<{text: string}>, httpFailures: Array<object>, requestFailures: Array<object> }} observers
 */
export const summarizeRuntimeSignals = (observers) => {
  const severeConsole = observers.consoleEntries.filter(
    (entry) =>
      hasSevereSignal(entry.text) ||
      (entry.type === "error" &&
        !shouldIgnoreConsole(entry.text) &&
        !GENERIC_RESOURCE_FAILURE_PATTERN.test(entry.text)),
  );
  const severePageErrors = observers.pageErrors.filter(
    (entry) => !shouldIgnoreConsole(entry.text),
  );

  return {
    severeConsole,
    severePageErrors,
    httpFailures: observers.httpFailures,
    requestFailures: observers.requestFailures,
    ok:
      severeConsole.length === 0 &&
      severePageErrors.length === 0 &&
      observers.httpFailures.length === 0 &&
      observers.requestFailures.length === 0,
  };
};

/**
 * Signs in through the real auth form.
 * @param {import("playwright").Page} page
 * @param {ReturnType<typeof resolveBeeperRuntimeConfig>} config
 */
export const signInWithAuditUser = async (page, config) => {
  const signInTab = page.getByRole("tab", { name: /^sign in$/i }).first();
  if (
    (await signInTab.isVisible().catch(() => false)) &&
    (await signInTab.getAttribute("aria-selected").catch(() => null)) !== "true"
  ) {
    await signInTab.click();
  }
  await page.locator("#email").fill(config.auditEmail);
  await page.locator("#password").fill(config.auditPassword);
  await page.locator("button.auth-submit").click();
};

/**
 * Waits until the browser leaves /auth.
 * @param {import("playwright").Page} page
 * @param {number} timeoutMs
 */
export const waitForNonAuthRoute = async (page, timeoutMs) => {
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: timeoutMs,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Accepts the one-time media-compliance gate when it is visible.
 * @param {import("playwright").Page} page
 */
export const satisfyMediaComplianceIfPresent = async (page) => {
  const gateHeading = page
    .getByRole("heading", { name: /^confirm media rights$/i })
    .first();
  const gateVisible = await gateHeading.isVisible().catch(() => false);
  if (!gateVisible) return false;

  const agreementCheckbox = page.locator('input[type="checkbox"]').first();
  const continueButton = page
    .getByRole("button", { name: /^continue$/i })
    .first();

  await agreementCheckbox.check({ force: true });
  await continueButton.click({ timeout: 10_000 });
  await gateHeading.waitFor({ state: "hidden", timeout: 20_000 });
  return true;
};

/**
 * Signs in if needed, then loads a protected route and clears the compliance gate when present.
 * @param {import("playwright").Page} page
 * @param {ReturnType<typeof resolveBeeperRuntimeConfig>} config
 * @param {string} routePath
 */
export const openProtectedRoute = async (page, config, routePath) => {
  await page.goto(
    `${config.baseUrl}/auth?next=${encodeURIComponent(routePath)}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    },
  );
  await page.waitForTimeout(1_000);

  if (page.url().includes("/auth")) {
    await signInWithAuditUser(page, config);
    const reachedProtectedRoute = await waitForNonAuthRoute(page, 20_000);
    if (!reachedProtectedRoute) {
      throw new Error(`Auth did not reach protected route for ${routePath}.`);
    }
  }

  await page.goto(`${config.baseUrl}${routePath}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  const mediaComplianceAccepted = await satisfyMediaComplianceIfPresent(page);
  await page.waitForTimeout(2_000);
  return { mediaComplianceAccepted };
};

/**
 * Builds a compact route summary for audit packets.
 * @param {import("playwright").Page} page
 * @param {string} routePath
 */
export const buildRouteSummary = async (page, routePath) => {
  const heading = await page
    .locator("h1, main h2, [role='heading']")
    .first()
    .innerText()
    .catch(() => null);
  const body = await page
    .locator("body")
    .innerText()
    .then((text) => text.replace(/\s+/g, " ").slice(0, 700))
    .catch(() => "");

  return {
    routePath,
    url: page.url(),
    title: await page.title(),
    heading: heading ? heading.replace(/\s+/g, " ").slice(0, 240) : null,
    body,
  };
};

/**
 * Ensures a directory exists.
 * @param {string} directoryPath
 */
export const ensureDirectory = (directoryPath) => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

/**
 * Writes JSON with a stable two-space indent.
 * @param {string} filePath
 * @param {unknown} value
 */
export const writeJsonFile = (filePath, value) => {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

/**
 * Formats a timestamp for path-safe output directories.
 * @param {Date} date
 */
export const formatTimestampSlug = (date) =>
  [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    "-",
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
  ].join("");

export { DEFAULT_AUDIT_ROUTES };
