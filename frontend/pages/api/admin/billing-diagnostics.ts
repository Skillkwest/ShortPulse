import type { NextApiRequest, NextApiResponse } from "next";
import type {
  AdminBillingContractSnapshot,
  AdminBillingDiagnosticsResponse,
  AdminBillingOfferSnapshot,
  AdminBillingProfileSnapshot,
  AdminBillingStorageAddonSnapshot,
  AdminHealthFinding,
  AdminStripeSubscriptionSnapshot,
} from "../../../features/admin/types";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { stripeGet } from "../../../lib/server/api/stripe";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BillingProfileRow = {
  plan_id: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

type BillingContractRow = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_id: string | null;
  contract_source: "stripe" | "internal_comp" | null;
  recurring_price_cents: number | string | null;
  monthly_credits_cents: number | string | null;
  storage_limit_bytes: number | string | null;
  status: string | null;
  current_period_end: string | null;
};

type BillingOfferRow = {
  id: string;
  plan_id: string | null;
  offer_name: string | null;
  stripe_price_id: string | null;
  recurring_price_cents: number | string | null;
  monthly_credits_cents: number | string | null;
  storage_limit_bytes: number | string | null;
  acquisition_enabled: boolean | null;
  is_active: boolean | null;
};

type BillingStorageAddonRow = {
  id: string;
  storage_addon_id: string | null;
  offer_id: string | null;
  stripe_subscription_item_id: string | null;
  stripe_price_id: string | null;
  storage_limit_bytes: number | string | null;
  quantity: number | string | null;
  recurring_price_cents: number | string | null;
  status: string | null;
};

type MediaUsageRow = {
  file_size: number | string | null;
};

type StripeSubscriptionResponse = {
  id: string;
  status?: string | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
        unit_amount?: number | null;
        currency?: string | null;
      } | null;
    }>;
  } | null;
};

type StripeSubscriptionListResponse = {
  data?: StripeSubscriptionResponse[];
};

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

const isSchemaCompatibilityError = (message: string) => {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache") ||
    text.includes("failed to parse select parameter") ||
    text.includes("column")
  );
};

const asCents = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pushFinding = (
  findings: AdminHealthFinding[],
  finding: Omit<AdminHealthFinding, "recommendedActions"> & { recommendedActions?: string[] }
) => {
  findings.push({
    ...finding,
    recommendedActions: finding.recommendedActions ?? [],
  });
};

const mapStripeSubscriptionSnapshot = (params: {
  configured: boolean;
  customerId: string | null;
  subscription: StripeSubscriptionResponse | null;
}): AdminStripeSubscriptionSnapshot => {
  const price = params.subscription?.items?.data?.[0]?.price ?? null;
  return {
    configured: params.configured,
    customerId: params.customerId,
    subscriptionId: params.subscription?.id ?? null,
    status: params.subscription?.status ?? null,
    priceId: price?.id ?? null,
    recurringPriceCents:
      typeof price?.unit_amount === "number" && Number.isFinite(price.unit_amount)
        ? price.unit_amount
        : null,
    currency: price?.currency ?? null,
    currentPeriodEnd:
      typeof params.subscription?.current_period_end === "number"
        ? new Date(params.subscription.current_period_end * 1000).toISOString()
        : null,
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | AdminBillingDiagnosticsResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const userId = asSingleString(req.query.userId).trim();
  if (!isUuid(userId)) {
    return res.status(400).json({ error: "A valid user id is required." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const userResult = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userResult.error) {
      throw new Error(userResult.error.message || "Failed to load target user.");
    }
    if (!userResult.data.user) {
      return res.status(404).json({ error: "User not found." });
    }

    const [profileResult, contractResult] = await Promise.all([
      supabaseAdmin
        .from("billing_profiles")
        .select(
          "plan_id, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end"
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("billing_subscription_contracts")
        .select(
          "id, plan_id, offer_id, stripe_price_id, stripe_subscription_id, contract_source, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, status, current_period_end"
        )
        .eq("user_id", userId)
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const contractCompatibilityError =
      contractResult.error?.message && isSchemaCompatibilityError(contractResult.error.message);
    if (profileResult.error || (contractResult.error && !contractCompatibilityError)) {
      const detail = [profileResult.error?.message, contractResult.error?.message]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Failed to load billing diagnostics." });
    }

    const billingProfile = (profileResult.data as BillingProfileRow | null) ?? null;
    const currentContract = contractCompatibilityError
      ? null
      : ((contractResult.data as BillingContractRow | null) ?? null);
    const effectivePlanId = currentContract?.plan_id ?? billingProfile?.plan_id ?? null;
    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

    let linkedOffer: AdminBillingOfferSnapshot | null = null;
    let currentPublicOffer: AdminBillingOfferSnapshot | null = null;
    if (effectivePlanId) {
      const [linkedOfferResult, currentOfferResult] = await Promise.all([
        currentContract?.offer_id
          ? supabaseAdmin
              .from("billing_plan_offers")
              .select(
                "id, plan_id, offer_name, stripe_price_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, acquisition_enabled, is_active"
              )
              .eq("id", currentContract.offer_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabaseAdmin
          .from("billing_plan_offers")
          .select(
            "id, plan_id, offer_name, stripe_price_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, acquisition_enabled, is_active"
          )
          .eq("plan_id", effectivePlanId)
          .eq("acquisition_enabled", true)
          .eq("is_active", true)
          .order("effective_start_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const offerErrors = [linkedOfferResult.error?.message, currentOfferResult.error?.message]
        .filter((message): message is string => typeof message === "string" && message.length > 0)
        .filter((message) => !isSchemaCompatibilityError(message));
      if (offerErrors.length > 0) {
        return res.status(500).json({ error: offerErrors.join(" | ") });
      }

      const mapOffer = (row: BillingOfferRow | null): AdminBillingOfferSnapshot | null =>
        row
          ? {
              id: row.id,
              planId: row.plan_id ?? null,
              offerName: row.offer_name ?? null,
              stripePriceId: row.stripe_price_id ?? null,
              recurringPriceCents: asCents(row.recurring_price_cents),
              monthlyCreditsCents: asCents(row.monthly_credits_cents),
              storageLimitBytes: asCents(row.storage_limit_bytes),
              acquisitionEnabled: Boolean(row.acquisition_enabled),
              isActive: Boolean(row.is_active),
            }
          : null;

      linkedOffer = mapOffer((linkedOfferResult.data as BillingOfferRow | null) ?? null);
      currentPublicOffer = mapOffer((currentOfferResult.data as BillingOfferRow | null) ?? null);
    }

    const [storageAddonsResult, mediaUsageResult] = await Promise.all([
      supabaseAdmin
        .from("billing_subscription_storage_addons")
        .select(
          "id, storage_addon_id, offer_id, stripe_subscription_item_id, stripe_price_id, storage_limit_bytes, quantity, recurring_price_cents, status"
        )
        .eq("user_id", userId)
        .is("ended_at", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("media_files").select("file_size").eq("user_id", userId),
    ]);

    if (storageAddonsResult.error || mediaUsageResult.error) {
      const detail = [storageAddonsResult.error?.message, mediaUsageResult.error?.message]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Failed to load storage diagnostics." });
    }

    let liveStripeSubscription: StripeSubscriptionResponse | null = null;
    if (stripeConfigured) {
      if (currentContract?.stripe_subscription_id || billingProfile?.stripe_subscription_id) {
        const subscriptionId =
          currentContract?.stripe_subscription_id ?? billingProfile?.stripe_subscription_id ?? null;
        if (subscriptionId) {
          liveStripeSubscription = await stripeGet<StripeSubscriptionResponse>(
            `/subscriptions/${subscriptionId}`,
            {
              "expand[]": "items.data.price",
            }
          );
        }
      } else if (billingProfile?.stripe_customer_id) {
        const subscriptionList = await stripeGet<StripeSubscriptionListResponse>("/subscriptions", {
          customer: billingProfile.stripe_customer_id,
          status: "all",
          limit: 1,
          "expand[]": "data.items.data.price",
        });
        liveStripeSubscription = Array.isArray(subscriptionList.data)
          ? (subscriptionList.data[0] ?? null)
          : null;
      }
    }

    const responseProfile: AdminBillingProfileSnapshot | null = billingProfile
      ? {
          planId: billingProfile.plan_id ?? null,
          subscriptionStatus: billingProfile.subscription_status ?? null,
          stripeCustomerId: billingProfile.stripe_customer_id ?? null,
          stripeSubscriptionId: billingProfile.stripe_subscription_id ?? null,
          currentPeriodEnd: billingProfile.current_period_end ?? null,
        }
      : null;

    const responseContract: AdminBillingContractSnapshot | null = currentContract
      ? {
          id: currentContract.id,
          planId: currentContract.plan_id ?? null,
          offerId: currentContract.offer_id ?? null,
          stripePriceId: currentContract.stripe_price_id ?? null,
          stripeSubscriptionId: currentContract.stripe_subscription_id ?? null,
          contractSource: currentContract.contract_source ?? null,
          recurringPriceCents: asCents(currentContract.recurring_price_cents),
          monthlyCreditsCents: asCents(currentContract.monthly_credits_cents),
          storageLimitBytes: asCents(currentContract.storage_limit_bytes),
          status: currentContract.status ?? null,
          currentPeriodEnd: currentContract.current_period_end ?? null,
        }
      : null;
    const activeStorageAddons: AdminBillingStorageAddonSnapshot[] = (
      (storageAddonsResult.data as BillingStorageAddonRow[] | null) ?? []
    ).map((row) => ({
      id: row.id,
      storageAddonId: row.storage_addon_id ?? null,
      offerId: row.offer_id ?? null,
      stripeSubscriptionItemId: row.stripe_subscription_item_id ?? null,
      stripePriceId: row.stripe_price_id ?? null,
      storageLimitBytes: asCents(row.storage_limit_bytes),
      quantity: Math.max(0, Number(row.quantity ?? 0) || 0),
      recurringPriceCents: asCents(row.recurring_price_cents),
      status: row.status ?? null,
    }));
    const usedBytes = ((mediaUsageResult.data as MediaUsageRow[] | null) ?? []).reduce<number>(
      (sum, row) => sum + Math.max(0, Number(row.file_size ?? 0) || 0),
      0
    );
    const baseLimitBytes =
      responseContract?.storageLimitBytes ??
      linkedOffer?.storageLimitBytes ??
      currentPublicOffer?.storageLimitBytes ??
      0;
    const addonLimitBytes = activeStorageAddons.reduce((sum, addon) => {
      const status = String(addon.status ?? "").toLowerCase();
      if (status === "canceled" || status === "inactive") {
        return sum;
      }
      return sum + (addon.storageLimitBytes ?? 0) * Math.max(0, addon.quantity);
    }, 0);
    const totalLimitBytes = baseLimitBytes + addonLimitBytes;
    const storageSummary = {
      usedBytes,
      baseLimitBytes,
      addonLimitBytes,
      totalLimitBytes,
      remainingBytes: Math.max(totalLimitBytes - usedBytes, 0),
      isOverLimit: usedBytes > totalLimitBytes,
    };
    const stripeSubscription = mapStripeSubscriptionSnapshot({
      configured: stripeConfigured,
      customerId: billingProfile?.stripe_customer_id ?? null,
      subscription: liveStripeSubscription,
    });

    const findings: AdminHealthFinding[] = [];
    const activePaidProfile =
      billingProfile?.plan_id != null &&
      billingProfile.plan_id !== "free" &&
      ["active", "trialing", "past_due", "unpaid"].includes(
        String(billingProfile.subscription_status ?? "").toLowerCase()
      );

    if (activePaidProfile && !currentContract) {
      pushFinding(findings, {
        code: "missing_active_contract",
        severity: "critical",
        confidence: "high",
        summary: "Active paid subscriber is missing a current contract row.",
        details:
          "Billing profile shows a paid subscription state, but no open billing_subscription_contracts row exists. Grandfathered pricing and renewal-credit truth can drift without this contract snapshot.",
        recommendedActions: [
          "Replay the latest Stripe subscription or invoice event for this customer.",
          "If replay is unavailable, backfill a contract row from Stripe subscription data before editing billing state manually.",
        ],
      });
    }

    if (
      currentContract &&
      billingProfile?.plan_id &&
      currentContract.plan_id !== billingProfile.plan_id
    ) {
      pushFinding(findings, {
        code: "plan_mismatch",
        severity: "warning",
        confidence: "high",
        summary: "Billing profile plan and current contract plan do not match.",
        details:
          "The runtime billing profile points at a different plan tier than the open subscriber contract. Account UI and renewal flows may present inconsistent entitlement state until they are resynced.",
        recommendedActions: [
          "Replay the latest Stripe customer.subscription.updated event.",
          "Confirm the intended tier in Stripe before changing local rows.",
        ],
      });
    }

    if (
      currentContract &&
      billingProfile?.stripe_subscription_id &&
      currentContract.stripe_subscription_id !== billingProfile.stripe_subscription_id
    ) {
      pushFinding(findings, {
        code: "subscription_id_mismatch",
        severity: "warning",
        confidence: "high",
        summary: "Stripe subscription id differs between contract and billing profile.",
        details:
          "The current contract and billing profile are referencing different Stripe subscription ids. This usually indicates a partial webhook sync or manual data drift.",
        recommendedActions: [
          "Replay the latest Stripe subscription update webhook.",
          "Verify which subscription id is active in Stripe before editing local records.",
        ],
      });
    }

    if (
      currentContract &&
      currentContract.contract_source !== "internal_comp" &&
      !currentContract.stripe_price_id &&
      currentContract.plan_id !== "free"
    ) {
      pushFinding(findings, {
        code: "missing_contract_price_id",
        severity: "critical",
        confidence: "high",
        summary: "Paid contract is missing its Stripe price id snapshot.",
        details:
          "The current subscriber contract has no Stripe price id. That removes the strongest link between the user’s locked billing terms and the Stripe subscription that should be charged.",
        recommendedActions: [
          "Backfill stripe_price_id from the active Stripe subscription item.",
          "Avoid plan migrations until the contract snapshot is repaired.",
        ],
      });
    }

    if (currentContract && !linkedOffer) {
      pushFinding(findings, {
        code: "missing_linked_offer",
        severity: "warning",
        confidence: "medium",
        summary: "Current contract references an offer that is not present locally.",
        details:
          "The contract offer id does not resolve to a billing_plan_offers row. Historical offer cleanup or incomplete migrations can cause this and make pricing audits harder.",
        recommendedActions: [
          "Restore or recreate the missing billing_plan_offers row.",
          "Keep the contract snapshot values unchanged until the linked offer is restored.",
        ],
      });
    }

    if (currentContract && linkedOffer) {
      if (currentContract.stripe_price_id !== linkedOffer.stripePriceId) {
        pushFinding(findings, {
          code: "linked_offer_price_id_mismatch",
          severity: "warning",
          confidence: "high",
          summary: "Current contract Stripe price id differs from its linked offer.",
          details:
            "The contract snapshot and linked offer row are pointing at different Stripe recurring prices. This usually means the contract was grandfathered or one side drifted without the other being updated.",
          recommendedActions: [
            "If the user is intentionally grandfathered, keep the contract and treat this as informational drift.",
            "If not grandfathered, resync the linked offer or contract from Stripe and pricing policy.",
          ],
        });
      }

      if (
        asCents(currentContract.recurring_price_cents) !==
          asCents(linkedOffer.recurringPriceCents) ||
        asCents(currentContract.monthly_credits_cents) !== asCents(linkedOffer.monthlyCreditsCents)
      ) {
        pushFinding(findings, {
          code: "linked_offer_snapshot_mismatch",
          severity: "warning",
          confidence: "high",
          summary: "Current contract pricing snapshot differs from its linked offer snapshot.",
          details:
            "The stored subscriber contract values no longer match the linked offer row. This is expected for grandfathered deals, but it should be reviewed if the contract was meant to track the linked offer exactly.",
          recommendedActions: [
            "Confirm whether the subscriber is intentionally grandfathered.",
            "If not, replay Stripe events or repair the contract snapshot from the intended offer.",
          ],
        });
      }
    }

    if (currentContract?.contract_source === "internal_comp") {
      pushFinding(findings, {
        code: "internal_comp_contract",
        severity: "info",
        confidence: "high",
        summary: "This account is payment exempt rather than Stripe billed.",
        details:
          "Recurring access and monthly renewals for this user are expected to come from the internal comp renewal runner, not from Stripe invoice webhooks.",
        recommendedActions: [
          "Use the admin payment-exempt controls for changes to this account.",
          "Only treat missing Stripe linkage as a problem if this user is supposed to be on a paid Stripe contract instead.",
        ],
      });
    }

    if (storageSummary.isOverLimit) {
      pushFinding(findings, {
        code: "storage_over_limit",
        severity: "warning",
        confidence: "high",
        summary: "User is over their current media storage entitlement.",
        details:
          "This account is currently using more canonical media storage than the active base plan plus recurring storage add-ons allow. New uploads and autosaves should already be blocked until the user deletes media or adds more capacity.",
        recommendedActions: [
          "Confirm whether the user wants to add recurring storage capacity or upgrade the base plan.",
          "If the user wants to stay on the current tier, have them delete media until usage falls back under the limit.",
        ],
      });
    }

    if (
      currentPublicOffer &&
      !currentPublicOffer.stripePriceId &&
      currentPublicOffer.planId !== "free"
    ) {
      pushFinding(findings, {
        code: "missing_public_offer_price_id",
        severity: "critical",
        confidence: "high",
        summary: "Current public offer is missing its Stripe price id.",
        details:
          "New subscription sales for this plan cannot complete safely while the acquisition offer lacks a Stripe recurring price id mapping.",
        recommendedActions: [
          "Create or locate the Stripe Price for the current public offer.",
          "Update billing_plan_offers.stripe_price_id before enabling new sales for this tier.",
        ],
      });
    }

    if (
      currentContract &&
      currentPublicOffer &&
      currentContract.stripe_price_id &&
      currentPublicOffer.stripePriceId &&
      currentContract.stripe_price_id !== currentPublicOffer.stripePriceId &&
      asCents(currentContract.recurring_price_cents) !==
        asCents(currentPublicOffer.recurringPriceCents)
    ) {
      pushFinding(findings, {
        code: "grandfathered_price_gap",
        severity: "info",
        confidence: "high",
        summary: "Current contract is on a different recurring price than the public offer.",
        details:
          "This user appears to be on a legacy or otherwise subscriber-specific price. That is expected when grandfathering is intentional, but support should understand that changing plans may forfeit the current rate.",
        recommendedActions: [
          "Treat the subscriber contract as billing truth for this user.",
          "Warn the user before any plan change that could move them onto the current public offer.",
        ],
      });
    }

    if (!stripeConfigured) {
      pushFinding(findings, {
        code: "stripe_not_configured",
        severity: "info",
        confidence: "high",
        summary: "Live Stripe reconciliation is not available in this environment.",
        details:
          "The server does not have STRIPE_SECRET_KEY configured, so diagnostics are limited to local billing tables.",
      });
    } else if (
      currentContract?.contract_source !== "internal_comp" &&
      billingProfile?.stripe_customer_id &&
      (billingProfile?.stripe_subscription_id || currentContract?.stripe_subscription_id) &&
      !liveStripeSubscription
    ) {
      pushFinding(findings, {
        code: "stripe_subscription_not_found",
        severity: "critical",
        confidence: "high",
        summary: "Live Stripe subscription could not be resolved for this user.",
        details:
          "Local billing state references a Stripe customer or subscription, but the live subscription could not be found. This can indicate stale local linkage or a deleted Stripe subscription.",
        recommendedActions: [
          "Verify the customer and subscription ids directly in Stripe.",
          "Repair local linkage only after confirming the intended live Stripe object.",
        ],
      });
    }

    if (
      currentContract &&
      currentContract.contract_source !== "internal_comp" &&
      stripeSubscription.subscriptionId &&
      currentContract.stripe_subscription_id &&
      currentContract.stripe_subscription_id !== stripeSubscription.subscriptionId
    ) {
      pushFinding(findings, {
        code: "stripe_live_subscription_mismatch",
        severity: "warning",
        confidence: "high",
        summary: "Current contract subscription id differs from the live Stripe subscription.",
        details:
          "The live Stripe reconciliation path resolved a different subscription id than the stored contract. This usually means local linkage is stale or the customer changed subscriptions without a full contract resync.",
        recommendedActions: [
          "Replay the latest Stripe subscription update webhook.",
          "Confirm the intended active subscription in Stripe before editing local rows.",
        ],
      });
    }

    if (
      currentContract &&
      currentContract.contract_source !== "internal_comp" &&
      stripeSubscription.priceId &&
      currentContract.stripe_price_id &&
      currentContract.stripe_price_id !== stripeSubscription.priceId
    ) {
      pushFinding(findings, {
        code: "stripe_live_price_id_mismatch",
        severity: "critical",
        confidence: "high",
        summary: "Current contract Stripe price id differs from the live Stripe subscription item.",
        details:
          "The live Stripe subscription is charging a different price id than the one stored on the subscriber contract. Renewal credits or UI messaging can drift until this is reconciled.",
        recommendedActions: [
          "Use Stripe as the charging source of truth and confirm whether the local contract needs repair.",
          "Replay the latest Stripe subscription/invoice webhook after verifying the intended live price id.",
        ],
      });
    }

    if (
      currentContract &&
      currentContract.contract_source !== "internal_comp" &&
      stripeSubscription.recurringPriceCents != null &&
      asCents(currentContract.recurring_price_cents) != null &&
      asCents(currentContract.recurring_price_cents) !== stripeSubscription.recurringPriceCents
    ) {
      pushFinding(findings, {
        code: "stripe_live_amount_mismatch",
        severity: "critical",
        confidence: "high",
        summary:
          "Current contract recurring amount differs from the live Stripe subscription amount.",
        details:
          "The stored contract amount and the amount currently configured on the live Stripe subscription item do not match. That means the app and Stripe disagree on what this user is paying.",
        recommendedActions: [
          "Inspect the live Stripe price and invoice history before changing local contract values.",
          "Repair the contract snapshot or migrate the subscription intentionally once the intended amount is confirmed.",
        ],
      });
    }

    return res.status(200).json({
      target: {
        userId,
        email: userResult.data.user.email ?? null,
      },
      billingProfile: responseProfile,
      currentContract: responseContract,
      linkedOffer,
      currentPublicOffer,
      activeStorageAddons,
      storageSummary,
      stripeSubscription,
      findings,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/billing-diagnostics",
      user: adminUser,
      metadata: {
        user_id: userId,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load billing diagnostics.",
    });
  }
}
