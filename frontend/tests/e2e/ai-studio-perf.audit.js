/* global require, process, console */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * AI Studio production perf gate audit.
 * Signs in to a dedicated account, runs grid/shell audits, and exits non-zero on gate failures.
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const EMAIL = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
const PASSWORD = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";

const COUNTS = [40, 60];
const CLICK_SAMPLES = 24;

async function signIn(page) {
  const signInTab = page.getByRole("tab", { name: /^Sign in$/i }).first();
  if (
    (await signInTab.isVisible().catch(() => false)) &&
    (await signInTab.getAttribute("aria-selected").catch(() => null)) !== "true"
  ) {
    await signInTab.click();
  }
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
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

async function main() {
  if (!EMAIL) {
    console.error("[ai-studio-perf.audit] PLAYWRIGHT_AUDIT_EMAIL is required.");
    process.exitCode = 1;
    return;
  }
  if (/@example\.com$/i.test(EMAIL)) {
    console.error(
      "[ai-studio-perf.audit] PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();

  const result = {
    ok: false,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    auth: {
      reachedProtectedRoute: false,
      blockedReason: null,
    },
    referenceGrid: null,
    studioShell: null,
  };

  try {
    await page.goto(`${BASE_URL}/auth?next=/ai-studio`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    if (page.url().includes("/auth")) {
      await signIn(page);
      const reached = await waitForNonAuthRoute(page, 20_000);
      if (!reached) {
        result.auth.blockedReason = "auth_blocked_or_confirmation_required";
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = 1;
        return;
      }
    }

    result.auth.reachedProtectedRoute = true;

    await page.goto(`${BASE_URL}/ai-studio`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForFunction(
      () => typeof globalThis.__shortpulseAiStudioPerf?.runReferenceGridAudit === "function",
      { timeout: 45_000 }
    );

    const referenceGrid = await page.evaluate(
      async ({ counts, clickSamples }) =>
        globalThis.__shortpulseAiStudioPerf.runReferenceGridAudit({ counts, clickSamples }),
      { counts: COUNTS, clickSamples: CLICK_SAMPLES }
    );
    const studioShell = await page.evaluate(
      async ({ counts }) => globalThis.__shortpulseAiStudioPerf.runStudioShellAudit({ counts }),
      { counts: COUNTS }
    );

    result.referenceGrid = referenceGrid;
    result.studioShell = studioShell;
    result.ok = Boolean(referenceGrid?.ok) && Boolean(studioShell?.ok);
    console.log(JSON.stringify(result, null, 2));

    if (!result.ok) {
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error("[ai-studio-perf.audit] fatal:", error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
