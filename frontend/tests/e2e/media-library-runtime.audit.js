/* global require, process, console, __dirname, document, HTMLElement, setTimeout, URL */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * AI Studio Media Library browser audit.
 * Signs in to AI Studio, exercises the active panel browse flow, and
 * optionally audits the legacy standalone modal when that entry point exists.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

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

const MEDIA_LIBRARY_ROUTE_PATHS = [
  "/api/account/media-compliance",
  "/api/media/",
  "/api/media",
  "/ai-studio",
];

const MEDIA_LIBRARY_SUPABASE_TABLE_PATTERNS = [
  /\/rest\/v1\/media_files(?:[/?#]|$)/i,
  /\/rest\/v1\/media_prompts(?:[/?#]|$)/i,
  /\/rest\/v1\/media_folders(?:[/?#]|$)/i,
  /\/rest\/v1\/media_folder_memberships(?:[/?#]|$)/i,
  /\/rest\/v1\/media_asset_variants(?:[/?#]|$)/i,
];

const MEDIA_LIBRARY_STORAGE_PATTERNS = [
  /\/storage\/v1\/(?:object|render\/image)\/(?:sign|public)\/media_library(?:[/?#]|$)/i,
];

function usage() {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/tests/e2e/media-library-runtime.audit.js [options]",
      "",
      "Environment:",
      "  PLAYWRIGHT_AUDIT_EMAIL              Required real test account email",
      "  PLAYWRIGHT_AUDIT_PASSWORD           Optional password override",
      "  PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL   Default base URL (default http://localhost:3000)",
      "  PLAYWRIGHT_PANEL_BASE_URL           Optional panel base URL override",
      "  PLAYWRIGHT_MODAL_BASE_URL           Optional standalone modal base URL override",
      "  PLAYWRIGHT_HEADLESS                 Set to false to watch the audit",
      "",
    ].join("\n")
  );
}

function loadEnvFromFileIfNeeded(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    if (!key || (process.env[key] ?? "") !== "") continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadAuditEnv() {
  const frontendRoot = path.resolve(__dirname, "..", "..");
  const repoRoot = path.resolve(frontendRoot, "..");
  loadEnvFromFileIfNeeded(path.join(frontendRoot, ".env.local"));
  loadEnvFromFileIfNeeded(path.join(frontendRoot, ".env.playwright.local"));
  loadEnvFromFileIfNeeded(path.join(repoRoot, ".env.agent.local"));
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

loadAuditEnv();

const DEFAULT_BASE_URL = (
  process.env.PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL || "http://localhost:3000"
).trim();
const PANEL_BASE_URL = (process.env.PLAYWRIGHT_PANEL_BASE_URL || DEFAULT_BASE_URL).trim();
const MODAL_BASE_URL = (process.env.PLAYWRIGHT_MODAL_BASE_URL || PANEL_BASE_URL).trim();
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";

function loadAuditCredentials() {
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  return { email, password };
}

function shouldIgnoreConsole(text) {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasSevereSignal(text) {
  return SEVERE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function isGenericResourceFailure(text) {
  return GENERIC_RESOURCE_FAILURE_PATTERN.test(text);
}

function isMediaLibraryRelevantUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return false;
  try {
    const parsed = new URL(rawUrl);
    const candidate = `${parsed.pathname}${parsed.search}`;
    if (MEDIA_LIBRARY_ROUTE_PATHS.some((segment) => candidate.includes(segment))) return true;
    if (MEDIA_LIBRARY_SUPABASE_TABLE_PATTERNS.some((pattern) => pattern.test(candidate))) {
      return true;
    }
    return MEDIA_LIBRARY_STORAGE_PATTERNS.some((pattern) => pattern.test(candidate));
  } catch {
    return MEDIA_LIBRARY_ROUTE_PATHS.some((segment) => rawUrl.includes(segment));
  }
}

function isIgnorableRequestFailure(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (!/net::ERR_ABORTED/i.test(entry.errorText || "")) return false;
  if (
    entry.method === "GET" &&
    typeof entry.url === "string" &&
    entry.url.includes("/api/account/media-compliance")
  ) {
    return true;
  }
  if (entry.isNavigationRequest) return true;
  return entry.resourceType === "document";
}

function summarizeSignals(consoleEntries, pageErrors, httpFailures, requestFailures) {
  const severeConsole = consoleEntries.filter((entry) => {
    if (hasSevereSignal(entry.text)) return true;
    if (entry.type !== "error") return false;
    if (shouldIgnoreConsole(entry.text)) return false;
    if (isGenericResourceFailure(entry.text)) return false;
    return true;
  });
  const severePageErrors = pageErrors.filter((entry) => !shouldIgnoreConsole(entry.text));
  const relevantHttpFailures = httpFailures.filter((entry) => isMediaLibraryRelevantUrl(entry.url));
  const relevantRequestFailures = requestFailures.filter(
    (entry) => isMediaLibraryRelevantUrl(entry.url) && !isIgnorableRequestFailure(entry)
  );
  return {
    severeConsole,
    severePageErrors,
    relevantHttpFailures,
    relevantRequestFailures,
    ok:
      severeConsole.length === 0 &&
      severePageErrors.length === 0 &&
      relevantHttpFailures.length === 0 &&
      relevantRequestFailures.length === 0,
  };
}

async function signIn(page, email, password) {
  const signInTab = page.getByRole("tab", { name: /^sign in$/i }).first();
  if (
    (await signInTab.isVisible().catch(() => false)) &&
    (await signInTab.getAttribute("aria-selected").catch(() => null)) !== "true"
  ) {
    await signInTab.click();
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button.auth-submit").click();
}

async function waitForNonAuthRoute(page, timeoutMs) {
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function satisfyMediaComplianceIfPresent(page) {
  const gateHeading = page.getByRole("heading", { name: /^confirm media rights$/i }).first();
  const gateVisible = await gateHeading.isVisible().catch(() => false);
  if (!gateVisible) return;

  const agreementCheckbox = page
    .getByLabel(/^i confirm that the media i use in shortpulse follows these rules\.$/i)
    .first();
  const continueButton = page.getByRole("button", { name: /^continue$/i }).first();

  await agreementCheckbox.check({ force: true });
  await continueButton.click({ timeout: 10_000 });
  await gateHeading.waitFor({ state: "hidden", timeout: 20_000 });
}

async function ensureSignedIn(page, baseUrl, targetPath, email, password) {
  await page.goto(`${baseUrl}/auth?next=${encodeURIComponent(targetPath)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(1000);

  if (page.url().includes("/auth")) {
    await signIn(page, email, password);
    const reached = await waitForNonAuthRoute(page, 20_000);
    if (!reached) {
      throw new Error(`Auth did not reach protected route for ${targetPath} on ${baseUrl}`);
    }
  }

  await page.goto(`${baseUrl}${targetPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await satisfyMediaComplianceIfPresent(page);
}

async function clickLoadMore(page, buttonLocator, maxClicks, delayMs) {
  let clicks = 0;
  for (let index = 0; index < maxClicks; index += 1) {
    if (!(await buttonLocator.isVisible().catch(() => false))) break;
    if (await buttonLocator.isDisabled().catch(() => false)) {
      await page.waitForTimeout(delayMs);
      continue;
    }
    try {
      await buttonLocator.scrollIntoViewIfNeeded().catch(() => {});
      await buttonLocator.click({ timeout: 5_000 });
      clicks += 1;
    } catch (error) {
      const message = String(error?.message || error);
      const isTransientLocatorFailure =
        /element is not stable/i.test(message) ||
        /element was detached from the dom/i.test(message) ||
        /timeout .* exceeded/i.test(message);
      if (!isTransientLocatorFailure) throw error;
      await page.waitForTimeout(delayMs);
      continue;
    }
    await page.waitForTimeout(delayMs);
  }
  return clicks;
}

async function churnScrollable(page, selector, iterations) {
  return page.evaluate(
    async ({ selector: scrollSelector, iterations: repeatCount }) => {
      const element = document.querySelector(scrollSelector);
      if (!(element instanceof HTMLElement)) return { found: false, iterations: 0 };
      for (let index = 0; index < repeatCount; index += 1) {
        element.scrollTop = element.scrollHeight;
        await new Promise((resolve) => setTimeout(resolve, 120));
        element.scrollTop = 0;
        await new Promise((resolve) => setTimeout(resolve, 90));
      }
      return { found: true, iterations: repeatCount };
    },
    { selector, iterations }
  );
}

async function attachSurfaceObservers(page) {
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
      isNavigationRequest: request.isNavigationRequest(),
      errorText: request.failure()?.errorText ?? "Request failed",
    });
  });
  return { consoleEntries, pageErrors, httpFailures, requestFailures };
}

async function openAiStudioMediaPanel(page) {
  const panel = page.locator('section[aria-label="Media library panel"]').first();
  if (await panel.isVisible().catch(() => false)) return panel;

  const mediaButton = page.getByRole("button", { name: /^media$/i }).first();
  const expandPanelButton = page
    .getByRole("button", { name: /^expand media library panel$/i })
    .first();
  const retryProjectButton = page
    .getByRole("button", { name: /^retry (project|workspace) load$/i })
    .first();
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await panel.isVisible().catch(() => false)) return panel;
    if (await retryProjectButton.isVisible().catch(() => false)) {
      throw new Error(
        "AI Studio did not finish loading: retry project/workspace state is visible."
      );
    }
    if (await expandPanelButton.isVisible().catch(() => false)) {
      await expandPanelButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    if (await mediaButton.isVisible().catch(() => false)) {
      await mediaButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for the AI Studio media panel to become ready.");
}

async function openAiStudioMediaModal(page) {
  const modal = page.getByRole("dialog", { name: /media library/i }).first();
  if (await modal.isVisible().catch(() => false)) return modal;

  const candidateButtons = [
    page.getByRole("button", { name: /^Media Library$/i }).last(),
    page.getByRole("button", { name: /^Open media library$/i }).last(),
    page.getByRole("button", { name: /^Browse media library$/i }).last(),
  ];

  for (const candidate of candidateButtons) {
    const isVisible = await candidate.isVisible().catch(() => false);
    if (!isVisible) continue;
    await candidate.click({ timeout: 10_000 });
    const opened = await modal
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return modal;
  }

  return null;
}

async function runPanelAudit(browser, creds) {
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();
  const observers = await attachSurfaceObservers(page);
  const result = {
    surface: "panel",
    ok: false,
    baseUrl: PANEL_BASE_URL,
    rootTabClicks: [],
    loadMoreMediaClicks: 0,
    loadMorePromptClicks: 0,
    folderTransition: {
      attempted: false,
      succeeded: false,
    },
    scrollChurn: null,
    severeSignals: null,
    finalUrl: null,
  };

  try {
    await ensureSignedIn(page, PANEL_BASE_URL, "/ai-studio", creds.email, creds.password);
    const panel = await openAiStudioMediaPanel(page);

    const folderNameButtons = page.locator(".media-library-panel-folder-chip-name");
    const folderButtonCount = await folderNameButtons.count();
    if (folderButtonCount > 0) {
      result.folderTransition.attempted = true;
      await folderNameButtons.first().click();
      await page.waitForTimeout(900);
      const allMediaButton = panel.getByRole("button", { name: /^all media/i }).first();
      await allMediaButton.click({ timeout: 10_000 });
      await panel.getByRole("tab", { name: /^Videos$/i }).waitFor({ timeout: 10_000 });
      await page.waitForTimeout(700);
      result.folderTransition.succeeded = true;
    }

    const rootTabs = ["Videos", "Prompts", "Images"];
    for (const rootTab of rootTabs) {
      await panel.getByRole("tab", { name: new RegExp(`^${rootTab}$`, "i") }).click();
      result.rootTabClicks.push(rootTab);
      await page.waitForTimeout(600);
      if (/prompts/i.test(rootTab)) {
        result.loadMorePromptClicks += await clickLoadMore(
          page,
          panel.getByRole("button", { name: /^load more prompts$/i }).first(),
          2,
          750
        );
      } else {
        result.loadMoreMediaClicks += await clickLoadMore(
          page,
          panel.getByRole("button", { name: /^load more media$/i }).first(),
          2,
          750
        );
      }
    }

    result.scrollChurn = await churnScrollable(page, ".media-library-panel-body", 6);
    await panel.waitFor({ timeout: 10_000 });
    result.finalUrl = page.url();
    result.severeSignals = summarizeSignals(
      observers.consoleEntries,
      observers.pageErrors,
      observers.httpFailures,
      observers.requestFailures
    );
    result.ok = result.severeSignals.ok;
  } finally {
    await context.close();
  }

  return result;
}

async function runModalAudit(browser, creds) {
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();
  const observers = await attachSurfaceObservers(page);
  const result = {
    surface: "modal",
    ok: false,
    skipped: false,
    skipReason: null,
    baseUrl: MODAL_BASE_URL,
    tabClicks: [],
    loadMoreClicks: 0,
    scrollChurn: null,
    severeSignals: null,
    finalUrl: null,
  };

  try {
    await ensureSignedIn(page, MODAL_BASE_URL, "/ai-studio", creds.email, creds.password);
    await openAiStudioMediaPanel(page);
    const modal = await openAiStudioMediaModal(page);
    if (!modal) {
      result.skipped = true;
      result.skipReason =
        "Standalone Media Library modal trigger is not present in the current AI Studio surface.";
      result.ok = true;
      result.finalUrl = page.url();
      result.severeSignals = summarizeSignals(
        observers.consoleEntries,
        observers.pageErrors,
        observers.httpFailures,
        observers.requestFailures
      );
      return result;
    }

    const tabNames = ["Videos", "Prompts", "Images", "All Media"];
    for (const tabName of tabNames) {
      const tab = modal.getByRole("tab", { name: new RegExp(`^${tabName}$`, "i") }).first();
      if (!(await tab.isVisible().catch(() => false))) continue;
      await tab.click();
      result.tabClicks.push(tabName);
      await page.waitForTimeout(650);
      result.loadMoreClicks += await clickLoadMore(
        page,
        modal.getByRole("button", { name: /^load more$/i }).first(),
        3,
        700
      );
    }

    result.scrollChurn = await churnScrollable(page, ".media-library-modal-body", 6);
    await modal.waitFor({ timeout: 10_000 });
    result.finalUrl = page.url();
    result.severeSignals = summarizeSignals(
      observers.consoleEntries,
      observers.pageErrors,
      observers.httpFailures,
      observers.requestFailures
    );
    result.ok = result.severeSignals.ok;
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  const creds = loadAuditCredentials();
  if (!creds.email) {
    console.error("[media-library-runtime.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(creds.email)) {
    console.error(
      "[media-library-runtime.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const output = {
    ok: false,
    generatedAt: new Date().toISOString(),
    panelBaseUrl: PANEL_BASE_URL,
    modalBaseUrl: MODAL_BASE_URL,
    surfaces: [],
  };

  try {
    output.surfaces.push(await runPanelAudit(browser, creds));
    output.surfaces.push(await runModalAudit(browser, creds));
    output.ok = output.surfaces.every((surface) => surface.ok);
    console.log(JSON.stringify(output, null, 2));
    if (!output.ok) process.exitCode = 1;
  } catch (error) {
    console.error("[media-library-runtime.audit] fatal:", error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
