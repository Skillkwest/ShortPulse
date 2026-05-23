#!/usr/bin/env node

/**
 * Runs a repeatable signed-in Beeper route walkthrough with screenshots and a JSON audit packet.
 * This is a starter smoke pass, not a replacement for deeper manual UX exploration.
 */

import path from "node:path";
import process from "node:process";
import {
  attachRuntimeObservers,
  buildRouteSummary,
  ensureBeeperAuditUser,
  ensureDirectory,
  formatTimestampSlug,
  launchBeeperBrowser,
  openProtectedRoute,
  parseRouteArgs,
  resolveAuditRoutes,
  resolveBeeperRuntimeConfig,
  summarizeRuntimeSignals,
  writeJsonFile,
} from "./lib/beeperAuditRuntime.mjs";

const usage = () => {
  console.log(`Usage:
  node beeper/scripts/live-product-walkthrough.mjs [options]

Options:
  --route <route>          Repeatable route alias/path (dashboard, ai-studio, media-library, character, profile, or /custom-path).
  --base-url <url>         Optional app base URL override.
  --output-dir <path>      Optional output directory. Defaults to beeper/evidence-cache/<timestamp>.
  --headless <true|false>  Browser visibility mode. Default: true.
  --skip-audit-user-ensure Skip the audit-user align/create step before sign-in.
  --help                   Show this message.

Output:
  - local raw screenshot per route
  - local raw audit-summary.json packet
`);
};

const parseFlagValue = (argv, flag) => {
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

const parseBooleanLike = (value, fallback) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const main = async () => {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    return;
  }

  const config = resolveBeeperRuntimeConfig({ argv });
  const routes = resolveAuditRoutes(parseRouteArgs(argv));
  const headless = parseBooleanLike(parseFlagValue(argv, "--headless"), true);
  const skipAuditUserEnsure = argv.includes("--skip-audit-user-ensure");
  const outputDir =
    parseFlagValue(argv, "--output-dir") ??
    path.join(
      config.repoRoot,
      "beeper",
      "evidence-cache",
      formatTimestampSlug(new Date()),
    );

  ensureDirectory(outputDir);

  if (!skipAuditUserEnsure) {
    await ensureBeeperAuditUser(config, { apply: true });
  }

  const browser = await launchBeeperBrowser({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  const observers = await attachRuntimeObservers(page);
  const routeSummaries = [];

  for (let index = 0; index < routes.length; index += 1) {
    const routePath = routes[index];
    const routeRun = await openProtectedRoute(page, config, routePath);
    const summary = {
      ...(await buildRouteSummary(page, routePath)),
      mediaComplianceAccepted: routeRun.mediaComplianceAccepted,
      screenshot: `route-${String(index + 1).padStart(2, "0")}.png`,
    };
    await page.screenshot({
      path: path.join(outputDir, summary.screenshot),
      fullPage: false,
    });
    routeSummaries.push(summary);
  }

  const signalSummary = summarizeRuntimeSignals(observers);
  const report = {
    ok: signalSummary.ok,
    baseUrl: config.baseUrl,
    runtimeProjectRef: config.runtimeProjectRef,
    auditEmail: config.auditEmail,
    routes: routeSummaries,
    signals: signalSummary,
  };

  writeJsonFile(path.join(outputDir, "audit-summary.json"), report);
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
};

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
