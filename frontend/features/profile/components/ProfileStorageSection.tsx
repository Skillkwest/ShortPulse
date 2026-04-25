/**
 * Media storage section for the profile workspace.
 * Separates recurring storage capacity and add-on management from credits and subscription plans.
 */
import type { BillingStorageAddonRecord } from "../../billing/catalog";
import { formatStorageBytes, formatStorageUsageValue } from "../../billing/storage";
import { formatCurrencyFromCents } from "../profilePageModel";

type ProfileStorageSectionProps = {
  activeAddonStorageBytes: number;
  billingContractLoading: boolean;
  billingPlansLoading: boolean;
  currentSubscriptionStorageLimitBytes: number;
  planLabel: string;
  portalActionLabel: string;
  portalLoading: boolean;
  portalManagementAvailable: boolean;
  storageAddons: BillingStorageAddonRecord[];
  totalStorageLimitBytes: number;
  usedStorageBytes: number;
  onOpenBillingPortal: () => void;
};

/**
 * Renders the storage usage and recurring add-on management panel stack.
 */
export function ProfileStorageSection({
  activeAddonStorageBytes,
  billingContractLoading,
  billingPlansLoading,
  currentSubscriptionStorageLimitBytes,
  planLabel,
  portalActionLabel,
  portalLoading,
  portalManagementAvailable,
  storageAddons,
  totalStorageLimitBytes,
  usedStorageBytes,
  onOpenBillingPortal,
}: ProfileStorageSectionProps) {
  return (
    <>
      <details className="panel profile-detail-panel profile-billing-how">
        <summary>How media storage works</summary>
        <p>
          Your workspace includes storage with your base plan. Recurring storage add-ons increase
          total media capacity for uploads, references, and saved generations.
        </p>
      </details>

      <div className="profile-summary-grid">
        <article className="panel profile-summary-card">
          <p className="tiny subdued">Current usage</p>
          <p className="summary-value small">
            {formatStorageUsageValue(usedStorageBytes, totalStorageLimitBytes)}
          </p>
          <p className="tiny subdued">Across uploads, references, and saved AI Studio media</p>
        </article>

        <article className="panel profile-summary-card">
          <p className="tiny subdued">Plan storage</p>
          <p className="summary-value small">
            {formatStorageBytes(currentSubscriptionStorageLimitBytes)}
          </p>
          <p className="tiny subdued">{planLabel} includes this base storage capacity</p>
        </article>

        <article className="panel profile-summary-card">
          <p className="tiny subdued">Active add-ons</p>
          <p className="summary-value small">{formatStorageBytes(activeAddonStorageBytes)}</p>
          <p className="tiny subdued">
            {activeAddonStorageBytes > 0
              ? "Recurring add-ons currently increase your monthly storage limit"
              : "No recurring storage add-ons are active on this account"}
          </p>
        </article>
      </div>

      <section className="panel profile-panel profile-panel-stack">
        <div className="panel-header profile-panel-header">
          <div>
            <p className="eyebrow">Storage add-ons</p>
            <h2 className="profile-panel-title">Expand media capacity</h2>
            <p className="subdued tiny">
              Recurring add-ons increase workspace capacity and renew alongside your subscription.
            </p>
          </div>
        </div>

        <div className="profile-plan-grid">
          {billingPlansLoading ? (
            <div className="profile-plan-card">
              <p className="tiny subdued">Loading storage add-ons…</p>
            </div>
          ) : storageAddons.length === 0 ? (
            <div className="profile-plan-card">
              <p className="tiny subdued">No recurring storage add-ons are configured yet.</p>
            </div>
          ) : (
            storageAddons.map((addon) => (
              <div key={addon.id} className="profile-plan-card">
                <div className="profile-plan-top">
                  <div>
                    <p className="tiny subdued">Recurring add-on</p>
                    <h3 className="profile-plan-card-title">{addon.display_name}</h3>
                  </div>
                  <span className="profile-plan-badge">Storage</span>
                </div>

                <p className="meta-value">
                  {formatCurrencyFromCents(addon.monthly_price_cents)}
                  <span className="tiny subdued"> / month</span>
                </p>

                <p className="tiny subdued">
                  Adds {formatStorageBytes(addon.storage_limit_bytes)} of recurring media capacity
                  to your workspace.
                </p>

                <div className="profile-actions">
                  <button
                    type="button"
                    className="profile-button ghost-btn"
                    onClick={onOpenBillingPortal}
                    disabled={portalLoading || !portalManagementAvailable}
                  >
                    {portalLoading ? "Opening portal…" : portalActionLabel}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {!portalManagementAvailable ? (
          <p className="tiny subdued">
            This storage entitlement is managed internally, so Stripe add-on controls are
            unavailable on this account.
          </p>
        ) : null}

        {billingContractLoading ? (
          <p className="tiny subdued">Syncing active storage entitlements…</p>
        ) : null}
      </section>
    </>
  );
}
