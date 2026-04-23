#!/usr/bin/env npx tsx

import { loadLocalEnv } from "./lib/load_local_env.mjs";

type ParsedArgs = {
  userId: string | null;
  limit: number;
  json: boolean;
  strict: boolean;
  help: boolean;
};

type BillingProfileRow = {
  user_id: string;
  plan_id: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

type BillingContractRow = {
  user_id: string;
  plan_id: string | null;
  offer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  recurring_price_cents: number | string | null;
  monthly_credits_cents: number | string | null;
  status: string | null;
  current_period_end: string | null;
};

type StripeSubscriptionResponse = {
  id: string;
  status?: string | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
        unit_amount?: number | null;
        currency?: string | null;
      } | null;
    }>;
  } | null;
};

type StripeSubscriptionListResponse = {
  data?: StripeSubscriptionResponse[];
};

type FindingSeverity = "info" | "warning" | "critical";

type VerificationFinding = {
  code: string;
  severity: FindingSeverity;
  message: string;
};

type VerificationRow = {
  userId: string;
  billingProfile: BillingProfileRow | null;
  currentContract: BillingContractRow | null;
  liveStripeSubscription: {
    customerId: string | null;
    subscriptionId: string | null;
    status: string | null;
    priceId: string | null;
    recurringPriceCents: number | null;
    currentPeriodEnd: string | null;
  };
  findings: VerificationFinding[];
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 250;
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const SUPABASE_REST_PREFIX = "/rest/v1";

const usage = () => {
  console.log(`Usage:
  npx tsx scripts/verify_billing_contracts_against_stripe.ts [options]

Options:
  --user-id <uuid>         Verify one user only.
  --limit <n>              Max users to inspect when scanning profiles (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).
  --json                   Emit raw JSON results.
  --strict                 Exit non-zero when warnings/critical findings exist.
  --env-file <path>        Optional env file path (repeatable).
  --help                   Show this message.
`);
};

const readArgValues = (name: string): string[] => {
  const values: string[] = [];
  const prefixed = `${name}=`;
  for (let index = 0; index < process.argv.length; index += 1) {
    const token = process.argv[index];
    if (token === name) {
      const next = process.argv[index + 1];
      if (typeof next === "string") values.push(next);
      continue;
    }
    if (token.startsWith(prefixed)) {
      values.push(token.slice(prefixed.length));
    }
  }
  return values;
};

const readSingleArg = (names: string[]): string | null => {
  for (const name of names) {
    const values = readArgValues(name);
    if (values.length > 0) {
      return values[values.length - 1] ?? null;
    }
  }
  return null;
};

const hasFlag = (names: string[]): boolean => names.some((name) => process.argv.includes(name));

const asPositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const parseArgs = (): ParsedArgs => ({
  userId: readSingleArg(["--user-id"])?.trim() || null,
  limit: Math.min(MAX_LIMIT, asPositiveInt(readSingleArg(["--limit"]), DEFAULT_LIMIT)),
  json: hasFlag(["--json"]),
  strict: hasFlag(["--strict"]),
  help: hasFlag(["--help", "-h"]),
});

const asCents = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const stripeGet = async <T>(
  secretKey: string,
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): Promise<T> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const url = `${STRIPE_API_BASE}${path}${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe call failed (${response.status})`);
  }
  return payload as T;
};

const supabaseSelect = async <T>(
  baseUrl: string,
  serviceRoleKey: string,
  table: string,
  query: Record<string, string | number>
): Promise<T[]> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }
  const response = await fetch(`${baseUrl}${SUPABASE_REST_PREFIX}/${table}?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const payload = (await response.json().catch(() => [])) as T[] | { message?: string };
  if (!response.ok) {
    throw new Error(
      (payload as { message?: string })?.message || `Supabase select failed (${response.status})`
    );
  }
  return Array.isArray(payload) ? payload : [];
};

const isActivePaidProfile = (profile: BillingProfileRow | null): boolean => {
  if (!profile?.plan_id || profile.plan_id === "free") return false;
  return ["active", "trialing", "past_due", "unpaid"].includes(
    String(profile.subscription_status ?? "").toLowerCase()
  );
};

const main = async () => {
  const args = parseArgs();
  if (args.help) {
    usage();
    return;
  }

  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: [
      ".env.agent.local",
      ".env.local",
      "frontend/.env.local",
      "frontend/.env.development.local",
    ],
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const profiles = await supabaseSelect<BillingProfileRow>(
    supabaseUrl,
    supabaseServiceRoleKey,
    "billing_profiles",
    args.userId
      ? {
          select:
            "user_id,plan_id,subscription_status,stripe_customer_id,stripe_subscription_id,current_period_end",
          user_id: `eq.${args.userId}`,
          order: "updated_at.desc",
          limit: args.limit,
        }
      : {
          select:
            "user_id,plan_id,subscription_status,stripe_customer_id,stripe_subscription_id,current_period_end",
          or: "(stripe_customer_id.not.is.null,stripe_subscription_id.not.is.null,and(plan_id.neq.free,subscription_status.in.(active,trialing,past_due,unpaid)))",
          order: "updated_at.desc",
          limit: args.limit,
        }
  );
  const userIds = [...new Set(profiles.map((profile) => profile.user_id))];

  let contracts: BillingContractRow[] = [];
  if (userIds.length > 0) {
    contracts = await supabaseSelect<BillingContractRow>(
      supabaseUrl,
      supabaseServiceRoleKey,
      "billing_subscription_contracts",
      {
        select:
          "user_id,plan_id,offer_id,stripe_subscription_id,stripe_price_id,recurring_price_cents,monthly_credits_cents,status,current_period_end",
        user_id: `in.(${userIds.join(",")})`,
        ended_at: "is.null",
      }
    );
  }

  const contractByUser = new Map<string, BillingContractRow>(
    contracts.map((contract) => [contract.user_id, contract])
  );

  const rows: VerificationRow[] = [];
  for (const profile of profiles) {
    const currentContract = contractByUser.get(profile.user_id) ?? null;
    const findings: VerificationFinding[] = [];
    const subscriptionId =
      currentContract?.stripe_subscription_id ?? profile.stripe_subscription_id ?? null;
    const customerId = profile.stripe_customer_id ?? null;
    let liveSubscription: StripeSubscriptionResponse | null = null;

    if (subscriptionId) {
      liveSubscription = await stripeGet<StripeSubscriptionResponse>(
        stripeSecretKey,
        `/subscriptions/${subscriptionId}`,
        { "expand[]": "items.data.price" }
      );
    } else if (customerId) {
      const list = await stripeGet<StripeSubscriptionListResponse>(stripeSecretKey, "/subscriptions", {
        customer: customerId,
        status: "all",
        limit: 1,
        "expand[]": "data.items.data.price",
      });
      liveSubscription = Array.isArray(list.data) ? (list.data[0] ?? null) : null;
    }

    const livePrice = liveSubscription?.items?.data?.[0]?.price ?? null;
    const liveSnapshot = {
      customerId,
      subscriptionId: liveSubscription?.id ?? null,
      status: liveSubscription?.status ?? null,
      priceId: livePrice?.id ?? null,
      recurringPriceCents:
        typeof livePrice?.unit_amount === "number" && Number.isFinite(livePrice.unit_amount)
          ? livePrice.unit_amount
          : null,
      currentPeriodEnd:
        typeof liveSubscription?.current_period_end === "number"
          ? new Date(liveSubscription.current_period_end * 1000).toISOString()
          : null,
    };

    if (isActivePaidProfile(profile) && !currentContract) {
      findings.push({
        code: "missing_active_contract",
        severity: "critical",
        message: "Active paid billing profile is missing a current contract row.",
      });
    }

    if (
      currentContract &&
      profile.plan_id &&
      currentContract.plan_id &&
      currentContract.plan_id !== profile.plan_id
    ) {
      findings.push({
        code: "plan_mismatch",
        severity: "warning",
        message: `billing_profiles.plan_id=${profile.plan_id} but contract.plan_id=${currentContract.plan_id}.`,
      });
    }

    if (customerId && subscriptionId && !liveSubscription) {
      findings.push({
        code: "stripe_subscription_not_found",
        severity: "critical",
        message: "Local Stripe references exist but no live Stripe subscription was found.",
      });
    }

    if (
      currentContract &&
      liveSnapshot.subscriptionId &&
      currentContract.stripe_subscription_id &&
      currentContract.stripe_subscription_id !== liveSnapshot.subscriptionId
    ) {
      findings.push({
        code: "stripe_subscription_id_mismatch",
        severity: "critical",
        message: `contract subscription id ${currentContract.stripe_subscription_id} differs from live Stripe subscription ${liveSnapshot.subscriptionId}.`,
      });
    }

    if (
      currentContract &&
      liveSnapshot.priceId &&
      currentContract.stripe_price_id &&
      currentContract.stripe_price_id !== liveSnapshot.priceId
    ) {
      findings.push({
        code: "stripe_price_id_mismatch",
        severity: "critical",
        message: `contract stripe price ${currentContract.stripe_price_id} differs from live Stripe price ${liveSnapshot.priceId}.`,
      });
    }

    if (
      currentContract &&
      liveSnapshot.recurringPriceCents != null &&
      asCents(currentContract.recurring_price_cents) != null &&
      asCents(currentContract.recurring_price_cents) !== liveSnapshot.recurringPriceCents
    ) {
      findings.push({
        code: "stripe_amount_mismatch",
        severity: "critical",
        message: `contract recurring amount ${asCents(currentContract.recurring_price_cents)} differs from live Stripe amount ${liveSnapshot.recurringPriceCents}.`,
      });
    }

    if (
      currentContract &&
      liveSnapshot.priceId &&
      currentContract.stripe_price_id &&
      currentContract.stripe_price_id === liveSnapshot.priceId &&
      asCents(currentContract.recurring_price_cents) === liveSnapshot.recurringPriceCents
    ) {
      findings.push({
        code: "stripe_contract_aligned",
        severity: "info",
        message: "Current contract matches live Stripe subscription pricing.",
      });
    }

    rows.push({
      userId: profile.user_id,
      billingProfile: profile,
      currentContract,
      liveStripeSubscription: liveSnapshot,
      findings,
    });
  }

  const summary = {
    scanned: rows.length,
    critical: rows.flatMap((row) => row.findings).filter((finding) => finding.severity === "critical")
      .length,
    warning: rows.flatMap((row) => row.findings).filter((finding) => finding.severity === "warning")
      .length,
    info: rows.flatMap((row) => row.findings).filter((finding) => finding.severity === "info").length,
  };

  if (args.json) {
    console.log(JSON.stringify({ summary, rows }, null, 2));
  } else {
    console.log(
      `[billing-contract-verify] scanned=${summary.scanned} critical=${summary.critical} warning=${summary.warning} info=${summary.info}`
    );
    for (const row of rows) {
      console.log(
        `[billing-contract-verify] user=${row.userId} profile_plan=${row.billingProfile?.plan_id ?? "—"} contract_plan=${row.currentContract?.plan_id ?? "—"} contract_price=${asCents(row.currentContract?.recurring_price_cents) ?? "—"} stripe_price=${row.liveStripeSubscription.recurringPriceCents ?? "—"} findings=${row.findings.map((finding) => finding.code).join(",") || "none"}`
      );
    }
  }

  if (args.strict && (summary.critical > 0 || summary.warning > 0)) {
    throw new Error("Strict verification failed due to billing/Stripe drift findings.");
  }
};

main().catch((error) => {
  console.error(
    `[billing-contract-verify] error=${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
