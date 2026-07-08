/**
 * Pure row types and mapping helpers for admin billing diagnostics.
 */
import type {
  AdminHealthFinding,
  AdminStripeCustomerSnapshot,
  AdminStripeSubscriptionSnapshot,
} from "../../../features/admin/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BillingProfileRow = {
  plan_id: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

export type BillingContractRow = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  billing_interval: "month" | "year" | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_id: string | null;
  contract_source: "stripe" | "internal_comp" | null;
  recurring_price_cents: number | string | null;
  monthly_credits_cents: number | string | null;
  storage_limit_bytes: number | string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  last_credit_grant_at: string | null;
  next_credit_grant_at: string | null;
};

export type BillingOfferRow = {
  id: string;
  plan_id: string | null;
  billing_interval: "month" | "year" | null;
  offer_name: string | null;
  stripe_price_id: string | null;
  recurring_price_cents: number | string | null;
  monthly_credits_cents: number | string | null;
  storage_limit_bytes: number | string | null;
  acquisition_enabled: boolean | null;
  is_active: boolean | null;
};

export type BillingStorageAddonRow = {
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

export type HistoricalBillingStorageAddonRow = BillingStorageAddonRow & {
  current_period_start: string | null;
  current_period_end: string | null;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string | null;
};

export type MediaUsageRow = {
  file_size: number | string | null;
};

export type BillingLedgerGrantRow = {
  id: string;
  source: string | null;
  source_ref: string | null;
  change_cents: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export type PricingObservabilityEvent = {
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

export type StripeSubscriptionResponse = {
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
        recurring?: {
          interval?: string | null;
        } | null;
      } | null;
    }>;
  } | null;
};

export type StripeSubscriptionListResponse = {
  data?: StripeSubscriptionResponse[];
};

export type StripeInvoiceResponse = {
  id: string;
  amount_due?: number | null;
  amount_paid?: number | null;
  amount_remaining?: number | null;
  number?: string | null;
  paid?: boolean;
  status?: string | null;
  billing_reason?: string | null;
  metadata?: Record<string, unknown> | null;
  subscription_details?: {
    metadata?: Record<string, unknown> | null;
  } | null;
};

export type StripeInvoiceListResponse = {
  data?: StripeInvoiceResponse[];
};

export type StripeCustomerResponse = {
  id: string;
  email?: string | null;
  name?: string | null;
  deleted?: boolean;
};

export type StripeLookupFailure = {
  target: "customer" | "subscription" | "subscription_list";
  identifier: string | null;
  message: string;
};

export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

export const isSchemaCompatibilityError = (message: string) => {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache") ||
    text.includes("failed to parse select parameter") ||
    text.includes("column")
  );
};

export const asCents = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const asQuantity = (value: number | string | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

export const isStripeModeMismatchError = (message: string): boolean => {
  const text = message.toLowerCase();
  return (
    text.includes("test mode") &&
    text.includes("live mode") &&
    (text.includes("no such") || text.includes("does not exist"))
  );
};

export const stringifyLookupError = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return `Stripe ${fallback} failed.`;
};

export const normalizeText = (value: string | null | undefined): string | null => {
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

export const asDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

export const buildPricingObservabilityEvent = ({
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

export const pickPositiveNumber = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (value != null && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
};

export const pushFinding = (
  findings: AdminHealthFinding[],
  finding: Omit<AdminHealthFinding, "recommendedActions"> & { recommendedActions?: string[] }
) => {
  findings.push({
    ...finding,
    recommendedActions: finding.recommendedActions ?? [],
  });
};

export const mapStripeSubscriptionSnapshot = (params: {
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
    billingInterval:
      price?.recurring?.interval === "month" || price?.recurring?.interval === "year"
        ? price.recurring.interval
        : null,
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

export const mapStripeCustomerSnapshot = (params: {
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
