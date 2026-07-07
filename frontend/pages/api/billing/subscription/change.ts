import type { NextApiRequest, NextApiResponse } from "next";
import {
  CURRENT_BILLABLE_STORAGE_ADDON_STATUSES,
  resolveStorageAddonEligibility,
} from "../../../../lib/billing/storageAddonEligibility";
import { resolveAuthDisplayName } from "../../../../lib/server/api/accountIdentity";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../../lib/server/api/auth";
import {
  BILLING_CONTRACT_SOURCE_INTERNAL_COMP,
  BILLING_CONTRACT_SOURCE_STRIPE,
} from "../../../../lib/server/api/billingContracts";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { getCanonicalAppBaseUrl, stripePostForm } from "../../../../lib/server/api/stripe";
import {
  ensureStripeCustomerForUser,
  readVerifiedStripeSubscriptionForUser,
  type StripeSubscriptionResponse,
} from "../../../../lib/server/api/stripeCustomer";
import {
  CatalogStripePriceValidationError,
  validateStripePriceForCatalogRow,
} from "../../../../lib/server/api/adminPricingCatalog";

type ChangeSubscriptionRequest = {
  targetPlanId?: string;
  billingInterval?: "month" | "year";
  checkoutCancelPath?: string;
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
  recurring_price_cents: number | null;
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
  sort_order: number | null;
};

type BillingPlanOfferRow = {
  id: string;
  plan_id: string;
  billing_interval: "month" | "year";
  stripe_price_id: string | null;
  recurring_price_cents: number;
  max_concurrent_generations: number;
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

type BillingSubscriptionStorageAddonRow = {
  id: string;
  storage_addon_id: string | null;
  stripe_subscription_item_id: string | null;
  quantity: number | null;
  status: string | null;
};

type StripeSubscriptionItem = NonNullable<
  NonNullable<StripeSubscriptionResponse["items"]>["data"]
>[number];

const BILLING_SUBSCRIPTION_CHANGE_RATE_LIMIT = {
  keyPrefix: "billing-subscription-change",
  maxRequests: 8,
  windowMs: 10 * 60 * 1000,
} as const;
const PLAN_UNAVAILABLE_MESSAGE = "This plan is temporarily unavailable. Try again later.";
const PLAN_CHANGE_UNAVAILABLE_MESSAGE =
  "This plan change is temporarily unavailable. Try again later.";
const STORAGE_ADDON_PLAN_CHANGE_UNAVAILABLE_MESSAGE =
  "Remove or change your active storage add-on before downgrading or changing billing intervals.";
const STRIPE_PORTAL_SUBSCRIPTION_UPDATE_DISABLED_PATTERN =
  /subscription update feature in the portal configuration is disabled/i;

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

const resolveCheckoutSuccessUrl = () =>
  `${getCanonicalAppBaseUrl()}/ai-studio?checkout=subscription_success&project=new&checkout_session_id={CHECKOUT_SESSION_ID}`;

const resolvePricingCheckoutCancelUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.includes("\\") ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//")
  ) {
    return null;
  }

  try {
    const parsed = new URL(candidate, getCanonicalAppBaseUrl());
    if (parsed.origin !== getCanonicalAppBaseUrl()) return null;
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPathname !== "/pricing") return null;
    return `${getCanonicalAppBaseUrl()}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};

const resolveActivePlanId = (
  billingProfile: BillingProfileRow | null,
  billingContract: BillingContractRow | null
) => {
  const planId = billingContract?.plan_id ?? billingProfile?.plan_id ?? "free";
  return typeof planId === "string" && planId.trim() ? planId : "free";
};

const hasStripeSubscriptionId = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
};

const isStripePortalSubscriptionUpdateDisabledError = (error: unknown): boolean =>
  STRIPE_PORTAL_SUBSCRIPTION_UPDATE_DISABLED_PATTERN.test(resolveErrorMessage(error));

const normalizePlanSortOrder = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isHigherPlanUpgradeBySortOrder = (
  activePlanSortOrder: number | null,
  targetPlanSortOrder: number | null
): boolean => {
  return (
    typeof activePlanSortOrder === "number" &&
    typeof targetPlanSortOrder === "number" &&
    targetPlanSortOrder > activePlanSortOrder
  );
};

const resolveStripeSubscriptionCustomerId = (
  subscription: StripeSubscriptionResponse
): string | null => {
  if (typeof subscription.customer === "string") {
    const normalized = subscription.customer.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (subscription.customer && typeof subscription.customer === "object") {
    const normalized =
      typeof subscription.customer.id === "string" ? subscription.customer.id.trim() : "";
    return normalized.length > 0 ? normalized : null;
  }
  return null;
};

const isStripeManagedSubscription = ({
  billingContract,
  stripeSubscriptionId,
  isInternalCompContract,
}: {
  billingContract: BillingContractRow | null;
  stripeSubscriptionId: string | null;
  isInternalCompContract: boolean;
}) =>
  billingContract?.contract_source === BILLING_CONTRACT_SOURCE_STRIPE ||
  (!isInternalCompContract && hasStripeSubscriptionId(stripeSubscriptionId));

const validateTargetPlanStripePrice = async ({
  targetOffer,
  targetPlanId,
  billingInterval,
}: {
  targetOffer: BillingPlanOfferRow;
  targetPlanId: string;
  billingInterval: "month" | "year";
}) => {
  await validateStripePriceForCatalogRow({
    stripePriceId: targetOffer.stripe_price_id,
    expectedAmountCents: targetOffer.recurring_price_cents,
    expectedInterval: billingInterval,
    catalogType: "plan",
    expectedMetadataIdKey: "shortpulse_plan_id",
    expectedMetadataIdValue: targetPlanId,
  });
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
        "id, plan_id, offer_id, billing_interval, recurring_price_cents, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, contract_source"
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
      .select("id, display_name, is_active, sort_order")
      .eq("id", targetPlanId)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_plan_offers")
      .select(
        "id, plan_id, billing_interval, stripe_price_id, recurring_price_cents, max_concurrent_generations, acquisition_enabled, is_active, effective_start_at, created_at"
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

const loadPlanSortOrder = async (planId: string): Promise<number | null> => {
  const normalizedPlanId = normalizePlanId(planId);
  if (!normalizedPlanId) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_plans")
    .select("id, sort_order, is_active")
    .eq("id", normalizedPlanId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load active plan ordering.");
  }

  const plan = data as Pick<BillingPlanRow, "id" | "is_active" | "sort_order"> | null;
  if (!plan || !plan.is_active) return null;
  return normalizePlanSortOrder(plan.sort_order);
};

const loadActiveStorageAddonRows = async (
  userId: string
): Promise<BillingSubscriptionStorageAddonRow[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_subscription_storage_addons")
    .select("id, storage_addon_id, stripe_subscription_item_id, quantity, status")
    .eq("user_id", userId)
    .is("ended_at", null)
    .in("status", [...CURRENT_BILLABLE_STORAGE_ADDON_STATUSES]);

  if (error) {
    throw new Error(error.message || "Failed to load active storage add-ons.");
  }

  return Array.isArray(data) ? (data as BillingSubscriptionStorageAddonRow[]) : [];
};

const canCarryKnownStorageAddonItem = ({
  activeStorageAddons,
  baseItemId,
  liveItems,
}: {
  activeStorageAddons: BillingSubscriptionStorageAddonRow[];
  baseItemId: string | null;
  liveItems: StripeSubscriptionItem[];
}): boolean => {
  if (!baseItemId || activeStorageAddons.length !== 1 || liveItems.length !== 2) {
    return false;
  }

  const storageItemId = activeStorageAddons[0]?.stripe_subscription_item_id?.trim() ?? "";
  if (!storageItemId || storageItemId === baseItemId) return false;

  const liveItemIds = new Set(liveItems.map((item) => item.id).filter(Boolean));
  return liveItemIds.has(baseItemId) && liveItemIds.has(storageItemId);
};

const resolveIncompatibleStorageAddonForPlan = (
  activeStorageAddons: BillingSubscriptionStorageAddonRow[],
  targetPlanId: string
): BillingSubscriptionStorageAddonRow | null => {
  if (activeStorageAddons.length > 1) {
    return activeStorageAddons[0] ?? null;
  }

  return (
    activeStorageAddons.find(
      (addon) =>
        !resolveStorageAddonEligibility({
          planId: targetPlanId,
          storageAddonId: addon.storage_addon_id,
        }).isEligible || Math.max(1, Number(addon.quantity ?? 1) || 1) !== 1
    ) ?? null
  );
};

const resolveBaseSubscriptionItem = async (params: {
  subscription: StripeSubscriptionResponse;
  contractStripePriceId: string | null;
}) => {
  const items = Array.isArray(params.subscription.items?.data)
    ? params.subscription.items.data
    : [];
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

  let user;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/subscription/change.auth",
    });
    return res.status(500).json({
      error: "Unable to start the subscription change.",
    });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...BILLING_SUBSCRIPTION_CHANGE_RATE_LIMIT,
      keyPrefix: `${BILLING_SUBSCRIPTION_CHANGE_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

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
    const useStripePortalForExistingSubscription = isStripeManagedSubscription({
      billingContract,
      stripeSubscriptionId,
      isInternalCompContract,
    });
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
        return res.status(501).json({ error: PLAN_CHANGE_UNAVAILABLE_MESSAGE });
      }
      if (!stripeSubscriptionId) {
        return res.status(409).json({ error: "No active paid subscription was found." });
      }
      const verifiedSubscription = await readVerifiedStripeSubscriptionForUser({
        userId: user.id,
        stripeSubscriptionId,
      });
      const stripeCustomerId = resolveStripeSubscriptionCustomerId(verifiedSubscription);
      if (!stripeCustomerId) {
        throw new Error("Verified Stripe subscription did not include a customer id.");
      }
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
      return res.status(409).json({ error: PLAN_UNAVAILABLE_MESSAGE });
    }

    const activeStorageAddonRows = await loadActiveStorageAddonRows(user.id);
    const incompatibleStorageAddon = resolveIncompatibleStorageAddonForPlan(
      activeStorageAddonRows,
      targetPlanId
    );
    if (incompatibleStorageAddon) {
      return res.status(409).json({
        error:
          "Remove or change your active storage add-on before switching to this subscription plan.",
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(501).json({ error: PLAN_CHANGE_UNAVAILABLE_MESSAGE });
    }

    if (useStripePortalForExistingSubscription && hasStripeSubscriptionId(stripeSubscriptionId)) {
      const returnUrl = `${getCanonicalAppBaseUrl()}/profile?section=subscription`;
      const verifiedSubscription = await readVerifiedStripeSubscriptionForUser({
        userId: user.id,
        stripeSubscriptionId,
      });
      const stripeCustomerId = resolveStripeSubscriptionCustomerId(verifiedSubscription);
      if (!stripeCustomerId) {
        throw new Error("Verified Stripe subscription did not include a customer id.");
      }
      const baseItem = await resolveBaseSubscriptionItem({
        subscription: verifiedSubscription,
        contractStripePriceId: billingContract?.stripe_price_id ?? null,
      });
      const liveItems = Array.isArray(verifiedSubscription.items?.data)
        ? verifiedSubscription.items.data
        : [];

      try {
        await validateTargetPlanStripePrice({
          targetOffer,
          targetPlanId,
          billingInterval,
        });
      } catch (error) {
        if (error instanceof CatalogStripePriceValidationError) {
          return res.status(409).json({
            error: PLAN_CHANGE_UNAVAILABLE_MESSAGE,
          });
        }
        throw error;
      }

      if (baseItem.itemCount > 1) {
        if (billingInterval !== activeBillingInterval) {
          return res.status(409).json({
            error: STORAGE_ADDON_PLAN_CHANGE_UNAVAILABLE_MESSAGE,
          });
        }
        const activePlanSortOrder = await loadPlanSortOrder(activePlanId);
        const isHigherPlanUpgrade = isHigherPlanUpgradeBySortOrder(
          activePlanSortOrder,
          normalizePlanSortOrder(targetPlan.sort_order)
        );
        if (!isHigherPlanUpgrade) {
          return res.status(409).json({
            error: STORAGE_ADDON_PLAN_CHANGE_UNAVAILABLE_MESSAGE,
          });
        }
        const canCarryStorageAddonItem = canCarryKnownStorageAddonItem({
          activeStorageAddons: activeStorageAddonRows,
          baseItemId: baseItem.itemId,
          liveItems,
        });
        if (!canCarryStorageAddonItem) {
          return res.status(409).json({
            error: PLAN_CHANGE_UNAVAILABLE_MESSAGE,
          });
        }
        if (!baseItem.itemId || !targetOffer.stripe_price_id) {
          return res.status(409).json({
            error: PLAN_CHANGE_UNAVAILABLE_MESSAGE,
          });
        }

        await stripePostForm(`/subscriptions/${stripeSubscriptionId}`, {
          proration_behavior: "create_prorations",
          payment_behavior: "error_if_incomplete",
          "items[0][id]": baseItem.itemId,
          "items[0][price]": targetOffer.stripe_price_id,
          "items[0][quantity]": baseItem.quantity,
          "metadata[user_id]": user.id,
          "metadata[billing_plan_id]": targetPlanId,
          "metadata[billing_offer_id]": targetOffer.id,
          "metadata[billing_interval]": billingInterval,
          "metadata[max_concurrent_generations]": targetOffer.max_concurrent_generations,
        });

        return res.status(200).json({
          redirectUrl: resolveProfileReturnUrl("updated"),
          mode: "app",
        });
      }

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
      return res.status(409).json({ error: PLAN_UNAVAILABLE_MESSAGE });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser({
      userId: user.id,
      email: user.email ?? null,
      displayName: resolveAuthDisplayName(user),
    });

    try {
      await validateTargetPlanStripePrice({
        targetOffer,
        targetPlanId,
        billingInterval,
      });
    } catch (error) {
      if (error instanceof CatalogStripePriceValidationError) {
        return res.status(409).json({
          error: PLAN_CHANGE_UNAVAILABLE_MESSAGE,
        });
      }
      throw error;
    }

    const cancelUrl =
      resolvePricingCheckoutCancelUrl(body.checkoutCancelPath) ??
      resolveProfileReturnUrl("checkout_cancel");

    const session = await stripePostForm<StripeCheckoutSession>("/checkout/sessions", {
      mode: "subscription",
      customer: stripeCustomerId,
      allow_promotion_codes: true,
      "line_items[0][price]": targetOffer.stripe_price_id,
      "line_items[0][quantity]": 1,
      success_url: resolveCheckoutSuccessUrl(),
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
      "metadata[billing_plan_id]": targetPlanId,
      "metadata[billing_offer_id]": targetOffer.id,
      "metadata[billing_interval]": billingInterval,
      "metadata[max_concurrent_generations]": targetOffer.max_concurrent_generations,
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][billing_plan_id]": targetPlanId,
      "subscription_data[metadata][billing_offer_id]": targetOffer.id,
      "subscription_data[metadata][billing_interval]": billingInterval,
      "subscription_data[metadata][max_concurrent_generations]":
        targetOffer.max_concurrent_generations,
    });

    if (!session.url) {
      throw new Error("Checkout session created, but no redirect URL was returned.");
    }

    return res.status(200).json({
      redirectUrl: session.url,
      mode: "checkout",
    });
  } catch (error) {
    if (isStripePortalSubscriptionUpdateDisabledError(error)) {
      return res.status(409).json({
        error: PLAN_CHANGE_UNAVAILABLE_MESSAGE,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/subscription/change",
      user,
      metadata: { target_plan_id: targetPlanId, billing_interval: billingInterval },
    });
    return res.status(500).json({
      error: "Unable to start the subscription change.",
    });
  }
}
