#!/usr/bin/env node

/**
 * Read-only billing launch-readiness audit for the signup-to-paid-use path.
 * Checks production routing, public-origin auth callbacks, public catalog shape,
 * production Supabase billing catalog state, internal renewal protection, and
 * optional Stripe/webhook + DB trigger proof when read credentials are present.
 */

import { loadLocalEnv } from "./lib/load_local_env.mjs";
import {
  REQUIRED_INTERVALS,
  REQUIRED_PLAN_IDS,
  REQUIRED_ROUTE_PATHS,
  REQUIRED_STRIPE_WEBHOOK_EVENTS,
  createReporter,
  execFileAsync,
  fetchJson,
  fetchText,
  parseArgs,
  parseNextData,
  runNodeScript,
  usage,
} from "./lib/billing_launch_readiness_helpers.mjs";

const LOADED_ENV_FILES = loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: [".env.agent.local", ".env.local", "frontend/.env.local"],
});

const PSQL_COMMAND_CANDIDATES = Array.from(
  new Set(
    [
      process.env.PSQL_BIN?.trim(),
      "/opt/homebrew/opt/libpq/bin/psql",
      "/usr/local/opt/libpq/bin/psql",
      "psql",
    ].filter(Boolean),
  ),
);

const ensureProductionBaseUrl = (baseUrl, reporter) => {
  if (baseUrl !== "https://www.shortpulse.ai") {
    reporter.warn(
      "base_url",
      "Audit target is not the production URL required by the pre-launch runtime policy.",
      baseUrl,
    );
    return;
  }
  reporter.pass("base_url", "Audit target is the production URL.", baseUrl);
};

const checkVercel = async (args, reporter) => {
  if (args.skipVercel) {
    reporter.warn(
      "vercel_env",
      "Skipped Vercel env and route checks by request.",
    );
    return;
  }

  const envOutput = await runNodeScript(
    "scripts/check_vercel_env_contract.mjs",
    ["--environment", "production"],
  );
  reporter.pass(
    "vercel_env",
    "Production Vercel env contract passed.",
    envOutput.split("\n")[0],
  );

  const routeArgs = ["--base-url", args.baseUrl];
  for (const routePath of REQUIRED_ROUTE_PATHS) {
    routeArgs.push("--required-route", routePath);
  }
  const routeOutput = await runNodeScript(
    "scripts/verify_deployment_route_parity.mjs",
    routeArgs,
  );
  reporter.pass(
    "vercel_route_parity",
    "Production deployment contains billing-critical routes.",
    routeOutput.split("\n").filter((line) => line.includes("PASS"))[0] ?? null,
  );
};

const checkAuthCallback = async (args, reporter) => {
  const nextPath = "/pricing?plan=starter&interval=year";
  const url = new URL("/api/auth/callback-url", `${args.baseUrl}/`);
  url.searchParams.set("flow", "signup");
  url.searchParams.set("next", nextPath);
  const payload = await fetchJson(url.toString());
  const callbackUrl = String(payload.url ?? "");
  const expectedPrefix = `${args.baseUrl}/auth/callback?`;
  if (!callbackUrl.startsWith(expectedPrefix)) {
    reporter.fail(
      "auth_callback_origin",
      "Signup callback helper returned a non-production callback URL.",
      callbackUrl,
    );
    return;
  }
  if (
    !callbackUrl.includes("next=%2Fpricing%3Fplan%3Dstarter%26interval%3Dyear")
  ) {
    reporter.fail(
      "auth_callback_next",
      "Signup callback helper did not preserve the selected pricing target.",
      callbackUrl,
    );
    return;
  }
  reporter.pass(
    "auth_callback",
    "Signup callback helper resolves to production and preserves selected plan intent.",
    callbackUrl,
  );
};

const checkPublicPricingCatalog = async (args, reporter) => {
  const { body } = await fetchText(`${args.baseUrl}/pricing`);
  const nextData = parseNextData(body);
  const catalog = nextData?.props?.pageProps?.billingCatalog;
  const plans = Array.isArray(catalog?.plans) ? catalog.plans : [];
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const missing = [];

  for (const planId of REQUIRED_PLAN_IDS) {
    const plan = planById.get(planId);
    if (!plan) {
      missing.push(`${planId}: missing plan`);
      continue;
    }
    for (const interval of REQUIRED_INTERVALS) {
      const offer = plan.offers?.[interval];
      if (!offer?.stripe_price_id) {
        missing.push(`${planId}/${interval}: missing stripe_price_id`);
      }
      if (offer?.acquisition_enabled !== true || offer?.is_active !== true) {
        missing.push(
          `${planId}/${interval}: offer not active/acquisition-enabled`,
        );
      }
    }
  }

  if (missing.length > 0) {
    reporter.fail(
      "public_pricing_catalog",
      "Public pricing catalog is not purchasable.",
      missing,
    );
    return;
  }

  reporter.pass(
    "public_pricing_catalog",
    "Public pricing catalog exposes active monthly and annual paid offers with Stripe price IDs.",
    REQUIRED_PLAN_IDS,
  );
};

const resolveProductionSupabaseConfig = () => {
  const baseUrl = process.env.SHORTPULSE_PRODUCTION_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey =
    process.env.SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!baseUrl || !serviceRoleKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    serviceRoleKey,
  };
};

const supabaseRest = async ({ baseUrl, serviceRoleKey }, path) => {
  const url = `${baseUrl}/rest/v1/${path}`;
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `${path} returned ${response.status}: ${body.slice(0, 240)}`,
    );
  }
  return body ? JSON.parse(body) : null;
};

const redactSensitiveDiagnostics = (value) => {
  const text = String(value ?? "");
  return text
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[redacted]@")
    .replace(
      /(SUPABASE_(?:ACCESS|MANAGEMENT_API)_TOKEN=)[^\s]+/gi,
      "$1[redacted]",
    )
    .replace(/(STRIPE_SECRET_KEY=)[^\s]+/gi, "$1[redacted]");
};

const checkProductionSupabaseCatalog = async (reporter) => {
  const config = resolveProductionSupabaseConfig();
  if (!config) {
    reporter.warn(
      "production_supabase_catalog",
      "Production-specific Supabase REST credentials are unavailable; catalog/schema proof is unproven.",
      "Expected SHORTPULSE_PRODUCTION_SUPABASE_URL and SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY.",
    );
    return;
  }

  const [offers, packages, storageOffers] = await Promise.all([
    supabaseRest(
      config,
      "billing_plan_offers?select=id,plan_id,billing_interval,stripe_price_id,recurring_price_cents,acquisition_enabled,is_active&acquisition_enabled=eq.true&is_active=eq.true&order=plan_id.asc",
    ),
    supabaseRest(
      config,
      "billing_credit_packages?select=id,price_cents,stripe_price_id,is_active&is_active=eq.true&order=sort_order.asc",
    ),
    supabaseRest(
      config,
      "billing_storage_addon_offers?select=id,storage_addon_id,recurring_price_cents,stripe_price_id,acquisition_enabled,is_active&acquisition_enabled=eq.true&is_active=eq.true&order=storage_addon_id.asc",
    ),
  ]);

  const [freePlans, freeOffers] = await Promise.all([
    supabaseRest(
      config,
      "billing_plans?select=id,monthly_price_cents,monthly_credits_cents,storage_limit_bytes,stripe_price_id,is_active&id=eq.free",
    ),
    supabaseRest(
      config,
      "billing_plan_offers?select=id,recurring_price_cents,monthly_credits_cents,storage_limit_bytes,max_concurrent_generations,stripe_price_id,acquisition_enabled,is_active&plan_id=eq.free",
    ),
  ]);

  const offerByKey = new Map(
    (Array.isArray(offers) ? offers : []).map((offer) => [
      `${offer.plan_id}:${offer.billing_interval}`,
      offer,
    ]),
  );
  const missingPlanOffers = [];
  for (const planId of REQUIRED_PLAN_IDS) {
    for (const interval of REQUIRED_INTERVALS) {
      const offer = offerByKey.get(`${planId}:${interval}`);
      if (!offer) {
        missingPlanOffers.push(
          `${planId}/${interval}: missing active acquisition offer`,
        );
        continue;
      }
      if (
        Number(offer.recurring_price_cents ?? 0) > 0 &&
        !offer.stripe_price_id
      ) {
        missingPlanOffers.push(
          `${planId}/${interval}: missing stripe_price_id`,
        );
      }
    }
  }
  const packageGaps = (Array.isArray(packages) ? packages : [])
    .filter((pkg) => Number(pkg.price_cents ?? 0) > 0 && !pkg.stripe_price_id)
    .map((pkg) => pkg.id);
  const storageGaps = (Array.isArray(storageOffers) ? storageOffers : [])
    .filter(
      (offer) =>
        Number(offer.recurring_price_cents ?? 0) > 0 && !offer.stripe_price_id,
    )
    .map((offer) => offer.id);

  if (missingPlanOffers.length || packageGaps.length || storageGaps.length) {
    reporter.fail(
      "production_supabase_catalog",
      "Production billing catalog has Stripe linkage gaps.",
      {
        planOffers: missingPlanOffers,
        creditPackages: packageGaps,
        storageOffers: storageGaps,
      },
    );
    return;
  }

  await Promise.all([
    supabaseRest(
      config,
      "billing_profiles?select=user_id,plan_id,stripe_customer_id,stripe_subscription_id,current_period_end&limit=0",
    ),
    supabaseRest(
      config,
      "billing_subscription_contracts?select=user_id,plan_id,offer_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,contract_source,current_period_end,next_credit_grant_at&limit=0",
    ),
    supabaseRest(
      config,
      "ai_credit_ledger?select=id,user_id,change_cents,source,source_ref,metadata,created_at&limit=0",
    ),
  ]);

  reporter.pass(
    "production_supabase_catalog",
    "Production Supabase billing catalog and core runtime billing tables are queryable with required Stripe linkage.",
    {
      activePlanOffers: Array.isArray(offers) ? offers.length : 0,
      activeCreditPackages: Array.isArray(packages) ? packages.length : 0,
      activeStorageOffers: Array.isArray(storageOffers)
        ? storageOffers.length
        : 0,
    },
  );

  const baselineAccessPlan = Array.isArray(freePlans) ? freePlans[0] : null;
  const baselineAccessOfferRows = Array.isArray(freeOffers) ? freeOffers : [];
  const baselineAccessGaps = [];

  if (!baselineAccessPlan) {
    baselineAccessGaps.push("baseline access sentinel row is missing");
  } else {
    if (Number(baselineAccessPlan.monthly_price_cents ?? 0) !== 0) {
      baselineAccessGaps.push("baseline access has non-zero monthly price");
    }
    if (Number(baselineAccessPlan.monthly_credits_cents ?? 0) !== 0) {
      baselineAccessGaps.push("baseline access has non-zero monthly credits");
    }
    if (Number(baselineAccessPlan.storage_limit_bytes ?? 0) !== 0) {
      baselineAccessGaps.push("baseline access has non-zero storage");
    }
    if (baselineAccessPlan.stripe_price_id) {
      baselineAccessGaps.push("baseline access has a Stripe price id");
    }
  }

  for (const offer of baselineAccessOfferRows) {
    if (offer.acquisition_enabled === true) {
      baselineAccessGaps.push(
        `${offer.id}: baseline access offer is acquisition-enabled`,
      );
    }
    if (Number(offer.recurring_price_cents ?? 0) !== 0) {
      baselineAccessGaps.push(
        `${offer.id}: baseline access offer has non-zero recurring price`,
      );
    }
    if (Number(offer.monthly_credits_cents ?? 0) !== 0) {
      baselineAccessGaps.push(
        `${offer.id}: baseline access offer has non-zero monthly credits`,
      );
    }
    if (Number(offer.storage_limit_bytes ?? 0) !== 0) {
      baselineAccessGaps.push(
        `${offer.id}: baseline access offer has non-zero storage`,
      );
    }
    if (Number(offer.max_concurrent_generations ?? 0) !== 0) {
      baselineAccessGaps.push(
        `${offer.id}: baseline access offer has generation concurrency`,
      );
    }
    if (offer.stripe_price_id) {
      baselineAccessGaps.push(
        `${offer.id}: baseline access offer has a Stripe price id`,
      );
    }
  }

  if (baselineAccessGaps.length > 0) {
    reporter.fail(
      "production_baseline_access",
      "Production baseline access still carries launch-risk paid value.",
      baselineAccessGaps,
    );
    return;
  }

  reporter.pass(
    "production_baseline_access",
    "Production baseline access is zero-value and not acquisition-enabled.",
    {
      baselineAccessSentinelPresent: Boolean(baselineAccessPlan),
      baselineAccessOfferRows: baselineAccessOfferRows.length,
    },
  );
};

const checkSignupTrigger = async (args, reporter) => {
  if (args.skipDbTrigger) {
    reporter.warn(
      "signup_billing_trigger",
      "Skipped hosted DB signup trigger check by request.",
    );
    return;
  }

  const dbUrl =
    process.env.SHORTPULSE_PRODUCTION_SUPABASE_DB_URL?.trim() ??
    process.env.SHORTPULSE_PRODUCTION_DB_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim() ??
    "";
  if (!dbUrl) {
    reporter.warn(
      "signup_billing_trigger",
      "Production auth.users billing trigger proof is unproven because no production DB URL is available locally.",
      "Expected SHORTPULSE_PRODUCTION_SUPABASE_DB_URL, SHORTPULSE_PRODUCTION_DB_URL, or SUPABASE_DB_URL.",
    );
    return;
  }

  const sql = `
with checks as (
  select 'function' as check_name,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'handle_new_user_billing_setup'
    ) as ok
  union all
  select 'trigger' as check_name,
    exists (
      select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth'
        and c.relname = 'users'
        and t.tgname = 'on_auth_user_created_billing_setup'
        and not t.tgisinternal
    ) as ok
)
select coalesce(json_agg(checks order by check_name), '[]'::json) from checks;
`;

  let stdout = null;
  const missingPsqlCommands = [];
  for (const psqlCommand of PSQL_COMMAND_CANDIDATES) {
    try {
      const result = await execFileAsync(
        psqlCommand,
        [dbUrl, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
        {
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
        },
      );
      stdout = result.stdout;
      break;
    } catch (error) {
      if (error?.code === "ENOENT") {
        missingPsqlCommands.push(psqlCommand);
        continue;
      }
      throw new Error(
        redactSensitiveDiagnostics(
          error instanceof Error ? error.message : error,
        ),
      );
    }
  }
  if (stdout === null) {
    reporter.warn(
      "signup_billing_trigger",
      "Production auth.users billing trigger proof is unproven because no psql client is available locally.",
      `Tried: ${missingPsqlCommands.join(", ")}`,
    );
    return;
  }
  const rows = JSON.parse(stdout.trim() || "[]");
  const failed = rows
    .filter((row) => row.ok !== true)
    .map((row) => row.check_name);
  if (failed.length > 0) {
    reporter.fail(
      "signup_billing_trigger",
      "Production signup billing bootstrap is missing DB objects.",
      failed,
    );
    return;
  }
  reporter.pass(
    "signup_billing_trigger",
    "Production auth.users signup billing bootstrap function and trigger are present.",
  );
};

const checkBillingRenewalFailClosed = async (args, reporter) => {
  const url = new URL(
    "/api/internal/billing-contract-renewals/run",
    `${args.baseUrl}/`,
  );
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = await response.text();
  if (response.status !== 401) {
    reporter.fail(
      "billing_renewal_worker_fail_closed",
      "Billing renewal worker did not fail closed with 401 for unauthenticated POST.",
      { status: response.status, body: body.slice(0, 240) },
    );
    return;
  }
  reporter.pass(
    "billing_renewal_worker_fail_closed",
    "Billing renewal worker is deployed, enabled, and protected from unauthenticated execution.",
  );
};

const checkStripeWebhookEndpoint = async (args, reporter) => {
  if (args.skipStripe) {
    reporter.warn(
      "stripe_webhook_endpoint",
      "Skipped Stripe webhook endpoint check by request.",
    );
    return;
  }
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!stripeSecretKey) {
    reporter.warn(
      "stripe_webhook_endpoint",
      "Stripe webhook endpoint event proof is unproven because STRIPE_SECRET_KEY is unavailable locally.",
      "Vercel production env presence is still covered by the Vercel env contract check.",
    );
    return;
  }

  const response = await fetch(
    "https://api.stripe.com/v1/webhook_endpoints?limit=100",
    {
      headers: {
        authorization: `Bearer ${stripeSecretKey}`,
      },
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Stripe webhook endpoint list failed (${response.status}): ${body.slice(0, 240)}`,
    );
  }
  const payload = JSON.parse(body);
  const expectedUrl = `${args.baseUrl}/api/billing/stripe/webhook`;
  const endpoint = (Array.isArray(payload.data) ? payload.data : []).find(
    (row) => row.url === expectedUrl && row.status === "enabled",
  );
  if (!endpoint) {
    reporter.fail(
      "stripe_webhook_endpoint",
      "No enabled Stripe webhook endpoint points at the production billing webhook.",
      expectedUrl,
    );
    return;
  }

  const enabledEvents = Array.isArray(endpoint.enabled_events)
    ? endpoint.enabled_events
    : [];
  const catchesAll = enabledEvents.includes("*");
  const missingEvents = catchesAll
    ? []
    : REQUIRED_STRIPE_WEBHOOK_EVENTS.filter(
        (eventName) => !enabledEvents.includes(eventName),
      );
  if (missingEvents.length > 0) {
    reporter.fail(
      "stripe_webhook_endpoint",
      "Production Stripe webhook endpoint is missing required billing events.",
      missingEvents,
    );
    return;
  }

  reporter.pass(
    "stripe_webhook_endpoint",
    "Stripe has an enabled production billing webhook endpoint with required events.",
    endpoint.id,
  );
};

const printSummary = ({ checks, strict, json }) => {
  const summary = {
    passed: checks.filter((check) => check.status === "pass").length,
    warnings: checks.filter((check) => check.status === "warn").length,
    failed: checks.filter((check) => check.status === "fail").length,
  };
  const payload = { summary, checks, loadedEnvFiles: LOADED_ENV_FILES.length };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    for (const check of checks) {
      const label = check.status.toUpperCase().padEnd(4);
      console.log(
        `[billing-launch-readiness] ${label} ${check.id}: ${check.summary}`,
      );
      if (check.detail != null) {
        const detail =
          typeof check.detail === "string"
            ? check.detail
            : JSON.stringify(check.detail);
        console.log(`  ${detail}`);
      }
    }
    console.log(
      `[billing-launch-readiness] summary pass=${summary.passed} warn=${summary.warnings} fail=${summary.failed} loaded_env_files=${LOADED_ENV_FILES.length}`,
    );
  }

  if (summary.failed > 0 || (strict && summary.warnings > 0)) {
    process.exit(1);
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const reporter = createReporter();
  ensureProductionBaseUrl(args.baseUrl, reporter);

  const checks = [
    ["vercel", () => checkVercel(args, reporter)],
    ["auth_callback", () => checkAuthCallback(args, reporter)],
    ["public_pricing_catalog", () => checkPublicPricingCatalog(args, reporter)],
    [
      "production_supabase_catalog",
      () => checkProductionSupabaseCatalog(reporter),
    ],
    ["signup_billing_trigger", () => checkSignupTrigger(args, reporter)],
    [
      "billing_renewal_worker_fail_closed",
      () => checkBillingRenewalFailClosed(args, reporter),
    ],
    [
      "stripe_webhook_endpoint",
      () => checkStripeWebhookEndpoint(args, reporter),
    ],
  ];

  for (const [id, runCheck] of checks) {
    try {
      await runCheck();
    } catch (error) {
      reporter.fail(
        id,
        redactSensitiveDiagnostics(
          error instanceof Error ? error.message : error,
        ),
      );
    }
  }

  printSummary({
    checks: reporter.checks,
    strict: args.strict,
    json: args.json,
  });
};

main().catch((error) => {
  console.error(
    `[billing-launch-readiness] error=${redactSensitiveDiagnostics(
      error instanceof Error ? error.message : error,
    )}`,
  );
  process.exit(1);
});
