/**
 * Client-only marker for reconciling account state after returning from hosted billing flows.
 */

export type BillingReturnSyncScope = "subscription";

type BillingReturnSyncMarker = {
  scope: BillingReturnSyncScope;
  createdAtMs: number;
};

const BILLING_RETURN_SYNC_STORAGE_KEY = "shortpulse.billingReturnSync";
const BILLING_RETURN_SYNC_MAX_AGE_MS = 10 * 60 * 1000;

const canUseSessionStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const parseMarker = (value: string | null): BillingReturnSyncMarker | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BillingReturnSyncMarker>;
    if (parsed.scope !== "subscription") return null;
    if (typeof parsed.createdAtMs !== "number" || !Number.isFinite(parsed.createdAtMs)) {
      return null;
    }
    if (Date.now() - parsed.createdAtMs > BILLING_RETURN_SYNC_MAX_AGE_MS) {
      return null;
    }
    return {
      scope: parsed.scope,
      createdAtMs: parsed.createdAtMs,
    };
  } catch {
    return null;
  }
};

/**
 * Records that the next AI Studio visit should re-read server-authoritative billing credit state.
 */
export const markBillingReturnSyncPending = (scope: BillingReturnSyncScope): void => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(
      BILLING_RETURN_SYNC_STORAGE_KEY,
      JSON.stringify({
        scope,
        createdAtMs: Date.now(),
      } satisfies BillingReturnSyncMarker)
    );
  } catch {
    // Best-effort only; the canonical credit state still comes from the snapshot API.
  }
};

/**
 * Consumes a pending post-billing sync marker once, if present and fresh.
 */
export const consumeBillingReturnSyncPending = (): BillingReturnSyncMarker | null => {
  if (!canUseSessionStorage()) return null;
  try {
    const marker = parseMarker(window.sessionStorage.getItem(BILLING_RETURN_SYNC_STORAGE_KEY));
    window.sessionStorage.removeItem(BILLING_RETURN_SYNC_STORAGE_KEY);
    return marker;
  } catch {
    return null;
  }
};
