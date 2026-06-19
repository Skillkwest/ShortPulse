#!/usr/bin/env node

/**
 * Verifies that protected internal worker routes are both present and operational.
 * The script probes each route twice: unauthenticated (must fail closed with 401)
 * and authenticated with the configured cron secret (must succeed with 200).
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

export const DEFAULT_ROUTE_CONFIGS = [
  {
    id: "generation_recovery",
    path: "/api/internal/generation-recovery/run",
    secretEnv: "SHORTPULSE_FAL_RECONCILER_CRON_SECRET",
  },
  {
    id: "media_derivatives",
    path: "/api/internal/media-derivatives/run",
    secretEnv: "SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET",
  },
  {
    id: "user_health_fleet",
    path: "/api/internal/admin-user-health-fleet/run",
    secretEnv: "SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET",
  },
  {
    id: "billing_renewals",
    path: "/api/internal/billing-contract-renewals/run",
    secretEnv: "SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET",
    mutatesOnAuthProbe: true,
  },
];

const DEFAULT_TIMEOUT_MS = 20_000;
const resolveRouteSecret = (route) =>
  process.env[route.secretEnv]?.trim() ?? process.env.CRON_SECRET?.trim() ?? "";

const usage = () => {
  console.log(`Usage:
  node scripts/verify_internal_route_runtime.mjs [options]

Options:
  --base-url <url>          Deployment base URL / alias to probe.
                            Fallback env: SHORTPULSE_STAGING_BASE_URL, APP_BASE_URL
  --route <id>              Probe only a specific route id. Repeatable.
                            Available: ${DEFAULT_ROUTE_CONFIGS.map((route) => route.id).join(", ")}
  --timeout-ms <ms>         Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --output <json-path>      Optional machine-readable summary output path.
  --skip-unauth             Skip the unauthenticated 401 protection check.
  --skip-auth               Skip the authenticated 200 runtime check.
  --allow-mutating-auth     Allow authenticated probes for routes that can mutate data.
                            Explicitly required for billing_renewals auth probes.
  --env-file <path>         Optional env file path (repeatable). Parsed by shared loader.
  --help                    Show this message.
`);
};

const readArgValue = (argv, index, label) => {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${label} requires a value`);
  }
  return value.trim();
};

export const parseArgs = (argv) => {
  const parsed = {
    baseUrl:
      process.env.SHORTPULSE_STAGING_BASE_URL?.trim() ??
      process.env.APP_BASE_URL?.trim() ??
      "",
    routeIds: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    output: "",
    runUnauth: true,
    runAuth: true,
    allowMutatingAuth: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--base-url") {
      parsed.baseUrl = readArgValue(argv, index, "--base-url");
      index += 1;
      continue;
    }
    if (arg === "--route") {
      parsed.routeIds.push(readArgValue(argv, index, "--route"));
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = Number.parseInt(
        readArgValue(argv, index, "--timeout-ms"),
        10,
      );
      index += 1;
      continue;
    }
    if (arg === "--output") {
      parsed.output = readArgValue(argv, index, "--output");
      index += 1;
      continue;
    }
    if (arg === "--skip-unauth") {
      parsed.runUnauth = false;
      continue;
    }
    if (arg === "--skip-auth") {
      parsed.runAuth = false;
      continue;
    }
    if (arg === "--allow-mutating-auth") {
      parsed.allowMutatingAuth = true;
      continue;
    }
    if (arg === "--env-file") {
      readArgValue(argv, index, "--env-file");
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  parsed.baseUrl = parsed.baseUrl.replace(/\/+$/, "");
  parsed.routeIds = [
    ...new Set(parsed.routeIds.map((value) => value.trim()).filter(Boolean)),
  ];

  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs < 1_000) {
    throw new Error(`Invalid --timeout-ms value: ${parsed.timeoutMs}`);
  }
  if (!parsed.runUnauth && !parsed.runAuth) {
    throw new Error(
      "At least one of unauth or auth checks must remain enabled.",
    );
  }

  return parsed;
};

export const resolveRoutes = (routeIds) => {
  if (routeIds.length === 0) return [...DEFAULT_ROUTE_CONFIGS];

  return routeIds.map((routeId) => {
    const route = DEFAULT_ROUTE_CONFIGS.find(
      (candidate) => candidate.id === routeId,
    );
    if (!route) {
      throw new Error(`Unknown route id: ${routeId}`);
    }
    return route;
  });
};

const ensureInputs = ({ baseUrl, routes, args, explicitRouteSelection }) => {
  if (!baseUrl) {
    throw new Error(
      "Missing required base URL. Set --base-url or SHORTPULSE_STAGING_BASE_URL / APP_BASE_URL.",
    );
  }

  if (args.runAuth) {
    const missingSecretKeys = routes
      .filter(
        (route) =>
          !shouldSkipAuthenticatedProbe({
            route,
            args,
            explicitRouteSelection,
          }),
      )
      .filter((route) => !resolveRouteSecret(route))
      .map((route) => `${route.secretEnv} or CRON_SECRET`);
    if (missingSecretKeys.length > 0) {
      throw new Error(
        `Missing required auth probe secret env(s): ${[...new Set(missingSecretKeys)].join(", ")}`,
      );
    }
  }
};

export const shouldSkipAuthenticatedProbe = ({
  route,
  args,
  explicitRouteSelection,
}) =>
  Boolean(
    route.mutatesOnAuthProbe &&
    args.runAuth &&
    !args.allowMutatingAuth &&
    !explicitRouteSelection,
  );

export const assertAllowedProbePlan = ({
  routes,
  args,
  explicitRouteSelection,
}) => {
  if (!args.runAuth || args.allowMutatingAuth || !explicitRouteSelection)
    return;
  const blockedRoutes = routes.filter((route) => route.mutatesOnAuthProbe);
  if (blockedRoutes.length === 0) return;
  throw new Error(
    `Authenticated probe for ${blockedRoutes
      .map((route) => route.id)
      .join(
        ", ",
      )} can mutate data. Re-run with --allow-mutating-auth if this is intentional.`,
  );
};

const normalizeBodyPreview = (bodyText) =>
  bodyText.replace(/\s+/g, " ").trim().slice(0, 320);

const buildUrl = (baseUrl, routePath) =>
  new URL(routePath, `${baseUrl}/`).toString();

const probeRoute = async ({
  url,
  timeoutMs,
  secret,
  bypassToken,
  authenticated,
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    "content-type": "application/json",
  };
  if (authenticated) {
    headers.authorization = `Bearer ${secret}`;
    headers["x-shortpulse-cron-secret"] = secret;
    if (bypassToken) {
      headers["x-vercel-protection-bypass"] = bypassToken;
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: "{}",
      signal: controller.signal,
    });
    const bodyText = await response.text();
    return {
      ok: true,
      status: response.status,
      bodyPreview: normalizeBodyPreview(bodyText),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      bodyPreview: "",
      error: error instanceof Error ? error.message : "Unknown fetch error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const writeJsonOutput = (outputPath, summary) => {
  if (!outputPath) return;
  const resolved = path.resolve(process.cwd(), outputPath);
  fs.writeFileSync(resolved, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
};

const main = async () => {
  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: [".env.agent.local", "frontend/.env.local"],
  });
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const explicitRouteSelection = args.routeIds.length > 0;
  const routes = resolveRoutes(args.routeIds);
  assertAllowedProbePlan({ routes, args, explicitRouteSelection });
  ensureInputs({ baseUrl: args.baseUrl, routes, args, explicitRouteSelection });

  const bypassToken =
    process.env.SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN?.trim() ?? "";
  const results = [];
  let failureCount = 0;

  for (const route of routes) {
    const url = buildUrl(args.baseUrl, route.path);
    const routeResult = {
      routeId: route.id,
      path: route.path,
      url,
      unauth: null,
      auth: null,
    };

    if (args.runUnauth) {
      const unauthResult = await probeRoute({
        url,
        timeoutMs: args.timeoutMs,
        secret: "",
        bypassToken: "",
        authenticated: false,
      });
      routeResult.unauth = {
        ...unauthResult,
        expectedStatus: 401,
        pass: unauthResult.ok && unauthResult.status === 401,
      };
      if (!routeResult.unauth.pass) {
        failureCount += 1;
      }
    }

    if (shouldSkipAuthenticatedProbe({ route, args, explicitRouteSelection })) {
      routeResult.auth = {
        ok: true,
        status: null,
        bodyPreview: "",
        expectedStatus: 200,
        pass: true,
        skipped: true,
        reason: "mutating_auth_probe_requires_explicit_allow",
        secretEnv: route.secretEnv,
        usedCronFallback: false,
      };
    } else if (args.runAuth) {
      const secret = resolveRouteSecret(route);
      const authResult = await probeRoute({
        url,
        timeoutMs: args.timeoutMs,
        secret,
        bypassToken,
        authenticated: true,
      });
      routeResult.auth = {
        ...authResult,
        expectedStatus: 200,
        pass: authResult.ok && authResult.status === 200,
        secretEnv: route.secretEnv,
        usedCronFallback:
          !process.env[route.secretEnv]?.trim() &&
          Boolean(process.env.CRON_SECRET?.trim()),
      };
      if (!routeResult.auth.pass) {
        failureCount += 1;
      }
    }

    results.push(routeResult);
  }

  for (const routeResult of results) {
    console.log(`[route-runtime] ${routeResult.routeId}`);
    if (routeResult.unauth) {
      console.log(
        `  unauth: status=${routeResult.unauth.status ?? "error"} expected=401 pass=${routeResult.unauth.pass}`,
      );
      if (!routeResult.unauth.pass) {
        console.log(
          `    detail=${routeResult.unauth.error ?? routeResult.unauth.bodyPreview ?? "no body"}`,
        );
      }
    }
    if (routeResult.auth) {
      if (routeResult.auth.skipped) {
        console.log(
          `  auth: skipped=${routeResult.auth.reason} expected=200 pass=${routeResult.auth.pass}`,
        );
      } else {
        console.log(
          `  auth: status=${routeResult.auth.status ?? "error"} expected=200 pass=${routeResult.auth.pass}`,
        );
      }
      if (!routeResult.auth.pass) {
        console.log(
          `    detail=${routeResult.auth.error ?? routeResult.auth.bodyPreview ?? "no body"}`,
        );
      }
    }
  }

  const summary = {
    baseUrl: args.baseUrl,
    routeCount: results.length,
    failureCount,
    results,
  };
  writeJsonOutput(args.output, summary);

  if (failureCount > 0) {
    throw new Error(
      `[route-runtime] FAIL: ${failureCount} probe(s) did not match expected status.`,
    );
  }

  console.log(
    "[route-runtime] PASS: protected internal routes fail closed unauthenticated; non-mutating auth probes succeeded.",
  );
};

const isCliEntry = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isCliEntry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
