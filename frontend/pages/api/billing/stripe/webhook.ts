/**
 * Stripe webhook endpoint (signature-verified, idempotent).
 * Applies credit grants and subscription state updates to Supabase.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
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
  stripePriceId: string | null;
  recurringPriceCents: number;
  monthlyCreditsCents: number;
};

type BillingProfileProjection = {
  user_id: string | null;
  plan_id: string | null;
};

type BillingContractProjection = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_id: string | null;
  recurring_price_cents: number | null;
  monthly_credits_cents: number | null;
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
    .select("id, plan_id, stripe_price_id, recurring_price_cents, monthly_credits_cents")
    .eq("stripe_price_id", stripePriceId)
    .maybeSingle();

  if (offer) {
    return {
      offerId: typeof offer.id === "string" ? offer.id : null,
      planId: typeof offer.plan_id === "string" ? offer.plan_id : null,
      stripePriceId:
        typeof offer.stripe_price_id === "string" ? offer.stripe_price_id : stripePriceId,
      recurringPriceCents: Number(offer.recurring_price_cents ?? 0),
      monthlyCreditsCents: Number(offer.monthly_credits_cents ?? 0),
    };
  }

  if (offerError && !isIgnorableSchemaDriftError(offerError)) {
    throw new Error(offerError.message || "Failed to load billing plan offer.");
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from("billing_plans")
    .select("id, stripe_price_id, monthly_price_cents, monthly_credits_cents")
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
      stripePriceId,
      recurringPriceCents: Number.isFinite(recurringPriceCents) ? recurringPriceCents : 0,
      monthlyCreditsCents: Number.isFinite(monthlyCreditsCents) ? monthlyCreditsCents : 0,
    };
  }

  return {
    offerId: typeof plan.id === "string" ? `${plan.id}__current` : null,
    planId: typeof plan.id === "string" ? plan.id : null,
    stripePriceId: typeof plan.stripe_price_id === "string" ? plan.stripe_price_id : stripePriceId,
    recurringPriceCents: Number(plan.monthly_price_cents ?? 0),
    monthlyCreditsCents: Number(plan.monthly_credits_cents ?? 0),
  };
};

const normalizeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const normalizeBoolean = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

const buildCheckoutGrantSourceRef = (session: JsonObject, fallbackEventId: string): string => {
  const sessionId = normalizeString(session.id);
  return sessionId ? `checkout_session:${sessionId}` : `checkout_event:${fallbackEventId}`;
};

const buildSubscriptionGrantSourceRef = (invoice: JsonObject, fallbackEventId: string): string => {
  const invoiceId = normalizeString(invoice.id);
  return invoiceId ? `invoice:${invoiceId}:monthly_allocation` : `invoice_event:${fallbackEventId}`;
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
      "id, plan_id, offer_id, stripe_price_id, stripe_subscription_id, recurring_price_cents, monthly_credits_cents, status"
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

const resolveCurrentBillingContextByCustomer = async (stripeCustomerId: string) => {
  const profile = await resolveBillingProfileByCustomer(stripeCustomerId);
  if (!profile?.user_id) return null;

  const contract = await resolveCurrentContractForUser(profile.user_id);
  if (contract) {
    return {
      userId: profile.user_id,
      planId: contract.plan_id ?? profile.plan_id,
      offerId: contract.offer_id ?? null,
      stripePriceId: contract.stripe_price_id ?? null,
      monthlyCreditsCents: Number(contract.monthly_credits_cents ?? 0),
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: plan, error: planError } = await supabaseAdmin
    .from("billing_plans")
    .select("monthly_credits_cents")
    .eq("id", profile.plan_id)
    .maybeSingle();
  if (planError && !isIgnorableSchemaDriftError(planError)) {
    throw new Error(planError.message || "Failed to load billing plan.");
  }

  return {
    userId: profile.user_id,
    planId: profile.plan_id,
    offerId: profile.plan_id ? `${profile.plan_id}__current` : null,
    stripePriceId: null,
    monthlyCreditsCents: Number(plan?.monthly_credits_cents ?? 0),
  };
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
  const stripePriceId = params.resolvedOffer?.stripePriceId ?? null;
  const offerId = params.resolvedOffer?.offerId ?? null;

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
    status: params.status,
    current_period_start: params.currentPeriodStart,
    current_period_end: params.currentPeriodEnd,
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
    current.stripe_subscription_id === params.stripeSubscriptionId &&
    current.stripe_price_id === stripePriceId &&
    Number(current.recurring_price_cents ?? 0) === payload.recurring_price_cents &&
    Number(current.monthly_credits_cents ?? 0) === payload.monthly_credits_cents;

  if (sameCommercialTerms) {
    const { error } = await supabaseAdmin
      .from("billing_subscription_contracts")
      .update({
        status: payload.status,
        current_period_start: payload.current_period_start,
        current_period_end: payload.current_period_end,
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
  if (!userId || !creditAmountRaw) return;

  const creditAmount = Number(creditAmountRaw);
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) return;

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
  const firstItem = toRecord(itemData[0]);
  const price = toRecord(firstItem.price);
  const priceIdCandidate = price.id;
  const priceId = typeof priceIdCandidate === "string" ? priceIdCandidate : undefined;
  const fallbackRecurringPriceCents = Number(price.unit_amount ?? 0);
  const priceMetadata = toRecord(price.metadata);
  const fallbackMonthlyCreditsCents = Number(priceMetadata.monthly_credits_cents ?? 0);
  const resolvedOffer = await resolveOfferFromPriceId(priceId, {
    recurringPriceCents: Number.isFinite(fallbackRecurringPriceCents)
      ? fallbackRecurringPriceCents
      : 0,
    monthlyCreditsCents: Number.isFinite(fallbackMonthlyCreditsCents)
      ? fallbackMonthlyCreditsCents
      : 0,
  });
  const resolvedPlanId =
    resolvedOffer?.planId ??
    (await resolvePlanIdFromSubscription(priceId)) ??
    profile?.plan_id ??
    null;

  const updatePayload: JsonObject = {
    stripe_subscription_id: subscription.id ?? null,
    subscription_status: typeof subscription.status === "string" ? subscription.status : "inactive",
    stripe_customer_id: stripeCustomerId,
    current_period_end: asIsoDate(
      typeof subscription.current_period_end === "number" ? subscription.current_period_end : null
    ),
  };
  if (resolvedPlanId) {
    updatePayload.plan_id = resolvedPlanId;
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
    status: typeof subscription.status === "string" ? subscription.status : "inactive",
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
    cancelAtPeriodEnd: normalizeBoolean(subscription.cancel_at_period_end),
    resolvedOffer,
  });
};

const processInvoicePaymentSucceeded = async (invoice: JsonObject, eventId: string) => {
  const billingReason = normalizeString(invoice.billing_reason);
  if (!billingReason || !SUBSCRIPTION_CREDIT_GRANT_BILLING_REASONS.has(billingReason)) {
    return;
  }

  const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
  if (!stripeCustomerId) return;

  const billingContext = await resolveCurrentBillingContextByCustomer(stripeCustomerId);
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
