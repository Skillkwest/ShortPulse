/**
 * Authenticated account billing summary client.
 * Coalesces plan and media-storage quota reads behind the app API boundary.
 */
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import type { MediaStorageQuotaSummary } from "./storage";

export type ResolvedAccountPlanSummary = {
  id: string;
  label: string;
  className: string;
  monthlyCreditsCents: number;
};

export type BillingAccountSummary = {
  userId: string;
  resolvedPlan: ResolvedAccountPlanSummary;
  quotaSummary: MediaStorageQuotaSummary | null;
};

const BILLING_ACCOUNT_SUMMARY_RETRY_BACKOFF_MS = 10_000;

let billingAccountSummaryInFlightPromise: Promise<BillingAccountSummary | null> | null = null;
let billingAccountSummaryRetryAfterMs = 0;

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

const parseBillingAccountSummary = (payload: unknown): BillingAccountSummary | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const row = payload as Record<string, unknown>;
  const resolvedPlan = parseResolvedPlan(row.resolvedPlan);
  if (typeof row.userId !== "string" || !resolvedPlan) return null;
  return {
    userId: row.userId,
    resolvedPlan,
    quotaSummary: parseQuotaSummary(row.quotaSummary),
  };
};

export const fetchBillingAccountSummary = async (options?: {
  force?: boolean;
}): Promise<BillingAccountSummary | null> => {
  const force = options?.force === true;
  if (!force && billingAccountSummaryRetryAfterMs > Date.now()) {
    return null;
  }
  if (billingAccountSummaryInFlightPromise) {
    return await billingAccountSummaryInFlightPromise;
  }

  const request = (async () => {
    try {
      const response = await fetchWithAuth("/api/billing/account-summary", {
        method: "GET",
        cache: "no-store",
        headers: {
          "cache-control": "no-cache",
          pragma: "no-cache",
        },
        shortpulseSkipErrorLogging: true,
      });
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
      return summary;
    } catch {
      billingAccountSummaryRetryAfterMs = Date.now() + BILLING_ACCOUNT_SUMMARY_RETRY_BACKOFF_MS;
      return null;
    }
  })();

  billingAccountSummaryInFlightPromise = request;
  try {
    return await request;
  } finally {
    if (billingAccountSummaryInFlightPromise === request) {
      billingAccountSummaryInFlightPromise = null;
    }
  }
};

export const resetBillingAccountSummaryClientStateForTests = (): void => {
  billingAccountSummaryInFlightPromise = null;
  billingAccountSummaryRetryAfterMs = 0;
};
