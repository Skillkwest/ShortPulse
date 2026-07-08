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
} from "../../../../lib/server/api/billingContracts";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { verifyStripeWebhookSignature } from "../../../../lib/server/api/stripe";
import { grantAccountCredits } from "../../../../lib/server/api/creditLedger";
import { resolveDefaultPlanConcurrencyLimit } from "../../../../lib/billing/planConcurrency";
import { readVerifiedStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";
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
type WebhookMetadataError = Error & {
  webhookMetadata?: Record<string, unknown>;
};

type ResolvedOffer = {
  offerId: string | null;
  planId: string | null;
  billingInterval: "month" | "year";
  stripePriceId: string | null;
  recurringPriceCents: number;
  monthlyCreditsCents: number;
  storageLimitBytes: number;
  maxConcurrentGenerations: number;
};

type ScheduledSubscriptionChangeProjection = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeScheduleId: string;
  changeKind: "scheduled_downgrade" | "scheduled_interval_change";
  currentPlanId: string | null;
  currentBillingInterval: "month" | "year" | null;
  currentStripePriceId: string | null;
  currentOffer: ResolvedOffer | null;
  targetOffer: ResolvedOffer;
  effectiveAt: string;
  currentBenefitsEndAt: string | null;
  schedulePhaseStartAt: string | null;
  schedulePhaseEndAt: string | null;
};

type InvoicePlanLine = {
  line: JsonObject;
  amountCents: number;
  offer: ResolvedOffer;
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
  max_concurrent_generations: number | null;
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

type BillingSubscriptionChangeIntentProjection = {
  id: string;
  user_id: string;
  active_plan_id: string | null;
  active_offer_id: string | null;
  target_plan_id: string;
  target_offer_id: string;
  target_stripe_price_id: string;
  target_billing_interval: "month" | "year";
  status: string;
  expires_at: string;
};

type SubscriptionUpdateGrant = {
  offer: ResolvedOffer;
  subscriptionChangeIntentId: string | null;
};

const SUBSCRIPTION_CREDIT_GRANT_BILLING_REASONS = new Set([
  "subscription_create",
  "subscription_cycle",
  "subscription_update",
]);
const SUBSCRIPTION_CREDIT_LIFESPAN_DAYS = 60;
const IMMEDIATE_PAID_UPGRADE_METADATA_VALUE = "immediate_paid_upgrade";

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

const resolveSubscriptionPeriodFromItems = (
  itemData: unknown[]
): { currentPeriodStart: string | null; currentPeriodEnd: string | null } => {
  const starts: number[] = [];
  const ends: number[] = [];

  for (const itemValue of itemData) {
    const item = toRecord(itemValue);
    if (typeof item.current_period_start === "number") {
      starts.push(item.current_period_start);
    }
    if (typeof item.current_period_end === "number") {
      ends.push(item.current_period_end);
    }
  }

  return {
    currentPeriodStart: starts.length > 0 ? asIsoDate(Math.min(...starts)) : null,
    currentPeriodEnd: ends.length > 0 ? asIsoDate(Math.max(...ends)) : null,
  };
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

const resolveSubscriptionCreditExpiresAt = () =>
  new Date(Date.now() + SUBSCRIPTION_CREDIT_LIFESPAN_DAYS * 24 * 60 * 60 * 1000).toISOString();

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

const releaseStripeEventClaim = async (event: StripeEvent): Promise<{ error: string | null }> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("stripe_event_log").delete().eq("id", event.id);
    return { error: error?.message ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe event claim release failed.";
    try {
      await writeAppErrorLog({
        source: "api.exception",
        severity: "high",
        message,
        stack: error instanceof Error ? (error.stack ?? null) : null,
        route: "billing/stripe/webhook",
        metadata: {
          route_label: "billing/stripe/webhook",
          stripe_event_id: event.id,
          stripe_event_type: event.type,
          claim_release_failed: true,
          exception_name: error instanceof Error ? error.name : undefined,
        },
      });
    } catch (loggingError) {
      console.error("[billing/stripe/webhook] claim release log write failed", loggingError);
    }
    return { error: message };
  }
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
      "id, plan_id, billing_interval, stripe_price_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations"
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
      maxConcurrentGenerations: Number(
        offer.max_concurrent_generations ??
          resolveDefaultPlanConcurrencyLimit(
            typeof offer.plan_id === "string" ? offer.plan_id : null
          )
      ),
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
      maxConcurrentGenerations: 0,
    };
  }

  const planId = typeof plan.id === "string" ? plan.id : null;
  return {
    offerId: planId ? `${planId}__current` : null,
    planId,
    billingInterval: BILLING_INTERVAL_MONTH,
    stripePriceId: typeof plan.stripe_price_id === "string" ? plan.stripe_price_id : stripePriceId,
    recurringPriceCents: Number(plan.monthly_price_cents ?? 0),
    monthlyCreditsCents: Number(plan.monthly_credits_cents ?? 0),
    storageLimitBytes: Number(plan.storage_limit_bytes ?? 0),
    maxConcurrentGenerations: resolveDefaultPlanConcurrencyLimit(planId),
  };
};

const resolveOfferFromOfferId = async (
  offerId: string | undefined,
  expectedPlanId?: string | null
): Promise<ResolvedOffer | null> => {
  if (!offerId) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: offer, error } = await supabaseAdmin
    .from("billing_plan_offers")
    .select(
      "id, plan_id, billing_interval, stripe_price_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations"
    )
    .eq("id", offerId)
    .maybeSingle();

  if (error && !isIgnorableSchemaDriftError(error)) {
    throw new Error(error.message || "Failed to load billing plan offer.");
  }
  if (!offer) return null;

  const planId = typeof offer.plan_id === "string" ? offer.plan_id : null;
  if (expectedPlanId && planId !== expectedPlanId) return null;

  return {
    offerId: typeof offer.id === "string" ? offer.id : null,
    planId,
    billingInterval:
      offer.billing_interval === BILLING_INTERVAL_YEAR
        ? BILLING_INTERVAL_YEAR
        : BILLING_INTERVAL_MONTH,
    stripePriceId: typeof offer.stripe_price_id === "string" ? offer.stripe_price_id : null,
    recurringPriceCents: Number(offer.recurring_price_cents ?? 0),
    monthlyCreditsCents: Number(offer.monthly_credits_cents ?? 0),
    storageLimitBytes: Number(offer.storage_limit_bytes ?? 0),
    maxConcurrentGenerations: Number(
      offer.max_concurrent_generations ?? resolveDefaultPlanConcurrencyLimit(planId)
    ),
  };
};

const resolvePlanSortOrder = async (planId: string | null | undefined): Promise<number | null> => {
  if (!planId) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_plans")
    .select("sort_order")
    .eq("id", planId)
    .maybeSingle();
  if (error && !isIgnorableSchemaDriftError(error)) {
    throw new Error(error.message || "Failed to load billing plan rank.");
  }
  const sortOrder = Number(data?.sort_order ?? NaN);
  return Number.isFinite(sortOrder) ? sortOrder : null;
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

const resolveStripePriceId = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  const price = toRecord(value);
  const id = normalizeString(price.id);
  return id ?? undefined;
};

const resolveScheduleSubscriptionId = (schedule: JsonObject): string | null => {
  const subscription = schedule.subscription;
  if (typeof subscription === "string") return subscription;
  return normalizeString(toRecord(subscription).id);
};

const resolveScheduleCustomerId = (schedule: JsonObject): string | null => {
  const customer = schedule.customer;
  if (typeof customer === "string") return customer;
  return normalizeString(toRecord(customer).id);
};

const readSchedulePhases = (schedule: JsonObject): JsonObject[] => {
  const phases = Array.isArray(schedule.phases) ? schedule.phases : [];
  return phases.map(toRecord).filter((phase) => Object.keys(phase).length > 0);
};

const readSchedulePhaseItems = (phase: JsonObject): JsonObject[] => {
  const directItems: unknown[] = Array.isArray(phase.items) ? phase.items : [];
  const phaseItemsRecord = toRecord(phase.items);
  const wrappedItems: unknown[] = Array.isArray(phaseItemsRecord.data) ? phaseItemsRecord.data : [];
  return [...directItems, ...wrappedItems]
    .map(toRecord)
    .filter((item) => Object.keys(item).length > 0);
};

const resolveSchedulePhasePlanOffer = async (phase: JsonObject): Promise<ResolvedOffer | null> => {
  const items = readSchedulePhaseItems(phase);
  for (const item of items) {
    const price = toRecord(item.price);
    const priceId = resolveStripePriceId(item.price) ?? resolveStripePriceId(price);
    if (!priceId) continue;
    const fallbackRecurringPriceCents = Number(price.unit_amount ?? 0);
    const priceMetadata = toRecord(price.metadata);
    const fallbackMonthlyCreditsCents = Number(priceMetadata.monthly_credits_cents ?? 0);
    const offer = await resolveOfferFromPriceId(priceId, {
      recurringPriceCents: Number.isFinite(fallbackRecurringPriceCents)
        ? fallbackRecurringPriceCents
        : 0,
      monthlyCreditsCents: Number.isFinite(fallbackMonthlyCreditsCents)
        ? fallbackMonthlyCreditsCents
        : 0,
    });
    if (offer?.planId) return offer;
  }
  return null;
};

const resolveCurrentSchedulePhase = (
  schedule: JsonObject,
  phases: JsonObject[]
): JsonObject | null => {
  const currentPhase = toRecord(schedule.current_phase);
  const currentStart = typeof currentPhase.start_date === "number" ? currentPhase.start_date : null;
  const currentEnd = typeof currentPhase.end_date === "number" ? currentPhase.end_date : null;
  if (currentStart != null || currentEnd != null) {
    const matched = phases.find((phase) => {
      const start = typeof phase.start_date === "number" ? phase.start_date : null;
      const end = typeof phase.end_date === "number" ? phase.end_date : null;
      return (
        (currentStart == null || start === currentStart) &&
        (currentEnd == null || end === currentEnd)
      );
    });
    if (matched) return matched;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return (
    phases.find((phase) => {
      const start = typeof phase.start_date === "number" ? phase.start_date : null;
      const end = typeof phase.end_date === "number" ? phase.end_date : null;
      return (start == null || start <= nowSeconds) && (end == null || end > nowSeconds);
    }) ?? null
  );
};

const resolveNextSchedulePhase = (
  phases: JsonObject[],
  currentPhase: JsonObject | null
): JsonObject | null => {
  const sortedPhases = [...phases].sort((left, right) => {
    const leftStart =
      typeof left.start_date === "number" ? left.start_date : Number.MAX_SAFE_INTEGER;
    const rightStart =
      typeof right.start_date === "number" ? right.start_date : Number.MAX_SAFE_INTEGER;
    return leftStart - rightStart;
  });
  const currentEnd =
    currentPhase && typeof currentPhase.end_date === "number" ? currentPhase.end_date : null;
  if (currentEnd != null) {
    return (
      sortedPhases.find((phase) => {
        const start = typeof phase.start_date === "number" ? phase.start_date : null;
        return start != null && start >= currentEnd;
      }) ?? null
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return (
    sortedPhases.find((phase) => {
      const start = typeof phase.start_date === "number" ? phase.start_date : null;
      return start != null && start > nowSeconds;
    }) ?? null
  );
};

const buildCheckoutGrantSourceRef = (session: JsonObject, fallbackEventId: string): string => {
  const sessionId = normalizeString(session.id);
  return sessionId ? `checkout_session:${sessionId}` : `checkout_event:${fallbackEventId}`;
};

const buildSubscriptionGrantSourceRef = (invoice: JsonObject, fallbackEventId: string): string => {
  const invoiceId = normalizeString(invoice.id);
  return invoiceId ? `invoice:${invoiceId}:monthly_allocation` : `invoice_event:${fallbackEventId}`;
};

const readInvoiceMetadata = (invoice: JsonObject): JsonObject => {
  const subscriptionDetails = toRecord(invoice.subscription_details);
  return {
    ...toRecord(invoice.metadata),
    ...toRecord(subscriptionDetails.metadata),
  };
};

const isImmediatePaidUpgradeInvoice = (invoice: JsonObject): boolean => {
  const metadata = readInvoiceMetadata(invoice);
  return (
    normalizeString(metadata.shortpulse_plan_change_kind) === IMMEDIATE_PAID_UPGRADE_METADATA_VALUE
  );
};

const resolveInvoiceLinePriceId = (lineValue: unknown): string | null => {
  const line = toRecord(lineValue);
  const directPrice = toRecord(line.price);
  const pricing = toRecord(line.pricing);
  const priceDetails = toRecord(pricing.price_details);
  return (
    normalizeString(priceDetails.price) ??
    normalizeString(directPrice.id) ??
    normalizeString(toRecord(line.plan).id)
  );
};

const findInvoiceLineForPriceId = (
  invoice: JsonObject,
  stripePriceId: string | null | undefined
): JsonObject => {
  if (!stripePriceId) return {};
  const lines = toRecord(invoice.lines);
  const lineData = Array.isArray(lines.data) ? lines.data : [];
  const matchingLine = lineData.find(
    (lineValue) => resolveInvoiceLinePriceId(lineValue) === stripePriceId
  );
  return toRecord(matchingLine);
};

const resolveInvoiceLineAmountCents = (line: JsonObject): number => {
  const amount = Number(line.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const resolveInvoicePlanLine = async (lineValue: unknown): Promise<InvoicePlanLine | null> => {
  const line = toRecord(lineValue);
  const priceId = resolveInvoiceLinePriceId(line) ?? undefined;
  if (!priceId) return null;

  const directPrice = toRecord(line.price);
  const pricing = toRecord(line.pricing);
  const metadata = toRecord(directPrice.metadata);
  const fallbackRecurringPriceCents =
    Number(directPrice.unit_amount ?? pricing.unit_amount_decimal ?? line.amount ?? 0) || 0;
  const fallbackMonthlyCreditsCents = Number(metadata.monthly_credits_cents ?? 0) || 0;
  const offer = await resolveOfferFromPriceId(priceId, {
    recurringPriceCents: fallbackRecurringPriceCents,
    monthlyCreditsCents: fallbackMonthlyCreditsCents,
  });
  if (!offer?.planId || !offer.stripePriceId || Number(offer.monthlyCreditsCents ?? 0) <= 0) {
    return null;
  }

  return {
    line,
    amountCents: resolveInvoiceLineAmountCents(line),
    offer,
  };
};

const loadPlanSortOrder = async (planId: string | null): Promise<number | null> => {
  if (!planId) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("billing_plans")
    .select("id, sort_order")
    .eq("id", planId)
    .maybeSingle();
  if (error && !isIgnorableSchemaDriftError(error)) {
    throw new Error(error.message || "Failed to load billing plan rank.");
  }
  const sortOrder = Number(data?.sort_order);
  return Number.isFinite(sortOrder) ? sortOrder : null;
};

const isHigherPlanOffer = async (targetOffer: ResolvedOffer, previousOffer: ResolvedOffer) => {
  if (!targetOffer.planId || !previousOffer.planId || targetOffer.planId === previousOffer.planId) {
    return false;
  }
  const [targetSortOrder, previousSortOrder] = await Promise.all([
    loadPlanSortOrder(targetOffer.planId),
    loadPlanSortOrder(previousOffer.planId),
  ]);
  return (
    typeof targetSortOrder === "number" &&
    typeof previousSortOrder === "number" &&
    targetSortOrder > previousSortOrder
  );
};

const resolvePaidSubscriptionUpdateGrantOffer = async (
  invoice: JsonObject
): Promise<ResolvedOffer | null> => {
  const invoiceMetadata = readInvoiceMetadata(invoice);
  if (isImmediatePaidUpgradeInvoice(invoice)) {
    const targetOffer = await resolveOfferFromOfferId(
      normalizeString(invoiceMetadata.billing_offer_id) ?? undefined,
      normalizeString(invoiceMetadata.billing_plan_id)
    );
    if (targetOffer?.planId) return targetOffer;
    if (normalizeString(invoiceMetadata.billing_offer_id)) return null;
  }

  const lines = toRecord(invoice.lines);
  const lineData = Array.isArray(lines.data) ? lines.data : [];
  const planLines: InvoicePlanLine[] = [];
  for (const lineValue of lineData) {
    const planLine = await resolveInvoicePlanLine(lineValue);
    if (planLine) planLines.push(planLine);
  }

  const previousLines = planLines.filter((line) => line.amountCents < 0);
  if (previousLines.length === 0) return null;

  const targetLines = planLines
    .filter((line) => line.amountCents > 0)
    .sort((left, right) => right.amountCents - left.amountCents);

  for (const targetLine of targetLines) {
    for (const previousLine of previousLines) {
      if (await isHigherPlanOffer(targetLine.offer, previousLine.offer)) {
        return targetLine.offer;
      }
    }
  }

  return null;
};

const resolveInvoiceSubscriptionId = (invoice: JsonObject): string | null => {
  const parent = toRecord(invoice.parent);
  const parentSubscriptionDetails = toRecord(parent.subscription_details);
  return (
    normalizeString(invoice.subscription) ??
    normalizeString(toRecord(invoice.subscription_details).subscription) ??
    normalizeString(parentSubscriptionDetails.subscription)
  );
};

const resolveFullPriceSubscriptionUpdateTargetOffer = async (
  invoice: JsonObject
): Promise<ResolvedOffer | null> => {
  const lines = toRecord(invoice.lines);
  const lineData = Array.isArray(lines.data) ? lines.data : [];
  const targetLines: InvoicePlanLine[] = [];

  for (const lineValue of lineData) {
    const planLine = await resolveInvoicePlanLine(lineValue);
    if (!planLine) continue;
    if (planLine.amountCents <= 0) continue;
    if (planLine.amountCents !== Number(planLine.offer.recurringPriceCents ?? 0)) continue;
    if (!planLine.offer.offerId || !planLine.offer.stripePriceId) continue;
    targetLines.push(planLine);
  }

  return targetLines.sort((left, right) => right.amountCents - left.amountCents)[0]?.offer ?? null;
};

const resolveFullPriceUpgradeIntentGrant = async (
  invoice: JsonObject,
  stripeCustomerId: string
): Promise<SubscriptionUpdateGrant | null> => {
  const targetOffer = await resolveFullPriceSubscriptionUpdateTargetOffer(invoice);
  if (!targetOffer?.offerId || !targetOffer.stripePriceId || !targetOffer.planId) return null;

  const stripeSubscriptionId = resolveInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return null;

  const profile = await resolveVerifiedBillingProfileByCustomer(stripeCustomerId);
  if (!profile?.user_id) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_subscription_change_intents")
    .select(
      "id, user_id, active_plan_id, active_offer_id, target_plan_id, target_offer_id, target_stripe_price_id, target_billing_interval, status, expires_at"
    )
    .eq("user_id", profile.user_id)
    .eq("intent_kind", "full_price_upgrade")
    .eq("stripe_customer_id", stripeCustomerId)
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("target_offer_id", targetOffer.offerId)
    .eq("target_stripe_price_id", targetOffer.stripePriceId)
    .in("status", ["pending", "portal_created"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isIgnorableSchemaDriftError(error)) return null;
    throw new Error(error.message || "Failed to load subscription change intent.");
  }

  const intent = data as BillingSubscriptionChangeIntentProjection | null;
  if (!intent?.id || intent.user_id !== profile.user_id) return null;
  if (
    intent.target_plan_id !== targetOffer.planId ||
    intent.target_offer_id !== targetOffer.offerId ||
    intent.target_stripe_price_id !== targetOffer.stripePriceId
  ) {
    return null;
  }

  const previousOffer: ResolvedOffer = {
    offerId: intent.active_offer_id,
    planId: intent.active_plan_id,
    billingInterval: BILLING_INTERVAL_MONTH,
    stripePriceId: null,
    recurringPriceCents: 0,
    monthlyCreditsCents: 0,
    storageLimitBytes: 0,
    maxConcurrentGenerations: 0,
  };
  if (!(await isHigherPlanOffer(targetOffer, previousOffer))) return null;

  return {
    offer: targetOffer,
    subscriptionChangeIntentId: intent.id,
  };
};

const markSubscriptionChangeIntentCompleted = async (params: {
  intentId: string;
  stripeInvoiceId: string | null;
}) => {
  const { error } = await getSupabaseAdmin()
    .from("billing_subscription_change_intents")
    .update({
      status: "completed",
      stripe_invoice_id: params.stripeInvoiceId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.intentId);

  if (error && !isIgnorableSchemaDriftError(error)) {
    throw new Error(error.message || "Failed to complete subscription change intent.");
  }
};

const withWebhookMetadata = (
  error: unknown,
  metadata: Record<string, unknown>
): WebhookMetadataError => {
  const normalized: WebhookMetadataError =
    error instanceof Error
      ? (error as WebhookMetadataError)
      : (new Error(String(error ?? "Webhook processing failed.")) as WebhookMetadataError);
  normalized.webhookMetadata = {
    ...(normalized.webhookMetadata ?? {}),
    ...metadata,
  };
  return normalized;
};

const getWebhookErrorMetadata = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== "object") return {};
  const metadata = (error as WebhookMetadataError).webhookMetadata;
  return metadata && typeof metadata === "object" ? metadata : {};
};

const recordBillingTelemetrySafely = async (params: {
  source:
    | "telemetry.billing.checkout_completed"
    | "telemetry.billing.checkout_async_payment_failed"
    | "telemetry.billing.invoice_payment_action_required"
    | "telemetry.billing.invoice_payment_failed";
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

const resolveFailureTelemetryUserIdSafely = async (
  stripeCustomerId: string | null
): Promise<string | null> => {
  if (!stripeCustomerId) return null;
  try {
    const profile = await resolveVerifiedBillingProfileByCustomer(stripeCustomerId);
    return profile?.user_id ?? null;
  } catch {
    return null;
  }
};

const processCheckoutAsyncPaymentFailed = async (session: JsonObject, eventId: string) => {
  const stripeCustomerId = normalizeString(session.customer);
  const userId = await resolveFailureTelemetryUserIdSafely(stripeCustomerId);
  const metadata = toRecord(session.metadata);

  await recordBillingTelemetrySafely({
    source: "telemetry.billing.checkout_async_payment_failed",
    message: "checkout_async_payment_failed",
    userId,
    metadata: {
      checkout_session_id: session.id ?? null,
      stripe_customer_id: stripeCustomerId,
      stripe_event_id: eventId,
      credit_package_id: normalizeString(metadata.credit_package_id),
      payment_status: normalizeString(session.payment_status),
    },
  });
};

const processInvoicePaymentIssue = async (
  invoice: JsonObject,
  eventId: string,
  source:
    | "telemetry.billing.invoice_payment_action_required"
    | "telemetry.billing.invoice_payment_failed",
  message: "invoice_payment_action_required" | "invoice_payment_failed"
) => {
  const stripeCustomerId = normalizeString(invoice.customer);
  const userId = await resolveFailureTelemetryUserIdSafely(stripeCustomerId);

  await recordBillingTelemetrySafely({
    source,
    message,
    userId,
    metadata: {
      invoice_id: invoice.id ?? null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: normalizeString(invoice.subscription),
      stripe_event_id: eventId,
      billing_reason: normalizeString(invoice.billing_reason),
      invoice_status: normalizeString(invoice.status),
      amount_due_cents: Number.isFinite(Number(invoice.amount_due))
        ? Number(invoice.amount_due)
        : null,
      attempt_count: Number.isFinite(Number(invoice.attempt_count))
        ? Number(invoice.attempt_count)
        : null,
      next_payment_attempt: Number.isFinite(Number(invoice.next_payment_attempt))
        ? invoice.next_payment_attempt
        : null,
      hosted_invoice_url: normalizeString(invoice.hosted_invoice_url),
    },
  });
};

const recordStorageAddonProjectionDriftSafely = async (params: {
  userId: string | null;
  storageAddonItemCount: number;
  quantityNotOneCount: number;
}) => {
  try {
    await writeAppErrorLog({
      source: "telemetry.billing.storage_addon_projection_drift",
      scope: "app",
      severity: "medium",
      message: "Stripe webhook projected recurring storage add-on drift.",
      userId: params.userId,
      metadata: {
        telemetry_family: "billing_storage",
        telemetry_version: 1,
        storage_addon_item_count: params.storageAddonItemCount,
        quantity_not_one_count: params.quantityNotOneCount,
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

const resolveVerifiedBillingProfileByCustomer = async (
  stripeCustomerId: string
): Promise<BillingProfileProjection | null> => {
  const profile = await resolveBillingProfileByCustomer(stripeCustomerId);
  if (!profile?.user_id) return null;

  await readVerifiedStripeCustomerForUser({
    userId: profile.user_id,
    stripeCustomerId,
  });

  return profile;
};

const resolveCurrentContractForUser = async (
  userId: string
): Promise<BillingContractProjection | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_subscription_contracts")
    .select(
      "id, plan_id, offer_id, billing_interval, stripe_price_id, stripe_subscription_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations, current_period_start, current_period_end, last_credit_grant_at, next_credit_grant_at, status"
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
  const profile = await resolveVerifiedBillingProfileByCustomer(stripeCustomerId);
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

const resolveScheduledSubscriptionChangeProjection = async (
  schedule: JsonObject
): Promise<ScheduledSubscriptionChangeProjection | null> => {
  const stripeScheduleId = normalizeString(schedule.id);
  const stripeCustomerId = resolveScheduleCustomerId(schedule);
  const stripeSubscriptionId = resolveScheduleSubscriptionId(schedule);
  if (!stripeScheduleId || !stripeCustomerId || !stripeSubscriptionId) return null;

  const profile = await resolveVerifiedBillingProfileByCustomer(stripeCustomerId);
  if (!profile?.user_id) return null;

  const phases = readSchedulePhases(schedule);
  const currentPhase = resolveCurrentSchedulePhase(schedule, phases);
  const nextPhase = resolveNextSchedulePhase(phases, currentPhase);
  if (!nextPhase) return null;

  const targetOffer = await resolveSchedulePhasePlanOffer(nextPhase);
  if (!targetOffer?.planId || !targetOffer.stripePriceId) return null;

  const currentContract = await resolveCurrentContractForUser(profile.user_id);
  const currentOffer =
    (currentPhase ? await resolveSchedulePhasePlanOffer(currentPhase) : null) ??
    (currentContract?.offer_id
      ? await resolveOfferFromOfferId(currentContract.offer_id, currentContract.plan_id)
      : currentContract?.stripe_price_id
        ? await resolveOfferFromPriceId(currentContract.stripe_price_id)
        : null);

  const currentPlanId = currentOffer?.planId ?? currentContract?.plan_id ?? profile.plan_id ?? null;
  const currentBillingInterval =
    currentOffer?.billingInterval ??
    (currentContract?.billing_interval === BILLING_INTERVAL_YEAR
      ? BILLING_INTERVAL_YEAR
      : BILLING_INTERVAL_MONTH);
  const currentRank = await resolvePlanSortOrder(currentPlanId);
  const targetRank = await resolvePlanSortOrder(targetOffer.planId);
  const changeKind =
    currentPlanId &&
    currentPlanId !== targetOffer.planId &&
    currentRank != null &&
    targetRank != null &&
    targetRank < currentRank
      ? "scheduled_downgrade"
      : currentPlanId === targetOffer.planId &&
          currentBillingInterval !== targetOffer.billingInterval
        ? "scheduled_interval_change"
        : null;
  if (!changeKind) return null;

  const effectiveAt = asIsoDate(
    typeof nextPhase.start_date === "number" ? nextPhase.start_date : null
  );
  if (!effectiveAt) return null;

  return {
    userId: profile.user_id,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeScheduleId,
    changeKind,
    currentPlanId,
    currentBillingInterval,
    currentStripePriceId: currentOffer?.stripePriceId ?? currentContract?.stripe_price_id ?? null,
    currentOffer,
    targetOffer,
    effectiveAt,
    currentBenefitsEndAt:
      asIsoDate(typeof currentPhase?.end_date === "number" ? currentPhase.end_date : null) ??
      effectiveAt,
    schedulePhaseStartAt: effectiveAt,
    schedulePhaseEndAt: asIsoDate(
      typeof nextPhase.end_date === "number" ? nextPhase.end_date : null
    ),
  };
};

const upsertScheduledSubscriptionChange = async (
  projection: ScheduledSubscriptionChangeProjection
) => {
  const payload = {
    user_id: projection.userId,
    source_kind: "stripe_subscription_schedule",
    status: "active",
    change_kind: projection.changeKind,
    stripe_customer_id: projection.stripeCustomerId,
    stripe_subscription_id: projection.stripeSubscriptionId,
    stripe_schedule_id: projection.stripeScheduleId,
    current_plan_id: projection.currentPlanId,
    current_offer_id: projection.currentOffer?.offerId ?? null,
    current_billing_interval: projection.currentBillingInterval,
    current_stripe_price_id: projection.currentStripePriceId,
    target_plan_id: projection.targetOffer.planId,
    target_offer_id: projection.targetOffer.offerId,
    target_billing_interval: projection.targetOffer.billingInterval,
    target_stripe_price_id: projection.targetOffer.stripePriceId,
    target_recurring_price_cents: projection.targetOffer.recurringPriceCents,
    target_monthly_credits_cents: projection.targetOffer.monthlyCreditsCents,
    target_storage_limit_bytes: projection.targetOffer.storageLimitBytes,
    target_max_concurrent_generations: projection.targetOffer.maxConcurrentGenerations,
    effective_at: projection.effectiveAt,
    current_benefits_end_at: projection.currentBenefitsEndAt,
    schedule_phase_start_at: projection.schedulePhaseStartAt,
    schedule_phase_end_at: projection.schedulePhaseEndAt,
    applied_at: null,
    canceled_at: null,
    released_at: null,
    completed_at: null,
    aborted_at: null,
    metadata: {
      stripe_schedule_id: projection.stripeScheduleId,
      projected_from: "stripe_subscription_schedule",
    },
  };
  const { error } = await getSupabaseAdmin()
    .from("billing_subscription_scheduled_changes")
    .upsert(payload, { onConflict: "stripe_schedule_id" });
  if (error) {
    throw new Error(error.message || "Failed to upsert scheduled subscription change.");
  }
};

const markScheduledSubscriptionChangeStatus = async ({
  scheduleId,
  status,
}: {
  scheduleId: string | null;
  status: "canceled" | "released" | "completed" | "aborted";
}) => {
  if (!scheduleId) return;
  const timestampColumn =
    status === "canceled"
      ? "canceled_at"
      : status === "released"
        ? "released_at"
        : status === "completed"
          ? "completed_at"
          : "aborted_at";
  const { error } = await getSupabaseAdmin()
    .from("billing_subscription_scheduled_changes")
    .update({
      status,
      [timestampColumn]: new Date().toISOString(),
    })
    .eq("stripe_schedule_id", scheduleId);
  if (error) {
    throw new Error(error.message || "Failed to update scheduled subscription change status.");
  }
};

const markAppliedScheduledSubscriptionChange = async ({
  stripeSubscriptionId,
  targetPlanId,
}: {
  stripeSubscriptionId: string | null;
  targetPlanId: string | null;
}) => {
  if (!stripeSubscriptionId || !targetPlanId) return;
  const { error } = await getSupabaseAdmin()
    .from("billing_subscription_scheduled_changes")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("target_plan_id", targetPlanId)
    .eq("status", "active");
  if (error && !isIgnorableSchemaDriftError(error)) {
    throw new Error(error.message || "Failed to mark scheduled subscription change applied.");
  }
};

const processSubscriptionScheduleUpdate = async (
  schedule: JsonObject,
  eventType: string
): Promise<void> => {
  const scheduleId = normalizeString(schedule.id);
  const scheduleStatus = normalizeString(schedule.status);
  if (eventType === "subscription_schedule.canceled" || scheduleStatus === "canceled") {
    await markScheduledSubscriptionChangeStatus({ scheduleId, status: "canceled" });
    return;
  }
  if (eventType === "subscription_schedule.released" || scheduleStatus === "released") {
    await markScheduledSubscriptionChangeStatus({ scheduleId, status: "released" });
    return;
  }
  if (eventType === "subscription_schedule.completed" || scheduleStatus === "completed") {
    await markScheduledSubscriptionChangeStatus({ scheduleId, status: "completed" });
    return;
  }
  if (eventType === "subscription_schedule.aborted" || scheduleStatus === "aborted") {
    await markScheduledSubscriptionChangeStatus({ scheduleId, status: "aborted" });
    return;
  }

  const projection = await resolveScheduledSubscriptionChangeProjection(schedule);
  if (projection) {
    await upsertScheduledSubscriptionChange(projection);
  }
};

const resolveBillingContextFromInvoice = async (
  invoice: JsonObject,
  stripeCustomerId: string,
  preferredOffer?: ResolvedOffer | null
) => {
  const profile = await resolveVerifiedBillingProfileByCustomer(stripeCustomerId);
  if (!profile?.user_id) return null;

  const invoiceMetadata = readInvoiceMetadata(invoice);
  const targetOfferId = normalizeString(invoiceMetadata.billing_offer_id);
  const targetOffer =
    preferredOffer ??
    (await resolveOfferFromOfferId(
      targetOfferId ?? undefined,
      normalizeString(invoiceMetadata.billing_plan_id)
    ));
  if (targetOffer?.planId) {
    const period = toRecord(findInvoiceLineForPriceId(invoice, targetOffer.stripePriceId).period);
    return {
      contractId: null,
      userId: profile.user_id,
      planId: targetOffer.planId,
      offerId: targetOffer.offerId,
      billingInterval:
        targetOffer.billingInterval === BILLING_INTERVAL_YEAR
          ? BILLING_INTERVAL_YEAR
          : BILLING_INTERVAL_MONTH,
      stripePriceId: targetOffer.stripePriceId,
      monthlyCreditsCents: Number(targetOffer.monthlyCreditsCents ?? 0),
      currentPeriodStart: asIsoDate(typeof period.start === "number" ? period.start : null),
      currentPeriodEnd: asIsoDate(typeof period.end === "number" ? period.end : null),
      nextCreditGrantAt: null,
    };
  }
  if (isImmediatePaidUpgradeInvoice(invoice) && targetOfferId) return null;

  const lines = toRecord(invoice.lines);
  const lineData = Array.isArray(lines.data) ? lines.data : [];

  for (const lineValue of lineData) {
    const line = toRecord(lineValue);
    const directPrice = toRecord(line.price);
    const pricing = toRecord(line.pricing);
    const metadata = toRecord(directPrice.metadata);
    const priceId = resolveInvoiceLinePriceId(line) ?? undefined;

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
  const maxConcurrentGenerations = Number(
    params.resolvedOffer?.maxConcurrentGenerations ??
      resolveDefaultPlanConcurrencyLimit(params.planId)
  );
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
  const isFinalCancellation = params.status === "canceled";
  const endedAt = isFinalCancellation
    ? (params.currentPeriodEnd ?? new Date().toISOString())
    : null;
  const effectiveCancelAtPeriodEnd = isFinalCancellation ? false : params.cancelAtPeriodEnd;

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
    max_concurrent_generations: Number.isFinite(maxConcurrentGenerations)
      ? Math.max(0, Math.trunc(maxConcurrentGenerations))
      : 0,
    billing_interval: billingInterval,
    status: params.status,
    current_period_start: params.currentPeriodStart,
    current_period_end: params.currentPeriodEnd,
    last_credit_grant_at:
      billingInterval === BILLING_INTERVAL_YEAR ? (current?.last_credit_grant_at ?? null) : null,
    next_credit_grant_at: billingInterval === BILLING_INTERVAL_YEAR ? nextCreditGrantAt : null,
    cancel_at_period_end: effectiveCancelAtPeriodEnd,
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
    Number(current.storage_limit_bytes ?? 0) === payload.storage_limit_bytes &&
    Number(current.max_concurrent_generations ?? 0) === payload.max_concurrent_generations;

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
  const isFinalCancellation = params.status === "canceled";
  const finalCancellationEndedAt = params.currentPeriodEnd ?? transitionTime;

  for (const current of currentRows) {
    const currentItemId = current.stripe_subscription_item_id;
    if (!isFinalCancellation && (!currentItemId || nextItemIds.has(currentItemId))) {
      continue;
    }

    const { error } = await supabaseAdmin
      .from("billing_subscription_storage_addons")
      .update({
        status: "canceled",
        ended_at: isFinalCancellation ? finalCancellationEndedAt : transitionTime,
        current_period_end: params.currentPeriodEnd,
        cancel_at_period_end: false,
      })
      .eq("id", current.id);
    if (error && !isIgnorableSchemaDriftError(error)) {
      throw new Error(error.message || "Failed to close removed billing storage add-on contract.");
    }
  }

  if (isFinalCancellation) {
    return;
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
      ended_at: null,
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
  creditKind: "paid_topup" | "subscription_allocation";
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  const { error } = await grantAccountCredits({
    userId: params.userId,
    amountCents: params.changeCents,
    source: params.source,
    sourceRef: params.sourceRef,
    reason: params.reason,
    creditKind: params.creditKind,
    expiresAt: params.expiresAt ?? null,
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
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const creditAmountRaw = metadata.credit_amount_cents;
  const packageId =
    typeof metadata.credit_package_id === "string" ? metadata.credit_package_id : null;
  const packageDisplayName =
    typeof metadata.credit_package_display_name === "string"
      ? metadata.credit_package_display_name
      : null;
  const packagePriceCentsRaw = metadata.credit_package_price_cents;
  if (!userId || !creditAmountRaw || !stripeCustomerId) return;

  await readVerifiedStripeCustomerForUser({
    userId,
    stripeCustomerId,
  });

  const creditAmount = Number(creditAmountRaw);
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) return;
  const packagePriceCents = Number(packagePriceCentsRaw);

  await applyCredit({
    userId,
    changeCents: creditAmount,
    source: "stripe_checkout",
    sourceRef: buildCheckoutGrantSourceRef(session, eventId),
    reason: packageId ? `Credit purchase (${packageId})` : "Credit purchase",
    creditKind: "paid_topup",
    expiresAt: null,
    metadata: {
      checkout_session_id: session.id ?? null,
      stripe_customer_id: stripeCustomerId,
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
      stripe_customer_id: stripeCustomerId,
      credit_package_id: packageId,
      stripe_event_id: eventId,
    },
  });
};

const processSubscriptionUpdate = async (subscription: JsonObject) => {
  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : undefined;
  if (!stripeCustomerId) return;

  const profile = await resolveVerifiedBillingProfileByCustomer(stripeCustomerId);

  const items = toRecord(subscription.items);
  const itemData = Array.isArray(items.data) ? items.data : [];
  const fallbackPeriod = resolveSubscriptionPeriodFromItems(itemData);
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

  const quantityNotOneCount = resolvedAddons.filter((addon) => addon.quantity !== 1).length;
  if (resolvedAddons.length > 1 || quantityNotOneCount > 0) {
    await recordStorageAddonProjectionDriftSafely({
      userId: profile?.user_id ?? null,
      storageAddonItemCount: resolvedAddons.length,
      quantityNotOneCount,
    });
  }

  resolvedPlanId = resolvedPlanId ?? profile?.plan_id ?? null;
  const subscriptionStatus =
    typeof subscription.status === "string" ? subscription.status : "inactive";
  const cancelAtPeriodEnd = normalizeBoolean(subscription.cancel_at_period_end);
  const isFinalCancellation = subscriptionStatus === "canceled";
  const resolvedCurrentPeriodStart =
    asIsoDate(
      typeof subscription.current_period_start === "number"
        ? subscription.current_period_start
        : typeof subscription.start_date === "number"
          ? subscription.start_date
          : null
    ) ?? fallbackPeriod.currentPeriodStart;
  const resolvedCurrentPeriodEnd =
    asIsoDate(
      typeof subscription.current_period_end === "number" ? subscription.current_period_end : null
    ) ?? fallbackPeriod.currentPeriodEnd;
  const runtimePlanId = isFinalCancellation ? "free" : resolvedPlanId;
  const runtimeCurrentPeriodEnd = isFinalCancellation ? null : resolvedCurrentPeriodEnd;

  const updatePayload: JsonObject = {
    stripe_subscription_id: isFinalCancellation ? null : (subscription.id ?? null),
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
    currentPeriodStart: resolvedCurrentPeriodStart,
    currentPeriodEnd: resolvedCurrentPeriodEnd,
    cancelAtPeriodEnd,
    resolvedOffer,
  });

  await syncSubscriptionStorageAddons({
    userId: profile.user_id,
    stripeCustomerId,
    stripeSubscriptionId: normalizeString(subscription.id),
    status: subscriptionStatus,
    currentPeriodStart: resolvedCurrentPeriodStart,
    currentPeriodEnd: resolvedCurrentPeriodEnd,
    cancelAtPeriodEnd,
    resolvedAddons,
  });

  await markAppliedScheduledSubscriptionChange({
    stripeSubscriptionId: normalizeString(subscription.id),
    targetPlanId: resolvedPlanId,
  });
};

const processInvoicePaymentSucceeded = async (invoice: JsonObject, eventId: string) => {
  const billingReason = normalizeString(invoice.billing_reason);
  if (!billingReason || !SUBSCRIPTION_CREDIT_GRANT_BILLING_REASONS.has(billingReason)) {
    return;
  }
  const isSubscriptionUpdateInvoice = billingReason === "subscription_update";
  const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
  if (!stripeCustomerId) return;
  let subscriptionUpdateGrant: SubscriptionUpdateGrant | null = null;
  if (isSubscriptionUpdateInvoice) {
    const legacyGrantOffer = await resolvePaidSubscriptionUpdateGrantOffer(invoice);
    subscriptionUpdateGrant = legacyGrantOffer
      ? {
          offer: legacyGrantOffer,
          subscriptionChangeIntentId: null,
        }
      : await resolveFullPriceUpgradeIntentGrant(invoice, stripeCustomerId);
    if (!subscriptionUpdateGrant) return;
  }

  const sourceRef = buildSubscriptionGrantSourceRef(invoice, eventId);

  let billingContext:
    | Awaited<ReturnType<typeof resolveCurrentBillingContextByCustomer>>
    | Awaited<ReturnType<typeof resolveBillingContextFromInvoice>>
    | null = null;
  try {
    billingContext = isSubscriptionUpdateInvoice
      ? await resolveBillingContextFromInvoice(
          invoice,
          stripeCustomerId,
          subscriptionUpdateGrant?.offer ?? null
        )
      : ((await resolveCurrentBillingContextByCustomer(stripeCustomerId)) ??
        (await resolveBillingContextFromInvoice(invoice, stripeCustomerId)));
    if (!billingContext?.userId || !billingContext.planId) return;

    const monthlyCredits = Number(billingContext.monthlyCreditsCents ?? 0);
    if (!Number.isFinite(monthlyCredits) || monthlyCredits <= 0) return;

    await applyCredit({
      userId: billingContext.userId,
      changeCents: monthlyCredits,
      source: "subscription_renewal",
      sourceRef,
      reason: "Monthly plan credit allocation",
      creditKind: "subscription_allocation",
      expiresAt: resolveSubscriptionCreditExpiresAt(),
      metadata: {
        invoice_id: invoice.id ?? null,
        billing_reason: billingReason,
        plan_id: billingContext.planId,
        offer_id: billingContext.offerId,
        stripe_customer_id: stripeCustomerId,
        stripe_price_id: billingContext.stripePriceId,
        subscription_change_intent_id: subscriptionUpdateGrant?.subscriptionChangeIntentId ?? null,
      },
    });

    if (subscriptionUpdateGrant?.subscriptionChangeIntentId) {
      await markSubscriptionChangeIntentCompleted({
        intentId: subscriptionUpdateGrant.subscriptionChangeIntentId,
        stripeInvoiceId: normalizeString(invoice.id),
      });
    }

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
  } catch (error) {
    throw withWebhookMetadata(error, {
      invoice_id: invoice.id ?? null,
      subscription_grant_source_ref: sourceRef,
      billing_reason: billingReason,
      stripe_customer_id: stripeCustomerId,
      user_id: billingContext?.userId ?? null,
      contract_id: billingContext?.contractId ?? null,
      plan_id: billingContext?.planId ?? null,
      offer_id: billingContext?.offerId ?? null,
      stripe_price_id: billingContext?.stripePriceId ?? null,
      monthly_credits_cents: billingContext?.monthlyCreditsCents ?? null,
      subscription_change_intent_id: subscriptionUpdateGrant?.subscriptionChangeIntentId ?? null,
    });
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
    if (eventClaim.kind === "duplicate") {
      return res.status(200).json({ received: true, duplicate: true });
    }

    try {
      const object = event.data?.object ?? {};
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        await processCheckoutCompleted(object, event.id);
      }
      if (event.type === "checkout.session.async_payment_failed") {
        await processCheckoutAsyncPaymentFailed(object, event.id);
      }
      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.pending_update_applied" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        await processSubscriptionUpdate(object);
      }
      if (
        event.type === "subscription_schedule.created" ||
        event.type === "subscription_schedule.updated" ||
        event.type === "subscription_schedule.released" ||
        event.type === "subscription_schedule.completed" ||
        event.type === "subscription_schedule.canceled" ||
        event.type === "subscription_schedule.aborted"
      ) {
        await processSubscriptionScheduleUpdate(object, event.type);
      }
      if (event.type === "invoice.payment_succeeded") {
        await processInvoicePaymentSucceeded(object, event.id);
      }
      if (event.type === "invoice.payment_failed") {
        await processInvoicePaymentIssue(
          object,
          event.id,
          "telemetry.billing.invoice_payment_failed",
          "invoice_payment_failed"
        );
      }
      if (event.type === "invoice.payment_action_required") {
        await processInvoicePaymentIssue(
          object,
          event.id,
          "telemetry.billing.invoice_payment_action_required",
          "invoice_payment_action_required"
        );
      }
    } catch (processingError) {
      const releaseResult = await releaseStripeEventClaim(event);
      await logApiRouteException({
        req,
        error: processingError,
        routeLabel: "billing/stripe/webhook",
        metadata: {
          stripe_event_signature_present: Boolean(req.headers["stripe-signature"]),
          stripe_event_id: event.id,
          stripe_event_type: event.type,
          ...getWebhookErrorMetadata(processingError),
          claim_released_for_retry: releaseResult.error ? false : true,
          claim_release_error: releaseResult.error,
        },
      });
      return res.status(500).json({
        error: "Webhook processing failed.",
      });
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
