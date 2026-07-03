/* global require, process, console, __dirname, URL, window, document */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * AI Studio lazy modal first-open audit runner.
 * Signs in to production, opens the model picker and generated-output detail modal,
 * and verifies the lazy chunks render without first-open stalls or runtime errors.
 */
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { chromium } = require("playwright");

const DEFAULT_BASE_URL = "https://www.shortpulse.ai";
const BASE_URL = (
  process.env.PLAYWRIGHT_LAZY_MODAL_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  DEFAULT_BASE_URL
).trim();
const AI_STUDIO_AUDIT_PATH = "/ai-studio?perfAuditRuntime=1";
const AI_SHELL_LEFT_WIDTH_STORAGE_KEY = "shortpulse.aiStudio.shellLeftWidthPx.v5";
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const TIMEOUT_MS = 45_000;

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
  /chunkloaderror/i,
  /loading chunk \d+ failed/i,
  /resizeobserver loop limit exceeded/i,
];

const GENERIC_RESOURCE_FAILURE_PATTERN =
  /^failed to load resource: the server responded with a status of \d+/i;

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

loadAuditEnv();

function loadAuditCredentials() {
  return {
    email: (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim(),
    password: (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345",
  };
}

function shouldIgnoreConsole(text) {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasSevereSignal(text) {
  return SEVERE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function isRelevantUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const candidate = `${parsed.pathname}${parsed.search}`;
    return (
      candidate.includes("/ai-studio") ||
      candidate.includes("/api/account/media-compliance") ||
      candidate.includes("/dashboard/ai-studio-hero.png") ||
      candidate.includes("/_next/static/chunks/") ||
      candidate.includes("/_next/static/css/")
    );
  } catch {
    return typeof rawUrl === "string" && rawUrl.includes("/ai-studio");
  }
}

function isGenericResourceFailure(text) {
  return GENERIC_RESOURCE_FAILURE_PATTERN.test(text);
}

function isIgnorableConsoleEntry(entry) {
  if (shouldIgnoreConsole(entry.text)) return true;
  if (isGenericResourceFailure(entry.text)) return true;
  return (
    /typeerror:\s*failed to fetch/i.test(entry.text) && /_refreshAccessToken/i.test(entry.text)
  );
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
  return entry.resourceType === "media";
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

function summarizeSignals(consoleEntries, pageErrors, httpFailures, requestFailures) {
  const severeConsole = consoleEntries.filter((entry) => {
    if (hasSevereSignal(entry.text)) return true;
    if (entry.type !== "error") return false;
    return !isIgnorableConsoleEntry(entry);
  });
  const severePageErrors = pageErrors.filter((entry) => !isIgnorableConsoleEntry(entry));
  const relevantHttpFailures = httpFailures.filter((entry) => isRelevantUrl(entry.url));
  const relevantRequestFailures = requestFailures.filter(
    (entry) => isRelevantUrl(entry.url) && !isIgnorableRequestFailure(entry)
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

async function satisfyMediaComplianceIfPresent(page) {
  const gateHeading = page.getByRole("heading", { name: /^confirm media rights$/i }).first();
  if (!(await gateHeading.isVisible().catch(() => false))) return;

  const agreementCheckbox = page
    .getByLabel(/^i confirm that the media i use in shortpulse follows these rules\.$/i)
    .first();
  const continueButton = page.getByRole("button", { name: /^continue$/i }).first();

  await agreementCheckbox.check({ force: true });
  await continueButton.click({ timeout: 10_000 });
  await gateHeading.waitFor({ state: "hidden", timeout: 20_000 });
}

async function ensureSignedIn(page, email, password) {
  await page.goto(`${BASE_URL}/auth?next=${encodeURIComponent(AI_STUDIO_AUDIT_PATH)}`, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_MS,
  });
  await page
    .evaluate(
      (storageKey) => window.localStorage.removeItem(storageKey),
      AI_SHELL_LEFT_WIDTH_STORAGE_KEY
    )
    .catch(() => undefined);

  if (page.url().includes("/auth")) {
    await signIn(page, email, password);
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: TIMEOUT_MS });
    await page
      .evaluate(
        (storageKey) => window.localStorage.removeItem(storageKey),
        AI_SHELL_LEFT_WIDTH_STORAGE_KEY
      )
      .catch(() => undefined);
  }

  await page.goto(`${BASE_URL}${AI_STUDIO_AUDIT_PATH}`, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_MS,
  });
  await satisfyMediaComplianceIfPresent(page);
  await page.locator(".ai-studio-page").waitFor({ timeout: TIMEOUT_MS });
  await page.getByText("What do you want to make?").first().waitFor({ timeout: TIMEOUT_MS });
}

async function ensureCreateTool(page) {
  const createButton = page.getByRole("button", { name: /^create$/i }).first();
  if (await createButton.isVisible().catch(() => false)) {
    await createButton.click({ timeout: 10_000 }).catch(() => undefined);
  }
  await page.locator(".create-composer-model-picker-trigger").first().waitFor({
    timeout: TIMEOUT_MS,
  });
}

async function openModelPicker(page) {
  await ensureCreateTool(page);
  const before = performance.now();
  const trigger = page.getByRole("button", { name: /open model picker/i }).first();
  await trigger.click({ timeout: 10_000 });
  const modal = page.locator(".model-picker-modal");
  await modal.waitFor({ timeout: TIMEOUT_MS });
  await modal.locator(".model-chip-title").first().waitFor({ timeout: TIMEOUT_MS });
  const title = (await modal.locator(".model-modal-title").textContent())?.trim() ?? "";
  const chipCount = await modal.locator(".model-chip-title").count();
  if (!title) throw new Error("Model picker opened without a title.");
  if (chipCount === 0) throw new Error("Model picker opened without visible model chips.");
  const elapsedMs = performance.now() - before;
  await page.getByRole("button", { name: /close model picker/i }).click({ timeout: 10_000 });
  await modal.waitFor({ state: "hidden", timeout: TIMEOUT_MS });
  return { title, chipCount, elapsedMs };
}

async function seedReferenceGridItem(page) {
  await page.waitForFunction(
    () => typeof globalThis.__shortpulseAiStudioPerf?.seedReferenceGridItems === "function",
    { timeout: TIMEOUT_MS }
  );
  return page.evaluate(() =>
    globalThis.__shortpulseAiStudioPerf.seedReferenceGridItems([
      {
        id: "lazy-modal-detail-proof-1",
        prompt: "lazy modal first-open proof image",
        mode: "image",
        generationId: "lazy-modal-detail-proof-generation-1",
        previewUrl: "/dashboard/ai-studio-hero.png",
        previewStoragePath: "audit/lazy-modal-detail-proof-preview.png",
        fullStoragePath: "audit/lazy-modal-detail-proof-full.png",
        savedMediaIds: ["lazy-modal-detail-proof-media-1"],
        mediaSource: "generated",
      },
    ])
  );
}

async function readHeaderShortcutState(page, label) {
  const button = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
  if (!(await button.isVisible().catch(() => false))) {
    return { visible: false, pressed: null, disabled: null };
  }
  return {
    visible: true,
    pressed: (await button.getAttribute("aria-pressed").catch(() => null)) === "true",
    disabled: await button.isDisabled().catch(() => false),
  };
}

async function setHeaderShortcutPressed(page, label, desiredPressed) {
  const button = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
  const state = await readHeaderShortcutState(page, label);
  if (!state.visible || state.disabled || state.pressed === desiredPressed) return state;
  await button.click({ timeout: 10_000 });
  await page.waitForTimeout(350);
  return readHeaderShortcutState(page, label);
}

async function captureReferenceGridDebugSnapshot(page) {
  return page.evaluate(() => ({
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    shell: Array.from(document.querySelectorAll(".ai-shell"), (element) => ({
      className: element.className,
      layoutMode: element.getAttribute("data-shell-layout-mode"),
      rect: element.getBoundingClientRect().toJSON(),
    })),
    rightColumn: Array.from(document.querySelectorAll(".ai-shell-right"), (element) => ({
      hidden: element.getAttribute("data-right-column-hidden"),
      rect: element.getBoundingClientRect().toJSON(),
    })),
    headerShortcuts: Array.from(
      document.querySelectorAll(".ai-hero-shortcut-button"),
      (button) => ({
        text: button.textContent?.trim() ?? "",
        ariaPressed: button.getAttribute("aria-pressed"),
        disabled: button.hasAttribute("disabled"),
      })
    ),
    referenceGridRootVisible: Boolean(
      document.querySelector('[data-grid-surface="reference-grid"]')
    ),
    referenceSectionCount: document.querySelectorAll(".reference-all-refs-section").length,
    referenceCardCount: document.querySelectorAll(".reference-card").length,
    visibleReferenceCardCount: Array.from(document.querySelectorAll(".reference-card")).filter(
      (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
      }
    ).length,
  }));
}

async function withReferenceGridOnly(page, callback) {
  const originalStates = {
    canvas: await readHeaderShortcutState(page, "Canvas"),
    quickSlot: await readHeaderShortcutState(page, "Quick Slot Inventory"),
    referenceGrid: await readHeaderShortcutState(page, "Reference Grid"),
  };

  await setHeaderShortcutPressed(page, "Canvas", false);
  await setHeaderShortcutPressed(page, "Quick Slot Inventory", false);
  await setHeaderShortcutPressed(page, "Reference Grid", true);
  await page.waitForTimeout(500);

  try {
    return await callback();
  } finally {
    if (originalStates.referenceGrid.visible && originalStates.referenceGrid.pressed !== null) {
      await setHeaderShortcutPressed(page, "Reference Grid", originalStates.referenceGrid.pressed);
    }
    if (originalStates.quickSlot.visible && originalStates.quickSlot.pressed !== null) {
      await setHeaderShortcutPressed(
        page,
        "Quick Slot Inventory",
        originalStates.quickSlot.pressed
      );
    }
    if (originalStates.canvas.visible && originalStates.canvas.pressed !== null) {
      await setHeaderShortcutPressed(page, "Canvas", originalStates.canvas.pressed);
    }
  }
}

async function openReferenceGridDetail(page) {
  const seeded = await seedReferenceGridItem(page);
  return withReferenceGridOnly(page, async () => {
    const card = page.locator(".reference-card").first();
    try {
      await card.waitFor({ timeout: TIMEOUT_MS });
    } catch {
      const snapshot = await captureReferenceGridDebugSnapshot(page);
      throw new Error(
        `Reference Grid card was not visible after seeding. Snapshot: ${JSON.stringify(snapshot)}`
      );
    }
    const before = performance.now();
    await card.dblclick({ timeout: 10_000 });
    const dialog = page.getByRole("dialog", { name: /^reference details$/i }).first();
    await dialog.waitFor({ timeout: TIMEOUT_MS });
    const elapsedMs = performance.now() - before;
    const hasPreview = await dialog
      .locator(".art-hero-image, .art-hero-video, .art-hero-audio")
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasPreview) {
      throw new Error("Reference detail modal opened without a visible preview surface.");
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: TIMEOUT_MS });
    return { seeded, elapsedMs, hasPreview };
  });
}

async function collectLazyResources(page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/_next/static/chunks/"))
      .map((entry) => ({
        name: entry.name.split("/").slice(-2).join("/"),
        durationMs: Number(entry.duration.toFixed(2)),
        transferSize: entry.transferSize,
        decodedBodySize: entry.decodedBodySize,
      }))
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 12)
  );
}

async function main() {
  const { email, password } = loadAuditCredentials();
  if (!email) {
    console.error("[ai-studio-lazy-modal-first-open.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(email)) {
    console.error(
      "[ai-studio-lazy-modal-first-open.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1100 } });
  const signals = await attachSurfaceObservers(page);

  try {
    await ensureSignedIn(page, email, password);
    const modelPicker = await openModelPicker(page);
    const referenceDetail = await openReferenceGridDetail(page);
    const lazyResources = await collectLazyResources(page);
    const signalSummary = summarizeSignals(
      signals.consoleEntries,
      signals.pageErrors,
      signals.httpFailures,
      signals.requestFailures
    );
    const result = {
      ok: signalSummary.ok,
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      path: AI_STUDIO_AUDIT_PATH,
      modelPicker,
      referenceDetail,
      lazyResources,
      signals: signalSummary,
      skipped: [
        "AiStudioInsufficientCreditsModal production first-open is not forced because that would mutate or depend on billing/credit state.",
        "SharedMediaDetailPreviewModal is owned by canvas/media-library detail surfaces, not the Reference Grid generated-output detail path exercised here.",
      ],
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    `[ai-studio-lazy-modal-first-open.audit] ${String(error?.stack || error?.message || error)}`
  );
  process.exitCode = 1;
});
