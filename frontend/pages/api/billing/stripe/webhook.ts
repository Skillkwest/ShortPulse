/**
 * Stripe webhook endpoint (signature-verified, idempotent).
 * Applies credit grants and subscription state updates to Supabase.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../_utils/appErrorLogs";
import { getSupabaseAdmin } from "../../_utils/supabaseAdmin";
import { verifyStripeWebhookSignature } from "../../_utils/stripe";
import { insertCreditLedgerEntry } from "../../_utils/creditLedger";

type StripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, any>;
  };
};

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

const resolvePlanIdFromSubscription = async (
  stripePriceId: string | undefined,
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
  if (error) {
    throw new Error(error.message || "Credit ledger insert failed.");
  }
};

const processCheckoutCompleted = async (session: Record<string, any>, eventId: string) => {
  const userId = session?.metadata?.user_id || session?.client_reference_id;
  const creditAmountRaw = session?.metadata?.credit_amount_cents;
  const packageId = session?.metadata?.credit_package_id ?? null;
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
      checkout_session_id: session?.id ?? null,
      stripe_customer_id: session?.customer ?? null,
      credit_package_id: packageId,
    },
  });
};

const processSubscriptionUpdate = async (subscription: Record<string, any>) => {
  const supabaseAdmin = getSupabaseAdmin();
  const stripeCustomerId = subscription?.customer as string | undefined;
  if (!stripeCustomerId) return;

  const priceId = subscription?.items?.data?.[0]?.price?.id as string | undefined;
  const resolvedPlanId = await resolvePlanIdFromSubscription(priceId);

  const updatePayload: Record<string, any> = {
    stripe_subscription_id: subscription?.id ?? null,
    subscription_status: subscription?.status ?? "inactive",
    current_period_end: asIsoDate(subscription?.current_period_end ?? null),
  };
  if (resolvedPlanId) {
    updatePayload.plan_id = resolvedPlanId;
  }

  await supabaseAdmin
    .from("billing_profiles")
    .update(updatePayload)
    .eq("stripe_customer_id", stripeCustomerId);
};

const processInvoicePaymentSucceeded = async (invoice: Record<string, any>, eventId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const stripeCustomerId = invoice?.customer as string | undefined;
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
      invoice_id: invoice?.id ?? null,
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

    const supabaseAdmin = getSupabaseAdmin();

    const { data: existingEvent } = await supabaseAdmin
      .from("stripe_event_log")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();
    if (existingEvent?.id) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    await supabaseAdmin.from("stripe_event_log").insert({
      id: event.id,
      event_type: event.type,
      payload: event as any,
    });

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
