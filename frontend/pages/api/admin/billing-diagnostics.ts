import type { NextApiRequest, NextApiResponse } from "next";
import type {
  AdminAuthIdentitySnapshot,
  AdminBillingContractSnapshot,
  AdminBillingDiagnosticsResponse,
  AdminBillingOfferSnapshot,
  AdminBillingProfileSnapshot,
  AdminBillingStorageAddonSnapshot,
  AdminHealthFinding,
  AdminStripeCustomerSnapshot,
  AdminStripeSubscriptionSnapshot,
} from "../../../features/admin/types";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { resolveAuthDisplayName } from "../../../lib/server/api/accountIdentity";
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
  stripe_customer_id: string | null;
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

type PricingObservabilityEvent = {
  sourceType: "reservation" | "ledger";
  rowId: string | null;
  sourceRef: string | null;
  requestId: string | null;
  observedAt: string | null;
  displayedBilledCredits: number | null;
  actualBilledCredits: number | null;
  deltaCredits: number | null;
  mismatch: boolean | null;
  pricingDisplaySource: string | null;
  pricingPolicyReady: boolean | null;
};

type StripeSubscriptionResponse = {
  id: string;
  status?: string | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      id?: string | null;
      quantity?: number | null;
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

type StripeCustomerResponse = {
  id: string;
  email?: string | null;
  name?: string | null;
  deleted?: boolean;
};

type StripeLookupFailure = {
  target: "customer" | "subscription" | "subscription_list";
  identifier: string | null;
  message: string;
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

const asQuantity = (value: number | string | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

const isStripeModeMismatchError = (message: string): boolean => {
  const text = message.toLowerCase();
  return (
    text.includes("test mode") &&
    text.includes("live mode") &&
    (text.includes("no such") || text.includes("does not exist"))
  );
};

const stringifyLookupError = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return `Stripe ${fallback} failed.`;
};

const normalizeText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readPricingObservability = (
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const direct = metadata.pricing_observability;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }
  const nestedPricingMetadata = metadata.pricing_metadata;
  if (
    nestedPricingMetadata &&
    typeof nestedPricingMetadata === "object" &&
    !Array.isArray(nestedPricingMetadata)
  ) {
    const nested = (nestedPricingMetadata as Record<string, unknown>).pricing_observability;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return null;
};

const buildPricingObservabilityEvent = ({
  sourceType,
  rowId,
  sourceRef,
  requestId,
  observedAt,
  metadata,
}: {
  sourceType: PricingObservabilityEvent["sourceType"];
  rowId: string | null;
  sourceRef: string | null;
  requestId: string | null;
  observedAt: string | null;
  metadata: Record<string, unknown> | null | undefined;
}): PricingObservabilityEvent | null => {
  const observability = readPricingObservability(metadata);
  if (!observability) return null;
  return {
    sourceType,
    rowId,
    sourceRef,
    requestId,
    observedAt,
    displayedBilledCredits: asFiniteNumber(observability.displayed_billed_credits),
    actualBilledCredits: asFiniteNumber(observability.actual_billed_credits),
    deltaCredits: asFiniteNumber(observability.delta_credits),
    mismatch: typeof observability.mismatch === "boolean" ? observability.mismatch : null,
    pricingDisplaySource: normalizeText(
      typeof observability.pricing_display_source === "string"
        ? observability.pricing_display_source
        : null
    ),
    pricingPolicyReady:
      typeof observability.pricing_policy_ready === "boolean"
        ? observability.pricing_policy_ready
        : null,
  };
};

const pickPositiveNumber = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (value != null && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
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

const mapStripeCustomerSnapshot = (params: {
  configured: boolean;
  customerId: string | null;
  customer: StripeCustomerResponse | null;
}): AdminStripeCustomerSnapshot => ({
  configured: params.configured,
  customerId: params.customerId,
  deleted: Boolean(params.customer?.deleted),
  email: normalizeText(params.customer?.email),
  name: normalizeText(params.customer?.name),
});

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
    const authIdentity: AdminAuthIdentitySnapshot = {
      userId,
      email: userResult.data.user.email ?? null,
      displayName: resolveAuthDisplayName(userResult.data.user),
    };

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
          "id, plan_id, offer_id, stripe_customer_id, stripe_price_id, stripe_subscription_id, contract_source, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, status, current_period_end"
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

    const [storageAddonsResult, mediaUsageResult, recentReservationsResult, recentLedgerResult] =
      await Promise.all([
        supabaseAdmin
          .from("billing_subscription_storage_addons")
          .select(
            "id, storage_addon_id, offer_id, stripe_subscription_item_id, stripe_price_id, storage_limit_bytes, quantity, recurring_price_cents, status"
          )
          .eq("user_id", userId)
          .is("ended_at", null)
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("media_files").select("file_size").eq("user_id", userId),
        supabaseAdmin
          .from("ai_credit_reservations")
          .select("id, user_id, source_ref, provider_request_id, metadata, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabaseAdmin
          .from("ai_credit_ledger")
          .select("id, user_id, source_ref, metadata, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

    if (
      storageAddonsResult.error ||
      mediaUsageResult.error ||
      recentReservationsResult.error ||
      recentLedgerResult.error
    ) {
      const detail = [
        storageAddonsResult.error?.message,
        mediaUsageResult.error?.message,
        recentReservationsResult.error?.message,
        recentLedgerResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Failed to load storage diagnostics." });
    }

    let liveStripeCustomer: StripeCustomerResponse | null = null;
    let liveStripeSubscription: StripeSubscriptionResponse | null = null;
    const stripeLookupFailures: StripeLookupFailure[] = [];
    if (stripeConfigured) {
      if (billingProfile?.stripe_customer_id) {
        try {
          liveStripeCustomer = await stripeGet<StripeCustomerResponse>(
            `/customers/${billingProfile.stripe_customer_id}`
          );
        } catch (error) {
          const message = stringifyLookupError(error, "customer lookup");
          if (!isStripeModeMismatchError(message)) {
            await logApiRouteException({
              req,
              error,
              routeLabel: "admin/billing-diagnostics",
              user: adminUser,
              metadata: {
                stripe_lookup_target: "customer",
                stripe_customer_id: billingProfile.stripe_customer_id,
                message: "Customer lookup failed in billing diagnostics.",
              },
            });
          }
          stripeLookupFailures.push({
            target: "customer",
            identifier: billingProfile.stripe_customer_id,
            message,
          });
        }
      }
      if (currentContract?.stripe_subscription_id || billingProfile?.stripe_subscription_id) {
        const subscriptionId =
          currentContract?.stripe_subscription_id ?? billingProfile?.stripe_subscription_id ?? null;
        if (subscriptionId) {
          try {
            liveStripeSubscription = await stripeGet<StripeSubscriptionResponse>(
              `/subscriptions/${subscriptionId}`,
              {
                "expand[]": "items.data.price",
              }
            );
          } catch (error) {
            await logApiRouteException({
              req,
              error,
              routeLabel: "admin/billing-diagnostics",
              user: adminUser,
              metadata: {
                stripe_lookup_target: "subscription",
                stripe_subscription_id: subscriptionId,
                message: "Subscription lookup failed in billing diagnostics.",
              },
            });
            stripeLookupFailures.push({
              target: "subscription",
              identifier: subscriptionId,
              message: stringifyLookupError(error, "subscription lookup"),
            });
          }
        }
      } else if (billingProfile?.stripe_customer_id) {
        try {
          const subscriptionList = await stripeGet<StripeSubscriptionListResponse>(
            "/subscriptions",
            {
              customer: billingProfile.stripe_customer_id,
              status: "all",
              limit: 1,
              "expand[]": "data.items.data.price",
            }
          );
          liveStripeSubscription = Array.isArray(subscriptionList.data)
            ? (subscriptionList.data[0] ?? null)
            : null;
        } catch (error) {
          await logApiRouteException({
            req,
            error,
            routeLabel: "admin/billing-diagnostics",
            user: adminUser,
            metadata: {
              stripe_lookup_target: "subscription_list",
              stripe_customer_id: billingProfile.stripe_customer_id,
              message: "Subscription list lookup failed in billing diagnostics.",
            },
          });
          stripeLookupFailures.push({
            target: "subscription_list",
            identifier: billingProfile.stripe_customer_id,
            message: stringifyLookupError(error, "subscription list lookup"),
          });
        }
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
          stripeCustomerId: currentContract.stripe_customer_id ?? null,
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
    const baseLimitBytes = pickPositiveNumber(
      responseContract?.storageLimitBytes,
      linkedOffer?.storageLimitBytes,
      currentPublicOffer?.storageLimitBytes
    );
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
    const recentReservationRows =
      (recentReservationsResult.data as Array<Record<string, unknown>> | null) ?? [];
    const recentLedgerRows =
      (recentLedgerResult.data as Array<Record<string, unknown>> | null) ?? [];
    const reservationObservabilityRows = recentReservationRows
      .map((row) =>
        buildPricingObservabilityEvent({
          sourceType: "reservation",
          rowId: normalizeText(typeof row.id === "string" ? row.id : null),
          sourceRef: normalizeText(typeof row.source_ref === "string" ? row.source_ref : null),
          requestId: normalizeText(
            typeof row.provider_request_id === "string" ? row.provider_request_id : null
          ),
          observedAt: normalizeText(typeof row.created_at === "string" ? row.created_at : null),
          metadata:
            row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : null,
        })
      )
      .filter((row): row is PricingObservabilityEvent => row != null);
    const ledgerObservabilityRows = recentLedgerRows
      .map((row) =>
        buildPricingObservabilityEvent({
          sourceType: "ledger",
          rowId: normalizeText(typeof row.id === "string" ? row.id : null),
          sourceRef: normalizeText(typeof row.source_ref === "string" ? row.source_ref : null),
          requestId: null,
          observedAt: normalizeText(typeof row.created_at === "string" ? row.created_at : null),
          metadata:
            row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : null,
        })
      )
      .filter((row): row is PricingObservabilityEvent => row != null);
    const pricingObservabilityEvents = [
      ...reservationObservabilityRows,
      ...ledgerObservabilityRows,
    ].sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? ""));
    const pricingObservabilityMismatchCount = pricingObservabilityEvents.filter(
      (row) => row.mismatch === true
    ).length;
    const pricingObservability = {
      rowsScanned: {
        reservations: recentReservationRows.length,
        ledgerEntries: recentLedgerRows.length,
      },
      observedRows: {
        reservations: reservationObservabilityRows.length,
        ledgerEntries: ledgerObservabilityRows.length,
      },
      mismatchCount: pricingObservabilityMismatchCount,
      lastObservedAt: pricingObservabilityEvents[0]?.observedAt ?? null,
      latestEvents: pricingObservabilityEvents.slice(0, 5),
    };
    const stripeSubscription = mapStripeSubscriptionSnapshot({
      configured: stripeConfigured,
      customerId: billingProfile?.stripe_customer_id ?? null,
      subscription: liveStripeSubscription,
    });
    const stripeCustomer = mapStripeCustomerSnapshot({
      configured: stripeConfigured,
      customerId: billingProfile?.stripe_customer_id ?? null,
      customer: liveStripeCustomer,
    });
    const liveStripeItems = Array.isArray(liveStripeSubscription?.items?.data)
      ? (liveStripeSubscription.items?.data ?? [])
      : [];

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

    if (stripeCustomer.customerId && stripeCustomer.deleted) {
      pushFinding(findings, {
        code: "deleted_stripe_customer",
        severity: "warning",
        confidence: "high",
        summary: "Stripe customer mapping points at a deleted customer.",
        details:
          "The local billing profile still stores a Stripe customer id, but the live Stripe customer has been deleted.",
        recommendedActions: ["Run Stripe customer resync before opening billing actions."],
      });
    }

    if (
      stripeCustomer.customerId &&
      stripeCustomer.email != null &&
      normalizeText(authIdentity.email) !== normalizeText(stripeCustomer.email)
    ) {
      pushFinding(findings, {
        code: "stripe_customer_email_mismatch",
        severity: "warning",
        confidence: "high",
        summary: "Stripe customer email does not match auth email.",
        details:
          "Supabase auth and the linked Stripe customer are carrying different email values for this account.",
        recommendedActions: ["Run Stripe customer resync to align Stripe with auth identity."],
      });
    }

    if (
      stripeCustomer.customerId &&
      stripeCustomer.name != null &&
      normalizeText(authIdentity.displayName) !== normalizeText(stripeCustomer.name)
    ) {
      pushFinding(findings, {
        code: "stripe_customer_name_mismatch",
        severity: "info",
        confidence: "high",
        summary: "Stripe customer name does not match auth display name.",
        details:
          "The linked Stripe customer name is out of sync with the current Supabase auth display name.",
        recommendedActions: ["Run Stripe customer resync to align Stripe with auth identity."],
      });
    }

    if (
      currentContract?.contract_source === "internal_comp" &&
      stripeCustomer.customerId &&
      !stripeSubscription.subscriptionId
    ) {
      pushFinding(findings, {
        code: "internal_comp_with_stripe_customer",
        severity: "info",
        confidence: "high",
        summary: "Internal-comp account still has historical Stripe customer linkage.",
        details:
          "This account is managed internally, but a Stripe customer mapping still exists without a live Stripe subscription.",
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

    if (pricingObservabilityMismatchCount > 0) {
      pushFinding(findings, {
        code: "pricing_observability_mismatch",
        severity: "warning",
        confidence: "high",
        summary: "Recent estimate-vs-debit pricing mismatches were detected.",
        details:
          "Recent reservation or ledger rows for this user contain pricing observability mismatches, which means at least one billable UI surface displayed a different credit amount than the server debited.",
        recommendedActions: [
          "Open the generation trace for this user and inspect the latest pricing observability rows.",
          "Compare the affected generation surface against the shared pricing adapter and server debit path before changing pricing policy.",
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
    }

    const hasStripeLookupFailures = stripeLookupFailures.length > 0;
    if (hasStripeLookupFailures) {
      for (const failure of stripeLookupFailures) {
        const isCustomerFailure = failure.target === "customer";
        const isModeMismatch = isStripeModeMismatchError(failure.message);
        const isInternalComp = currentContract?.contract_source === "internal_comp";
        const details = isCustomerFailure
          ? `Stripe customer ${failure.identifier ?? "unknown"} could not be loaded: ${failure.message}`
          : `Stripe subscription lookup for ${failure.identifier ?? "unknown"} failed: ${failure.message}`;

        pushFinding(findings, {
          code: isCustomerFailure
            ? isModeMismatch
              ? "stripe_customer_mode_mismatch"
              : "stripe_customer_lookup_failed"
            : "stripe_subscription_lookup_failed",
          severity: isInternalComp || isModeMismatch ? "warning" : "critical",
          confidence: isModeMismatch ? "medium" : "high",
          summary: isModeMismatch
            ? "Stripe lookup failed due test/live mode mismatch."
            : "Stripe live lookup failed for a related object.",
          details,
          recommendedActions: isModeMismatch
            ? [
                "Repair stale Stripe identifiers to match the active billing mode before using this account in billing diagnostics.",
              ]
            : [
                "Inspect the linked Stripe id values and run a reconciliation path after confirming the intended environment and subscription state.",
              ],
        });
      }

      if (
        currentContract?.contract_source === "internal_comp" &&
        stripeLookupFailures.some((failure) => failure.target === "customer")
      ) {
        pushFinding(findings, {
          code: "internal_comp_stripe_lookup_failure",
          severity: "info",
          confidence: "medium",
          summary: "Internal-comp user has unresolved Stripe linkage.",
          details:
            "Payment-exempt accounts do not require Stripe reconciliation for plan access, but stale customer IDs can still confuse operations.",
          recommendedActions: [
            "Use admin payment-exempt controls to clear stale Stripe customer identifiers before retrying reconciliation.",
          ],
        });
      }
    }

    if (
      currentContract &&
      currentContract.contract_source !== "internal_comp" &&
      billingProfile?.stripe_customer_id &&
      currentContract.stripe_customer_id &&
      billingProfile.stripe_customer_id !== currentContract.stripe_customer_id
    ) {
      pushFinding(findings, {
        code: "stripe_customer_id_mismatch",
        severity: "warning",
        confidence: "high",
        summary: "Billing profile and active contract point at different Stripe customers.",
        details:
          "Local billing tables disagree on the Stripe customer id for this user. Portal flows, diagnostics, and invoice history can target the wrong customer until the mapping is reconciled.",
        recommendedActions: [
          "Run the admin Stripe customer sync flow to reconcile local profile and contract mappings.",
          "Confirm the intended Stripe customer in the active billing environment before editing local billing rows.",
        ],
      });
    }

    if (
      currentContract?.contract_source !== "internal_comp" &&
      billingProfile?.stripe_customer_id &&
      (billingProfile?.stripe_subscription_id || currentContract?.stripe_subscription_id) &&
      !liveStripeSubscription &&
      !hasStripeLookupFailures
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

    const matchedLiveAddonItemIds = new Set<string>();
    for (const addon of activeStorageAddons) {
      const matchedLiveItem = liveStripeItems.find((item) => {
        const liveItemId = typeof item?.id === "string" ? item.id : null;
        const livePriceId = item?.price?.id ?? null;
        if (addon.stripeSubscriptionItemId && liveItemId === addon.stripeSubscriptionItemId) {
          return true;
        }
        return addon.stripePriceId != null && livePriceId === addon.stripePriceId;
      });

      if (!matchedLiveItem) {
        pushFinding(findings, {
          code: "storage_addon_missing_in_stripe",
          severity: "critical",
          confidence: "high",
          summary: "Local recurring storage add-on is missing from live Stripe items.",
          details:
            "A current billing_subscription_storage_addons row does not match any live Stripe subscription item. Storage entitlement can drift if the local add-on contract is no longer backed by the Stripe subscription.",
          recommendedActions: [
            "Inspect the live Stripe subscription items for this customer.",
            "Repair or close the local add-on contract only after confirming the intended Stripe state.",
          ],
        });
        continue;
      }

      if (typeof matchedLiveItem.id === "string") {
        matchedLiveAddonItemIds.add(matchedLiveItem.id);
      }

      const localQuantity = Math.max(0, addon.quantity);
      const liveQuantity = asQuantity(matchedLiveItem.quantity ?? 1);
      if (localQuantity !== liveQuantity) {
        pushFinding(findings, {
          code: "storage_addon_quantity_mismatch",
          severity: "critical",
          confidence: "high",
          summary: "Local storage add-on quantity differs from live Stripe quantity.",
          details:
            "The local recurring storage add-on contract quantity does not match the corresponding live Stripe subscription item. That can distort the effective storage entitlement shown in-app.",
          recommendedActions: [
            "Replay the latest Stripe subscription update event for this customer.",
            "If Stripe is correct, repair the local add-on contract quantity from the live item.",
          ],
        });
      }
    }

    for (const liveItem of liveStripeItems) {
      const liveItemId = typeof liveItem?.id === "string" ? liveItem.id : null;
      const livePriceId = liveItem?.price?.id ?? null;
      if (!livePriceId) continue;
      if (currentContract?.stripe_price_id && livePriceId === currentContract.stripe_price_id) {
        continue;
      }
      if (liveItemId && matchedLiveAddonItemIds.has(liveItemId)) {
        continue;
      }

      pushFinding(findings, {
        code: "unmapped_live_subscription_item",
        severity: "critical",
        confidence: "high",
        summary: "Live Stripe subscription contains an unmapped recurring item.",
        details:
          "Stripe is currently billing a recurring subscription item that does not resolve to the current base contract or any local recurring storage add-on contract. This usually points to a missing mapping or a partial webhook sync.",
        recommendedActions: [
          "Check whether the live Stripe price id is part of the supported ShortPulse catalog.",
          "Repair local contract/add-on state before changing the subscription again.",
        ],
      });
    }

    return res.status(200).json({
      target: {
        userId,
        email: userResult.data.user.email ?? null,
      },
      authIdentity,
      billingProfile: responseProfile,
      currentContract: responseContract,
      linkedOffer,
      currentPublicOffer,
      activeStorageAddons,
      storageSummary,
      stripeCustomer,
      stripeSubscription,
      pricingObservability,
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
