/**
 * Shared subscription status policy for paid access, billing recovery, and revocation checks.
 * Stripe remains the source of status truth; this module only classifies projected statuses.
 */

export const FULL_ACCESS_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
export const RECOVERABLE_SUBSCRIPTION_STATUSES = ["past_due"] as const;
export const PAID_ACCESS_SUBSCRIPTION_STATUSES = [
  ...FULL_ACCESS_SUBSCRIPTION_STATUSES,
  ...RECOVERABLE_SUBSCRIPTION_STATUSES,
] as const;
export const REVOKED_SUBSCRIPTION_STATUSES = [
  "canceled",
  "incomplete",
  "incomplete_expired",
  "inactive",
  "paused",
  "unpaid",
] as const;

export type FullAccessSubscriptionStatus = (typeof FULL_ACCESS_SUBSCRIPTION_STATUSES)[number];
export type RecoverableSubscriptionStatus = (typeof RECOVERABLE_SUBSCRIPTION_STATUSES)[number];
export type PaidAccessSubscriptionStatus = (typeof PAID_ACCESS_SUBSCRIPTION_STATUSES)[number];
export type RevokedSubscriptionStatus = (typeof REVOKED_SUBSCRIPTION_STATUSES)[number];

export const normalizeSubscriptionStatus = (status: string | null | undefined): string =>
  String(status ?? "")
    .trim()
    .toLowerCase();

export const isFullAccessSubscriptionStatus = (
  status: string | null | undefined
): status is FullAccessSubscriptionStatus =>
  FULL_ACCESS_SUBSCRIPTION_STATUSES.includes(
    normalizeSubscriptionStatus(status) as FullAccessSubscriptionStatus
  );

export const isRecoverableSubscriptionStatus = (
  status: string | null | undefined
): status is RecoverableSubscriptionStatus =>
  RECOVERABLE_SUBSCRIPTION_STATUSES.includes(
    normalizeSubscriptionStatus(status) as RecoverableSubscriptionStatus
  );

export const isPaidAccessSubscriptionStatus = (
  status: string | null | undefined
): status is PaidAccessSubscriptionStatus =>
  PAID_ACCESS_SUBSCRIPTION_STATUSES.includes(
    normalizeSubscriptionStatus(status) as PaidAccessSubscriptionStatus
  );

export const isRevokedSubscriptionStatus = (
  status: string | null | undefined
): status is RevokedSubscriptionStatus =>
  REVOKED_SUBSCRIPTION_STATUSES.includes(
    normalizeSubscriptionStatus(status) as RevokedSubscriptionStatus
  );

export const isCreditTopUpEligibleSubscriptionStatus = (
  status: string | null | undefined
): boolean => isFullAccessSubscriptionStatus(status);
