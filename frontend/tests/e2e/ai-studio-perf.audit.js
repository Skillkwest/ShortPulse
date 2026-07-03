/* global require, process, console, __dirname, URL, document, window */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * AI Studio production perf gate audit.
 * Signs in to a dedicated account, runs grid/shell audits, and exits non-zero on gate failures.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

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

const BASE_URL = (
  process.env.PLAYWRIGHT_AI_STUDIO_ENTRY_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://localhost:3100"
).trim();
const AI_STUDIO_AUDIT_PATH = "/ai-studio?perfAuditRuntime=1";
const LOGIN_ENTRY_PATH = "/log-in";
const EMAIL = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
const PASSWORD = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";

const REFERENCE_GRID_COUNTS = [40, 60, 100, 300, 400, 500];
const ACTIVE_WORKSET_COUNTS = [40, 60, 100, 400, 500];
const STUDIO_SHELL_COUNTS = [40, 60, 100];
const TARGET_TOTAL_COUNT = 500;
const TARGET_ACTIVE_COUNT = 500;
const TARGET_AUDIT_ACTIVE_COUNT = 500;
const CLICK_SAMPLES = 24;
const REFERENCE_GRID_SURFACE_SELECTOR =
  ".reference-canvas-panel[data-grid-surface='reference-grid']";
const REFERENCE_GRID_CARD_SELECTOR = ".reference-column .reference-card";
const PROJECT_RESTORE_OUTPUT_STORE_COUNTER_GATE_NAMES = [
  "project_restore_output_store_publish_count",
  "project_restore_all_refs_scan_count",
  "project_restore_quick_slot_lookup_count",
];
const TARGET_CAPACITY_GATE_NAMES_BY_COUNT = new Map(
  [400, 500].map((count) => [
    count,
    [
      `target_capacity_click_p95_ms_at_${count}`,
      `target_capacity_rendered_item_count_p95_at_${count}`,
      `target_capacity_long_task_p95_ms_at_${count}`,
      `target_capacity_max_input_stall_ms_at_${count}`,
      `target_capacity_image_decode_inflight_p95_at_${count}`,
      `target_capacity_video_attach_budget_p95_at_${count}`,
      `target_capacity_media_work_tokens_p95_at_${count}`,
      `target_capacity_heap_delta_mb_at_${count}`,
    ],
  ])
);

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

async function waitForReferenceGridSurface(page) {
  await page.waitForSelector(REFERENCE_GRID_SURFACE_SELECTOR, {
    timeout: 45_000,
  });
}

async function waitForSeededReferenceGridCards(page) {
  await page.waitForFunction(
    ({ cardSelector }) => document.querySelectorAll(cardSelector).length > 0,
    { cardSelector: REFERENCE_GRID_CARD_SELECTOR },
    { timeout: 45_000 }
  );
}

function validateProjectRestoreInstrumentationContract(projectRestore) {
  const scenario = projectRestore?.scenarios?.[0] ?? null;
  const outputStore = scenario?.outputStore ?? null;
  if (!outputStore) {
    return "project_restore_output_store_summary_missing";
  }
  if (typeof outputStore.instrumentationAvailable !== "boolean") {
    return "project_restore_output_store_instrumentation_flag_missing";
  }

  const gatesByName = new Map((projectRestore?.gates ?? []).map((gate) => [gate?.name, gate]));

  for (const gateName of PROJECT_RESTORE_OUTPUT_STORE_COUNTER_GATE_NAMES) {
    const gate = gatesByName.get(gateName);
    if (!gate) {
      return `${gateName}_gate_missing`;
    }
    if (outputStore.instrumentationAvailable) {
      if (typeof gate.actual !== "number") {
        return `${gateName}_must_report_numeric_actual_when_instrumented`;
      }
      continue;
    }
    if (gate.actual !== null || !/instrumentation unavailable/i.test(gate.note ?? "")) {
      return `${gateName}_must_be_informational_when_uninstrumented`;
    }
  }

  return null;
}

function validateReferenceGridTargetCapacityContract(referenceGrid) {
  const gatesByName = new Map((referenceGrid?.gates ?? []).map((gate) => [gate?.name, gate]));
  for (const [count, gateNames] of TARGET_CAPACITY_GATE_NAMES_BY_COUNT.entries()) {
    const scenario = referenceGrid?.scenarios?.find((candidate) => candidate?.count === count);
    if (!scenario) {
      return `target_capacity_${count}_scenario_missing`;
    }
    for (const gateName of gateNames) {
      const gate = gatesByName.get(gateName);
      if (!gate) {
        return `${gateName}_gate_missing`;
      }
      if (!gate.pass) {
        return `${gateName}_gate_failed`;
      }
    }
  }
  return null;
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
    projectRestore: null,
    referenceGrid: null,
    referenceGridActiveWorkset: null,
    studioShell: null,
    projectRestoreInstrumentationContract: {
      ok: false,
      reason: null,
    },
    referenceGridTargetCapacityContract: {
      ok: false,
      reason: null,
    },
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
      () =>
        typeof globalThis.__shortpulseAiStudioPerf?.seedReferenceGrid === "function" &&
        typeof globalThis.__shortpulseAiStudioPerf?.runReferenceGridAudit === "function" &&
        typeof globalThis.__shortpulseAiStudioPerf?.runStudioShellAudit === "function" &&
        typeof globalThis.__shortpulseAiStudioPerf?.runProjectRestoreAudit === "function",
      { timeout: 45_000 }
    );
    await waitForReferenceGridSurface(page);

    const referenceGridTargetSeed = await page.evaluate(
      ({ targetTotalCount }) =>
        globalThis.__shortpulseAiStudioPerf.seedReferenceGrid(targetTotalCount),
      { targetTotalCount: TARGET_TOTAL_COUNT }
    );
    await waitForSeededReferenceGridCards(page);
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
    await waitForSeededReferenceGridCards(page);
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
      { counts: REFERENCE_GRID_COUNTS, clickSamples: CLICK_SAMPLES }
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
      { counts: STUDIO_SHELL_COUNTS }
    );
    const projectRestore = await page.evaluate(
      async ({ totalCount, activeCount }) =>
        globalThis.__shortpulseAiStudioPerf.runProjectRestoreAudit({
          totalCount,
          activeCount,
        }),
      {
        totalCount: TARGET_TOTAL_COUNT,
        activeCount: TARGET_ACTIVE_COUNT,
      }
    );

    result.referenceGrid = referenceGrid;
    result.referenceGridActiveWorkset = referenceGridActiveWorkset;
    result.studioShell = studioShell;
    result.projectRestore = projectRestore;
    const projectRestoreInstrumentationContractFailure =
      validateProjectRestoreInstrumentationContract(projectRestore);
    const referenceGridTargetCapacityContractFailure =
      validateReferenceGridTargetCapacityContract(referenceGrid);
    result.projectRestoreInstrumentationContract = {
      ok: projectRestoreInstrumentationContractFailure === null,
      reason: projectRestoreInstrumentationContractFailure,
    };
    result.referenceGridTargetCapacityContract = {
      ok: referenceGridTargetCapacityContractFailure === null,
      reason: referenceGridTargetCapacityContractFailure,
    };
    result.ok =
      Boolean(referenceGrid?.ok) &&
      Boolean(referenceGridActiveWorkset?.ok) &&
      Boolean(studioShell?.ok) &&
      Boolean(projectRestore?.ok) &&
      result.projectRestoreInstrumentationContract.ok &&
      result.referenceGridTargetCapacityContract.ok;
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
