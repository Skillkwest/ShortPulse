#!/usr/bin/env node

/**
 * Read-only guard for the dedicated full-price subscription-upgrade Portal
 * configuration. This must pass before production routes use the config id.
 */

import { loadLocalEnv } from "./lib/load_local_env.mjs";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const CONFIG_ENV = "STRIPE_BILLING_PORTAL_FULL_PRICE_UPGRADE_CONFIG_ID";

const readArgValues = (argv, name) => {
  const values = [];
  const prefixed = `${name}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === name) {
      const next = argv[index + 1];
      if (typeof next === "string") values.push(next);
      continue;
    }
    if (token.startsWith(prefixed)) {
      values.push(token.slice(prefixed.length));
    }
  }
  return values;
};

const readSingleArg = (argv, names) => {
  for (const name of names) {
    const values = readArgValues(argv, name);
    if (values.length > 0) return values[values.length - 1] ?? null;
  }
  return null;
};

const hasFlag = (argv, names) => names.some((name) => argv.includes(name));

const usage = () => {
  console.log(`Usage:
  node scripts/check_stripe_billing_portal_upgrade_config.mjs [options]

Options:
  --config-id <bpc_...>    Stripe Billing Portal configuration id. Defaults to ${CONFIG_ENV}.
  --json                   Emit machine-readable JSON.
  --env-file <path>        Optional env file path (repeatable). Parsed by shared loader.
  --help                   Show this message.
`);
};

const parseArgs = (argv) => ({
  configId: readSingleArg(argv, ["--config-id"])?.trim() || null,
  json: hasFlag(argv, ["--json"]),
  help: hasFlag(argv, ["--help", "-h"]),
});

const stripeGet = async (path, stripeSecretKey) => {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    headers: {
      authorization: `Bearer ${stripeSecretKey}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Stripe request failed (${response.status}).`,
    );
  }
  return payload;
};

const main = async () => {
  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: [".env.agent.local", ".env.local", "frontend/.env.local"],
  });
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const configId = args.configId ?? process.env[CONFIG_ENV]?.trim() ?? "";
  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }
  if (!configId) {
    throw new Error(`Missing --config-id or ${CONFIG_ENV}.`);
  }

  const config = await stripeGet(
    `/billing_portal/configurations/${configId}`,
    stripeSecretKey,
  );
  const subscriptionUpdate = config?.features?.subscription_update ?? {};
  const allowedUpdates = Array.isArray(
    subscriptionUpdate.default_allowed_updates,
  )
    ? subscriptionUpdate.default_allowed_updates
    : [];
  const products = Array.isArray(subscriptionUpdate.products)
    ? subscriptionUpdate.products
    : [];
  const exposedPriceCount = products.reduce((count, product) => {
    const prices = Array.isArray(product?.prices) ? product.prices : [];
    return count + prices.length;
  }, 0);

  const checks = [
    {
      name: "configuration_active",
      pass: config.active === true,
      expected: true,
      actual: config.active ?? null,
    },
    {
      name: "subscription_update_enabled",
      pass: subscriptionUpdate.enabled === true,
      expected: true,
      actual: subscriptionUpdate.enabled ?? null,
    },
    {
      name: "proration_behavior",
      pass: subscriptionUpdate.proration_behavior === "none",
      expected: "none",
      actual: subscriptionUpdate.proration_behavior ?? null,
    },
    {
      name: "billing_cycle_anchor",
      pass: subscriptionUpdate.billing_cycle_anchor === "now",
      expected: "now",
      actual: subscriptionUpdate.billing_cycle_anchor ?? null,
    },
    {
      name: "price_updates_allowed",
      pass: allowedUpdates.length === 1 && allowedUpdates[0] === "price",
      expected: ["price"],
      actual: allowedUpdates,
    },
    {
      name: "prices_exposed",
      pass: exposedPriceCount > 0,
      expected: "at least one Portal-updatable price",
      actual: exposedPriceCount,
    },
  ];
  const failures = checks.filter((check) => !check.pass);
  const result = {
    ok: failures.length === 0,
    config_id: configId,
    checks,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(
      `PASS Stripe Billing Portal full-price upgrade configuration ${configId} is active, update-enabled, non-prorated, and resets the billing cycle anchor.`,
    );
  } else {
    console.error(
      `FAIL Stripe Billing Portal full-price upgrade configuration ${configId} does not match the required contract:`,
    );
    for (const failure of failures) {
      console.error(
        `- ${failure.name}: expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(
          failure.actual,
        )}`,
      );
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
