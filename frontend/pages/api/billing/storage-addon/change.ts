import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { BILLING_CONTRACT_SOURCE_INTERNAL_COMP } from "../../../../lib/server/api/billingContracts";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { stripeGet, stripePostForm } from "../../../../lib/server/api/stripe";

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

const normalizeStorageAddonId = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

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

  if (!addon || !addon.is_active) {
    return { addon: null, offer: null };
  }

  return {
    addon,
    offer: [...offers].sort(compareOfferRecency)[0] ?? null,
  };
};

const loadActiveStorageAddonRows = async (userId: string, storageAddonId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("billing_subscription_storage_addons")
    .select(
      "id, storage_addon_id, offer_id, stripe_subscription_item_id, stripe_price_id, quantity, status"
    )
    .eq("user_id", userId)
    .eq("storage_addon_id", storageAddonId)
    .is("ended_at", null)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message || "Failed to load active storage add-ons.");
  }

  return Array.isArray(data) ? (data as BillingSubscriptionStorageAddonRow[]) : [];
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

  const user = await requireApiUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as ChangeStorageAddonRequest;
  const storageAddonId = normalizeStorageAddonId(body.storageAddonId);
  const action = body.action === "remove" ? "remove" : body.action === "add" ? "add" : null;

  if (!storageAddonId || !action) {
    return res.status(400).json({ error: "Select a valid storage add-on action." });
  }

  try {
    const [{ billingProfile, billingContract }, { addon, offer }, activeAddonRows] =
      await Promise.all([
        loadBillingState(user.id),
        loadTargetStorageAddon(storageAddonId),
        loadActiveStorageAddonRows(user.id, storageAddonId),
      ]);

    if (!addon) {
      return res.status(404).json({ error: "This storage add-on is no longer available." });
    }

    if (billingContract?.contract_source === BILLING_CONTRACT_SOURCE_INTERNAL_COMP) {
      return res.status(400).json({
        error:
          "This account is managed internally. Move billing into Stripe before changing recurring storage add-ons.",
      });
    }

    const stripeSubscriptionId =
      billingContract?.stripe_subscription_id ?? billingProfile?.stripe_subscription_id ?? null;

    if (!stripeSubscriptionId) {
      const currentPlanId = billingContract?.plan_id ?? billingProfile?.plan_id ?? "free";
      return res.status(400).json({
        error:
          currentPlanId === "free"
            ? "Choose a paid subscription plan before adding recurring storage capacity."
            : "Your Stripe subscription is still syncing. Try again in a moment.",
      });
    }

    if (action === "add" && activeAddonRows.length > 0) {
      return res
        .status(409)
        .json({ error: `${addon.display_name} is already active on this workspace.` });
    }

    if (action === "add" && !offer?.stripe_price_id) {
      return res.status(409).json({
        error: "This storage add-on is temporarily unavailable. Try again later.",
      });
    }

    if (action === "remove" && activeAddonRows.length === 0) {
      return res
        .status(409)
        .json({ error: `${addon.display_name} is not active on this workspace.` });
    }

    const stripeSubscription = await stripeGet<StripeSubscriptionResponse>(
      `/subscriptions/${stripeSubscriptionId}`
    );
    const liveItems = Array.isArray(stripeSubscription.items?.data)
      ? stripeSubscription.items.data
      : [];

    if (!liveItems.length) {
      return res.status(409).json({
        error: "Your Stripe subscription has no active billing items to update.",
      });
    }

    if (action === "add") {
      await stripePostForm(
        `/subscriptions/${stripeSubscriptionId}`,
        buildSubscriptionUpdatePayload([
          {
            price: offer!.stripe_price_id!,
            quantity: 1,
          },
        ])
      );

      return res.status(200).json({
        ok: true,
        message: `${addon.display_name} added. Stripe is syncing your workspace storage now.`,
      });
    }

    const removableItemIds = Array.from(
      new Set(
        activeAddonRows
          .map((row) => row.stripe_subscription_item_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const activeStripePriceIds = new Set(
      activeAddonRows
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
      return res.status(409).json({
        error: "Could not find a live Stripe storage add-on to remove for this workspace.",
      });
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

    return res.status(200).json({
      ok: true,
      message:
        `${addon.display_name} removed. If your library stays over the remaining limit, ` +
        "new uploads may be blocked until usage drops.",
    });
  } catch (error) {
    await logApiRouteException("billing.storage-addon.change", error, {
      userId: user.id,
      storageAddonId,
      action,
    });
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Unable to update recurring storage right now.",
    });
  }
}
