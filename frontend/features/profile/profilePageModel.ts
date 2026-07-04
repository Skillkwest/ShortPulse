/**
 * Shared profile-page types and presentation helpers.
 * Keeps the route focused on orchestration while section components share one contract.
 */
import type React from "react";
import type { IconProps } from "phosphor-react";

export type ProfileSection = "account" | "subscription" | "credits" | "storage" | "transactions";

export type BillingProfile = {
  plan_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type BillingSubscriptionContract = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  billing_interval: "month" | "year" | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  contract_source: "stripe" | "internal_comp" | null;
  recurring_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  max_concurrent_generations?: number | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  started_at: string | null;
  ended_at: string | null;
};

export type BillingCatalogResponse = {
  plans?: unknown[];
  packages?: unknown[];
  storageAddons?: unknown[];
  error?: string;
};

export type BillingSubscriptionStorageAddon = {
  id: string;
  storageAddonId: string;
  offerId: string | null;
  stripeSubscriptionItemId: string | null;
  storageLimitBytes: number;
  quantity: number;
  recurringPriceCents: number;
  status: string | null;
};

export type BillingLedgerEvent = {
  id: string;
  change_cents: number;
  reason: string;
  source: string | null;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SubscriptionTransaction = {
  id: string;
  invoiceNumber: string | null;
  amountPaidCents: number;
  currency: string | null;
  status: string | null;
  title: string;
  createdAt: string | null;
  paidAt: string | null;
  receiptUrl: string | null;
  kind: "subscription" | "storage" | "credit_purchase" | "mixed";
  kindLabel: string;
  reference: string | null;
};

export const CUSTOMER_CREDIT_ACTIVITY_SOURCES = ["stripe_checkout"] as const;

export type NoticeTone = "info" | "success" | "error";

export type NoticeState = {
  tone: NoticeTone;
  message: string;
};

export type ProfileSectionItem = {
  key: ProfileSection;
  label: string;
  icon: React.ComponentType<IconProps>;
};

export type RecurringPaymentSummary = {
  primaryLabel: string;
};

export type AccountCreditsSummary =
  | {
      label: string;
      state: "loading" | "unavailable";
      currentLabel: null;
      planLabel: null;
      isSurplus: false;
    }
  | {
      label: string;
      state: "ready";
      currentLabel: string;
      planLabel: string;
      isSurplus: boolean;
    };

/**
 * Resolves the account summary credit balance as current spendable credits over the plan allowance.
 */
export const resolveAccountCreditsSummary = ({
  balanceCents,
  balanceLoading,
  planCreditsCents,
}: {
  balanceCents: number | null;
  balanceLoading: boolean;
  planCreditsCents: number;
}): AccountCreditsSummary => {
  if (balanceLoading) {
    return {
      label: "Syncing",
      state: "loading",
      currentLabel: null,
      planLabel: null,
      isSurplus: false,
    };
  }
  if (balanceCents == null) {
    return {
      label: "Unavailable",
      state: "unavailable",
      currentLabel: null,
      planLabel: null,
      isSurplus: false,
    };
  }

  const currentCredits = Math.max(0, Math.round(balanceCents));
  const planCredits = Math.max(0, Math.round(planCreditsCents));
  const currentLabel = currentCredits.toLocaleString();
  const planLabel = planCredits.toLocaleString();
  return {
    label: `${currentLabel} / ${planLabel}`,
    state: "ready",
    currentLabel,
    planLabel,
    isSurplus: currentCredits > planCredits,
  };
};

/**
 * Formats the account summary credit balance as current spendable credits over the plan allowance.
 */
export const formatAccountCreditsSummary = (
  options: Parameters<typeof resolveAccountCreditsSummary>[0]
): string => resolveAccountCreditsSummary(options).label;

/**
 * Formats integer cent amounts as USD strings for profile billing surfaces.
 */
export const formatCurrencyFromCents = (value: number): string => `$${(value / 100).toFixed(2)}`;

/**
 * Summarizes the current subscriber payment across plan and recurring storage add-ons.
 */
export const resolveRecurringPaymentSummary = ({
  baseRecurringPriceCents,
  billingInterval,
  activeAddonRecurringPriceCents,
  isInternalCompContract,
}: {
  baseRecurringPriceCents: number;
  billingInterval: "month" | "year";
  activeAddonRecurringPriceCents: number;
  isInternalCompContract: boolean;
}): RecurringPaymentSummary => {
  const basePriceCents = Math.max(0, Math.round(baseRecurringPriceCents));
  const addonPriceCents = Math.max(0, Math.round(activeAddonRecurringPriceCents));

  if (isInternalCompContract) {
    return {
      primaryLabel: "No Stripe charge",
    };
  }

  if (basePriceCents === 0 && addonPriceCents === 0) {
    return {
      primaryLabel: "No recurring payment",
    };
  }

  if (billingInterval === "year") {
    const monthlyEquivalentCents = Math.round(basePriceCents / 12) + addonPriceCents;
    return {
      primaryLabel:
        addonPriceCents > 0
          ? `${formatCurrencyFromCents(monthlyEquivalentCents)} / month`
          : `${formatCurrencyFromCents(basePriceCents)} / year`,
    };
  }

  const monthlyTotalCents = basePriceCents + addonPriceCents;
  return {
    primaryLabel: `${formatCurrencyFromCents(monthlyTotalCents)} / month`,
  };
};

/**
 * Formats Stripe minor-unit amounts using the reported invoice currency.
 */
export const formatCurrencyAmount = (value: number, currency: string | null): string => {
  const normalizedCurrency = currency?.trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
    }).format(value / 100);
  } catch {
    return formatCurrencyFromCents(value);
  }
};

/**
 * Formats a stored ISO date as a short local date label.
 */
export const formatDateLabel = (value: string | null): string => {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString();
};

/**
 * Formats a stored ISO date as a long local date label for hero chips.
 */
export const formatLongDateLabel = (value: string | null): string => {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

/**
 * Formats a stored ISO date as a local date-time label.
 */
export const formatDateTimeLabel = (value: string | null): string => {
  if (!value) return "Unavailable";
  return new Date(value).toLocaleString();
};

/**
 * Converts subscription status identifiers into readable labels.
 */
export const formatStatusLabel = (status: string | null): string => {
  if (!status) return "Inactive";
  return status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

/**
 * Resolves the plan id shown on the profile page from loaded billing account state.
 */
export const resolveProfileActivePlanId = ({
  billingContract,
  billingProfile,
}: {
  billingContract: BillingSubscriptionContract | null;
  billingProfile: BillingProfile | null;
}): string | null => billingContract?.plan_id ?? billingProfile?.plan_id ?? null;

/**
 * Pulls the most useful reference id from a billing ledger event.
 */
export const resolveLedgerReference = (event: BillingLedgerEvent): string | null => {
  if (!event.metadata || typeof event.metadata !== "object") return event.source_ref;
  const metadata = event.metadata as Record<string, unknown>;
  const invoiceId = typeof metadata.invoice_id === "string" ? metadata.invoice_id : null;
  const checkoutSessionId =
    typeof metadata.checkout_session_id === "string" ? metadata.checkout_session_id : null;
  const packageId =
    typeof metadata.credit_package_id === "string" ? metadata.credit_package_id : null;
  return invoiceId ?? checkoutSessionId ?? packageId ?? event.source_ref;
};

/**
 * Normalizes billing ledger events to short UI labels.
 */
export const resolveLedgerLabel = (event: BillingLedgerEvent): string => {
  if (event.source === "subscription_renewal") return "Subscription renewal";
  if (event.source === "annual_contract_monthly_allocation") {
    return "Annual monthly credit allocation";
  }
  if (event.source === "stripe_checkout") return "Credit purchase";
  return "Billing activity";
};

/**
 * Returns the title for the selected profile section.
 */
export const getProfileSectionContent = (section: ProfileSection): { title: string } => {
  if (section === "subscription") {
    return {
      title: "Subscription plans",
    };
  }
  if (section === "credits") {
    return {
      title: "Credits",
    };
  }
  if (section === "storage") {
    return {
      title: "Media storage",
    };
  }
  if (section === "transactions") {
    return {
      title: "Transaction history",
    };
  }
  return {
    title: "Account settings",
  };
};
