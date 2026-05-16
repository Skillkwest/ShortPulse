#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildMarkdownReport, scorePacket } from "./media_panel_kpi_score.mjs";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_SURFACE = "ai-studio-panel";
const PANEL_TELEMETRY_SURFACE = "media-library-panel";

const CAPTURE_SURFACES = {
  "ai-studio-panel": {
    label: "AI Studio media panel",
    panelSelector: 'section[aria-label="Media library panel"]',
    telemetrySurface: PANEL_TELEMETRY_SURFACE,
  },
  "elements-media-panel": {
    label: "Elements embedded media panel",
    panelSelector: 'section[aria-label="Elements media library panel"]',
    telemetrySurface: PANEL_TELEMETRY_SURFACE,
  },
};

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");
const toFiniteNumber = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const loadEnvFromFileIfNeeded = (filePath) => {
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
};

const loadAuditEnv = () => {
  const frontendRoot = path.resolve(path.dirname(SCRIPT_FILE), "..");
  const repoRoot = path.resolve(frontendRoot, "..");
  loadEnvFromFileIfNeeded(path.join(frontendRoot, ".env.local"));
  loadEnvFromFileIfNeeded(path.join(repoRoot, ".env.agent.local"));
};

const getCaptureSurfaceSpec = (surface) => {
  return CAPTURE_SURFACES[surface] ?? null;
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/media_panel_kpi_capture.mjs [options]",
      "",
      "Options:",
      "  --surface <ai-studio-panel|elements-media-panel>   Default ai-studio-panel",
      "  --base-url <url>                                   Default PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL or http://localhost:3000",
      "  --format <json|packet|markdown|text>              Default json",
      "  --headless <true|false>                            Default env PLAYWRIGHT_HEADLESS or true",
      "  --write-packet <path>                              Optional output file for the derived KPI packet",
      "",
      "Environment:",
      "  PLAYWRIGHT_AUDIT_EMAIL                             Required real audit account email",
      "  PLAYWRIGHT_AUDIT_PASSWORD                          Optional audit password override",
      "  PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL                  Default base URL",
      "  PLAYWRIGHT_HEADLESS                                Set to false to watch the run",
      "",
    ].join("\n")
  );
};

export const parseArgs = (argv) => {
  const readValue = (flag) => {
    const prefixed = `${flag}=`;
    for (let index = 0; index < argv.length; index += 1) {
      const token = argv[index];
      if (token === flag) return argv[index + 1] ?? "";
      if (token.startsWith(prefixed)) return token.slice(prefixed.length);
    }
    return "";
  };

  return {
    help: argv.includes("--help") || argv.includes("-h"),
    surface: normalizeString(readValue("--surface")) || DEFAULT_SURFACE,
    baseUrl: normalizeString(readValue("--base-url")),
    format: normalizeString(readValue("--format")) || "json",
    headless: normalizeString(readValue("--headless")),
    writePacket: normalizeString(readValue("--write-packet")),
  };
};

const resolveHeadless = (value) => {
  const normalized = normalizeString(value || process.env.PLAYWRIGHT_HEADLESS);
  if (!normalized) return true;
  return normalized !== "false";
};

const shouldIgnoreConsole = (text) =>
  /\[hmr\]\s+invalid message|\[hmr\]\s+connected|\[fast refresh\]|\breact devtools\b|favicon\.ico/i.test(
    text
  );

const buildCaptureModeLabel = (capture) => {
  return capture.perfHandle?.available
    ? "playwright-panel-audit+live-perf-handle"
    : "playwright-panel-audit";
};

const countConsoleErrors = (entries) =>
  Array.isArray(entries)
    ? entries.filter((entry) => entry?.type === "error" && !shouldIgnoreConsole(String(entry?.text ?? "")))
        .length
    : 0;

const aggregateSignStats = (capture) => {
  const buckets = Array.isArray(capture?.perfHandle?.signStats)
    ? capture.perfHandle.signStats.filter(
        (bucket) => bucket?.surface === (capture?.telemetrySurface ?? PANEL_TELEMETRY_SURFACE)
      )
    : [];
  if (!buckets.length) return null;

  const totals = buckets.reduce(
    (sum, bucket) => {
      sum.samples += toFiniteNumber(bucket.samples) ?? 0;
      sum.totalSigned += toFiniteNumber(bucket.total_signed) ?? 0;
      sum.totalFailed += toFiniteNumber(bucket.total_failed) ?? 0;
      sum.totalResolvedDurable += toFiniteNumber(bucket.total_resolved_durable) ?? 0;
      sum.totalResolvedOriginal += toFiniteNumber(bucket.total_resolved_original) ?? 0;
      sum.totalPrimaryDurable += toFiniteNumber(bucket.total_primary_durable) ?? 0;
      sum.totalPrimaryOriginal += toFiniteNumber(bucket.total_primary_original) ?? 0;
      sum.maxP95 = Math.max(sum.maxP95, toFiniteNumber(bucket.p95_duration_ms) ?? 0);
      return sum;
    },
    {
      samples: 0,
      totalSigned: 0,
      totalFailed: 0,
      totalResolvedDurable: 0,
      totalResolvedOriginal: 0,
      totalPrimaryDurable: 0,
      totalPrimaryOriginal: 0,
      maxP95: 0,
    }
  );

  const signFailedRatio =
    totals.totalSigned + totals.totalFailed > 0
      ? totals.totalFailed / (totals.totalSigned + totals.totalFailed)
      : 0;

  const resolvedDenominator = totals.totalResolvedDurable + totals.totalResolvedOriginal;
  const primaryDenominator = totals.totalPrimaryDurable + totals.totalPrimaryOriginal;
  const canonicalPreviewCoverageRatio =
    resolvedDenominator > 0
      ? totals.totalResolvedDurable / resolvedDenominator
      : primaryDenominator > 0
        ? totals.totalPrimaryDurable / primaryDenominator
        : null;

  return {
    signBatchP95Ms: totals.maxP95 || null,
    signFailedRatio: Number(signFailedRatio.toFixed(4)),
    canonicalPreviewCoverageRatio:
      canonicalPreviewCoverageRatio == null ? null : Number(canonicalPreviewCoverageRatio.toFixed(4)),
  };
};

const aggregateResolveStats = (capture) => {
  const buckets = Array.isArray(capture?.perfHandle?.resolveStats)
    ? capture.perfHandle.resolveStats.filter(
        (bucket) => bucket?.surface === (capture?.telemetrySurface ?? PANEL_TELEMETRY_SURFACE)
      )
    : [];
  if (!buckets.length) {
    return {
      resolveCallsPerOpen: Number(
        Math.max(0, Math.round(toFiniteNumber(capture?.resolveRequestCount) ?? 0)).toFixed(4)
      ),
      resolveFailedRatio: null,
    };
  }

  const samples = buckets.reduce((sum, bucket) => sum + (toFiniteNumber(bucket.samples) ?? 0), 0);
  const totalResolved = buckets.reduce(
    (sum, bucket) => sum + (toFiniteNumber(bucket.total_resolved) ?? 0),
    0
  );
  const totalFailed = buckets.reduce(
    (sum, bucket) => sum + (toFiniteNumber(bucket.total_failed) ?? 0),
    0
  );

  return {
    resolveCallsPerOpen: Number(samples.toFixed(4)),
    resolveFailedRatio:
      totalResolved + totalFailed > 0
        ? Number((totalFailed / (totalResolved + totalFailed)).toFixed(4))
        : 0,
  };
};

const aggregateFallbackStats = (capture) => {
  const buckets = Array.isArray(capture?.perfHandle?.fallbackStats)
    ? capture.perfHandle.fallbackStats.filter(
        (bucket) => bucket?.surface === (capture?.telemetrySurface ?? PANEL_TELEMETRY_SURFACE)
      )
    : [];
  if (!buckets.length) {
    return {
      fallbackCallsPerOpen: Number(
        Math.max(0, Math.round(toFiniteNumber(capture?.fallbackRequestCount) ?? 0)).toFixed(4)
      ),
      fallbackFailedRatio: null,
    };
  }

  const samples = buckets.reduce((sum, bucket) => sum + (toFiniteNumber(bucket.samples) ?? 0), 0);
  const totalSucceeded = buckets.reduce(
    (sum, bucket) => sum + (toFiniteNumber(bucket.total_succeeded) ?? 0),
    0
  );
  const totalFailed = buckets.reduce(
    (sum, bucket) => sum + (toFiniteNumber(bucket.total_failed) ?? 0),
    0
  );

  return {
    fallbackCallsPerOpen: Number(samples.toFixed(4)),
    fallbackFailedRatio:
      totalSucceeded + totalFailed > 0
        ? Number((totalFailed / (totalSucceeded + totalFailed)).toFixed(4))
        : 0,
  };
};

export const buildPacketFromPanelCapture = (capture, options = {}) => {
  const firstVisibleMs = toFiniteNumber(capture?.firstVisibleMs);
  const stateFlipCount = toFiniteNumber(capture?.stateFlipCount);
  const loadingStateVisibleMs = toFiniteNumber(capture?.loadingStateVisibleMs);
  const listRequestCount = Math.max(0, Math.round(toFiniteNumber(capture?.listRequestCount) ?? 0));
  const signAggregate = aggregateSignStats(capture);
  const resolveAggregate = aggregateResolveStats(capture);
  const fallbackAggregate = aggregateFallbackStats(capture);

  const surfaceSpec = getCaptureSurfaceSpec(options.surface ?? DEFAULT_SURFACE);
  const surfaceLabel = surfaceSpec?.label ?? "media panel";

  return {
    packetVersion: 2,
    measuredAt: options.measuredAt ?? new Date().toISOString(),
    environment: options.environment ?? "unknown",
    captureMode: options.captureMode ?? buildCaptureModeLabel(capture),
    sampleCount: 1,
    surface: options.surface ?? DEFAULT_SURFACE,
    notes: [
      `Derived automatically from the ${surfaceLabel} KPI capture helper.`,
      "Single-run browser capture. Repeat runs are recommended before treating this as sprint-level evidence.",
      capture?.firstVisibleKind === "media"
        ? "firstMediaPaintP95Ms and openToFirstMediaP95Ms were both populated from the first visible media moment in this run."
        : "first visible content was not a media card, so first-media metrics were left incomplete where appropriate.",
      signAggregate?.canonicalPreviewCoverageRatio == null
        ? "Canonical preview coverage was not derivable from the live sign stats in this run."
        : "Canonical preview coverage was derived from panel sign stats using resolved durable vs resolved original counts when available.",
    ],
    metrics: {
      firstMediaPaintP95Ms: capture?.firstVisibleKind === "media" ? firstVisibleMs : null,
      loadingStateVisibleMsP95: loadingStateVisibleMs,
      openToFirstMediaP95Ms: capture?.firstVisibleKind === "media" ? firstVisibleMs : null,
      stableContentSettleMsP95: null,
      signBatchP95Ms: signAggregate?.signBatchP95Ms ?? null,
      resolveCallsPerOpen: resolveAggregate.resolveCallsPerOpen,
      fallbackCallsPerOpen: fallbackAggregate.fallbackCallsPerOpen,
      stateFlipCountPerOpen: stateFlipCount,
      extraListCallsPerOpen: Number(Math.max(0, listRequestCount - 1).toFixed(4)),
      signFailedRatio: signAggregate?.signFailedRatio ?? null,
      resolveFailedRatio: resolveAggregate.resolveFailedRatio,
      fallbackFailedRatio: fallbackAggregate.fallbackFailedRatio,
      consoleErrorsPerOpen: countConsoleErrors(capture?.consoleEntries),
      visualRegressionCount: null,
      missingPreviewRatio: null,
      canonicalPreviewCoverageRatio: signAggregate?.canonicalPreviewCoverageRatio ?? null,
      emptyStateMismatchCount: null,
      saveRoundtripFailureRate: null,
      saveRoundtripMismatchRate: null,
      saveBrowseReadyRatio: null,
    },
  };
};

const loadAuditCredentials = () => {
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  return { email, password };
};

const waitForDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function ensureSignedIn(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/auth?next=%2Fai-studio`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await waitForDelay(1_000);

  if (page.url().includes("/auth")) {
    await signIn(page, email, password);
    const reached = await waitForNonAuthRoute(page, 20_000);
    if (!reached) {
      throw new Error(`Auth did not reach protected route for /ai-studio on ${baseUrl}`);
    }
  }

  await page.goto(`${baseUrl}/ai-studio`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await satisfyMediaComplianceIfPresent(page);
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
      throw new Error("AI Studio did not finish loading: retry project/workspace state is visible.");
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
    await waitForDelay(500);
  }

  throw new Error("Timed out waiting for the AI Studio media panel to become ready.");
}

async function openElementsMediaPanel(page) {
  const panel = page.locator(CAPTURE_SURFACES["elements-media-panel"].panelSelector).first();
  if (await panel.isVisible().catch(() => false)) return panel;

  const elementsButton = page.getByRole("button", { name: /^elements$/i }).first();
  const elementsHeading = page.getByRole("heading", { name: /^elements library$/i }).first();
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await panel.isVisible().catch(() => false)) return panel;
    if (await elementsHeading.isVisible().catch(() => false)) {
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    if (await elementsButton.isVisible().catch(() => false)) {
      await elementsButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    await waitForDelay(500);
  }

  throw new Error("Timed out waiting for the Elements embedded media panel to become ready.");
}

async function measurePanelOpenState(page, panelSelector) {
  return page.evaluate(async ({ selector }) => {
    const panel = document.querySelector(selector);
    if (!(panel instanceof HTMLElement)) {
      return {
        firstVisibleKind: "missing",
        firstVisibleMs: null,
        loadingStateVisibleMs: null,
        stateFlipCount: null,
      };
    }

    const start = performance.now();
    let previousState = "shell";
    let stateFlipCount = 0;
    let sawLoading = false;
    let lastLoadingAt = null;

    const readState = () => {
      const text = panel.textContent || "";
      const hasCard = Boolean(
        panel.querySelector(
          ".media-library-panel-card, .media-library-media-card, .media-library-panel-media-card-shell"
        )
      );
      if (/loading saved items|loading prompts/i.test(text)) return "loading";
      if (hasCard) return "media";
      if (/no media found|no prompts found/i.test(text)) return "empty";
      return "shell";
    };

    while (performance.now() - start < 20_000) {
      const nextState = readState();
      if (nextState !== previousState) {
        stateFlipCount += 1;
        previousState = nextState;
      }
      if (nextState === "loading") {
        sawLoading = true;
        lastLoadingAt = Math.round(performance.now() - start);
      }
      if (nextState === "media" || nextState === "empty") {
        return {
          firstVisibleKind: nextState,
          firstVisibleMs: Math.round(performance.now() - start),
          loadingStateVisibleMs: sawLoading ? lastLoadingAt : null,
          stateFlipCount,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return {
      firstVisibleKind: "timeout",
      firstVisibleMs: null,
      loadingStateVisibleMs: sawLoading ? lastLoadingAt : null,
      stateFlipCount,
    };
  }, { selector: panelSelector });
}

async function captureTabResults(page, panel) {
  const tabNames = ["All Media", "Images", "Prompts"];
  const results = [];

  for (const tabName of tabNames) {
    const tab = panel.getByRole("tab", { name: new RegExp(`^${tabName}$`, "i") }).first();
    if (!(await tab.isVisible().catch(() => false))) continue;
    const startedAt = Date.now();
    await tab.click();
    await waitForDelay(700);
    const visibleMs = Date.now() - startedAt;
    const text = await panel.evaluate((node) => node.textContent || "");
    results.push({
      tabName,
      visibleMs,
      sawEmpty: /No prompts found for this folder\.|No media found/i.test(text),
    });
  }

  return results;
}

async function runPanelCapture({ baseUrl, headless, surface }) {
  const surfaceSpec = getCaptureSurfaceSpec(surface);
  if (!surfaceSpec) {
    throw new Error(
      `Unsupported capture surface: ${surface}. Supported surfaces: ${Object.keys(CAPTURE_SURFACES).join(", ")}.`
    );
  }

  const creds = loadAuditCredentials();
  if (!creds.email) {
    throw new Error("PLAYWRIGHT_AUDIT_EMAIL is required.");
  }
  if (/@example\.com$/i.test(creds.email)) {
    throw new Error("PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account.");
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();

  const consoleEntries = [];
  const listRequests = [];
  const resolveRequests = [];
  const fallbackRequests = [];
  page.on("console", (message) => {
    const text = message.text();
    if (shouldIgnoreConsole(text)) return;
    consoleEntries.push({ type: message.type(), text });
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/media/list")) listRequests.push({ url, method: request.method() });
    if (url.includes("/api/media/resolve-previews")) {
      resolveRequests.push({ url, method: request.method() });
    }
    if (
      url.includes("/storage/v1/object/sign/media_library") ||
      url.includes("/storage/v1/render/image")
    ) {
      fallbackRequests.push({ url, method: request.method() });
    }
  });

  try {
    await ensureSignedIn(page, baseUrl, creds.email, creds.password);
    const panel =
      surface === "elements-media-panel"
        ? await openElementsMediaPanel(page)
        : await openAiStudioMediaPanel(page);
    const openState = await measurePanelOpenState(page, surfaceSpec.panelSelector);
    await waitForDelay(1_200);
    const tabResults = await captureTabResults(page, panel);
    const perfHandle = await page.evaluate(() => {
      const handle = window.__shortpulseMediaPerf;
      if (!handle) return { available: false };
      return {
        available: true,
        durationStats: typeof handle.durationStats === "function" ? handle.durationStats() : null,
        signStats: typeof handle.signStats === "function" ? handle.signStats() : null,
        resolveStats: typeof handle.resolveStats === "function" ? handle.resolveStats() : null,
        fallbackStats: typeof handle.fallbackStats === "function" ? handle.fallbackStats() : null,
      };
    });

    return {
      ok: countConsoleErrors(consoleEntries) === 0,
      baseUrl,
      finalUrl: page.url(),
      telemetrySurface: surfaceSpec.telemetrySurface,
      firstVisibleKind: openState.firstVisibleKind,
      firstVisibleMs: openState.firstVisibleMs,
      loadingStateVisibleMs: openState.loadingStateVisibleMs,
      stateFlipCount: openState.stateFlipCount,
      tabResults,
      listRequestCount: listRequests.length,
      resolveRequestCount: resolveRequests.length,
      fallbackRequestCount: fallbackRequests.length,
      consoleEntries,
      perfHandle,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

const writeJsonFile = (outputPath, value) => {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  loadAuditEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const baseUrl = args.baseUrl || (process.env.PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL || DEFAULT_BASE_URL).trim();
  const headless = resolveHeadless(args.headless);
  const capture = await runPanelCapture({
    baseUrl,
    headless,
    surface: args.surface,
  });
  const packet = buildPacketFromPanelCapture(capture, {
    environment: /localhost|127\.0\.0\.1/i.test(baseUrl) ? "development" : "production",
    captureMode: buildCaptureModeLabel(capture),
    surface: args.surface,
  });
  const scored = scorePacket(packet);
  const report = {
    capture,
    packet,
    scored,
  };

  if (args.writePacket) {
    writeJsonFile(args.writePacket, packet);
  }

  if (args.format === "packet") {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
    return;
  }
  if (args.format === "markdown") {
    process.stdout.write(`${buildMarkdownReport(scored)}\n`);
    return;
  }
  if (args.format === "text") {
    process.stdout.write(
      [
        `Surface: ${scored.surfaceLabel} (${scored.surface})`,
        `Overall score: ${scored.overallScore10} / 10 (${scored.grade})`,
        `Readiness: ${scored.readiness}`,
        `Evidence quality: ${scored.evidence}`,
        `Coverage: ${(scored.coverage * 100).toFixed(0)}%`,
        `Capture URL: ${capture.finalUrl ?? baseUrl}`,
      ].join("\n") + "\n"
    );
    return;
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

if (path.resolve(process.argv[1] || "") === SCRIPT_FILE) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
