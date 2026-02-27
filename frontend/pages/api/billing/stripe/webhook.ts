/**
 * Stripe webhook endpoint (signature-verified, idempotent).
 * Applies credit grants and subscription state updates to Supabase.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { verifyStripeWebhookSignature } from "../../../../lib/server/api/stripe";
import { insertCreditLedgerEntry } from "../../../../lib/server/api/creditLedger";

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

export const config = {
  api: {
    bodyParser: false,
  },
};

const readRawBody = async (req: NextApiRequest): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });

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
    sourceRef: eventId,
    reason: packageId ? `Credit purchase (${packageId})` : "Credit purchase",
    metadata: {
      checkout_session_id: session.id ?? null,
      stripe_customer_id: session.customer ?? null,
      credit_package_id: packageId,
    },
  });
};

const processSubscriptionUpdate = async (subscription: JsonObject) => {
  const supabaseAdmin = getSupabaseAdmin();
  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : undefined;
  if (!stripeCustomerId) return;

  const items = toRecord(subscription.items);
  const itemData = Array.isArray(items.data) ? items.data : [];
  const firstItem = toRecord(itemData[0]);
  const priceIdCandidate = toRecord(firstItem.price).id;
  const priceId = typeof priceIdCandidate === "string" ? priceIdCandidate : undefined;
  const resolvedPlanId = await resolvePlanIdFromSubscription(priceId);

  const updatePayload: JsonObject = {
    stripe_subscription_id: subscription.id ?? null,
    subscription_status: typeof subscription.status === "string" ? subscription.status : "inactive",
    current_period_end: asIsoDate(
      typeof subscription.current_period_end === "number" ? subscription.current_period_end : null
    ),
  };
  if (resolvedPlanId) {
    updatePayload.plan_id = resolvedPlanId;
  }

  await supabaseAdmin
    .from("billing_profiles")
    .update(updatePayload)
    .eq("stripe_customer_id", stripeCustomerId);
};

const processInvoicePaymentSucceeded = async (invoice: JsonObject, eventId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
  if (!stripeCustomerId) return;

  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("user_id, plan_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (!profile?.user_id || !profile.plan_id) return;

  const { data: plan } = await supabaseAdmin
    .from("billing_plans")
    .select("monthly_credits_cents")
    .eq("id", profile.plan_id)
    .maybeSingle();
  const monthlyCredits = Number(plan?.monthly_credits_cents ?? 0);
  if (!Number.isFinite(monthlyCredits) || monthlyCredits <= 0) return;

  await applyCredit({
    userId: profile.user_id,
    changeCents: monthlyCredits,
    source: "subscription_renewal",
    sourceRef: eventId,
    reason: "Monthly plan credit allocation",
    metadata: {
      invoice_id: invoice.id ?? null,
      plan_id: profile.plan_id,
      stripe_customer_id: stripeCustomerId,
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
    const rawBody = await readRawBody(req);
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
      return res.status(500).json({ error: eventClaim.message });
    }
    const duplicateEvent = eventClaim.kind === "duplicate";

    const object = event.data?.object ?? {};
    if (event.type === "checkout.session.completed") {
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
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/stripe/webhook",
      metadata: {
        stripe_event_signature_present: Boolean(req.headers["stripe-signature"]),
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Webhook processing failed.",
    });
  }
}
