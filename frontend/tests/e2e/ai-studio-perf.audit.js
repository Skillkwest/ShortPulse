/* global require, process, console, URL, document, window */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * AI Studio production perf gate audit.
 * Signs in to a dedicated account, runs grid/shell audits, and exits non-zero on gate failures.
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100";
const AI_STUDIO_AUDIT_PATH = "/ai-studio?perfAuditRuntime=1";
const LOGIN_ENTRY_PATH = "/log-in";
const EMAIL = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
const PASSWORD = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";

const COUNTS = [40, 60, 100];
const ACTIVE_WORKSET_COUNTS = [40, 60, 100, 300];
const TARGET_TOTAL_COUNT = 500;
const TARGET_ACTIVE_COUNT = 128;
const TARGET_AUDIT_ACTIVE_COUNT = 300;
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

function isAuthEntryPath(pathname) {
  return (
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === LOGIN_ENTRY_PATH ||
    pathname === "/sign-up"
  );
}

async function waitForProtectedRoute(page, targetPath, timeoutMs) {
  const targetUrl = new URL(targetPath, BASE_URL);
  try {
    await page.waitForURL((url) => url.pathname === targetUrl.pathname, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function readAuthBlockDetails(page) {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText || "";
    const messageSnippets = bodyText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) =>
        /incorrect|confirm|check your email|unable|error|try again|too many|invalid/i.test(line)
      )
      .slice(0, 6);

    return {
      observedUrl: window.location.href,
      messageSnippets,
    };
  });
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
      observedUrl: null,
      messageSnippets: [],
    },
    referenceGridTargetSeed: null,
    referenceGridActiveWorksetSeed: null,
    referenceGrid: null,
    referenceGridActiveWorkset: null,
    studioShell: null,
  };

  try {
    await page.goto(
      `${BASE_URL}${LOGIN_ENTRY_PATH}?next=${encodeURIComponent(AI_STUDIO_AUDIT_PATH)}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      }
    );
    await page.waitForTimeout(1000);

    if (isAuthEntryPath(new URL(page.url()).pathname)) {
      await signIn(page);
      const reached = await waitForProtectedRoute(page, AI_STUDIO_AUDIT_PATH, 20_000);
      if (!reached) {
        result.auth.blockedReason = "auth_blocked_or_confirmation_required";
        Object.assign(result.auth, await readAuthBlockDetails(page));
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = 1;
        return;
      }
    }

    result.auth.reachedProtectedRoute = true;

    await page.goto(`${BASE_URL}${AI_STUDIO_AUDIT_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForFunction(
      () => typeof globalThis.__shortpulseAiStudioPerf?.runReferenceGridAudit === "function",
      { timeout: 45_000 }
    );

    const referenceGridTargetSeed = await page.evaluate(
      ({ targetTotalCount }) =>
        globalThis.__shortpulseAiStudioPerf.seedReferenceGrid(targetTotalCount),
      { targetTotalCount: TARGET_TOTAL_COUNT }
    );
    result.referenceGridTargetSeed = referenceGridTargetSeed;
    if (
      referenceGridTargetSeed?.requestedCount !== TARGET_TOTAL_COUNT ||
      referenceGridTargetSeed?.activeCount !== TARGET_ACTIVE_COUNT ||
      referenceGridTargetSeed?.archivedCount !== TARGET_TOTAL_COUNT - TARGET_ACTIVE_COUNT ||
      referenceGridTargetSeed?.totalCount !== TARGET_TOTAL_COUNT
    ) {
      result.ok = false;
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }

    const referenceGridActiveWorksetSeed = await page.evaluate(
      ({ targetActiveCount }) =>
        globalThis.__shortpulseAiStudioPerf.seedReferenceGrid(targetActiveCount, {
          activeCapOverride: targetActiveCount,
        }),
      { targetActiveCount: TARGET_AUDIT_ACTIVE_COUNT }
    );
    result.referenceGridActiveWorksetSeed = referenceGridActiveWorksetSeed;
    if (
      referenceGridActiveWorksetSeed?.requestedCount !== TARGET_AUDIT_ACTIVE_COUNT ||
      referenceGridActiveWorksetSeed?.activeCount !== TARGET_AUDIT_ACTIVE_COUNT ||
      referenceGridActiveWorksetSeed?.archivedCount !== 0 ||
      referenceGridActiveWorksetSeed?.totalCount !== TARGET_AUDIT_ACTIVE_COUNT ||
      referenceGridActiveWorksetSeed?.activeCapOverride !== TARGET_AUDIT_ACTIVE_COUNT
    ) {
      result.ok = false;
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }

    const referenceGrid = await page.evaluate(
      async ({ counts, clickSamples }) =>
        globalThis.__shortpulseAiStudioPerf.runReferenceGridAudit({ counts, clickSamples }),
      { counts: COUNTS, clickSamples: CLICK_SAMPLES }
    );
    const referenceGridActiveWorkset = await page.evaluate(
      async ({ counts, clickSamples, targetActiveCount }) =>
        globalThis.__shortpulseAiStudioPerf.runReferenceGridAudit({
          counts,
          clickSamples,
          activeCapOverride: targetActiveCount,
        }),
      {
        counts: ACTIVE_WORKSET_COUNTS,
        clickSamples: CLICK_SAMPLES,
        targetActiveCount: TARGET_AUDIT_ACTIVE_COUNT,
      }
    );
    const activeWorksetScenario = referenceGridActiveWorkset?.scenarios?.find(
      (scenario) => scenario?.count === TARGET_AUDIT_ACTIVE_COUNT
    );
    if (
      activeWorksetScenario?.seeded?.requestedCount !== TARGET_AUDIT_ACTIVE_COUNT ||
      activeWorksetScenario?.seeded?.activeCount !== TARGET_AUDIT_ACTIVE_COUNT ||
      activeWorksetScenario?.seeded?.archivedCount !== 0 ||
      activeWorksetScenario?.seeded?.totalCount !== TARGET_AUDIT_ACTIVE_COUNT ||
      activeWorksetScenario?.seeded?.activeCapOverride !== TARGET_AUDIT_ACTIVE_COUNT
    ) {
      result.referenceGridActiveWorkset = referenceGridActiveWorkset;
      result.ok = false;
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }
    const studioShell = await page.evaluate(
      async ({ counts }) => globalThis.__shortpulseAiStudioPerf.runStudioShellAudit({ counts }),
      { counts: COUNTS }
    );

    result.referenceGrid = referenceGrid;
    result.referenceGridActiveWorkset = referenceGridActiveWorkset;
    result.studioShell = studioShell;
    result.ok =
      Boolean(referenceGrid?.ok) &&
      Boolean(referenceGridActiveWorkset?.ok) &&
      Boolean(studioShell?.ok);
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
