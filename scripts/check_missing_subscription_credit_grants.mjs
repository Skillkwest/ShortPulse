#!/usr/bin/env node

/**
 * Read-only reconciliation for paid Stripe subscription invoices and local
 * recurring credit grants. This proves the paid-invoice -> credit-ledger
 * invariant without replaying events or mutating billing state.
 */

import { loadLocalEnv } from "./lib/load_local_env.mjs";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 250;
const DEFAULT_DAYS = 45;
const MAX_DAYS = 370;
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const SUPABASE_REST_PREFIX = "/rest/v1";
const ALLOCATION_BILLING_REASONS = new Set([
  "subscription_create",
  "subscription_cycle",
  "subscription_update",
]);
const IMMEDIATE_PAID_UPGRADE_METADATA_VALUE = "immediate_paid_upgrade";
const ACTIVE_PAID_PROFILE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

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

const asPositiveInt = (value, fallback, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
};

const usage = () => {
  console.log(`Usage:
  node scripts/check_missing_subscription_credit_grants.mjs [options]

Options:
  --user-id <uuid>         Reconcile one user only.
  --limit <n>              Max billing profiles to inspect (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).
  --days <n>               Look back this many days for paid Stripe invoices (default ${DEFAULT_DAYS}, max ${MAX_DAYS}).
  --json                   Emit raw JSON results.
  --strict                 Exit non-zero on warnings as well as missing paid invoice grants.
  --env-file <path>        Optional env file path (repeatable). Parsed by shared loader.
  --help                   Show this message.
`);
};

const parseArgs = (argv) => ({
  userId: readSingleArg(argv, ["--user-id"])?.trim() || null,
  limit: asPositiveInt(
    readSingleArg(argv, ["--limit"]),
    DEFAULT_LIMIT,
    MAX_LIMIT,
  ),
  days: asPositiveInt(readSingleArg(argv, ["--days"]), DEFAULT_DAYS, MAX_DAYS),
  json: hasFlag(argv, ["--json"]),
  strict: hasFlag(argv, ["--strict"]),
  help: hasFlag(argv, ["--help", "-h"]),
});

const redactSensitiveDiagnostics = (value) =>
  String(value ?? "")
    .replace(/(STRIPE_SECRET_KEY=)[^\s]+/gi, "$1[redacted]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY=)[^\s]+/gi, "$1[redacted]")
    .replace(
      /(SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY=)[^\s]+/gi,
      "$1[redacted]",
    );

const resolveSupabaseConfig = () => {
  const baseUrl =
    process.env.SHORTPULSE_PRODUCTION_SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    "";
  const serviceRoleKey =
    process.env.SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    "";
  if (!baseUrl || !serviceRoleKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    serviceRoleKey,
  };
};

const buildQuery = (query) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    params.set(key, String(value));
  }
  return params.toString();
};

const supabaseSelect = async (config, table, query) => {
  const response = await fetch(
    `${config.baseUrl}${SUPABASE_REST_PREFIX}/${table}?${buildQuery(query)}`,
    {
      method: "GET",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
    },
  );
  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(
      payload?.message || `${table} select failed (${response.status})`,
    );
  }
  return Array.isArray(payload) ? payload : [];
};

const stripeGet = async (secretKey, path, query = {}) => {
  const response = await fetch(
    `${STRIPE_API_BASE}${path}?${buildQuery(query)}`,
    {
      headers: {
        authorization: `Bearer ${secretKey}`,
      },
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Stripe request failed (${response.status})`,
    );
  }
  return payload;
};

const asCents = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asUnixSeconds = (value) => {
  const parsed = Date.parse(String(value ?? ""));
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed / 1000);
};

const isStripeBackedPaidContract = (contract) =>
  contract?.contract_source === "stripe" &&
  contract?.plan_id &&
  contract.plan_id !== "free" &&
  Number(contract.monthly_credits_cents ?? 0) > 0 &&
  (contract.stripe_customer_id || contract.stripe_subscription_id);

const isActivePaidProfile = (profile) =>
  profile?.plan_id &&
  profile.plan_id !== "free" &&
  ACTIVE_PAID_PROFILE_STATUSES.has(
    String(profile.subscription_status ?? "").toLowerCase(),
  ) &&
  (profile.stripe_customer_id || profile.stripe_subscription_id);

const sourceRefForInvoice = (invoiceId) =>
  `invoice:${invoiceId}:monthly_allocation`;

const readInvoiceMetadata = (invoice) => ({
  ...((invoice?.metadata && typeof invoice.metadata === "object"
    ? invoice.metadata
    : {}) ?? {}),
  ...((invoice?.subscription_details?.metadata &&
  typeof invoice.subscription_details.metadata === "object"
    ? invoice.subscription_details.metadata
    : {}) ?? {}),
});

const isImmediatePaidUpgradeInvoice = (invoice) =>
  String(readInvoiceMetadata(invoice).shortpulse_plan_change_kind ?? "") ===
  IMMEDIATE_PAID_UPGRADE_METADATA_VALUE;

const resolveInvoiceOfferFromMetadata = (invoice, offerById) => {
  if (!isImmediatePaidUpgradeInvoice(invoice)) return null;
  const metadata = readInvoiceMetadata(invoice);
  const offerId =
    typeof metadata.billing_offer_id === "string" &&
    metadata.billing_offer_id.length > 0
      ? metadata.billing_offer_id
      : null;
  if (!offerId) return null;
  const offer = offerById.get(offerId) ?? null;
  const expectedPlanId =
    typeof metadata.billing_plan_id === "string" &&
    metadata.billing_plan_id.length > 0
      ? metadata.billing_plan_id
      : null;
  if (offer && expectedPlanId && offer.plan_id !== expectedPlanId) return null;
  return offer;
};

const extractInvoicePriceId = (invoice, offerById = new Map()) => {
  const invoiceOffer = resolveInvoiceOfferFromMetadata(invoice, offerById);
  if (typeof invoiceOffer?.stripe_price_id === "string") {
    return invoiceOffer.stripe_price_id;
  }
  if (
    isImmediatePaidUpgradeInvoice(invoice) &&
    typeof readInvoiceMetadata(invoice).billing_offer_id === "string"
  ) {
    return null;
  }

  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  for (const line of lines) {
    const priceId =
      (typeof line?.pricing?.price_details?.price === "string"
        ? line.pricing.price_details.price
        : null) ??
      (typeof line?.price?.id === "string" ? line.price.id : null) ??
      (typeof line?.plan?.id === "string" ? line.plan.id : null);
    if (priceId) return priceId;
  }
  return null;
};

const invoiceMatchesStripePrice = (
  invoice,
  stripePriceId,
  offerById = new Map(),
) =>
  Boolean(
    stripePriceId &&
    extractInvoicePriceId(invoice, offerById) === stripePriceId,
  );

const extractLedgerInvoiceId = (row) => {
  const metadata =
    row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  if (
    typeof metadata.invoice_id === "string" &&
    metadata.invoice_id.length > 0
  ) {
    return metadata.invoice_id;
  }
  if (typeof row?.source_ref === "string") {
    return (
      row.source_ref.match(/^invoice:([^:]+):monthly_allocation$/)?.[1] ?? null
    );
  }
  return null;
};

const fetchPaidAllocationInvoices = async ({
  secretKey,
  customerId,
  createdGte,
}) => {
  if (!customerId) return [];
  const payload = await stripeGet(secretKey, "/invoices", {
    customer: customerId,
    limit: 100,
    "created[gte]": createdGte,
  });
  return (Array.isArray(payload.data) ? payload.data : []).filter((invoice) => {
    const billingReason = String(invoice.billing_reason ?? "").toLowerCase();
    const amountPaid = Number(invoice.amount_paid ?? 0);
    if (
      billingReason === "subscription_update" &&
      !isImmediatePaidUpgradeInvoice(invoice)
    ) {
      return false;
    }
    return (
      ALLOCATION_BILLING_REASONS.has(billingReason) &&
      (amountPaid > 0 || invoice.paid === true || invoice.status === "paid")
    );
  });
};

const buildRows = async ({ args, supabaseConfig, stripeSecretKey }) => {
  const [profiles, contracts, offers] = await Promise.all([
    supabaseSelect(
      supabaseConfig,
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
          },
    ),
    supabaseSelect(
      supabaseConfig,
      "billing_subscription_contracts",
      args.userId
        ? {
            select:
              "id,user_id,plan_id,offer_id,billing_interval,contract_source,stripe_customer_id,stripe_subscription_id,stripe_price_id,monthly_credits_cents,status,started_at,ended_at",
            user_id: `eq.${args.userId}`,
            ended_at: "is.null",
            order: "started_at.desc",
            limit: args.limit,
          }
        : {
            select:
              "id,user_id,plan_id,offer_id,billing_interval,contract_source,stripe_customer_id,stripe_subscription_id,stripe_price_id,monthly_credits_cents,status,started_at,ended_at",
            contract_source: "eq.stripe",
            ended_at: "is.null",
            order: "started_at.desc",
            limit: args.limit,
          },
    ),
    supabaseSelect(supabaseConfig, "billing_plan_offers", {
      select:
        "id,plan_id,billing_interval,stripe_price_id,monthly_credits_cents",
      stripe_price_id: "not.is.null",
      limit: 1000,
    }),
  ]);
  const offerByStripePriceId = new Map(
    offers
      .filter((offer) => typeof offer.stripe_price_id === "string")
      .map((offer) => [offer.stripe_price_id, offer]),
  );
  const offerById = new Map(
    offers
      .filter((offer) => typeof offer.id === "string")
      .map((offer) => [offer.id, offer]),
  );
  const profileByUser = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );
  const paidContracts = contracts.filter(isStripeBackedPaidContract);
  const subjectsByUser = new Map();
  for (const contract of paidContracts) {
    const profile = profileByUser.get(contract.user_id) ?? null;
    subjectsByUser.set(contract.user_id, {
      source: "contract",
      userId: contract.user_id,
      contractId: contract.id,
      planId: contract.plan_id ?? profile?.plan_id ?? null,
      offerId: contract.offer_id ?? null,
      billingInterval: contract.billing_interval ?? null,
      stripeCustomerId:
        contract.stripe_customer_id ?? profile?.stripe_customer_id ?? null,
      stripeSubscriptionId:
        contract.stripe_subscription_id ??
        profile?.stripe_subscription_id ??
        null,
      stripePriceId: contract.stripe_price_id ?? null,
      expectedCreditsCents: asCents(contract.monthly_credits_cents),
      contractStartedAt: contract.started_at ?? null,
      missingContract: false,
    });
  }
  for (const profile of profiles.filter(isActivePaidProfile)) {
    if (subjectsByUser.has(profile.user_id)) continue;
    subjectsByUser.set(profile.user_id, {
      source: "profile",
      userId: profile.user_id,
      contractId: null,
      planId: profile.plan_id ?? null,
      offerId: null,
      billingInterval: null,
      stripeCustomerId: profile.stripe_customer_id ?? null,
      stripeSubscriptionId: profile.stripe_subscription_id ?? null,
      stripePriceId: null,
      expectedCreditsCents: null,
      contractStartedAt: null,
      missingContract: true,
    });
  }
  const subjects = [...subjectsByUser.values()];
  const userIds = [...new Set(subjects.map((subject) => subject.userId))];

  let ledgerRows = [];
  let grantRows = [];
  if (userIds.length > 0) {
    ledgerRows = await supabaseSelect(supabaseConfig, "ai_credit_ledger", {
      select: "id,user_id,source,source_ref,change_cents,metadata,created_at",
      user_id: `in.(${userIds.join(",")})`,
      source: "eq.subscription_renewal",
      order: "created_at.desc",
      limit: 1000,
    });
    grantRows = await supabaseSelect(supabaseConfig, "ai_credit_grants", {
      select:
        "id,user_id,ledger_id,source,source_ref,credit_kind,granted_cents,remaining_cents,metadata,created_at",
      user_id: `in.(${userIds.join(",")})`,
      source: "eq.subscription_renewal",
      order: "created_at.desc",
      limit: 1000,
    });
  }

  const ledgerByUserAndInvoice = new Map();
  for (const row of ledgerRows) {
    const invoiceId = extractLedgerInvoiceId(row);
    if (!invoiceId) continue;
    ledgerByUserAndInvoice.set(`${row.user_id}:${invoiceId}`, row);
  }
  const grantsByUserAndInvoice = new Map();
  for (const row of grantRows) {
    const invoiceId = extractLedgerInvoiceId(row);
    if (!invoiceId) continue;
    const key = `${row.user_id}:${invoiceId}`;
    const existing = grantsByUserAndInvoice.get(key) ?? [];
    existing.push(row);
    grantsByUserAndInvoice.set(key, existing);
  }

  const createdGte = Math.floor(
    (Date.now() - args.days * 24 * 60 * 60 * 1000) / 1000,
  );
  const rows = [];
  for (const subject of subjects) {
    let invoices = [];
    let stripeLookupError = null;
    if (!subject.stripeCustomerId) {
      stripeLookupError =
        "No Stripe customer id is available for invoice reconciliation.";
    } else {
      try {
        invoices = await fetchPaidAllocationInvoices({
          secretKey: stripeSecretKey,
          customerId: subject.stripeCustomerId,
          createdGte,
        });
      } catch (error) {
        stripeLookupError =
          error instanceof Error
            ? error.message
            : "Stripe invoice lookup failed.";
      }
    }

    if (stripeLookupError) {
      rows.push({
        userId: subject.userId,
        contractId: subject.contractId,
        stripeCustomerId: subject.stripeCustomerId,
        stripeSubscriptionId: subject.stripeSubscriptionId,
        invoiceId: null,
        billingReason: null,
        expectedCreditsCents: subject.expectedCreditsCents,
        sourceRef: null,
        status: "stripe_lookup_failed",
        severity: "warning",
        message: stripeLookupError,
        recommendedAction:
          "Resolve Stripe lookup before deciding whether recurring credits are missing.",
      });
      continue;
    }

    for (const invoice of invoices) {
      const invoiceId = typeof invoice.id === "string" ? invoice.id : null;
      if (!invoiceId) continue;
      const key = `${subject.userId}:${invoiceId}`;
      const ledger = ledgerByUserAndInvoice.get(key) ?? null;
      const grants = grantsByUserAndInvoice.get(key) ?? [];
      const sourceRef = sourceRefForInvoice(invoiceId);
      const hasLedger = Boolean(ledger);
      const hasGrant = grants.length > 0;
      const invoiceStripePriceId = extractInvoicePriceId(invoice, offerById);
      const invoiceOffer = invoiceStripePriceId
        ? (offerByStripePriceId.get(invoiceStripePriceId) ?? null)
        : null;
      const invoiceExpectedCreditsCents =
        asCents(invoiceOffer?.monthly_credits_cents) ??
        subject.expectedCreditsCents;
      const ledgerCreditsCents = asCents(ledger?.change_cents);
      const grantedCreditsCents = grants.reduce(
        (sum, grant) => sum + Number(grant.granted_cents ?? 0),
        0,
      );
      const hasAmountMismatch =
        invoiceExpectedCreditsCents != null &&
        ((hasLedger && ledgerCreditsCents !== invoiceExpectedCreditsCents) ||
          (hasGrant && grantedCreditsCents !== invoiceExpectedCreditsCents));
      const matched = hasLedger && hasGrant && !hasAmountMismatch;
      rows.push({
        userId: subject.userId,
        contractId: subject.contractId,
        planId: invoiceOffer?.plan_id ?? subject.planId,
        offerId: invoiceOffer?.id ?? subject.offerId,
        billingInterval:
          invoiceOffer?.billing_interval ?? subject.billingInterval,
        stripeCustomerId: subject.stripeCustomerId,
        stripeSubscriptionId: subject.stripeSubscriptionId,
        stripePriceId: invoiceStripePriceId ?? subject.stripePriceId,
        invoiceId,
        billingReason: invoice.billing_reason ?? null,
        invoiceStatus: invoice.status ?? null,
        amountPaidCents: asCents(invoice.amount_paid),
        expectedCreditsCents: invoiceExpectedCreditsCents,
        ledgerCreditsCents,
        grantedCreditsCents: hasGrant ? grantedCreditsCents : null,
        sourceRef,
        ledgerId: ledger?.id ?? null,
        grantIds: grants.map((grant) => grant.id),
        missingContract: subject.missingContract,
        status: matched
          ? "matched"
          : hasAmountMismatch
            ? "credit_amount_mismatch"
            : "missing_credit_grant",
        severity: matched ? "info" : "critical",
        message: matched
          ? "Paid allocation invoice has matching local ledger and grant rows."
          : hasAmountMismatch
            ? "Paid allocation invoice has local credit rows, but the granted amount does not match the invoice-time plan allocation."
            : "Paid allocation invoice is missing a matching local recurring credit grant.",
        recommendedAction: matched
          ? "No action required."
          : hasAmountMismatch
            ? "Inspect invoice line pricing, local ledger/grant rows, and the Stripe webhook grant metadata before considering any repair."
            : "Inspect the Stripe invoice and local credit rows, then replay the Stripe invoice.payment_succeeded event before considering any manual adjustment.",
      });
    }

    if (
      subject.source === "contract" &&
      subject.stripePriceId &&
      asUnixSeconds(subject.contractStartedAt) != null &&
      asUnixSeconds(subject.contractStartedAt) >= createdGte &&
      !invoices.some((invoice) =>
        invoiceMatchesStripePrice(invoice, subject.stripePriceId, offerById),
      )
    ) {
      rows.push({
        userId: subject.userId,
        contractId: subject.contractId,
        planId: subject.planId,
        offerId: subject.offerId,
        billingInterval: subject.billingInterval,
        stripeCustomerId: subject.stripeCustomerId,
        stripeSubscriptionId: subject.stripeSubscriptionId,
        stripePriceId: subject.stripePriceId,
        invoiceId: null,
        billingReason: null,
        invoiceStatus: null,
        amountPaidCents: null,
        expectedCreditsCents: subject.expectedCreditsCents,
        sourceRef: null,
        ledgerId: null,
        grantIds: [],
        missingContract: false,
        status: "current_contract_invoice_not_found",
        severity: "warning",
        message:
          "Current Stripe contract started within the lookback window, but no paid allocation invoice for its Stripe price was found.",
        recommendedAction:
          "Inspect Stripe subscription history for an upgrade that changed local entitlement without an immediate paid invoice.",
      });
    }
  }
  return rows;
};

const printResults = ({ rows, args, loadedEnvFiles }) => {
  const summary = {
    scanned: rows.length,
    matched: rows.filter((row) => row.status === "matched").length,
    missing: rows.filter((row) => row.status === "missing_credit_grant").length,
    amountMismatches: rows.filter(
      (row) => row.status === "credit_amount_mismatch",
    ).length,
    warnings: rows.filter((row) => row.severity === "warning").length,
  };
  const payload = { summary, rows, loadedEnvFiles };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  for (const row of rows) {
    const label =
      row.severity === "critical"
        ? "FAIL"
        : row.severity === "warning"
          ? "WARN"
          : "PASS";
    console.log(
      `[subscription-credit-grants] ${label} ${row.userId} ${row.invoiceId ?? row.status}: ${row.message}`,
    );
    if (row.recommendedAction) {
      console.log(`  ${row.recommendedAction}`);
    }
  }
  console.log(
    `[subscription-credit-grants] summary scanned=${summary.scanned} matched=${summary.matched} missing=${summary.missing} amount_mismatches=${summary.amountMismatches} warnings=${summary.warnings} loaded_env_files=${loadedEnvFiles}`,
  );
};

const main = async () => {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const loadedEnvFiles = loadLocalEnv({
    argv,
    defaultPaths: [".env.agent.local", ".env.local", "frontend/.env.local"],
  }).length;
  if (args.help) {
    usage();
    return;
  }

  const supabaseConfig = resolveSupabaseConfig();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!supabaseConfig) {
    throw new Error(
      "Missing Supabase REST credentials. Expected SHORTPULSE_PRODUCTION_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const rows = await buildRows({ args, supabaseConfig, stripeSecretKey });
  printResults({ rows, args, loadedEnvFiles });

  const hasFailures = rows.some(
    (row) =>
      row.status === "missing_credit_grant" ||
      row.status === "credit_amount_mismatch",
  );
  if (
    hasFailures ||
    (args.strict && rows.some((row) => row.severity === "warning"))
  ) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(
    `[subscription-credit-grants] error=${redactSensitiveDiagnostics(
      error instanceof Error ? error.message : error,
    )}`,
  );
  process.exit(1);
});
