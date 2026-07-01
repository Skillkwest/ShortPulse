import type { NextApiRequest, NextApiResponse } from "next";
import {
  CURRENT_BILLABLE_STORAGE_ADDON_STATUSES,
  normalizeStorageAddonId,
  resolveStorageAddonEligibility,
} from "../../../../lib/billing/storageAddonEligibility";
import { logApiRouteException, writeAppErrorLog } from "../../../../lib/server/api/appErrorLogs";
import { requireApiUser, type AuthenticatedApiUser } from "../../../../lib/server/api/auth";
import { BILLING_CONTRACT_SOURCE_INTERNAL_COMP } from "../../../../lib/server/api/billingContracts";
import { enforceApiRateLimit } from "../../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { stripePostForm } from "../../../../lib/server/api/stripe";
import { readVerifiedStripeSubscriptionForUser } from "../../../../lib/server/api/stripeCustomer";

type ChangeStorageAddonRequest = {
  storageAddonId?: string;
  action?: "add" | "remove";
};

type BillingProfileRow = {
  user_id: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
};

type BillingContractRow = {
  id: string;
  plan_id: string | null;
  stripe_subscription_id: string | null;
  contract_source: string | null;
  status: string | null;
};

type BillingStorageAddonRow = {
  id: string;
  display_name: string;
  is_active: boolean;
};

type BillingStorageAddonOfferRow = {
  id: string;
  storage_addon_id: string;
  stripe_price_id: string | null;
  recurring_price_cents: number;
  storage_limit_bytes: number;
  acquisition_enabled: boolean;
  is_active: boolean;
  effective_start_at: string | null;
  created_at: string;
};

type BillingSubscriptionStorageAddonRow = {
  id: string;
  storage_addon_id: string | null;
  offer_id: string | null;
  stripe_subscription_item_id: string | null;
  stripe_price_id: string | null;
  quantity: number | null;
  status: string | null;
};

const BILLING_STORAGE_ADDON_CHANGE_RATE_LIMIT = {
  keyPrefix: "billing-storage-addon-change",
  maxRequests: 10,
  windowMs: 10 * 60 * 1000,
} as const;
const STORAGE_ADDON_CHANGE_UNAVAILABLE_MESSAGE =
  "Recurring storage changes are temporarily unavailable. Try again later.";
const STORAGE_ADDON_ALREADY_ACTIVE_MESSAGE =
  "You already have an active storage add-on. Remove it before adding a different storage package.";
const STORAGE_ADDON_TELEMETRY_SOURCE = "telemetry.storage.addon";

const writeStorageAddonTelemetry = async ({
  userId,
  userEmail,
  eventName,
  storageAddonId,
  action,
  reason,
  statusCode,
}: {
  userId: string;
  userEmail: string | null;
  eventName:
    | "storage_addon_request_started"
    | "storage_addon_request_succeeded"
    | "storage_addon_request_failed"
    | "storage_addon_removed";
  storageAddonId: string;
  action: "add" | "remove";
  reason?: string;
  statusCode?: number;
}) => {
  try {
    await writeAppErrorLog({
      source: STORAGE_ADDON_TELEMETRY_SOURCE,
      scope: "app",
      severity: "low",
      message: eventName,
      statusCode: statusCode ?? null,
      userId,
      userEmail,
      metadata: {
        telemetry_family: "storage_addon",
        telemetry_version: 1,
        event_name: eventName,
        storage_addon_id: storageAddonId,
        action,
        reason: reason ?? null,
      },
    });
  } catch {
    // Telemetry must never block a billing mutation response.
  }
};

const compareOfferRecency = (
  left: BillingStorageAddonOfferRow,
  right: BillingStorageAddonOfferRow
) => {
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

const loadBillingState = async (userId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const [billingProfileResult, billingContractResult] = await Promise.all([
    supabaseAdmin
      .from("billing_profiles")
      .select("user_id, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_subscription_contracts")
      .select("id, plan_id, stripe_subscription_id, contract_source, status")
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

const loadTargetStorageAddon = async (storageAddonId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const [addonResult, offersResult] = await Promise.all([
    supabaseAdmin
      .from("billing_storage_addons")
      .select("id, display_name, is_active")
      .eq("id", storageAddonId)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_storage_addon_offers")
      .select(
        "id, storage_addon_id, stripe_price_id, recurring_price_cents, storage_limit_bytes, acquisition_enabled, is_active, effective_start_at, created_at"
      )
      .eq("storage_addon_id", storageAddonId)
      .eq("is_active", true)
      .eq("acquisition_enabled", true),
  ]);

  if (addonResult.error || offersResult.error) {
    throw new Error(
      addonResult.error?.message || offersResult.error?.message || "Failed to load storage catalog."
    );
  }

  const addon = (addonResult.data as BillingStorageAddonRow | null) ?? null;
  const offers = Array.isArray(offersResult.data)
    ? ((offersResult.data as BillingStorageAddonOfferRow[]).filter(
        (offer) => offer.is_active && offer.acquisition_enabled
      ) as BillingStorageAddonOfferRow[])
    : [];

  if (!addon) {
    return { addon: null, offer: null };
  }

  return {
    addon,
    offer: addon.is_active ? ([...offers].sort(compareOfferRecency)[0] ?? null) : null,
  };
};

const loadActiveStorageAddonRows = async (userId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_subscription_storage_addons")
    .select(
      "id, storage_addon_id, offer_id, stripe_subscription_item_id, stripe_price_id, quantity, status"
    )
    .eq("user_id", userId)
    .is("ended_at", null)
    .in("status", [...CURRENT_BILLABLE_STORAGE_ADDON_STATUSES]);

  if (error) {
    throw new Error(error.message || "Failed to load active storage add-ons.");
  }

  return Array.isArray(data) ? (data as BillingSubscriptionStorageAddonRow[]) : [];
};

const loadStorageAddonStripePriceIds = async () => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_storage_addon_offers")
    .select("stripe_price_id");

  if (error) {
    throw new Error(error.message || "Failed to load storage add-on Stripe prices.");
  }

  return new Set(
    (Array.isArray(data) ? (data as Array<{ stripe_price_id: string | null }>) : [])
      .map((row) => row.stripe_price_id)
      .filter((value): value is string => Boolean(value))
  );
};

const buildSubscriptionUpdatePayload = (
  itemPayloads: Array<Record<string, string | number | boolean>>
) => {
  const payload: Record<string, string | number | boolean> = {
    proration_behavior: "create_prorations",
  };

  itemPayloads.forEach((item, index) => {
    Object.entries(item).forEach(([key, value]) => {
      payload[`items[${index}][${key}]`] = value;
    });
  });

  return payload;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: AuthenticatedApiUser | null = null;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing.storage-addon.change.auth",
    });
    return res.status(500).json({
      error: "Unable to update recurring storage right now.",
    });
  }
  if (!user) return;
  const authenticatedUser = user;
  if (
    !enforceApiRateLimit(req, res, {
      ...BILLING_STORAGE_ADDON_CHANGE_RATE_LIMIT,
      keyPrefix: `${BILLING_STORAGE_ADDON_CHANGE_RATE_LIMIT.keyPrefix}:${authenticatedUser.id}`,
    })
  ) {
    return;
  }

  const body = (req.body ?? {}) as ChangeStorageAddonRequest;
  const storageAddonId = normalizeStorageAddonId(body.storageAddonId);
  const action = body.action === "remove" ? "remove" : body.action === "add" ? "add" : null;

  if (!storageAddonId || !action) {
    return res.status(400).json({ error: "Select a valid storage add-on action." });
  }

  const writeMutationTelemetry = async (
    eventName: Parameters<typeof writeStorageAddonTelemetry>[0]["eventName"],
    reason?: string,
    statusCode?: number
  ) =>
    writeStorageAddonTelemetry({
      userId: authenticatedUser.id,
      userEmail: authenticatedUser.email ?? null,
      eventName,
      storageAddonId,
      action,
      reason,
      statusCode,
    });

  const failStorageAddonMutation = async (statusCode: number, error: string, reason: string) => {
    await writeMutationTelemetry("storage_addon_request_failed", reason, statusCode);
    return res.status(statusCode).json({ error });
  };

  try {
    await writeMutationTelemetry("storage_addon_request_started");

    const [
      { billingProfile, billingContract },
      { addon, offer },
      activeAddonRows,
      storageAddonStripePriceIds,
    ] = await Promise.all([
      loadBillingState(authenticatedUser.id),
      loadTargetStorageAddon(storageAddonId),
      loadActiveStorageAddonRows(authenticatedUser.id),
      loadStorageAddonStripePriceIds(),
    ]);

    if (!addon) {
      return failStorageAddonMutation(
        404,
        "This storage add-on is no longer available.",
        "addon_unavailable"
      );
    }

    if (action === "add" && !addon.is_active) {
      return failStorageAddonMutation(
        404,
        "This storage add-on is no longer available.",
        "addon_unavailable"
      );
    }

    if (billingContract?.contract_source === BILLING_CONTRACT_SOURCE_INTERNAL_COMP) {
      return failStorageAddonMutation(
        400,
        "Recurring storage add-ons are not available for this account.",
        "internal_comp"
      );
    }

    const stripeSubscriptionId =
      billingContract?.stripe_subscription_id ?? billingProfile?.stripe_subscription_id ?? null;

    const currentPlanId = billingContract?.plan_id ?? billingProfile?.plan_id ?? "free";
    const storageAddonEligibility = resolveStorageAddonEligibility({
      planId: currentPlanId,
      storageAddonId,
    });
    const targetActiveAddonRows = activeAddonRows.filter(
      (row) => row.storage_addon_id === storageAddonId
    );

    if (action === "add" && !storageAddonEligibility.isEligible) {
      if (storageAddonEligibility.reason === "paid_plan_required") {
        return failStorageAddonMutation(
          400,
          "Choose a paid subscription plan before adding recurring storage capacity.",
          "paid_plan_required"
        );
      }
      if (storageAddonEligibility.reason === "manual_review_required") {
        return failStorageAddonMutation(
          409,
          "This storage add-on requires manual review and is not available for self-serve checkout.",
          "manual_review_required"
        );
      }
      return failStorageAddonMutation(
        400,
        "This storage add-on is not available for your current plan.",
        "ineligible_plan"
      );
    }

    if (!stripeSubscriptionId) {
      return failStorageAddonMutation(
        400,
        "Your subscription is still syncing. Try again in a moment.",
        "subscription_missing"
      );
    }

    if (action === "add" && activeAddonRows.length > 0) {
      const sameAddonAlreadyActive = targetActiveAddonRows.length > 0;
      return failStorageAddonMutation(
        409,
        sameAddonAlreadyActive
          ? `${addon.display_name} is already active on this workspace.`
          : STORAGE_ADDON_ALREADY_ACTIVE_MESSAGE,
        sameAddonAlreadyActive ? "same_addon_active" : "different_addon_active"
      );
    }

    if (action === "add" && !offer?.stripe_price_id) {
      return failStorageAddonMutation(
        409,
        "This storage add-on is temporarily unavailable. Try again later.",
        "offer_price_missing"
      );
    }

    if (action === "remove" && targetActiveAddonRows.length === 0) {
      return failStorageAddonMutation(
        409,
        `${addon.display_name} is not active on this workspace.`,
        "addon_not_active"
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return failStorageAddonMutation(
        501,
        STORAGE_ADDON_CHANGE_UNAVAILABLE_MESSAGE,
        "stripe_key_missing"
      );
    }

    const stripeSubscription = await readVerifiedStripeSubscriptionForUser({
      userId: authenticatedUser.id,
      stripeSubscriptionId,
    });
    const liveItems = Array.isArray(stripeSubscription.items?.data)
      ? stripeSubscription.items.data
      : [];

    if (!liveItems.length) {
      return failStorageAddonMutation(
        409,
        STORAGE_ADDON_CHANGE_UNAVAILABLE_MESSAGE,
        "stripe_live_items_missing"
      );
    }

    if (action === "add") {
      if (offer?.stripe_price_id) {
        storageAddonStripePriceIds.add(offer.stripe_price_id);
      }
      const liveStorageAddonItems = liveItems.filter(
        (item) => item.price?.id && storageAddonStripePriceIds.has(item.price.id)
      );
      if (liveStorageAddonItems.length > 0) {
        const addonAlreadyLiveInStripe = liveStorageAddonItems.some(
          (item) => item.price?.id === offer!.stripe_price_id
        );
        return failStorageAddonMutation(
          409,
          addonAlreadyLiveInStripe
            ? `${addon.display_name} is already active on this workspace.`
            : STORAGE_ADDON_ALREADY_ACTIVE_MESSAGE,
          addonAlreadyLiveInStripe ? "same_addon_live_in_stripe" : "different_addon_live_in_stripe"
        );
      }

      await stripePostForm(`/subscriptions/${stripeSubscriptionId}`, {
        ...buildSubscriptionUpdatePayload([
          {
            price: offer!.stripe_price_id!,
            quantity: 1,
          },
        ]),
        payment_behavior: "error_if_incomplete",
      });

      await writeMutationTelemetry("storage_addon_request_succeeded", undefined, 200);
      return res.status(200).json({
        ok: true,
        message: `${addon.display_name} added. Your workspace storage is syncing now.`,
      });
    }

    const removableItemIds = Array.from(
      new Set(
        targetActiveAddonRows
          .map((row) => row.stripe_subscription_item_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const activeStripePriceIds = new Set(
      targetActiveAddonRows
        .map((row) => row.stripe_price_id)
        .filter((value): value is string => Boolean(value))
    );
    if (offer?.stripe_price_id) {
      activeStripePriceIds.add(offer.stripe_price_id);
    }

    if (!removableItemIds.length && activeStripePriceIds.size > 0) {
      liveItems.forEach((item) => {
        if (item.id && item.price?.id && activeStripePriceIds.has(item.price.id)) {
          removableItemIds.push(item.id);
        }
      });
    }

    if (!removableItemIds.length) {
      return failStorageAddonMutation(
        409,
        "This storage add-on could not be found on your subscription. Refresh and try again.",
        "removable_item_missing"
      );
    }

    await stripePostForm(
      `/subscriptions/${stripeSubscriptionId}`,
      buildSubscriptionUpdatePayload(
        removableItemIds.map((itemId) => ({
          id: itemId,
          deleted: true,
        }))
      )
    );

    await writeMutationTelemetry("storage_addon_removed", undefined, 200);
    return res.status(200).json({
      ok: true,
      message:
        `${addon.display_name} removed. If your library stays over the remaining limit, ` +
        "new uploads may be blocked until usage drops.",
    });
  } catch (error) {
    await logApiRouteException({
      error,
      routeLabel: "billing.storage-addon.change",
      user: authenticatedUser,
      metadata: {
        storageAddonId,
        action,
      },
    });
    await writeMutationTelemetry("storage_addon_request_failed", "unexpected_exception", 500);
    return res.status(500).json({
      error: "Unable to update recurring storage right now.",
    });
  }
}
