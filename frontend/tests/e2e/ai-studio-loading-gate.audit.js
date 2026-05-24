/* global require, process, console, __dirname, window, document, HTMLElement */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * AI Studio loading gate browser audit.
 * Signs in to a real protected route, delays the media-compliance request, and
 * verifies the canonical animated loading gate is what renders during bootstrap.
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
  /fonts\.googleapis\.com.+Content Security Policy directive/i,
];

const SEVERE_SIGNAL_PATTERNS = [
  /maximum update depth exceeded/i,
  /too many re-renders/i,
  /page is unresponsive/i,
  /long[- ]running script/i,
  /resizeobserver loop limit exceeded/i,
];

const DEFAULT_BASE_URL = (
  process.env.PLAYWRIGHT_AI_STUDIO_ENTRY_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://shortpulse.ai"
).trim();
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const MEDIA_COMPLIANCE_ROUTE_PATTERN = "**/api/account/media-compliance*";
const TARGET_ROUTE_PATH = "/ai-studio";

function usage() {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/tests/e2e/ai-studio-loading-gate.audit.js [options]",
      "",
      "Environment:",
      "  PLAYWRIGHT_AUDIT_EMAIL                  Required real test account email",
      "  PLAYWRIGHT_AUDIT_PASSWORD               Optional password override",
      "  PLAYWRIGHT_AI_STUDIO_ENTRY_BASE_URL     Base URL override (default https://shortpulse.ai)",
      "  PLAYWRIGHT_BASE_URL                     Fallback base URL override",
      "  PLAYWRIGHT_HEADLESS                     Set to false to watch the audit",
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

function shouldIgnoreConsole(text) {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasSevereSignal(text) {
  return SEVERE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function summarizeSignals(consoleEntries, pageErrors, failedResponses) {
  const severeConsole = consoleEntries.filter((entry) => {
    if (hasSevereSignal(entry.text)) return true;
    return entry.type === "error" && !shouldIgnoreConsole(entry.text);
  });
  const severePageErrors = pageErrors.filter((entry) => !shouldIgnoreConsole(entry.text));
  const severeFailedResponses = failedResponses.filter(
    (entry) =>
      entry.status >= 500 ||
      entry.url.includes("/api/account/media-compliance") ||
      entry.url.includes("/ai-studio")
  );
  return {
    severeConsole,
    severePageErrors,
    severeFailedResponses,
    ok:
      severeConsole.length === 0 &&
      severePageErrors.length === 0 &&
      severeFailedResponses.length === 0,
  };
}

async function attachSurfaceObservers(page) {
  const consoleEntries = [];
  const pageErrors = [];
  const failedResponses = [];

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
    const status = response.status();
    if (status < 400) return;
    failedResponses.push({
      status,
      url: response.url(),
      resourceType: response.request().resourceType(),
      method: response.request().method(),
    });
  });

  return { consoleEntries, pageErrors, failedResponses };
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

async function ensureSignedIn(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/auth?next=${encodeURIComponent(TARGET_ROUTE_PATH)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(1000);

  if (page.url().includes("/auth")) {
    await signIn(page, email, password);
    const reached = await waitForNonAuthRoute(page, 20_000);
    if (!reached) {
      throw new Error(`Auth did not reach protected route for ${TARGET_ROUTE_PATH} on ${baseUrl}`);
    }
  }
}

function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    process.exit(0);
  }

  loadAuditEnv();

  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";

  if (!email) {
    console.error("[ai-studio-loading-gate.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(email)) {
    console.error(
      "[ai-studio-loading-gate.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();
  const observers = await attachSurfaceObservers(page);

  const result = {
    ok: false,
    generatedAt: new Date().toISOString(),
    baseUrl: DEFAULT_BASE_URL,
    auth: {
      reachedProtectedRoute: false,
    },
    loadingGate: {
      mediaComplianceRequestSeen: false,
      stageVisible: false,
      surfaceVariantClass: "none",
      pulsePlaneVisible: false,
      maskImage: "",
      pulseAnimationName: "",
      heading: null,
      message: null,
    },
    signals: null,
  };

  const releaseMediaCompliance = createDeferred();
  const mediaComplianceSeen = createDeferred();
  let mediaComplianceInterceptCount = 0;

  try {
    await ensureSignedIn(page, DEFAULT_BASE_URL, email, password);
    result.auth.reachedProtectedRoute = true;

    await page.route(MEDIA_COMPLIANCE_ROUTE_PATTERN, async (route) => {
      mediaComplianceInterceptCount += 1;
      if (mediaComplianceInterceptCount === 1) {
        result.loadingGate.mediaComplianceRequestSeen = true;
        mediaComplianceSeen.resolve();
      }

      try {
        await releaseMediaCompliance.promise;
        const response = await route.fetch();
        await route.fulfill({ response });
      } catch (error) {
        if (/Request context disposed/i.test(String(error?.message || error))) {
          await route.abort().catch(() => {});
          return;
        }
        throw error;
      }
    });

    await page.goto(`${DEFAULT_BASE_URL}${TARGET_ROUTE_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    await Promise.race([
      mediaComplianceSeen.promise,
      page.waitForTimeout(15_000).then(() => {
        throw new Error("Timed out waiting for the media-compliance request.");
      }),
    ]);

    await page.waitForSelector('[data-testid="entry-animation-stage"]', { timeout: 15_000 });
    await page.waitForSelector(".ai-studio-project-entry-pulse-plane.is-visible", {
      timeout: 15_000,
    });

    const gateSnapshot = await page.evaluate(() => {
      const root = document.querySelector(".ai-studio-project-entry-page");
      const stage = document.querySelector('[data-testid="entry-animation-stage"]');
      const pulsePlane = document.querySelector(".ai-studio-project-entry-pulse-plane");
      const pulseMotion = document.querySelector(".ai-studio-project-entry-pulse-motion");
      const heading = document.querySelector(".ai-studio-project-entry-title");
      const message = document.querySelector(".ai-studio-project-entry-message");

      if (!(pulsePlane instanceof HTMLElement)) {
        return {
          stageVisible: stage instanceof HTMLElement,
          surfaceVariantClass: root?.classList.contains("ai-studio-project-entry-page--animated")
            ? "animated"
            : root?.classList.contains("ai-studio-project-entry-page--experimental")
              ? "experimental"
              : "none",
          pulsePlaneVisible: false,
          maskImage: "",
          pulseAnimationName: "",
          heading: heading?.textContent?.trim() ?? null,
          message: message?.textContent?.trim() ?? null,
        };
      }

      const pulseStyle = window.getComputedStyle(pulsePlane);
      const motionStyle =
        pulseMotion instanceof HTMLElement ? window.getComputedStyle(pulseMotion) : null;

      return {
        stageVisible: stage instanceof HTMLElement,
        surfaceVariantClass: root?.classList.contains("ai-studio-project-entry-page--animated")
          ? "animated"
          : root?.classList.contains("ai-studio-project-entry-page--experimental")
            ? "experimental"
            : "none",
        pulsePlaneVisible: pulsePlane.classList.contains("is-visible"),
        maskImage: pulseStyle.maskImage || pulseStyle.webkitMaskImage || "",
        pulseAnimationName: motionStyle?.animationName || "",
        heading: heading?.textContent?.trim() ?? null,
        message: message?.textContent?.trim() ?? null,
      };
    });

    result.loadingGate = {
      ...result.loadingGate,
      ...gateSnapshot,
    };

    const hasExpectedMask = /mask\.png/i.test(result.loadingGate.maskImage);
    const hasExpectedAnimation =
      result.loadingGate.pulseAnimationName === "ai-studio-project-entry-pulse-run";
    const hasExpectedSurfaceClass = result.loadingGate.surfaceVariantClass !== "none";
    const hasExpectedHeading = result.loadingGate.heading === "Loading project";
    const hasExpectedMessage =
      result.loadingGate.message ===
      "Checking your media agreement before project restore continues.";

    if (
      !result.loadingGate.stageVisible ||
      !hasExpectedSurfaceClass ||
      !result.loadingGate.pulsePlaneVisible ||
      !hasExpectedMask ||
      !hasExpectedAnimation ||
      !hasExpectedHeading ||
      !hasExpectedMessage
    ) {
      throw new Error(
        "AI Studio loading gate did not render the canonical animated entry surface as expected."
      );
    }

    releaseMediaCompliance.resolve();
    await page.waitForTimeout(1000);

    result.signals = summarizeSignals(
      observers.consoleEntries,
      observers.pageErrors,
      observers.failedResponses
    );
    result.ok = result.signals.ok;
    console.log(JSON.stringify(result, null, 2));

    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    releaseMediaCompliance.resolve();
    result.signals = summarizeSignals(
      observers.consoleEntries,
      observers.pageErrors,
      observers.failedResponses
    );
    console.error("[ai-studio-loading-gate.audit] fatal:", error);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } finally {
    await page.unroute(MEDIA_COMPLIANCE_ROUTE_PATTERN).catch(() => {});
    await browser.close();
  }
}

main();
