import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAuthDisplayName } from "../../../../lib/server/api/accountIdentity";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../../lib/server/api/auth";
import {
  BILLING_CONTRACT_SOURCE_INTERNAL_COMP,
  BILLING_CONTRACT_SOURCE_STRIPE,
} from "../../../../lib/server/api/billingContracts";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import {
  getCanonicalAppBaseUrl,
  stripeGet,
  stripePostForm,
} from "../../../../lib/server/api/stripe";
import { ensureStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";

type ChangeSubscriptionRequest = {
  targetPlanId?: string;
  billingInterval?: "month" | "year";
};

type BillingProfileRow = {
  user_id: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
};

type BillingContractRow = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  billing_interval: "month" | "year" | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string | null;
  contract_source: string | null;
};

type BillingPlanRow = {
  id: string;
  display_name: string;
  is_active: boolean;
};

type BillingPlanOfferRow = {
  id: string;
  plan_id: string;
  billing_interval: "month" | "year";
  stripe_price_id: string | null;
  recurring_price_cents: number;
  acquisition_enabled: boolean;
  is_active: boolean;
  effective_start_at: string | null;
  created_at: string;
};

type StripePortalSession = {
  id: string;
  url: string;
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
};

type StripeSubscriptionResponse = {
  id: string;
  items?: {
    data?: Array<{
      id?: string;
      quantity?: number;
      price?: {
        id?: string;
      };
    }>;
  };
};

const normalizePlanId = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeBillingInterval = (value: unknown): "month" | "year" =>
  value === "year" ? "year" : "month";

const compareOfferRecency = (left: BillingPlanOfferRow, right: BillingPlanOfferRow): number => {
  const leftEffective = left.effective_start_at ? Date.parse(left.effective_start_at) : Number.NaN;
  const rightEffective = right.effective_start_at
    ? Date.parse(right.effective_start_at)
    : Number.NaN;
  const leftCreated = Date.parse(left.created_at);
  const rightCreated = Date.parse(right.created_at);

  if (
    Number.isFinite(leftEffective) &&
    Number.isFinite(rightEffective) &&
    leftEffective !== rightEffective
  ) {
    return rightEffective - leftEffective;
  }
  if (Number.isFinite(leftEffective) && !Number.isFinite(rightEffective)) return -1;
  if (!Number.isFinite(leftEffective) && Number.isFinite(rightEffective)) return 1;
  if (leftCreated !== rightCreated) return rightCreated - leftCreated;
  return right.id.localeCompare(left.id);
};

const resolveProfileReturnUrl = (status: string) =>
  `${getCanonicalAppBaseUrl()}/profile?section=subscription&plan_change=${status}`;

const resolveActivePlanId = (
  billingProfile: BillingProfileRow | null,
  billingContract: BillingContractRow | null
) => {
  const planId = billingContract?.plan_id ?? billingProfile?.plan_id ?? "free";
  return typeof planId === "string" && planId.trim() ? planId : "free";
};

const loadBillingState = async (userId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const [billingProfileResult, billingContractResult] = await Promise.all([
    supabaseAdmin
      .from("billing_profiles")
      .select(
        "user_id, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_subscription_contracts")
      .select(
        "id, plan_id, offer_id, billing_interval, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, contract_source"
      )
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (billingProfileResult.error || billingContractResult.error) {
    throw new Error(
      billingProfileResult.error?.message ||
        billingContractResult.error?.message ||
        "Failed to load current billing state."
    );
  }

  return {
    billingProfile: (billingProfileResult.data as BillingProfileRow | null) ?? null,
    billingContract: (billingContractResult.data as BillingContractRow | null) ?? null,
  };
};

const loadTargetPlan = async (targetPlanId: string, billingInterval: "month" | "year") => {
  const supabaseAdmin = getSupabaseAdmin();
  const [planResult, offersResult] = await Promise.all([
    supabaseAdmin
      .from("billing_plans")
      .select("id, display_name, is_active")
      .eq("id", targetPlanId)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_plan_offers")
      .select(
        "id, plan_id, billing_interval, stripe_price_id, recurring_price_cents, acquisition_enabled, is_active, effective_start_at, created_at"
      )
      .eq("plan_id", targetPlanId)
      .eq("billing_interval", billingInterval)
      .eq("is_active", true)
      .eq("acquisition_enabled", true),
  ]);

  if (planResult.error || offersResult.error) {
    throw new Error(
      planResult.error?.message || offersResult.error?.message || "Failed to load plan catalog."
    );
  }

  const plan = (planResult.data as BillingPlanRow | null) ?? null;
  const offers = Array.isArray(offersResult.data)
    ? ((offersResult.data as BillingPlanOfferRow[]).filter(
        (offer) => offer.is_active && offer.acquisition_enabled
      ) as BillingPlanOfferRow[])
    : [];

  if (!plan || !plan.is_active) {
    return { plan: null, offer: null };
  }

  const currentOffer = [...offers].sort(compareOfferRecency)[0] ?? null;
  return { plan, offer: currentOffer };
};

const resolveBaseSubscriptionItem = async (params: {
  stripeSubscriptionId: string;
  contractStripePriceId: string | null;
}) => {
  const subscription = await stripeGet<StripeSubscriptionResponse>(
    `/subscriptions/${params.stripeSubscriptionId}`
  );
  const items = Array.isArray(subscription.items?.data) ? subscription.items.data : [];
  if (!items.length) {
    throw new Error("Stripe subscription has no items.");
  }

  if (items.length === 1) {
    return {
      itemId: items[0]?.id ?? null,
      quantity: Math.max(1, Number(items[0]?.quantity ?? 1) || 1),
      itemCount: 1,
    };
  }

  if (params.contractStripePriceId) {
    const currentItem = items.find((item) => item.price?.id === params.contractStripePriceId);
    if (currentItem?.id) {
      return {
        itemId: currentItem.id,
        quantity: Math.max(1, Number(currentItem.quantity ?? 1) || 1),
        itemCount: items.length,
      };
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  for (const item of items) {
    const stripePriceId = item.price?.id;
    if (!stripePriceId) continue;

    const { data: offer, error } = await supabaseAdmin
      .from("billing_plan_offers")
      .select("id")
      .eq("stripe_price_id", stripePriceId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || "Failed to resolve Stripe subscription item.");
    }
    if (offer && item.id) {
      return {
        itemId: item.id,
        quantity: Math.max(1, Number(item.quantity ?? 1) || 1),
        itemCount: items.length,
      };
    }
  }

  return { itemId: null, quantity: 1, itemCount: items.length };
};

const createPortalSession = async (payload: Record<string, string | number>) =>
  stripePostForm<StripePortalSession>("/billing_portal/sessions", payload);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as ChangeSubscriptionRequest;
  const targetPlanId = normalizePlanId(body.targetPlanId);
  const billingInterval = normalizeBillingInterval(body.billingInterval);
  if (!targetPlanId) {
    return res.status(400).json({ error: "targetPlanId is required." });
  }

  try {
    const { billingProfile, billingContract } = await loadBillingState(user.id);
    const activePlanId = resolveActivePlanId(billingProfile, billingContract);
    const activeBillingInterval = billingContract?.billing_interval === "year" ? "year" : "month";
    const stripeSubscriptionId =
      billingContract?.stripe_subscription_id ?? billingProfile?.stripe_subscription_id ?? null;
    const isInternalCompContract =
      billingContract?.contract_source === BILLING_CONTRACT_SOURCE_INTERNAL_COMP;
    const allowSamePlanMigration = isInternalCompContract && targetPlanId !== "free";

    if (
      targetPlanId === activePlanId &&
      billingInterval === activeBillingInterval &&
      !allowSamePlanMigration
    ) {
      return res.status(409).json({ error: "You are already on that plan." });
    }

    if (targetPlanId === "free") {
      if (isInternalCompContract) {
        const nowIso = new Date().toISOString();
        const supabaseAdmin = getSupabaseAdmin();

        if (billingContract?.id) {
          const { error: closeContractError } = await supabaseAdmin
            .from("billing_subscription_contracts")
            .update({
              status: "canceled",
              ended_at: nowIso,
            })
            .eq("id", billingContract.id);
          if (closeContractError) {
            throw new Error(
              closeContractError.message || "Failed to close internal plan contract."
            );
          }
        }

        const { error: closeStorageAddonsError } = await supabaseAdmin
          .from("billing_subscription_storage_addons")
          .update({
            status: "canceled",
            ended_at: nowIso,
            current_period_end: nowIso,
            cancel_at_period_end: false,
          })
          .eq("user_id", user.id)
          .is("ended_at", null);
        if (closeStorageAddonsError) {
          throw new Error(
            closeStorageAddonsError.message || "Failed to close recurring storage add-ons."
          );
        }

        const preservedStripeCustomerId =
          billingProfile?.stripe_customer_id ?? billingContract?.stripe_customer_id ?? null;
        const { error: profileUpdateError } = await supabaseAdmin.from("billing_profiles").upsert(
          {
            user_id: user.id,
            plan_id: "free",
            stripe_customer_id: preservedStripeCustomerId,
            stripe_subscription_id: null,
            subscription_status: "canceled",
            current_period_end: null,
          },
          { onConflict: "user_id" }
        );
        if (profileUpdateError) {
          throw new Error(profileUpdateError.message || "Failed to update billing profile.");
        }

        return res.status(200).json({
          redirectUrl: resolveProfileReturnUrl("switched_free"),
          mode: "app",
        });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(501).json({ error: "Stripe is not configured on the server yet." });
      }
      if (!stripeSubscriptionId) {
        return res.status(409).json({ error: "No active paid subscription was found." });
      }

      const stripeCustomerId = await ensureStripeCustomerForUser({
        userId: user.id,
        email: user.email ?? null,
        displayName: resolveAuthDisplayName(user),
      });
      const returnUrl = `${getCanonicalAppBaseUrl()}/profile?section=subscription`;
      const session = await createPortalSession({
        customer: stripeCustomerId,
        return_url: returnUrl,
        "flow_data[type]": "subscription_cancel",
        "flow_data[subscription_cancel][subscription]": stripeSubscriptionId,
        "flow_data[after_completion][type]": "redirect",
        "flow_data[after_completion][redirect][return_url]": resolveProfileReturnUrl("canceled"),
      });

      return res.status(200).json({
        redirectUrl: session.url,
        mode: "portal",
      });
    }

    const { plan: targetPlan, offer: targetOffer } = await loadTargetPlan(
      targetPlanId,
      billingInterval
    );
    if (!targetPlan || !targetOffer) {
      return res.status(404).json({
        error:
          billingInterval === "year"
            ? "Annual billing for that plan is not available right now."
            : "Selected plan is not available right now.",
      });
    }
    if (targetOffer.recurring_price_cents > 0 && !targetOffer.stripe_price_id) {
      return res
        .status(409)
        .json({ error: `Plan '${targetPlan.display_name}' is missing a Stripe price id.` });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(501).json({ error: "Stripe is not configured on the server yet." });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
      displayName: resolveAuthDisplayName(user),
    });

    if (
      billingContract?.contract_source === BILLING_CONTRACT_SOURCE_STRIPE &&
      typeof stripeSubscriptionId === "string" &&
      stripeSubscriptionId.length > 0
    ) {
      const returnUrl = `${getCanonicalAppBaseUrl()}/profile?section=subscription`;
      const baseItem = await resolveBaseSubscriptionItem({
        stripeSubscriptionId,
        contractStripePriceId: billingContract?.stripe_price_id ?? null,
      });

      if (baseItem.itemCount === 1 && baseItem.itemId && targetOffer.stripe_price_id) {
        const session = await createPortalSession({
          customer: stripeCustomerId,
          return_url: returnUrl,
          "flow_data[type]": "subscription_update_confirm",
          "flow_data[subscription_update_confirm][subscription]": stripeSubscriptionId,
          "flow_data[subscription_update_confirm][items][0][id]": baseItem.itemId,
          "flow_data[subscription_update_confirm][items][0][price]": targetOffer.stripe_price_id,
          "flow_data[subscription_update_confirm][items][0][quantity]": baseItem.quantity,
          "flow_data[after_completion][type]": "redirect",
          "flow_data[after_completion][redirect][return_url]": resolveProfileReturnUrl("updated"),
        });

        return res.status(200).json({
          redirectUrl: session.url,
          mode: "portal",
        });
      }

      const session = await createPortalSession({
        customer: stripeCustomerId,
        return_url: returnUrl,
        "flow_data[type]": "subscription_update",
        "flow_data[subscription_update][subscription]": stripeSubscriptionId,
        "flow_data[after_completion][type]": "redirect",
        "flow_data[after_completion][redirect][return_url]": resolveProfileReturnUrl("updated"),
      });

      return res.status(200).json({
        redirectUrl: session.url,
        mode: "portal",
      });
    }

    if (!targetOffer.stripe_price_id) {
      return res.status(409).json({ error: "Selected plan is not purchasable yet." });
    }

    const session = await stripePostForm<StripeCheckoutSession>("/checkout/sessions", {
      mode: "subscription",
      customer: stripeCustomerId,
      allow_promotion_codes: true,
      "line_items[0][price]": targetOffer.stripe_price_id,
      "line_items[0][quantity]": 1,
      success_url: resolveProfileReturnUrl("checkout_success"),
      cancel_url: resolveProfileReturnUrl("checkout_cancel"),
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
      "metadata[billing_plan_id]": targetPlanId,
      "metadata[billing_offer_id]": targetOffer.id,
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][billing_plan_id]": targetPlanId,
      "subscription_data[metadata][billing_offer_id]": targetOffer.id,
    });

    if (!session.url) {
      throw new Error("Checkout session created, but no redirect URL was returned.");
    }

    return res.status(200).json({
      redirectUrl: session.url,
      mode: "checkout",
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/subscription/change",
      user,
      metadata: { target_plan_id: targetPlanId },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to start the subscription change.",
    });
  }
}
