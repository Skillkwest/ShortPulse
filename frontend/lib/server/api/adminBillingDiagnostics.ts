import type {
  AdminAuthIdentitySnapshot,
  AdminBillingContractSnapshot,
  AdminBillingDiagnosticsResponse,
  AdminBillingOfferSnapshot,
  AdminBillingProfileSnapshot,
  AdminBillingStorageAddonSnapshot,
  AdminHealthFinding,
} from "../../../features/admin/types";
import {
  isManualReviewStorageAddon,
  isCurrentBillableStorageAddonStatus,
  resolveStorageAddonEligibility,
} from "../../billing/storageAddonEligibility";
import {
  asCents,
  asDate,
  asQuantity,
  BillingContractRow,
  BillingLedgerGrantRow,
  BillingOfferRow,
  BillingProfileRow,
  BillingStorageAddonRow,
  buildPricingObservabilityEvent,
  HistoricalBillingStorageAddonRow,
  isSchemaCompatibilityError,
  isStripeModeMismatchError,
  isUuid,
  mapStripeCustomerSnapshot,
  mapStripeSubscriptionSnapshot,
  MediaUsageRow,
  normalizeText,
  pickPositiveNumber,
  PricingObservabilityEvent,
  pushFinding,
  stringifyLookupError,
  StripeCustomerResponse,
  StripeInvoiceListResponse,
  StripeInvoiceResponse,
  StripeLookupFailure,
  StripeSubscriptionListResponse,
  StripeSubscriptionResponse,
} from "./adminBillingDiagnosticsMappers";
import { resolveAuthDisplayName } from "./accountIdentity";
import { stripeGet } from "./stripe";
import { getSupabaseAdmin } from "./supabaseAdmin";

type AdminBillingDiagnosticsLogParams = {
  error: unknown;
  metadata: Record<string, unknown>;
};

export class AdminBillingDiagnosticsServiceError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AdminBillingDiagnosticsServiceError";
    this.statusCode = statusCode;
  }
}

export const isAdminBillingDiagnosticsUserId = isUuid;

export const resolveAdminBillingDiagnostics = async ({
  userId,
  logStripeLookupException,
}: {
  userId: string;
  logStripeLookupException?: (params: AdminBillingDiagnosticsLogParams) => Promise<void>;
}): Promise<AdminBillingDiagnosticsResponse> => {
  const supabaseAdmin = getSupabaseAdmin();
  const userResult = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userResult.error) {
    throw new Error(userResult.error.message || "Failed to load target user.");
  }
  if (!userResult.data.user) {
    throw new AdminBillingDiagnosticsServiceError(404, "User not found.");
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
        "id, plan_id, offer_id, billing_interval, stripe_customer_id, stripe_price_id, stripe_subscription_id, contract_source, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, status, current_period_start, current_period_end, last_credit_grant_at, next_credit_grant_at"
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
    throw new AdminBillingDiagnosticsServiceError(
      500,
      detail || "Failed to load billing diagnostics."
    );
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
      throw new AdminBillingDiagnosticsServiceError(500, offerErrors.join(" | "));
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

  const [
    storageAddonsResult,
    historicalStorageAddonsResult,
    mediaUsageResult,
    recentReservationsResult,
    recentLedgerResult,
    recentGrantLedgerResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("billing_subscription_storage_addons")
      .select(
        "id, storage_addon_id, offer_id, stripe_subscription_item_id, stripe_price_id, storage_limit_bytes, quantity, recurring_price_cents, status"
      )
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("billing_subscription_storage_addons")
      .select(
        "id, storage_addon_id, stripe_subscription_item_id, status, current_period_start, current_period_end, started_at, ended_at, updated_at"
      )
      .eq("user_id", userId)
      .not("ended_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(10),
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
    supabaseAdmin
      .from("ai_credit_ledger")
      .select("id, source, source_ref, change_cents, metadata, created_at")
      .eq("user_id", userId)
      .in("source", ["subscription_renewal", "annual_contract_monthly_allocation"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (
    storageAddonsResult.error ||
    historicalStorageAddonsResult.error ||
    mediaUsageResult.error ||
    recentReservationsResult.error ||
    recentLedgerResult.error ||
    recentGrantLedgerResult.error
  ) {
    const detail = [
      storageAddonsResult.error?.message,
      historicalStorageAddonsResult.error?.message,
      mediaUsageResult.error?.message,
      recentReservationsResult.error?.message,
      recentLedgerResult.error?.message,
      recentGrantLedgerResult.error?.message,
    ]
      .filter(Boolean)
      .join(" | ");
    throw new AdminBillingDiagnosticsServiceError(
      500,
      detail || "Failed to load storage diagnostics."
    );
  }

  let liveStripeCustomer: StripeCustomerResponse | null = null;
  let liveStripeSubscription: StripeSubscriptionResponse | null = null;
  let livePaidInvoices: StripeInvoiceResponse[] = [];
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
          await logStripeLookupException?.({
            error,
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
          await logStripeLookupException?.({
            error,
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
        const subscriptionList = await stripeGet<StripeSubscriptionListResponse>("/subscriptions", {
          customer: billingProfile.stripe_customer_id,
          status: "all",
          limit: 1,
          "expand[]": "data.items.data.price",
        });
        liveStripeSubscription = Array.isArray(subscriptionList.data)
          ? (subscriptionList.data[0] ?? null)
          : null;
      } catch (error) {
        await logStripeLookupException?.({
          error,
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

    if (billingProfile?.stripe_customer_id) {
      try {
        const invoiceList = await stripeGet<StripeInvoiceListResponse>("/invoices", {
          customer: billingProfile.stripe_customer_id,
          limit: 12,
        });
        livePaidInvoices = (Array.isArray(invoiceList.data) ? invoiceList.data : []).filter(
          (invoice) => {
            const amountPaid = Number(invoice.amount_paid ?? 0);
            return amountPaid > 0 || invoice.paid === true || invoice.status === "paid";
          }
        );
      } catch (error) {
        await logStripeLookupException?.({
          error,
          metadata: {
            stripe_lookup_target: "invoice_list",
            stripe_customer_id: billingProfile.stripe_customer_id,
            message: "Invoice list lookup failed in billing diagnostics.",
          },
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
        billingInterval: currentContract.billing_interval ?? null,
        stripeCustomerId: currentContract.stripe_customer_id ?? null,
        stripePriceId: currentContract.stripe_price_id ?? null,
        stripeSubscriptionId: currentContract.stripe_subscription_id ?? null,
        contractSource: currentContract.contract_source ?? null,
        recurringPriceCents: asCents(currentContract.recurring_price_cents),
        monthlyCreditsCents: asCents(currentContract.monthly_credits_cents),
        storageLimitBytes: asCents(currentContract.storage_limit_bytes),
        status: currentContract.status ?? null,
        currentPeriodStart: currentContract.current_period_start ?? null,
        currentPeriodEnd: currentContract.current_period_end ?? null,
        lastCreditGrantAt: currentContract.last_credit_grant_at ?? null,
        nextCreditGrantAt: currentContract.next_credit_grant_at ?? null,
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
  const historicalStorageAddons = (
    (historicalStorageAddonsResult.data as HistoricalBillingStorageAddonRow[] | null) ?? []
  ).map((row) => ({
    id: row.id,
    storageAddonId: row.storage_addon_id ?? null,
    stripeSubscriptionItemId: row.stripe_subscription_item_id ?? null,
    status: row.status ?? null,
    currentPeriodStart: row.current_period_start ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    updatedAt: row.updated_at ?? null,
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
  const recentLedgerRows = (recentLedgerResult.data as Array<Record<string, unknown>> | null) ?? [];
  const recurringGrantRows = (recentGrantLedgerResult.data as BillingLedgerGrantRow[] | null) ?? [];
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
  const latestSubscriptionGrantAt =
    recurringGrantRows.find((row) => row.source === "subscription_renewal")?.created_at ?? null;
  const latestAnnualAllocationAt =
    recurringGrantRows.find((row) => row.source === "annual_contract_monthly_allocation")
      ?.created_at ?? null;
  const recentPaidAllocationInvoices = livePaidInvoices.filter((invoice) =>
    ["subscription_create", "subscription_cycle"].includes(
      String(invoice.billing_reason ?? "").toLowerCase()
    )
  );
  const recurringGrantInvoiceIds = new Set(
    recurringGrantRows
      .map((row) => {
        const metadata = row.metadata ?? {};
        if (typeof metadata.invoice_id === "string" && metadata.invoice_id.length > 0) {
          return metadata.invoice_id;
        }
        if (typeof row.source_ref === "string") {
          const match = row.source_ref.match(/^invoice:([^:]+):monthly_allocation$/);
          return match?.[1] ?? null;
        }
        return null;
      })
      .filter((value): value is string => Boolean(value))
  );
  const recurringGrantHealth = {
    latestSubscriptionGrantAt,
    latestAnnualAllocationAt,
    recentPaidAllocationInvoices: recentPaidAllocationInvoices.length,
    unmatchedPaidAllocationInvoices: recentPaidAllocationInvoices
      .map((invoice) => invoice.id)
      .filter((invoiceId) => !recurringGrantInvoiceIds.has(invoiceId)),
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
  const activeRecurringStorageAddons = activeStorageAddons.filter((addon) =>
    isCurrentBillableStorageAddonStatus(addon.status)
  );
  const diagnosticsPlanId = responseContract?.planId ?? responseProfile?.planId ?? "free";

  if (activeRecurringStorageAddons.length > 1) {
    pushFinding(findings, {
      code: "multiple_active_storage_addons",
      severity: "critical",
      confidence: "high",
      summary: "Account has more than one active recurring storage add-on.",
      details:
        `${activeRecurringStorageAddons.length} active recurring storage add-on rows are open for this account. ` +
        "Storage add-ons are single-slot entitlements, so stacked rows can overstate the media storage limit.",
      recommendedActions: [
        "Inspect the live Stripe subscription items before editing local storage add-on rows.",
        "Close or repair extra active rows only after confirming the intended single add-on.",
      ],
    });
  }

  const quantityDriftCount = activeRecurringStorageAddons.filter(
    (addon) => addon.quantity !== 1
  ).length;
  if (quantityDriftCount > 0) {
    pushFinding(findings, {
      code: "storage_addon_quantity_not_one",
      severity: "critical",
      confidence: "high",
      summary: "Active recurring storage add-on quantity is not one.",
      details:
        `${quantityDriftCount} active recurring storage add-on row(s) have quantity other than one. ` +
        "Recurring storage add-ons should not multiply entitlement by Stripe quantity.",
      recommendedActions: [
        "Confirm the live Stripe item quantity before changing local state.",
        "Repair the Stripe item or local row so the active storage add-on quantity is exactly one.",
      ],
    });
  }

  const manualReviewActiveCount = activeRecurringStorageAddons.filter((addon) =>
    isManualReviewStorageAddon(addon.storageAddonId)
  ).length;
  if (manualReviewActiveCount > 0) {
    pushFinding(findings, {
      code: "manual_review_storage_addon_active",
      severity: "warning",
      confidence: "high",
      summary: "Manual-review storage add-on is active on the account.",
      details:
        `${manualReviewActiveCount} active recurring storage add-on row(s) use manual-review capacity. ` +
        "These add-ons should not enter the self-serve checkout path.",
      recommendedActions: [
        "Verify the account was intentionally granted manual-review storage capacity.",
        "If this was self-serve drift, remove or migrate the add-on after confirming Stripe state.",
      ],
    });
  }

  const planIneligibleActiveCount = activeRecurringStorageAddons.filter((addon) => {
    const eligibility = resolveStorageAddonEligibility({
      planId: diagnosticsPlanId,
      storageAddonId: addon.storageAddonId,
    });
    return !eligibility.isEligible && !eligibility.isManualReviewOnly;
  }).length;
  if (planIneligibleActiveCount > 0) {
    pushFinding(findings, {
      code: "storage_addon_plan_ineligible",
      severity: "critical",
      confidence: "high",
      summary: "Active recurring storage add-on is not eligible for the current plan.",
      details:
        `${planIneligibleActiveCount} active recurring storage add-on row(s) do not match the current plan eligibility rules. ` +
        "The account may be receiving storage capacity that the self-serve plan should not allow.",
      recommendedActions: [
        "Confirm the intended customer plan and live Stripe storage item.",
        "Repair the add-on or plan state through the canonical billing reconciliation path.",
      ],
    });
  }

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
    currentContract?.contract_source === "stripe" &&
    currentContract.billing_interval === "year" &&
    currentContract.status === "active" &&
    !currentContract.current_period_end
  ) {
    pushFinding(findings, {
      code: "annual_contract_missing_period_end",
      severity: "critical",
      confidence: "high",
      summary: "Annual contract is missing its current period end.",
      details:
        "The active annual contract has no current_period_end value, so renewal timing and monthly annual allocations cannot be trusted.",
      recommendedActions: [
        "Repair the annual contract period bounds from the live Stripe subscription.",
        "Do not rely on the renewal worker for this account until the contract cursor is repaired.",
      ],
    });
  }

  if (
    currentContract?.contract_source === "stripe" &&
    currentContract.billing_interval === "year" &&
    currentContract.status === "active" &&
    currentContract.current_period_end &&
    !currentContract.next_credit_grant_at
  ) {
    pushFinding(findings, {
      code: "annual_credit_cursor_missing",
      severity: "critical",
      confidence: "high",
      summary: "Annual contract is missing its next monthly credit cursor.",
      details:
        "This annual subscriber has an active yearly term but no next_credit_grant_at value. Future monthly allocations will be skipped until the cursor is repaired.",
      recommendedActions: [
        "Backfill next_credit_grant_at from the active annual contract period.",
        "Inspect the live Stripe subscription items before changing local dates.",
      ],
    });
  }

  if (
    currentContract?.contract_source === "stripe" &&
    currentContract.billing_interval === "year" &&
    currentContract.status === "active" &&
    currentContract.current_period_start &&
    currentContract.current_period_end &&
    currentContract.next_credit_grant_at
  ) {
    const currentPeriodStart = asDate(currentContract.current_period_start);
    const currentPeriodEnd = asDate(currentContract.current_period_end);
    const nextCreditGrantAt = asDate(currentContract.next_credit_grant_at);
    if (
      currentPeriodStart &&
      currentPeriodEnd &&
      nextCreditGrantAt &&
      (nextCreditGrantAt.getTime() <= currentPeriodStart.getTime() ||
        nextCreditGrantAt.getTime() >= currentPeriodEnd.getTime())
    ) {
      pushFinding(findings, {
        code: "annual_credit_cursor_invalid",
        severity: "critical",
        confidence: "high",
        summary: "Annual contract credit cursor is outside the active billing term.",
        details:
          "The next annual monthly credit allocation cursor is outside the current annual period bounds. Renewal allocations can stall or misfire until it is corrected.",
        recommendedActions: [
          "Repair next_credit_grant_at so it falls strictly inside the active annual term.",
          "Confirm current_period_start and current_period_end from the live Stripe subscription.",
        ],
      });
    }
  }

  if (
    currentContract?.contract_source === "stripe" &&
    currentContract.billing_interval === "year" &&
    currentContract.status === "active" &&
    currentContract.next_credit_grant_at
  ) {
    const nextCreditGrantAt = asDate(currentContract.next_credit_grant_at);
    const currentPeriodEnd = asDate(currentContract.current_period_end);
    if (
      nextCreditGrantAt &&
      currentPeriodEnd &&
      nextCreditGrantAt.getTime() < Date.now() &&
      currentPeriodEnd.getTime() > Date.now()
    ) {
      pushFinding(findings, {
        code: "annual_credit_cursor_overdue",
        severity: "warning",
        confidence: "high",
        summary: "Annual monthly credit allocation is overdue.",
        details:
          "The next annual monthly allocation cursor is already in the past while the annual term is still active. This usually means the renewal worker has not advanced the contract yet.",
        recommendedActions: [
          "Run the annual renewal worker or inspect its latest execution logs.",
          "Confirm the contract receives an annual_contract_monthly_allocation ledger entry after repair.",
        ],
      });
    }
  }

  if (
    currentContract?.contract_source === "stripe" &&
    currentContract.plan_id !== "free" &&
    recurringGrantHealth.unmatchedPaidAllocationInvoices.length > 0
  ) {
    pushFinding(findings, {
      code: "missing_paid_invoice_credit_grant",
      severity: "critical",
      confidence: "medium",
      summary: "At least one paid subscription invoice has no matching local credit grant.",
      details: `Recent paid allocation invoices without a matching local grant: ${recurringGrantHealth.unmatchedPaidAllocationInvoices.join(
        ", "
      )}. The user may have been charged successfully without receiving recurring credits.`,
      recommendedActions: [
        "Inspect the matching Stripe invoice and local ai_credit_ledger rows together.",
        "Backfill missing recurring credits only after confirming the invoice was paid and not already granted through another source.",
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
      asCents(currentContract.recurring_price_cents) !== asCents(linkedOffer.recurringPriceCents) ||
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

  const suspiciousHistoricalStorageAddons = historicalStorageAddons.filter((row) => {
    const endedAt = asDate(row.endedAt);
    const startedAt = asDate(row.startedAt);
    const currentPeriodStart = asDate(row.currentPeriodStart);
    if (endedAt && startedAt && endedAt.getTime() < startedAt.getTime()) {
      return true;
    }
    if (endedAt && currentPeriodStart && endedAt.getTime() === currentPeriodStart.getTime()) {
      return true;
    }
    return false;
  });

  if (suspiciousHistoricalStorageAddons.length > 0) {
    const sampleRows = suspiciousHistoricalStorageAddons
      .slice(0, 3)
      .map((row) => row.id)
      .join(", ");
    pushFinding(findings, {
      code: "historical_storage_lifecycle_drift",
      severity: "warning",
      confidence: "high",
      summary: "Historical storage add-on lifecycle rows look suspicious.",
      details: `${suspiciousHistoricalStorageAddons.length} historical storage add-on row(s) have impossible or period-start removal timing. Sample row ids: ${sampleRows}.`,
      recommendedActions: [
        "Inspect billing_subscription_storage_addons history before assuming add-on removals were recorded cleanly.",
        "Use the historical billing drift audit queries before backfilling or deleting any storage lifecycle rows.",
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

  return {
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
    recurringGrantHealth,
    historicalStorageAddons,
    findings,
  };
};
