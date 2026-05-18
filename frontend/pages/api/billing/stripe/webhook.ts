/**
 * Stripe webhook endpoint (signature-verified, idempotent).
 * Applies credit grants and subscription state updates to Supabase.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException, writeAppErrorLog } from "../../../../lib/server/api/appErrorLogs";
import {
  addMonthsUtc,
  BILLING_INTERVAL_MONTH,
  BILLING_INTERVAL_YEAR,
  buildAnnualContractMonthlyGrantRef,
} from "../../../../lib/server/api/billingContracts";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { verifyStripeWebhookSignature } from "../../../../lib/server/api/stripe";
import { insertCreditLedgerEntry } from "../../../../lib/server/api/creditLedger";
import {
  readRawRequestBody,
  RequestBodyTooLargeError,
} from "../../../../lib/server/api/requestBody";

type StripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

type JsonObject = Record<string, unknown>;
type EventClaimResult =
  | { kind: "claimed" }
  | { kind: "duplicate" }
  | { kind: "failed"; message: string };

type ResolvedOffer = {
  offerId: string | null;
  planId: string | null;
  billingInterval: "month" | "year";
  stripePriceId: string | null;
  recurringPriceCents: number;
  monthlyCreditsCents: number;
  storageLimitBytes: number;
};

type ResolvedStorageAddonOffer = {
  storageAddonId: string | null;
  offerId: string | null;
  stripePriceId: string | null;
  storageLimitBytes: number;
  recurringPriceCents: number;
};

type BillingProfileProjection = {
  user_id: string | null;
  plan_id: string | null;
};

type BillingContractProjection = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  billing_interval: "month" | "year" | null;
  stripe_price_id: string | null;
  stripe_subscription_id: string | null;
  recurring_price_cents: number | null;
  monthly_credits_cents: number | null;
  storage_limit_bytes: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  last_credit_grant_at: string | null;
  next_credit_grant_at: string | null;
  status: string | null;
};

type BillingStorageAddonContractProjection = {
  id: string;
  storage_addon_id: string | null;
  offer_id: string | null;
  stripe_subscription_item_id: string | null;
  stripe_price_id: string | null;
  storage_limit_bytes: number | null;
  quantity: number | null;
  recurring_price_cents: number | null;
  status: string | null;
};

const SUBSCRIPTION_CREDIT_GRANT_BILLING_REASONS = new Set([
  "subscription_create",
  "subscription_cycle",
]);

export const config = {
  api: {
    bodyParser: false,
  },
};

const STRIPE_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

const asIsoDate = (unixSeconds?: number | null): string | null => {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
};

const asDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toRecord = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const isDuplicateEventInsertError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "23505";
};

const isDuplicateLedgerSourceRefError = (error: { message?: string; code?: string } | null) => {
  if (!error) return false;
  if (error.code === "23505") return true;
  const message = String(error.message ?? "");
  return /duplicate key value violates unique constraint/i.test(message);
};

const isIgnorableSchemaDriftError = (error: { message?: string; code?: string } | null) => {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  const message = String(error.message ?? "");
  return /does not exist|schema cache/i.test(message);
};

const claimStripeEvent = async (event: StripeEvent): Promise<EventClaimResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("stripe_event_log").insert({
    id: event.id,
    event_type: event.type,
    payload: event as unknown as JsonObject,
  });
  if (!error) {
    return { kind: "claimed" };
  }
  if (isDuplicateEventInsertError(error)) {
    return { kind: "duplicate" };
  }
  return {
    kind: "failed",
    message: error.message || "Stripe event claim insert failed.",
  };
};

const resolvePlanIdFromSubscription = async (
  stripePriceId: string | undefined
): Promise<string | null> => {
  if (!stripePriceId) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("billing_plans")
    .select("id")
    .eq("stripe_price_id", stripePriceId)
    .maybeSingle();
  return data?.id ?? null;
};

const resolveOfferFromPriceId = async (
  stripePriceId: string | undefined,
  fallback?: { recurringPriceCents?: number; monthlyCreditsCents?: number }
): Promise<ResolvedOffer | null> => {
  if (!stripePriceId) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: offer, error: offerError } = await supabaseAdmin
    .from("billing_plan_offers")
    .select(
      "id, plan_id, billing_interval, stripe_price_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes"
    )
    .eq("stripe_price_id", stripePriceId)
    .maybeSingle();

  if (offer) {
    return {
      offerId: typeof offer.id === "string" ? offer.id : null,
      planId: typeof offer.plan_id === "string" ? offer.plan_id : null,
      billingInterval:
        offer.billing_interval === BILLING_INTERVAL_YEAR
          ? BILLING_INTERVAL_YEAR
          : BILLING_INTERVAL_MONTH,
      stripePriceId:
        typeof offer.stripe_price_id === "string" ? offer.stripe_price_id : stripePriceId,
      recurringPriceCents: Number(offer.recurring_price_cents ?? 0),
      monthlyCreditsCents: Number(offer.monthly_credits_cents ?? 0),
      storageLimitBytes: Number(offer.storage_limit_bytes ?? 0),
    };
  }

  if (offerError && !isIgnorableSchemaDriftError(offerError)) {
    throw new Error(offerError.message || "Failed to load billing plan offer.");
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from("billing_plans")
    .select("id, stripe_price_id, monthly_price_cents, monthly_credits_cents, storage_limit_bytes")
    .eq("stripe_price_id", stripePriceId)
    .maybeSingle();
  if (planError && !isIgnorableSchemaDriftError(planError)) {
    throw new Error(planError.message || "Failed to load billing plan.");
  }
  if (!plan) {
    const recurringPriceCents = Number(fallback?.recurringPriceCents ?? 0);
    const monthlyCreditsCents = Number(fallback?.monthlyCreditsCents ?? 0);
    return {
      offerId: null,
      planId: null,
      billingInterval: BILLING_INTERVAL_MONTH,
      stripePriceId,
      recurringPriceCents: Number.isFinite(recurringPriceCents) ? recurringPriceCents : 0,
      monthlyCreditsCents: Number.isFinite(monthlyCreditsCents) ? monthlyCreditsCents : 0,
      storageLimitBytes: 0,
    };
  }

  return {
    offerId: typeof plan.id === "string" ? `${plan.id}__current` : null,
    planId: typeof plan.id === "string" ? plan.id : null,
    billingInterval: BILLING_INTERVAL_MONTH,
    stripePriceId: typeof plan.stripe_price_id === "string" ? plan.stripe_price_id : stripePriceId,
    recurringPriceCents: Number(plan.monthly_price_cents ?? 0),
    monthlyCreditsCents: Number(plan.monthly_credits_cents ?? 0),
    storageLimitBytes: Number(plan.storage_limit_bytes ?? 0),
  };
};

const resolveStorageAddonOfferFromPriceId = async (
  stripePriceId: string | undefined,
  fallback?: { recurringPriceCents?: number }
): Promise<ResolvedStorageAddonOffer | null> => {
  if (!stripePriceId) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: offer, error: offerError } = await supabaseAdmin
    .from("billing_storage_addon_offers")
    .select("id, storage_addon_id, stripe_price_id, storage_limit_bytes, recurring_price_cents")
    .eq("stripe_price_id", stripePriceId)
    .maybeSingle();

  if (offer) {
    return {
      storageAddonId: typeof offer.storage_addon_id === "string" ? offer.storage_addon_id : null,
      offerId: typeof offer.id === "string" ? offer.id : null,
      stripePriceId:
        typeof offer.stripe_price_id === "string" ? offer.stripe_price_id : stripePriceId,
      storageLimitBytes: Number(offer.storage_limit_bytes ?? 0),
      recurringPriceCents: Number(offer.recurring_price_cents ?? 0),
    };
  }

  if (offerError && !isIgnorableSchemaDriftError(offerError)) {
    throw new Error(offerError.message || "Failed to load billing storage add-on offer.");
  }

  const { data: addon, error: addonError } = await supabaseAdmin
    .from("billing_storage_addons")
    .select("id, stripe_price_id, storage_limit_bytes, monthly_price_cents")
    .eq("stripe_price_id", stripePriceId)
    .maybeSingle();
  if (addonError && !isIgnorableSchemaDriftError(addonError)) {
    throw new Error(addonError.message || "Failed to load billing storage add-on.");
  }
  if (!addon) {
    const recurringPriceCents = Number(fallback?.recurringPriceCents ?? 0);
    return {
      storageAddonId: null,
      offerId: null,
      stripePriceId,
      storageLimitBytes: 0,
      recurringPriceCents: Number.isFinite(recurringPriceCents) ? recurringPriceCents : 0,
    };
  }

  return {
    storageAddonId: typeof addon.id === "string" ? addon.id : null,
    offerId: typeof addon.id === "string" ? `${addon.id}__current` : null,
    stripePriceId:
      typeof addon.stripe_price_id === "string" ? addon.stripe_price_id : stripePriceId,
    storageLimitBytes: Number(addon.storage_limit_bytes ?? 0),
    recurringPriceCents: Number(addon.monthly_price_cents ?? 0),
  };
};

const normalizeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const normalizeBoolean = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

const isPaidPlanId = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0 && value !== "free";

const buildCheckoutGrantSourceRef = (session: JsonObject, fallbackEventId: string): string => {
  const sessionId = normalizeString(session.id);
  return sessionId ? `checkout_session:${sessionId}` : `checkout_event:${fallbackEventId}`;
};

const buildSubscriptionGrantSourceRef = (invoice: JsonObject, fallbackEventId: string): string => {
  const invoiceId = normalizeString(invoice.id);
  return invoiceId ? `invoice:${invoiceId}:monthly_allocation` : `invoice_event:${fallbackEventId}`;
};

const recordBillingTelemetrySafely = async (params: {
  source: "telemetry.billing.checkout_completed";
  message: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await writeAppErrorLog({
      source: params.source,
      scope: "app",
      severity: "low",
      message: params.message,
      userId: params.userId ?? null,
      metadata: {
        telemetry_family: "billing_funnel",
        telemetry_version: 1,
        event_name: params.message,
        ...(params.metadata ?? {}),
      },
    });
  } catch {
    // Webhook success must not depend on telemetry persistence.
  }
};

const resolveBillingProfileByCustomer = async (
  stripeCustomerId: string
): Promise<BillingProfileProjection | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_profiles")
    .select("user_id, plan_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || "Failed to load billing profile.");
  }
  return (data as BillingProfileProjection | null) ?? null;
};

const resolveCurrentContractForUser = async (
  userId: string
): Promise<BillingContractProjection | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_subscription_contracts")
    .select(
      "id, plan_id, offer_id, billing_interval, stripe_price_id, stripe_subscription_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, current_period_start, current_period_end, last_credit_grant_at, next_credit_grant_at, status"
    )
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isIgnorableSchemaDriftError(error)) return null;
    throw new Error(error.message || "Failed to load billing subscription contract.");
  }
  return (data as BillingContractProjection | null) ?? null;
};

const resolveCurrentStorageAddonContractsForUser = async (
  userId: string,
  stripeSubscriptionId: string | null
): Promise<BillingStorageAddonContractProjection[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("billing_subscription_storage_addons")
    .select(
      "id, storage_addon_id, offer_id, stripe_subscription_item_id, stripe_price_id, storage_limit_bytes, quantity, recurring_price_cents, status"
    )
    .eq("user_id", userId);

  if (stripeSubscriptionId) {
    query = query.eq("stripe_subscription_id", stripeSubscriptionId);
  }

  query = query.is("ended_at", null);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    if (isIgnorableSchemaDriftError(error)) return [];
    throw new Error(error.message || "Failed to load billing storage add-on contracts.");
  }
  return Array.isArray(data) ? (data as BillingStorageAddonContractProjection[]) : [];
};

const resolveCurrentBillingContextByCustomer = async (stripeCustomerId: string) => {
  const profile = await resolveBillingProfileByCustomer(stripeCustomerId);
  if (!profile?.user_id) return null;

  const contract = await resolveCurrentContractForUser(profile.user_id);
  if (contract) {
    return {
      contractId: contract.id,
      userId: profile.user_id,
      planId: contract.plan_id ?? profile.plan_id,
      offerId: contract.offer_id ?? null,
      billingInterval:
        contract.billing_interval === BILLING_INTERVAL_YEAR
          ? BILLING_INTERVAL_YEAR
          : BILLING_INTERVAL_MONTH,
      stripePriceId: contract.stripe_price_id ?? null,
      monthlyCreditsCents: Number(contract.monthly_credits_cents ?? 0),
      currentPeriodStart: contract.current_period_start ?? null,
      currentPeriodEnd: contract.current_period_end ?? null,
      nextCreditGrantAt: contract.next_credit_grant_at ?? null,
    };
  }
  if (isPaidPlanId(profile.plan_id)) {
    return null;
  }

  return null;
};

const resolveBillingContextFromInvoice = async (invoice: JsonObject, stripeCustomerId: string) => {
  const profile = await resolveBillingProfileByCustomer(stripeCustomerId);
  if (!profile?.user_id) return null;

  const lines = toRecord(invoice.lines);
  const lineData = Array.isArray(lines.data) ? lines.data : [];

  for (const lineValue of lineData) {
    const line = toRecord(lineValue);
    const directPrice = toRecord(line.price);
    const pricing = toRecord(line.pricing);
    const priceDetails = toRecord(pricing.price_details);
    const metadata = toRecord(directPrice.metadata);
    const priceId =
      normalizeString(priceDetails.price) ??
      normalizeString(directPrice.id) ??
      normalizeString(toRecord(line.plan).id) ??
      undefined;

    if (!priceId) continue;

    const fallbackRecurringPriceCents =
      Number(directPrice.unit_amount ?? pricing.unit_amount_decimal ?? line.amount ?? 0) || 0;
    const fallbackMonthlyCreditsCents = Number(metadata.monthly_credits_cents ?? 0) || 0;
    const resolvedOffer = await resolveOfferFromPriceId(priceId, {
      recurringPriceCents: fallbackRecurringPriceCents,
      monthlyCreditsCents: fallbackMonthlyCreditsCents,
    });
    const candidatePlanId = resolvedOffer?.planId ?? (await resolvePlanIdFromSubscription(priceId));

    if (!candidatePlanId) continue;

    const period = toRecord(line.period);
    return {
      contractId: null,
      userId: profile.user_id,
      planId: candidatePlanId,
      offerId: resolvedOffer?.offerId ?? null,
      billingInterval:
        resolvedOffer?.billingInterval === BILLING_INTERVAL_YEAR
          ? BILLING_INTERVAL_YEAR
          : BILLING_INTERVAL_MONTH,
      stripePriceId: resolvedOffer?.stripePriceId ?? priceId,
      monthlyCreditsCents: Number(resolvedOffer?.monthlyCreditsCents ?? 0),
      currentPeriodStart: asIsoDate(typeof period.start === "number" ? period.start : null),
      currentPeriodEnd: asIsoDate(typeof period.end === "number" ? period.end : null),
      nextCreditGrantAt: null,
    };
  }

  return null;
};

const resolveAnnualNextCreditGrantAt = (params: {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}): string | null => {
  const periodStart = asDate(params.currentPeriodStart);
  const periodEnd = asDate(params.currentPeriodEnd);
  if (!periodStart || !periodEnd) return null;
  const nextGrant = addMonthsUtc(periodStart, 1);
  if (nextGrant.getTime() >= periodEnd.getTime()) return null;
  return nextGrant.toISOString();
};

const syncSubscriptionContract = async (params: {
  userId: string;
  planId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  resolvedOffer: ResolvedOffer | null;
}) => {
  if (!params.planId) return;

  const recurringPriceCents = Number(params.resolvedOffer?.recurringPriceCents ?? 0);
  const monthlyCreditsCents = Number(params.resolvedOffer?.monthlyCreditsCents ?? 0);
  const storageLimitBytes = Number(params.resolvedOffer?.storageLimitBytes ?? 0);
  const stripePriceId = params.resolvedOffer?.stripePriceId ?? null;
  const offerId = params.resolvedOffer?.offerId ?? null;
  const billingInterval = params.resolvedOffer?.billingInterval ?? BILLING_INTERVAL_MONTH;
  const nextCreditGrantAt =
    billingInterval === BILLING_INTERVAL_YEAR
      ? resolveAnnualNextCreditGrantAt({
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
        })
      : null;

  const current = await resolveCurrentContractForUser(params.userId);
  const endedAt =
    params.status === "canceled" && !params.cancelAtPeriodEnd
      ? (params.currentPeriodEnd ?? new Date().toISOString())
      : null;

  const supabaseAdmin = getSupabaseAdmin();
  const payload = {
    user_id: params.userId,
    plan_id: params.planId,
    offer_id: offerId,
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    stripe_price_id: stripePriceId,
    recurring_price_cents: Number.isFinite(recurringPriceCents) ? recurringPriceCents : 0,
    monthly_credits_cents: Number.isFinite(monthlyCreditsCents) ? monthlyCreditsCents : 0,
    storage_limit_bytes: Number.isFinite(storageLimitBytes) ? storageLimitBytes : 0,
    billing_interval: billingInterval,
    status: params.status,
    current_period_start: params.currentPeriodStart,
    current_period_end: params.currentPeriodEnd,
    last_credit_grant_at:
      billingInterval === BILLING_INTERVAL_YEAR ? (current?.last_credit_grant_at ?? null) : null,
    next_credit_grant_at: billingInterval === BILLING_INTERVAL_YEAR ? nextCreditGrantAt : null,
    cancel_at_period_end: params.cancelAtPeriodEnd,
    started_at: params.currentPeriodStart ?? new Date().toISOString(),
    ended_at: endedAt,
  };

  if (!current) {
    const { error } = await supabaseAdmin.from("billing_subscription_contracts").insert(payload);
    if (error && !isIgnorableSchemaDriftError(error)) {
      throw new Error(error.message || "Failed to insert billing subscription contract.");
    }
    return;
  }

  const sameCommercialTerms =
    current.plan_id === params.planId &&
    current.offer_id === offerId &&
    current.billing_interval === billingInterval &&
    current.stripe_subscription_id === params.stripeSubscriptionId &&
    current.stripe_price_id === stripePriceId &&
    Number(current.recurring_price_cents ?? 0) === payload.recurring_price_cents &&
    Number(current.monthly_credits_cents ?? 0) === payload.monthly_credits_cents &&
    Number(current.storage_limit_bytes ?? 0) === payload.storage_limit_bytes;

  if (sameCommercialTerms) {
    const periodShifted = current.current_period_start !== params.currentPeriodStart;
    const { error } = await supabaseAdmin
      .from("billing_subscription_contracts")
      .update({
        billing_interval: payload.billing_interval,
        status: payload.status,
        current_period_start: payload.current_period_start,
        current_period_end: payload.current_period_end,
        last_credit_grant_at:
          billingInterval === BILLING_INTERVAL_YEAR && periodShifted
            ? null
            : payload.last_credit_grant_at,
        next_credit_grant_at:
          billingInterval === BILLING_INTERVAL_YEAR
            ? periodShifted
              ? nextCreditGrantAt
              : (current.next_credit_grant_at ?? payload.next_credit_grant_at)
            : null,
        cancel_at_period_end: payload.cancel_at_period_end,
        ended_at: payload.ended_at,
      })
      .eq("id", current.id);
    if (error && !isIgnorableSchemaDriftError(error)) {
      throw new Error(error.message || "Failed to update billing subscription contract.");
    }
    return;
  }

  const contractTransitionTime = params.currentPeriodStart ?? new Date().toISOString();
  const { error: closeError } = await supabaseAdmin
    .from("billing_subscription_contracts")
    .update({
      ended_at: contractTransitionTime,
    })
    .eq("id", current.id);
  if (closeError && !isIgnorableSchemaDriftError(closeError)) {
    throw new Error(closeError.message || "Failed to close billing subscription contract.");
  }

  const { error: insertError } = await supabaseAdmin
    .from("billing_subscription_contracts")
    .insert({ ...payload, started_at: contractTransitionTime });
  if (insertError && !isIgnorableSchemaDriftError(insertError)) {
    throw new Error(insertError.message || "Failed to insert billing subscription contract.");
  }
};

const syncSubscriptionStorageAddons = async (params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  resolvedAddons: Array<{
    storageAddonId: string | null;
    offerId: string | null;
    stripePriceId: string | null;
    stripeSubscriptionItemId: string | null;
    storageLimitBytes: number;
    quantity: number;
    recurringPriceCents: number;
  }>;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const currentRows = await resolveCurrentStorageAddonContractsForUser(
    params.userId,
    params.stripeSubscriptionId
  );
  const currentByItemId = new Map(
    currentRows
      .filter((row) => row.stripe_subscription_item_id)
      .map((row) => [row.stripe_subscription_item_id as string, row])
  );
  const nextItemIds = new Set(
    params.resolvedAddons
      .map((addon) => addon.stripeSubscriptionItemId)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const transitionTime = new Date().toISOString();

  for (const current of currentRows) {
    const currentItemId = current.stripe_subscription_item_id;
    if (!currentItemId || nextItemIds.has(currentItemId)) {
      continue;
    }

    const { error } = await supabaseAdmin
      .from("billing_subscription_storage_addons")
      .update({
        status: "canceled",
        ended_at: transitionTime,
        current_period_end: params.currentPeriodEnd,
        cancel_at_period_end: false,
      })
      .eq("id", current.id);
    if (error && !isIgnorableSchemaDriftError(error)) {
      throw new Error(error.message || "Failed to close removed billing storage add-on contract.");
    }
  }

  for (const addon of params.resolvedAddons) {
    if (!addon.stripeSubscriptionItemId) continue;

    const payload = {
      user_id: params.userId,
      storage_addon_id: addon.storageAddonId,
      offer_id: addon.offerId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      stripe_subscription_item_id: addon.stripeSubscriptionItemId,
      stripe_price_id: addon.stripePriceId,
      storage_limit_bytes: addon.storageLimitBytes,
      quantity: addon.quantity,
      recurring_price_cents: addon.recurringPriceCents,
      status: params.status,
      current_period_start: params.currentPeriodStart,
      current_period_end: params.currentPeriodEnd,
      cancel_at_period_end: params.cancelAtPeriodEnd,
      started_at: transitionTime,
      ended_at:
        params.status === "canceled" && !params.cancelAtPeriodEnd
          ? (params.currentPeriodEnd ?? transitionTime)
          : null,
    };
    const current = currentByItemId.get(addon.stripeSubscriptionItemId);

    if (!current) {
      const { error } = await supabaseAdmin
        .from("billing_subscription_storage_addons")
        .insert(payload);
      if (error && !isIgnorableSchemaDriftError(error)) {
        throw new Error(error.message || "Failed to insert billing storage add-on contract.");
      }
      continue;
    }

    const sameCommercialTerms =
      current.storage_addon_id === addon.storageAddonId &&
      current.offer_id === addon.offerId &&
      current.stripe_price_id === addon.stripePriceId &&
      Number(current.storage_limit_bytes ?? 0) === payload.storage_limit_bytes &&
      Number(current.quantity ?? 0) === payload.quantity &&
      Number(current.recurring_price_cents ?? 0) === payload.recurring_price_cents;

    if (sameCommercialTerms) {
      const { error } = await supabaseAdmin
        .from("billing_subscription_storage_addons")
        .update({
          status: payload.status,
          current_period_start: payload.current_period_start,
          current_period_end: payload.current_period_end,
          cancel_at_period_end: payload.cancel_at_period_end,
          ended_at: payload.ended_at,
        })
        .eq("id", current.id);
      if (error && !isIgnorableSchemaDriftError(error)) {
        throw new Error(error.message || "Failed to update billing storage add-on contract.");
      }
      continue;
    }

    const { error: closeError } = await supabaseAdmin
      .from("billing_subscription_storage_addons")
      .update({
        ended_at: transitionTime,
      })
      .eq("id", current.id);
    if (closeError && !isIgnorableSchemaDriftError(closeError)) {
      throw new Error(closeError.message || "Failed to close billing storage add-on contract.");
    }

    const { error: insertError } = await supabaseAdmin
      .from("billing_subscription_storage_addons")
      .insert(payload);
    if (insertError && !isIgnorableSchemaDriftError(insertError)) {
      throw new Error(insertError.message || "Failed to insert billing storage add-on contract.");
    }
  }
};

const applyCredit = async (params: {
  userId: string;
  changeCents: number;
  source: string;
  sourceRef: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) => {
  const { error } = await insertCreditLedgerEntry({
    userId: params.userId,
    changeCents: params.changeCents,
    source: params.source,
    sourceRef: params.sourceRef,
    reason: params.reason,
    metadata: params.metadata ?? {},
  });
  if (isDuplicateLedgerSourceRefError(error)) {
    return;
  }
  if (error) {
    throw new Error(error.message || "Credit ledger insert failed.");
  }
};

const processCheckoutCompleted = async (session: JsonObject, eventId: string) => {
  if (normalizeString(session.payment_status) !== "paid") {
    return;
  }

  const metadata = toRecord(session.metadata);
  const userIdRaw = metadata.user_id ?? session.client_reference_id;
  const userId = typeof userIdRaw === "string" ? userIdRaw : null;
  const creditAmountRaw = metadata.credit_amount_cents;
  const packageId =
    typeof metadata.credit_package_id === "string" ? metadata.credit_package_id : null;
  const packageDisplayName =
    typeof metadata.credit_package_display_name === "string"
      ? metadata.credit_package_display_name
      : null;
  const packagePriceCentsRaw = metadata.credit_package_price_cents;
  if (!userId || !creditAmountRaw) return;

  const creditAmount = Number(creditAmountRaw);
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) return;
  const packagePriceCents = Number(packagePriceCentsRaw);

  await applyCredit({
    userId,
    changeCents: creditAmount,
    source: "stripe_checkout",
    sourceRef: buildCheckoutGrantSourceRef(session, eventId),
    reason: packageId ? `Credit purchase (${packageId})` : "Credit purchase",
    metadata: {
      checkout_session_id: session.id ?? null,
      stripe_customer_id: session.customer ?? null,
      credit_package_id: packageId,
      credit_package_display_name: packageDisplayName,
      credit_package_price_cents:
        Number.isFinite(packagePriceCents) && packagePriceCents > 0 ? packagePriceCents : null,
    },
  });

  await recordBillingTelemetrySafely({
    source: "telemetry.billing.checkout_completed",
    message: "checkout_completed",
    userId,
    metadata: {
      checkout_session_id: session.id ?? null,
      stripe_customer_id: session.customer ?? null,
      credit_package_id: packageId,
      stripe_event_id: eventId,
    },
  });
};

const processSubscriptionUpdate = async (subscription: JsonObject) => {
  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : undefined;
  if (!stripeCustomerId) return;

  const profile = await resolveBillingProfileByCustomer(stripeCustomerId);

  const items = toRecord(subscription.items);
  const itemData = Array.isArray(items.data) ? items.data : [];
  let resolvedOffer: ResolvedOffer | null = null;
  let resolvedPlanId: string | null = null;
  const resolvedAddons: Array<{
    storageAddonId: string | null;
    offerId: string | null;
    stripePriceId: string | null;
    stripeSubscriptionItemId: string | null;
    storageLimitBytes: number;
    quantity: number;
    recurringPriceCents: number;
  }> = [];

  for (const itemValue of itemData) {
    const item = toRecord(itemValue);
    const price = toRecord(item.price);
    const priceIdCandidate = price.id;
    const priceId = typeof priceIdCandidate === "string" ? priceIdCandidate : undefined;
    const quantity = Math.max(1, Number(item.quantity ?? 1) || 1);
    const fallbackRecurringPriceCents = Number(price.unit_amount ?? 0);
    const priceMetadata = toRecord(price.metadata);
    const fallbackMonthlyCreditsCents = Number(priceMetadata.monthly_credits_cents ?? 0);

    const candidatePlanOffer = await resolveOfferFromPriceId(priceId, {
      recurringPriceCents: Number.isFinite(fallbackRecurringPriceCents)
        ? fallbackRecurringPriceCents
        : 0,
      monthlyCreditsCents: Number.isFinite(fallbackMonthlyCreditsCents)
        ? fallbackMonthlyCreditsCents
        : 0,
    });
    const candidatePlanId =
      candidatePlanOffer?.planId ?? (await resolvePlanIdFromSubscription(priceId));

    if (!resolvedOffer && candidatePlanId) {
      resolvedOffer = candidatePlanOffer;
      resolvedPlanId = candidatePlanId;
      continue;
    }

    const resolvedAddon = await resolveStorageAddonOfferFromPriceId(priceId, {
      recurringPriceCents: Number.isFinite(fallbackRecurringPriceCents)
        ? fallbackRecurringPriceCents
        : 0,
    });
    if (!resolvedAddon || (!resolvedAddon.storageAddonId && !resolvedAddon.offerId)) {
      continue;
    }

    resolvedAddons.push({
      storageAddonId: resolvedAddon.storageAddonId,
      offerId: resolvedAddon.offerId,
      stripePriceId: resolvedAddon.stripePriceId,
      stripeSubscriptionItemId: normalizeString(item.id),
      storageLimitBytes: Number(resolvedAddon.storageLimitBytes ?? 0),
      quantity,
      recurringPriceCents: Number(resolvedAddon.recurringPriceCents ?? 0) * quantity,
    });
  }

  resolvedPlanId = resolvedPlanId ?? profile?.plan_id ?? null;
  const subscriptionStatus =
    typeof subscription.status === "string" ? subscription.status : "inactive";
  const cancelAtPeriodEnd = normalizeBoolean(subscription.cancel_at_period_end);
  const isImmediateCancellation = subscriptionStatus === "canceled" && !cancelAtPeriodEnd;
  const runtimePlanId = isImmediateCancellation ? "free" : resolvedPlanId;
  const runtimeCurrentPeriodEnd = isImmediateCancellation
    ? null
    : asIsoDate(
        typeof subscription.current_period_end === "number" ? subscription.current_period_end : null
      );

  const updatePayload: JsonObject = {
    stripe_subscription_id: isImmediateCancellation ? null : (subscription.id ?? null),
    subscription_status: subscriptionStatus,
    stripe_customer_id: stripeCustomerId,
    current_period_end: runtimeCurrentPeriodEnd,
  };
  if (runtimePlanId) {
    updatePayload.plan_id = runtimePlanId;
  }

  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin
    .from("billing_profiles")
    .update(updatePayload)
    .eq("stripe_customer_id", stripeCustomerId);

  if (!profile?.user_id) return;

  await syncSubscriptionContract({
    userId: profile.user_id,
    planId: resolvedPlanId,
    stripeCustomerId,
    stripeSubscriptionId: normalizeString(subscription.id),
    status: subscriptionStatus,
    currentPeriodStart: asIsoDate(
      typeof subscription.current_period_start === "number"
        ? subscription.current_period_start
        : typeof subscription.start_date === "number"
          ? subscription.start_date
          : null
    ),
    currentPeriodEnd: asIsoDate(
      typeof subscription.current_period_end === "number" ? subscription.current_period_end : null
    ),
    cancelAtPeriodEnd,
    resolvedOffer,
  });

  await syncSubscriptionStorageAddons({
    userId: profile.user_id,
    stripeCustomerId,
    stripeSubscriptionId: normalizeString(subscription.id),
    status: subscriptionStatus,
    currentPeriodStart: asIsoDate(
      typeof subscription.current_period_start === "number"
        ? subscription.current_period_start
        : typeof subscription.start_date === "number"
          ? subscription.start_date
          : null
    ),
    currentPeriodEnd: asIsoDate(
      typeof subscription.current_period_end === "number" ? subscription.current_period_end : null
    ),
    cancelAtPeriodEnd,
    resolvedAddons,
  });
};

const processInvoicePaymentSucceeded = async (invoice: JsonObject, eventId: string) => {
  const billingReason = normalizeString(invoice.billing_reason);
  if (!billingReason || !SUBSCRIPTION_CREDIT_GRANT_BILLING_REASONS.has(billingReason)) {
    return;
  }

  const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
  if (!stripeCustomerId) return;

  const billingContext =
    (await resolveCurrentBillingContextByCustomer(stripeCustomerId)) ??
    (await resolveBillingContextFromInvoice(invoice, stripeCustomerId));
  if (!billingContext?.userId || !billingContext.planId) return;

  const monthlyCredits = Number(billingContext.monthlyCreditsCents ?? 0);
  if (!Number.isFinite(monthlyCredits) || monthlyCredits <= 0) return;

  await applyCredit({
    userId: billingContext.userId,
    changeCents: monthlyCredits,
    source: "subscription_renewal",
    sourceRef: buildSubscriptionGrantSourceRef(invoice, eventId),
    reason: "Monthly plan credit allocation",
    metadata: {
      invoice_id: invoice.id ?? null,
      billing_reason: billingReason,
      plan_id: billingContext.planId,
      offer_id: billingContext.offerId,
      stripe_customer_id: stripeCustomerId,
      stripe_price_id: billingContext.stripePriceId,
    },
  });

  if (billingContext.billingInterval === BILLING_INTERVAL_YEAR && billingContext.contractId) {
    const annualNextGrantAt = resolveAnnualNextCreditGrantAt({
      currentPeriodStart: billingContext.currentPeriodStart ?? null,
      currentPeriodEnd: billingContext.currentPeriodEnd ?? null,
    });
    const { error } = await getSupabaseAdmin()
      .from("billing_subscription_contracts")
      .update({
        last_credit_grant_at: new Date().toISOString(),
        next_credit_grant_at: annualNextGrantAt,
      })
      .eq("id", billingContext.contractId);
    if (error && !isIgnorableSchemaDriftError(error)) {
      throw new Error(
        error.message || "Failed to update annual credit allocation state after invoice payment."
      );
    }
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ error: "Stripe webhook is not configured." });
  }

  try {
    const rawBody = await readRawRequestBody(req, {
      maxBytes: STRIPE_WEBHOOK_MAX_BODY_BYTES,
    });
    const signatureHeader = req.headers["stripe-signature"] as string | undefined;
    const verified = verifyStripeWebhookSignature(rawBody, signatureHeader);
    if (!verified) {
      return res.status(400).json({ error: "Invalid Stripe signature." });
    }

    const event = JSON.parse(rawBody) as StripeEvent;
    if (!event?.id || !event?.type) {
      return res.status(400).json({ error: "Invalid Stripe event payload." });
    }

    const eventClaim = await claimStripeEvent(event);
    if (eventClaim.kind === "failed") {
      await logApiRouteException({
        req,
        error: new Error(eventClaim.message),
        routeLabel: "billing/stripe/webhook",
        metadata: {
          stripe_event_signature_present: Boolean(req.headers["stripe-signature"]),
          stripe_event_id: event.id,
          stripe_event_type: event.type,
          claim_failed: true,
        },
      });
      return res.status(500).json({ error: "Webhook processing failed." });
    }
    const duplicateEvent = eventClaim.kind === "duplicate";

    const object = event.data?.object ?? {};
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await processCheckoutCompleted(object, event.id);
    }
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await processSubscriptionUpdate(object);
    }
    if (event.type === "invoice.payment_succeeded") {
      await processInvoicePaymentSucceeded(object, event.id);
    }

    if (duplicateEvent) {
      return res.status(200).json({ received: true, duplicate: true });
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return res.status(413).json({ error: "Webhook payload too large." });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/stripe/webhook",
      metadata: {
        stripe_event_signature_present: Boolean(req.headers["stripe-signature"]),
      },
    });
    return res.status(500).json({
      error: "Webhook processing failed.",
    });
  }
}
