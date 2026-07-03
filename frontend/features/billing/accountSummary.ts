/**
 * Authenticated account billing summary client.
 * Coalesces plan and media-storage quota reads behind the app API boundary.
 */
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import type { MediaStorageQuotaSummary } from "./storage";
import type {
  BillingLedgerEvent,
  BillingProfile,
  BillingSubscriptionContract,
  BillingSubscriptionStorageAddon,
} from "../profile/profilePageModel";

export type ResolvedAccountPlanSummary = {
  id: string;
  label: string;
  className: string;
  monthlyCreditsCents: number;
};

export type BillingAccountSummary = {
  userId: string;
  resolvedPlan: ResolvedAccountPlanSummary;
  quotaStatus: "available" | "unavailable";
  quotaSummary: MediaStorageQuotaSummary | null;
  profileState?: BillingAccountProfileState | null;
};

export type BillingAccountProfileState = {
  billingProfile: BillingProfile | null;
  billingContract: BillingSubscriptionContract | null;
  billingActivity: BillingLedgerEvent[];
  activeStorageAddons: BillingSubscriptionStorageAddon[];
};

const BILLING_ACCOUNT_SUMMARY_RETRY_BACKOFF_MS = 10_000;
const BILLING_ACCOUNT_SUMMARY_CACHE_TTL_MS = 30_000;

let billingAccountSummaryInFlightByKey = new Map<string, Promise<BillingAccountSummary | null>>();
let billingAccountSummaryCacheByUserId = new Map<
  string,
  { summary: BillingAccountSummary; loadedAtMs: number }
>();
let billingAccountSummaryRetryAfterMs = 0;

const createCacheKey = (userId: string, includeProfileState: boolean): string =>
  `${userId}:${includeProfileState ? "profile" : "summary"}`;

const asNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseResolvedPlan = (value: unknown): ResolvedAccountPlanSummary | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const monthlyCreditsCents = asNumber(row.monthlyCreditsCents);
  if (
    typeof row.id !== "string" ||
    typeof row.label !== "string" ||
    typeof row.className !== "string" ||
    monthlyCreditsCents == null
  ) {
    return null;
  }
  return {
    id: row.id,
    label: row.label,
    className: row.className,
    monthlyCreditsCents: Math.max(0, Math.trunc(monthlyCreditsCents)),
  };
};

const parseQuotaSummary = (value: unknown): MediaStorageQuotaSummary | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const usedBytes = asNumber(row.usedBytes);
  const baseLimitBytes = asNumber(row.baseLimitBytes);
  const addonLimitBytes = asNumber(row.addonLimitBytes);
  const totalLimitBytes = asNumber(row.totalLimitBytes);
  const remainingBytes = asNumber(row.remainingBytes);
  if (
    usedBytes == null ||
    baseLimitBytes == null ||
    addonLimitBytes == null ||
    totalLimitBytes == null ||
    remainingBytes == null
  ) {
    return null;
  }
  return {
    usedBytes: Math.max(0, Math.trunc(usedBytes)),
    baseLimitBytes: Math.max(0, Math.trunc(baseLimitBytes)),
    addonLimitBytes: Math.max(0, Math.trunc(addonLimitBytes)),
    totalLimitBytes: Math.max(0, Math.trunc(totalLimitBytes)),
    remainingBytes: Math.max(0, Math.trunc(remainingBytes)),
    isOverLimit: row.isOverLimit === true,
  };
};

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const asRequiredString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const asInteger = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
};

const parseBillingProfile = (value: unknown): BillingProfile | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    plan_id: asNullableString(row.plan_id),
    subscription_status: asNullableString(row.subscription_status),
    current_period_end: asNullableString(row.current_period_end),
    stripe_customer_id: asNullableString(row.stripe_customer_id),
    stripe_subscription_id: asNullableString(row.stripe_subscription_id),
  };
};

const parseBillingContract = (value: unknown): BillingSubscriptionContract | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = asRequiredString(row.id);
  const recurringPriceCents = asInteger(row.recurring_price_cents);
  const monthlyCreditsCents = asInteger(row.monthly_credits_cents);
  const storageLimitBytes = asInteger(row.storage_limit_bytes);
  if (
    !id ||
    recurringPriceCents == null ||
    monthlyCreditsCents == null ||
    storageLimitBytes == null
  ) {
    return null;
  }
  const billingInterval =
    row.billing_interval === "year" ? "year" : row.billing_interval === "month" ? "month" : null;
  const contractSource =
    row.contract_source === "stripe" || row.contract_source === "internal_comp"
      ? row.contract_source
      : null;
  return {
    id,
    plan_id: asNullableString(row.plan_id),
    offer_id: asNullableString(row.offer_id),
    billing_interval: billingInterval,
    stripe_subscription_id: asNullableString(row.stripe_subscription_id),
    stripe_price_id: asNullableString(row.stripe_price_id),
    contract_source: contractSource,
    recurring_price_cents: Math.max(0, recurringPriceCents),
    monthly_credits_cents: Math.max(0, monthlyCreditsCents),
    storage_limit_bytes: Math.max(0, storageLimitBytes),
    max_concurrent_generations: asInteger(row.max_concurrent_generations),
    status: asNullableString(row.status),
    current_period_start: asNullableString(row.current_period_start),
    current_period_end: asNullableString(row.current_period_end),
    cancel_at_period_end: row.cancel_at_period_end === true,
    started_at: asNullableString(row.started_at),
    ended_at: asNullableString(row.ended_at),
  };
};

const parseBillingLedgerEvent = (value: unknown): BillingLedgerEvent | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = asRequiredString(row.id);
  const changeCents = asInteger(row.change_cents);
  const reason = asRequiredString(row.reason);
  const createdAt = asRequiredString(row.created_at);
  if (!id || changeCents == null || !reason || !createdAt) return null;
  return {
    id,
    change_cents: changeCents,
    reason,
    source: asNullableString(row.source),
    source_ref: asNullableString(row.source_ref),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: createdAt,
  };
};

const parseStorageAddon = (value: unknown): BillingSubscriptionStorageAddon | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = asRequiredString(row.id);
  const storageAddonId = asRequiredString(row.storageAddonId);
  const storageLimitBytes = asInteger(row.storageLimitBytes);
  const quantity = asInteger(row.quantity);
  const recurringPriceCents = asInteger(row.recurringPriceCents);
  if (
    !id ||
    !storageAddonId ||
    storageLimitBytes == null ||
    quantity == null ||
    recurringPriceCents == null
  ) {
    return null;
  }
  return {
    id,
    storageAddonId,
    offerId: asNullableString(row.offerId),
    stripeSubscriptionItemId: asNullableString(row.stripeSubscriptionItemId),
    storageLimitBytes: Math.max(0, storageLimitBytes),
    quantity: Math.max(1, quantity),
    recurringPriceCents: Math.max(0, recurringPriceCents),
    status: asNullableString(row.status),
  };
};

const parseProfileState = (value: unknown): BillingAccountProfileState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    billingProfile: parseBillingProfile(row.billingProfile),
    billingContract: parseBillingContract(row.billingContract),
    billingActivity: Array.isArray(row.billingActivity)
      ? row.billingActivity
          .map(parseBillingLedgerEvent)
          .filter((event): event is BillingLedgerEvent => Boolean(event))
      : [],
    activeStorageAddons: Array.isArray(row.activeStorageAddons)
      ? row.activeStorageAddons
          .map(parseStorageAddon)
          .filter((addon): addon is BillingSubscriptionStorageAddon => Boolean(addon))
      : [],
  };
};

const parseBillingAccountSummary = (payload: unknown): BillingAccountSummary | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const row = payload as Record<string, unknown>;
  const resolvedPlan = parseResolvedPlan(row.resolvedPlan);
  if (typeof row.userId !== "string" || !resolvedPlan) return null;
  return {
    userId: row.userId,
    resolvedPlan,
    quotaStatus: row.quotaStatus === "available" ? "available" : "unavailable",
    quotaSummary: parseQuotaSummary(row.quotaSummary),
    profileState: parseProfileState(row.profileState),
  };
};

export const fetchBillingAccountSummary = async (options?: {
  force?: boolean;
  expectedUserId?: string | null;
  includeProfileState?: boolean;
}): Promise<BillingAccountSummary | null> => {
  const force = options?.force === true;
  const expectedUserId = options?.expectedUserId?.trim() || null;
  const includeProfileState = options?.includeProfileState === true;
  const now = Date.now();
  if (!force && billingAccountSummaryRetryAfterMs > now) {
    return null;
  }
  if (!force && expectedUserId) {
    const cached = billingAccountSummaryCacheByUserId.get(
      createCacheKey(expectedUserId, includeProfileState)
    );
    if (cached && now - cached.loadedAtMs <= BILLING_ACCOUNT_SUMMARY_CACHE_TTL_MS) {
      return cached.summary;
    }
  }

  const inFlightKey = `${expectedUserId ?? "unknown"}:${force ? "force" : "normal"}:${
    includeProfileState ? "profile" : "summary"
  }`;
  const inFlightRequest = billingAccountSummaryInFlightByKey.get(inFlightKey);
  if (inFlightRequest) {
    return await inFlightRequest;
  }

  const request = (async () => {
    try {
      const response = await fetchWithAuth(
        includeProfileState
          ? "/api/billing/account-summary?includeProfileState=1"
          : "/api/billing/account-summary",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "cache-control": "no-cache",
            pragma: "no-cache",
          },
          shortpulseSkipErrorLogging: true,
        }
      );
      if (!response.ok) {
        billingAccountSummaryRetryAfterMs = Date.now() + BILLING_ACCOUNT_SUMMARY_RETRY_BACKOFF_MS;
        return null;
      }
      const payload = await response.json();
      const summary = parseBillingAccountSummary(payload);
      if (!summary) {
        billingAccountSummaryRetryAfterMs = Date.now() + BILLING_ACCOUNT_SUMMARY_RETRY_BACKOFF_MS;
        return null;
      }
      billingAccountSummaryRetryAfterMs = 0;
      billingAccountSummaryCacheByUserId.set(createCacheKey(summary.userId, includeProfileState), {
        summary,
        loadedAtMs: Date.now(),
      });
      return summary;
    } catch {
      billingAccountSummaryRetryAfterMs = Date.now() + BILLING_ACCOUNT_SUMMARY_RETRY_BACKOFF_MS;
      return null;
    }
  })();

  billingAccountSummaryInFlightByKey.set(inFlightKey, request);
  try {
    return await request;
  } finally {
    if (billingAccountSummaryInFlightByKey.get(inFlightKey) === request) {
      billingAccountSummaryInFlightByKey.delete(inFlightKey);
    }
  }
};

export const resetBillingAccountSummaryClientStateForTests = (): void => {
  billingAccountSummaryInFlightByKey = new Map();
  billingAccountSummaryCacheByUserId = new Map();
  billingAccountSummaryRetryAfterMs = 0;
};
