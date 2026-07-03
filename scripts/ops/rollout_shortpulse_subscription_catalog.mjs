#!/usr/bin/env node

/**
 * Creates or updates the real ShortPulse paid subscription ladder in Stripe and Supabase.
 *
 * Required env:
 * - STRIPE_SECRET_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 * - DRY_RUN=1
 */

const GIB = 1024 * 1024 * 1024;
const NOW_ISO = new Date().toISOString();
const DRY_RUN =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const CUTOVER_TAG =
  process.env.SHORTPULSE_PRICING_CUTOVER_TAG || "shortpulse_pricing_20260509";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const PAID_PLAN_BLUEPRINT = [
  {
    id: "starter",
    displayName: "Starter",
    monthlyPriceCents: 1500,
    annualPriceCents: 18000,
    monthlyCreditsCents: 350,
    storageLimitBytes: 1 * GIB,
    sortOrder: 10,
    createStripeProduct: true,
    acquisitionEnabled: true,
  },
  {
    id: "media",
    displayName: "Media",
    monthlyPriceCents: 4900,
    annualPriceCents: 58800,
    monthlyCreditsCents: 1200,
    storageLimitBytes: 25 * GIB,
    sortOrder: 20,
    createStripeProduct: false,
    acquisitionEnabled: true,
  },
  {
    id: "studio",
    displayName: "Studio",
    monthlyPriceCents: 12900,
    annualPriceCents: 118800,
    monthlyCreditsCents: 3200,
    storageLimitBytes: 100 * GIB,
    sortOrder: 30,
    createStripeProduct: false,
    acquisitionEnabled: true,
  },
  {
    id: "business",
    displayName: "Business",
    monthlyPriceCents: 29900,
    annualPriceCents: 274800,
    monthlyCreditsCents: 7500,
    storageLimitBytes: 500 * GIB,
    sortOrder: 40,
    createStripeProduct: false,
    acquisitionEnabled: true,
  },
];

const assertRequiredEnv = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for catalog rollout.",
    );
  }
  if (!DRY_RUN && !STRIPE_SECRET_KEY.startsWith("sk_live_")) {
    throw new Error(
      "A live STRIPE_SECRET_KEY is required for a non-dry-run catalog rollout.",
    );
  }
};

const logStep = (message) => {
  process.stdout.write(`${message}\n`);
};

const toSupabaseUrl = (path) =>
  `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1${path}`;

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const stripeHeaders = {
  Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
  "Content-Type": "application/x-www-form-urlencoded",
};

const toFormBody = (payload) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    params.append(key, String(value));
  }
  return params;
};

const supabaseGet = async (path) => {
  const response = await fetch(toSupabaseUrl(path), {
    headers: supabaseHeaders,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Supabase GET failed: ${path}`,
    );
  }
  return data;
};

const supabasePatch = async (path, body) => {
  if (DRY_RUN) return [];
  const response = await fetch(toSupabaseUrl(path), {
    method: "PATCH",
    headers: supabaseHeaders,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Supabase PATCH failed: ${path}`,
    );
  }
  return data;
};

const supabasePost = async (path, body, options = {}) => {
  if (DRY_RUN) return [];
  const response = await fetch(toSupabaseUrl(path), {
    method: "POST",
    headers: {
      ...supabaseHeaders,
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Supabase POST failed: ${path}`,
    );
  }
  return data;
};

const stripePost = async (path, payload) => {
  if (DRY_RUN) {
    return {
      id: `dryrun_${path.replace(/[^\w]+/g, "_")}_${Date.now()}`,
    };
  }
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: stripeHeaders,
    body: toFormBody(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe POST failed: ${path}`);
  }
  return data;
};

const fetchPlanRows = async () => {
  const rows = await supabaseGet(
    "/billing_plans?select=id,display_name,monthly_price_cents,monthly_credits_cents,storage_limit_bytes,stripe_product_id,stripe_price_id,sort_order,is_active",
  );
  return new Map(rows.map((row) => [row.id, row]));
};

const upsertPlanMetadata = async ({ plan, stripeProductId, stripePriceId }) => {
  logStep(`Sync billing_plans.${plan.id}`);
  return supabasePost(
    "/billing_plans?on_conflict=id",
    {
      id: plan.id,
      display_name: plan.displayName,
      monthly_price_cents: plan.monthlyPriceCents,
      monthly_credits_cents: plan.monthlyCreditsCents,
      storage_limit_bytes: plan.storageLimitBytes,
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
      sort_order: plan.sortOrder,
      is_active: true,
    },
    { prefer: "resolution=merge-duplicates,return=representation" },
  );
};

const hardenBaselineAccessSentinel = async () => {
  logStep("Harden baseline access sentinel to zero value");
  return supabasePatch("/billing_plans?id=eq.free", {
    display_name: "Baseline access",
    monthly_price_cents: 0,
    monthly_credits_cents: 0,
    storage_limit_bytes: 0,
    stripe_product_id: null,
    stripe_price_id: null,
    sort_order: 0,
    is_active: true,
  });
};

const deactivateBaselineAccessAcquisitionOffers = async () => {
  logStep(
    "Disable baseline access acquisition offers so Starter remains the first public tier",
  );
  return supabasePatch(
    "/billing_plan_offers?plan_id=eq.free&acquisition_enabled=eq.true&is_active=eq.true&effective_end_at=is.null",
    {
      acquisition_enabled: false,
      effective_end_at: NOW_ISO,
      updated_at: NOW_ISO,
    },
  );
};

const activatePlanOffer = async ({
  plan,
  billingInterval,
  recurringPriceCents,
  stripePriceId,
}) => {
  const offerId =
    billingInterval === "month"
      ? `${plan.id}__month__${CUTOVER_TAG}`
      : `${plan.id}__year__${CUTOVER_TAG}`;
  const offerName =
    billingInterval === "month"
      ? `${plan.displayName} ${CUTOVER_TAG} monthly`
      : `${plan.displayName} ${CUTOVER_TAG} annual`;

  logStep(`Activate ${billingInterval} offer for ${plan.id}`);
  return supabasePost("/rpc/activate_billing_plan_offer", {
    p_offer_id: offerId,
    p_plan_id: plan.id,
    p_offer_name: offerName,
    p_billing_interval: billingInterval,
    p_recurring_price_cents: recurringPriceCents,
    p_monthly_credits_cents: plan.monthlyCreditsCents,
    p_storage_limit_bytes: plan.storageLimitBytes,
    p_stripe_price_id: stripePriceId,
    p_expected_current_offer_id: null,
    p_expected_current_offer_absent: false,
  });
};

const createPlanProduct = async (plan) => {
  logStep(`Create Stripe product for ${plan.id}`);
  const product = await stripePost("/products", {
    name: `Plan - ${plan.displayName}`,
    "metadata[shortpulse_catalog_type]": "plan",
    "metadata[shortpulse_plan_id]": plan.id,
    "metadata[shortpulse_display_name]": plan.displayName,
  });
  return product.id;
};

const createRecurringPrice = async ({
  plan,
  stripeProductId,
  interval,
  amountCents,
}) => {
  logStep(`Create Stripe ${interval} price for ${plan.id}`);
  const price = await stripePost("/prices", {
    product: stripeProductId,
    currency: "usd",
    unit_amount: amountCents,
    "recurring[interval]": interval,
    "metadata[shortpulse_catalog_type]": "plan",
    "metadata[shortpulse_plan_id]": plan.id,
    "metadata[shortpulse_display_name]": plan.displayName,
    "metadata[shortpulse_billing_interval]": interval,
    "metadata[shortpulse_cutover_tag]": CUTOVER_TAG,
  });
  return price.id;
};

const run = async () => {
  assertRequiredEnv();

  const existingPlans = await fetchPlanRows();
  const summary = [];

  await hardenBaselineAccessSentinel();
  await deactivateBaselineAccessAcquisitionOffers();

  for (const plan of PAID_PLAN_BLUEPRINT) {
    const existingPlan = existingPlans.get(plan.id) ?? null;
    let stripeProductId = existingPlan?.stripe_product_id ?? null;
    let monthlyStripePriceId = plan.monthlyPriceCents > 0 ? null : null;
    let annualStripePriceId = plan.annualPriceCents > 0 ? null : null;

    if (plan.createStripeProduct) {
      stripeProductId = stripeProductId ?? (await createPlanProduct(plan));
    }

    if (!stripeProductId) {
      throw new Error(
        `Plan ${plan.id} is missing stripe_product_id and cannot be repriced.`,
      );
    }
    monthlyStripePriceId = await createRecurringPrice({
      plan,
      stripeProductId,
      interval: "month",
      amountCents: plan.monthlyPriceCents,
    });
    annualStripePriceId = await createRecurringPrice({
      plan,
      stripeProductId,
      interval: "year",
      amountCents: plan.annualPriceCents,
    });

    await upsertPlanMetadata({
      plan,
      stripeProductId,
      stripePriceId: monthlyStripePriceId,
    });

    if (plan.acquisitionEnabled) {
      await activatePlanOffer({
        plan,
        billingInterval: "month",
        recurringPriceCents: plan.monthlyPriceCents,
        stripePriceId: monthlyStripePriceId,
      });
      await activatePlanOffer({
        plan,
        billingInterval: "year",
        recurringPriceCents: plan.annualPriceCents,
        stripePriceId: annualStripePriceId,
      });
    }

    summary.push({
      planId: plan.id,
      stripeProductId,
      monthlyStripePriceId,
      annualStripePriceId,
    });
  }

  logStep("");
  logStep("ShortPulse subscription catalog rollout summary");
  logStep(
    JSON.stringify(
      { dryRun: DRY_RUN, cutoverTag: CUTOVER_TAG, summary },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
