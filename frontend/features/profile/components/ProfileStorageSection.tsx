/**
 * Media storage section for the profile workspace.
 * Separates recurring storage capacity and add-on management from credits and subscription plans.
 */
import { Receipt } from "phosphor-react";
import type { BillingStorageAddonRecord } from "../../billing/catalog";
import { formatStorageBytes, formatStorageUsageValue } from "../../billing/storage";
import {
  formatCurrencyAmount,
  formatCurrencyFromCents,
  formatDateTimeLabel,
  formatStatusLabel,
  type BillingSubscriptionStorageAddon,
  type SubscriptionTransaction,
} from "../profilePageModel";
import { profileClass } from "../profileRouteStyles";

type ProfileStorageSectionProps = {
  activeAddonStorageBytes: number;
  activePlanClassName: string;
  activeStorageAddons: readonly BillingSubscriptionStorageAddon[];
  billingContractLoading: boolean;
  billingPlansLoading: boolean;
  currentSubscriptionStorageLimitBytes: number;
  storageAddonChangeLoadingId: string | null;
  storageAddonManagementState: "eligible" | "requires_paid_plan" | "syncing" | "managed_internally";
  storageAddons: BillingStorageAddonRecord[];
  storageTransactions: SubscriptionTransaction[];
  storageTransactionsError: string | null;
  storageTransactionsLoading: boolean;
  totalStorageLimitBytes: number;
  usedStorageBytes: number;
  onStorageAddonChange: (params: { storageAddonId: string; action: "add" | "remove" }) => void;
};

/**
 * Renders the storage usage and recurring add-on management panel stack.
 */
export function ProfileStorageSection({
  activeAddonStorageBytes,
  activePlanClassName,
  activeStorageAddons = [],
  billingContractLoading,
  billingPlansLoading,
  currentSubscriptionStorageLimitBytes,
  storageAddonChangeLoadingId,
  storageAddonManagementState,
  storageAddons = [],
  storageTransactions = [],
  storageTransactionsError,
  storageTransactionsLoading,
  totalStorageLimitBytes,
  usedStorageBytes,
  onStorageAddonChange,
}: ProfileStorageSectionProps) {
  const activeAddonRowsById = new Map<string, BillingSubscriptionStorageAddon[]>();
  activeStorageAddons.forEach((addon) => {
    const currentRows = activeAddonRowsById.get(addon.storageAddonId) ?? [];
    currentRows.push(addon);
    activeAddonRowsById.set(addon.storageAddonId, currentRows);
  });

  const activeAddonSummary = (() => {
    if (activeStorageAddons.length === 0) return "None";

    const activeCatalogEntries = storageAddons
      .filter((addon) => (activeAddonRowsById.get(addon.id)?.length ?? 0) > 0)
      .map((addon) => {
        const quantity = (activeAddonRowsById.get(addon.id) ?? []).reduce(
          (total, row) => total + Math.max(1, row.quantity),
          0
        );
        return quantity > 1 ? `${quantity} × ${addon.display_name}` : addon.display_name;
      });

    if (activeCatalogEntries.length > 0) {
      return activeCatalogEntries.join(", ");
    }

    return `+${formatStorageBytes(activeAddonStorageBytes)}`;
  })();
  const isStorageAddonManagementAvailable = storageAddonManagementState === "eligible";
  const storagePaymentsAvailable = storageAddonManagementState !== "managed_internally";
  const storageCalloutMessage =
    storageAddonManagementState === "managed_internally"
      ? "This storage entitlement is managed internally. Move billing into Stripe before changing recurring storage add-ons."
      : storageAddonManagementState === "requires_paid_plan"
        ? "Choose a paid subscription plan before adding recurring storage capacity."
        : storageAddonManagementState === "syncing"
          ? "Your Stripe subscription is still syncing. Storage add-on controls will unlock once billing finishes linking."
          : null;
  const planCapacityHelperText = "Included with your base plan";
  const currentUsageHelperText = `of ${formatStorageBytes(totalStorageLimitBytes)} available`;
  const activeAddonsHelperText =
    activeStorageAddons.length > 0
      ? "Recurring storage add-ons renew monthly"
      : "No active add-ons";

  return (
    <>
      <details className={profileClass("panel", "profile-detail-panel", "profile-billing-how")}>
        <summary>How media storage works</summary>
        <p>
          Your workspace includes storage with your base plan. Recurring storage add-ons increase
          total media capacity for uploads, references, and saved generations.
        </p>
      </details>

      <article
        className={profileClass(
          "panel",
          "profile-hero-card",
          "profile-storage-hero-card",
          activePlanClassName
        )}
      >
        <div className={profileClass("profile-hero-copy")}>
          <p className="eyebrow">Workspace capacity</p>
          <h2 className={profileClass("profile-hero-title")}>Your media storage</h2>
          <p className={profileClass("profile-hero-value", "profile-hero-value-text")}>
            {formatStorageBytes(totalStorageLimitBytes)}
          </p>
          <p className="tiny subdued">
            Using {formatStorageUsageValue(usedStorageBytes, totalStorageLimitBytes)} across
            uploads, references, and saved AI Studio media.
          </p>
        </div>

        <div className={profileClass("profile-hero-meta")}>
          <div className={profileClass("profile-hero-stat-card")}>
            <p className={profileClass("profile-hero-stat-label")}>Plan capacity</p>
            <p className={profileClass("profile-hero-stat-value")}>
              {formatStorageBytes(currentSubscriptionStorageLimitBytes)}
            </p>
            <p className={profileClass("profile-hero-stat-helper")}>{planCapacityHelperText}</p>
          </div>
          <div className={profileClass("profile-hero-stat-card")}>
            <p className={profileClass("profile-hero-stat-label")}>Current usage</p>
            <p className={profileClass("profile-hero-stat-value")}>
              {formatStorageBytes(usedStorageBytes)}
            </p>
            <p className={profileClass("profile-hero-stat-helper")}>{currentUsageHelperText}</p>
          </div>
          <div className={profileClass("profile-hero-stat-card")}>
            <p className={profileClass("profile-hero-stat-label")}>Active add-ons</p>
            <p className={profileClass("profile-hero-stat-value")}>{activeAddonSummary}</p>
            <p className={profileClass("profile-hero-stat-helper")}>{activeAddonsHelperText}</p>
          </div>
        </div>
      </article>

      {storageCalloutMessage ? (
        <aside className={profileClass("profile-callout")}>
          <p className="tiny">{storageCalloutMessage}</p>
        </aside>
      ) : null}

      <section className={profileClass("panel", "profile-panel", "profile-panel-stack")}>
        <div className={profileClass("panel-header", "profile-panel-header")}>
          <div>
            <p className="eyebrow">Storage add-ons</p>
            <h2 className={profileClass("profile-panel-title")}>Expand media capacity</h2>
            <p className="subdued tiny">
              Recurring add-ons increase workspace capacity and renew alongside your subscription.
              Removing one updates Stripe immediately; if usage stays over the remaining limit, new
              uploads may be blocked until usage drops.
            </p>
          </div>
        </div>

        <div className={profileClass("profile-plan-grid")}>
          {billingPlansLoading ? (
            <div className={profileClass("profile-plan-card")}>
              <p className="tiny subdued">Loading storage add-ons…</p>
            </div>
          ) : storageAddons.length === 0 ? (
            <div className={profileClass("profile-plan-card")}>
              <p className="tiny subdued">No recurring storage add-ons are configured yet.</p>
            </div>
          ) : (
            storageAddons.map((addon) => (
              <div key={addon.id} className={profileClass("profile-plan-card")}>
                <div className={profileClass("profile-plan-top")}>
                  <div>
                    <p className="tiny subdued">Recurring add-on</p>
                    <h3 className={profileClass("profile-plan-card-title")}>
                      {addon.display_name}
                    </h3>
                  </div>
                  {(activeAddonRowsById.get(addon.id)?.length ?? 0) > 0 ? (
                    <span className={profileClass("profile-plan-badge")}>Active add-on</span>
                  ) : null}
                </div>

                <p className="meta-value">
                  {formatCurrencyFromCents(addon.monthly_price_cents)}
                  <span className="tiny subdued"> / month</span>
                </p>

                <p className="tiny subdued">
                  Adds {formatStorageBytes(addon.storage_limit_bytes)} of recurring media capacity
                  to your workspace.
                </p>

                {(() => {
                  const activeRows = activeAddonRowsById.get(addon.id) ?? [];
                  const activeQuantity = activeRows.reduce(
                    (total, row) => total + Math.max(1, row.quantity),
                    0
                  );
                  const isActive = activeQuantity > 0;
                  const isLoading = storageAddonChangeLoadingId === addon.id;
                  const isBusy = storageAddonChangeLoadingId !== null;
                  const actionLabel = isLoading
                    ? "Updating…"
                    : isStorageAddonManagementAvailable
                      ? isActive
                        ? "Remove"
                        : `Add ${formatStorageBytes(addon.storage_limit_bytes)}`
                      : storageAddonManagementState === "managed_internally"
                        ? "Managed internally"
                        : storageAddonManagementState === "requires_paid_plan"
                          ? "Choose paid plan first"
                          : "Subscription syncing";

                  return (
                    <>
                      <p className="tiny subdued">
                        {isActive
                          ? activeQuantity > 1
                            ? `${activeQuantity} recurring units active`
                            : "Active and renewing with your subscription"
                          : "Renews with your subscription"}
                      </p>

                      <div className={profileClass("profile-actions")}>
                        <button
                          type="button"
                          className={profileClass("profile-button", "ghost-btn")}
                          onClick={() =>
                            onStorageAddonChange({
                              storageAddonId: addon.id,
                              action: isActive ? "remove" : "add",
                            })
                          }
                          disabled={!isStorageAddonManagementAvailable || isBusy}
                        >
                          {actionLabel}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))
          )}
        </div>

        {billingContractLoading ? (
          <p className="tiny subdued">Syncing active storage entitlements…</p>
        ) : null}
      </section>

      <section className={profileClass("panel", "profile-panel", "profile-panel-stack")}>
        <div className={profileClass("panel-header", "profile-panel-header")}>
          <div>
            <p className="eyebrow">Payment history</p>
            <h2 className={profileClass("profile-panel-title")}>Recent storage payments</h2>
            <p className="subdued tiny">
              {storagePaymentsAvailable
                ? "Recent recurring storage add-on charges billed through Stripe."
                : "This account is managed internally, so there are no Stripe storage charges to show here."}
            </p>
          </div>
          <span className={profileClass("profile-panel-icon-chip")} aria-hidden="true">
            <Receipt size={18} weight="bold" />
          </span>
        </div>

        <div className={profileClass("profile-receipts", "profile-receipts-standalone")}>
          <div className={profileClass("profile-receipts-header")}>
            <h3 className={profileClass("profile-subsection-title")}>Recent transactions</h3>
            <Receipt size={16} />
          </div>

          {storageTransactionsLoading ? (
            <p className="tiny subdued">Loading recent payments…</p>
          ) : null}
          {!storageTransactionsLoading && storageTransactionsError ? (
            <p className="tiny subdued">{storageTransactionsError}</p>
          ) : null}
          {!storageTransactionsLoading &&
          !storageTransactionsError &&
          storageTransactions.length === 0 ? (
            <p className="tiny subdued">
              {storagePaymentsAvailable
                ? "No recent storage add-on payments yet."
                : "No Stripe storage payments are available for this internally managed account."}
            </p>
          ) : null}
          {!storageTransactionsLoading &&
          !storageTransactionsError &&
          storageTransactions.length > 0 ? (
            <ul className={profileClass("profile-receipt-list")}>
              {storageTransactions.map((transaction) => {
                const timestamp = transaction.paidAt ?? transaction.createdAt;
                return (
                  <li key={transaction.id} className={profileClass("profile-receipt-item")}>
                    <div>
                      <p className="label">{transaction.title}</p>
                      <p className="tiny subdued">
                        {formatDateTimeLabel(timestamp)}
                        {transaction.invoiceNumber ? ` · Invoice ${transaction.invoiceNumber}` : ""}
                      </p>
                      {transaction.receiptUrl ? (
                        <a
                          href={transaction.receiptUrl}
                          className={profileClass("tiny", "subdued", "profile-receipt-link")}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View invoice
                        </a>
                      ) : null}
                    </div>

                    <div className={profileClass("profile-receipt-item-meta")}>
                      <p className="label">
                        {formatCurrencyAmount(
                          transaction.amountPaidCents,
                          transaction.currency ?? "usd"
                        )}
                      </p>
                      <p className="tiny subdued">{formatStatusLabel(transaction.status)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </section>
    </>
  );
}
