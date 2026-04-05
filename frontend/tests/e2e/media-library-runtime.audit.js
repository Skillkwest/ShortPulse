/* global require, process, console, __dirname, document, HTMLElement, setTimeout, window */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Media Library runtime heavy browser audit.
 * Exercises the route, panel, and modal media-library surfaces with real browser interactions
 * and fails on severe runtime signals such as max-depth or runaway render warnings.
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
  loadEnvFromFileIfNeeded(path.join(repoRoot, ".env.agent.local"));
}

loadAuditEnv();

const DEFAULT_BASE_URL = (
  process.env.PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL || "http://localhost:3000"
).trim();
const ROUTE_BASE_URL = (process.env.PLAYWRIGHT_ROUTE_BASE_URL || DEFAULT_BASE_URL).trim();
const PANEL_BASE_URL = (process.env.PLAYWRIGHT_PANEL_BASE_URL || DEFAULT_BASE_URL).trim();
const MODAL_BASE_URL = (process.env.PLAYWRIGHT_MODAL_BASE_URL || DEFAULT_BASE_URL).trim();
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

function summarizeSignals(consoleEntries, pageErrors) {
  const severeConsole = consoleEntries.filter(
    (entry) =>
      (entry.type === "error" && !shouldIgnoreConsole(entry.text)) || hasSevereSignal(entry.text)
  );
  const severePageErrors = pageErrors.filter((entry) => !shouldIgnoreConsole(entry.text));
  return {
    severeConsole,
    severePageErrors,
    ok: severeConsole.length === 0 && severePageErrors.length === 0,
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
  return { consoleEntries, pageErrors };
}

async function runRouteAudit(browser, creds) {
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();
  const observers = await attachSurfaceObservers(page);
  const result = {
    surface: "route",
    ok: false,
    baseUrl: ROUTE_BASE_URL,
    tabClicks: [],
    loadMoreClicks: 0,
    scrollChurn: null,
    severeSignals: null,
    finalUrl: null,
  };

  try {
    await ensureSignedIn(page, ROUTE_BASE_URL, "/media-library", creds.email, creds.password);
    await page.getByRole("heading", { name: /^media library$/i }).waitFor({ timeout: 20_000 });

    const tabNames = [
      "Uploaded Videos",
      "Saved Prompts",
      "AI Studio Generations",
      "Private",
      "Uploaded Images",
    ];

    for (const tabName of tabNames) {
      await page.getByRole("button", { name: new RegExp(`^${tabName}$`, "i") }).click();
      result.tabClicks.push(tabName);
      await page.waitForTimeout(650);
      result.loadMoreClicks += await clickLoadMore(
        page,
        page.getByRole("button", { name: /^load more$/i }).first(),
        3,
        700
      );
      await page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
      });
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
      });
      await page.waitForTimeout(150);
    }

    result.scrollChurn = await churnScrollable(page, "body", 6);
    await page.getByRole("heading", { name: /^media library$/i }).waitFor({ timeout: 10_000 });
    result.finalUrl = page.url();
    result.severeSignals = summarizeSignals(observers.consoleEntries, observers.pageErrors);
    result.ok = result.severeSignals.ok;
  } finally {
    await context.close();
  }

  return result;
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
    await page.getByRole("button", { name: /^media$/i }).first().click();
    const panel = page.locator('section[aria-label="Media library panel"]').first();
    await panel.waitFor({ timeout: 20_000 });

    const folderNameButtons = page.locator(".media-library-panel-folder-chip-name");
    const folderButtonCount = await folderNameButtons.count();
    if (folderButtonCount > 1) {
      result.folderTransition.attempted = true;
      await folderNameButtons.nth(1).click();
      await page.waitForTimeout(900);
      await folderNameButtons.nth(0).click();
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
    result.severeSignals = summarizeSignals(observers.consoleEntries, observers.pageErrors);
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
    baseUrl: MODAL_BASE_URL,
    tabClicks: [],
    loadMoreClicks: 0,
    scrollChurn: null,
    severeSignals: null,
    finalUrl: null,
  };

  try {
    await ensureSignedIn(page, MODAL_BASE_URL, "/ai-studio", creds.email, creds.password);
    await page.getByRole("button", { name: /^media$/i }).first().click();

    const modal = page.getByRole("dialog", { name: /media library/i }).first();
    await modal.waitFor({ timeout: 20_000 });

    const tabNames = [
      "Uploaded Videos",
      "Saved Prompts",
      "AI Studio Generations",
      "Private",
      "Uploaded Images",
    ];

    for (const tabName of tabNames) {
      await modal.getByRole("tab", { name: new RegExp(tabName, "i") }).first().click();
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
    result.severeSignals = summarizeSignals(observers.consoleEntries, observers.pageErrors);
    result.ok = result.severeSignals.ok;
  } finally {
    await context.close();
  }

  return result;
}

function isModalAuditTopologyAvailable() {
  if (process.env.PLAYWRIGHT_MEDIA_LIBRARY_FORCE_MODAL_AUDIT === "true") {
    return true;
  }
  if (MODAL_BASE_URL !== PANEL_BASE_URL) {
    return true;
  }
  return process.env.NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED === "false";
}

function createSkippedModalAuditResult() {
  return {
    surface: "modal",
    ok: true,
    skipped: true,
    skipReason:
      "Modal audit requires a modal-only server. Set PLAYWRIGHT_MODAL_BASE_URL to a separate server or disable NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED there.",
    baseUrl: MODAL_BASE_URL,
    tabClicks: [],
    loadMoreClicks: 0,
    scrollChurn: null,
    severeSignals: null,
    finalUrl: null,
  };
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
    routeBaseUrl: ROUTE_BASE_URL,
    panelBaseUrl: PANEL_BASE_URL,
    modalBaseUrl: MODAL_BASE_URL,
    surfaces: [],
  };

  try {
    output.surfaces.push(await runRouteAudit(browser, creds));
    output.surfaces.push(await runPanelAudit(browser, creds));
    output.surfaces.push(
      isModalAuditTopologyAvailable()
        ? await runModalAudit(browser, creds)
        : createSkippedModalAuditResult()
    );
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
