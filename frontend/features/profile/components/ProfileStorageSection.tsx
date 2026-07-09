/**
 * Media storage section for the profile workspace.
 * Separates recurring storage capacity and add-on management from credits and subscription plans.
 */
import { Receipt } from "phosphor-react";
import type { BillingStorageAddonRecord } from "../../billing/catalog";
import { formatStorageBytes } from "../../billing/storage";
import {
  getMinimumSelfServeStorageAddonPlanId,
  resolveStorageAddonEligibility,
} from "../../../lib/billing/storageAddonEligibility";
import {
  formatCurrencyAmount,
  formatCurrencyFromCents,
  formatDateTimeLabel,
  formatStatusLabel,
  type BillingSubscriptionStorageAddon,
  type SubscriptionTransaction,
} from "../profilePageModel";
import { profileClass } from "../profileRouteStyles";
import { ProfileMetricCard, ProfilePanel } from "./ProfileSurface";

type ProfileStorageSectionProps = {
  activeAddonStorageBytes: number;
  activePlanId: string | null;
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
  subscriptionHref?: string;
  totalStorageLimitBytes: number;
  usedStorageBytes: number;
  onStorageAddonChange: (params: { storageAddonId: string; action: "add" | "remove" }) => void;
};

const STORAGE_ADDON_PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  media: "Media",
  studio: "Studio",
  business: "Business",
};

function resolveStorageAddonMinimumPlanLabel(storageAddonId: string): string {
  const minimumPlanId = getMinimumSelfServeStorageAddonPlanId(storageAddonId);
  return minimumPlanId
    ? `${STORAGE_ADDON_PLAN_LABELS[minimumPlanId] ?? "a higher"} plan`
    : "a higher plan";
}

/**
 * Renders the storage usage and recurring add-on management panel stack.
 */
export function ProfileStorageSection({
  activeAddonStorageBytes,
  activePlanId,
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
  subscriptionHref = "/profile?section=subscription",
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
  const usagePercent =
    totalStorageLimitBytes > 0
      ? Math.min(100, Math.max(0, Math.round((usedStorageBytes / totalStorageLimitBytes) * 100)))
      : 0;
  const hasActiveStorageAddon = activeStorageAddons.length > 0;

  return (
    <>
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
          <p className={profileClass("profile-hero-value", "profile-hero-value-text")}>
            {formatStorageBytes(totalStorageLimitBytes)}
          </p>
          <div
            className={profileClass("profile-storage-meter")}
            role="meter"
            aria-label="Media storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={usagePercent}
          >
            <span style={{ width: `${usagePercent}%` }} />
          </div>
        </div>

        <div className={profileClass("profile-hero-meta")}>
          <ProfileMetricCard
            className="profile-hero-stat-card"
            label="Current usage"
            value={formatStorageBytes(usedStorageBytes)}
          />
          <ProfileMetricCard
            className="profile-hero-stat-card"
            label="Plan capacity"
            value={formatStorageBytes(currentSubscriptionStorageLimitBytes)}
          />
          <ProfileMetricCard
            className="profile-hero-stat-card"
            label="Active add-ons"
            value={activeAddonSummary}
          />
        </div>
      </article>

      {storageCalloutMessage ? (
        <aside className={profileClass("profile-callout")}>
          <p className="tiny">{storageCalloutMessage}</p>
          {storageAddonManagementState === "requires_paid_plan" ? (
            <a className="app-message__action ai-panel-plan-access-cta" href={subscriptionHref}>
              View plans
            </a>
          ) : null}
        </aside>
      ) : null}

      <ProfilePanel
        eyebrow="Storage add-ons"
        title="Expand media capacity"
        className="profile-panel-stack"
      >
        <p className="tiny subdued">You can keep one recurring storage add-on active at a time.</p>
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
                  const eligibility = resolveStorageAddonEligibility({
                    planId: activePlanId,
                    storageAddonId: addon.id,
                  });
                  const isActive = activeQuantity > 0;
                  const blocksPlanEligibility =
                    isStorageAddonManagementAvailable && !isActive && !eligibility.isEligible;
                  const switchesActiveAddon = hasActiveStorageAddon && !isActive;
                  const isLoading = storageAddonChangeLoadingId === addon.id;
                  const isBusy = storageAddonChangeLoadingId !== null;
                  const minimumPlanLabel = resolveStorageAddonMinimumPlanLabel(addon.id);
                  const usesPrimaryActionStyle =
                    isStorageAddonManagementAvailable && !isActive && !blocksPlanEligibility;
                  let actionLabel = "Subscription syncing";
                  if (isLoading) {
                    actionLabel = "Updating…";
                  } else if (isStorageAddonManagementAvailable) {
                    if (isActive) {
                      actionLabel = "Remove";
                    } else if (blocksPlanEligibility) {
                      actionLabel = `Requires ${minimumPlanLabel}`;
                    } else if (switchesActiveAddon) {
                      actionLabel = `Switch to ${formatStorageBytes(addon.storage_limit_bytes)}`;
                    } else {
                      actionLabel = `Add ${formatStorageBytes(addon.storage_limit_bytes)}`;
                    }
                  } else if (storageAddonManagementState === "managed_internally") {
                    actionLabel = "Managed internally";
                  } else if (storageAddonManagementState === "requires_paid_plan") {
                    actionLabel = "Choose paid plan first";
                  }

                  return (
                    <>
                      <p className="tiny subdued">
                        {isActive
                          ? activeQuantity > 1
                            ? `${activeQuantity} recurring units active`
                            : "Active and renewing with your subscription"
                          : blocksPlanEligibility
                            ? `Available on ${minimumPlanLabel} and above`
                            : switchesActiveAddon
                              ? "Replaces your current recurring storage add-on"
                              : "Renews with your subscription"}
                      </p>

                      <div className={profileClass("profile-actions")}>
                        <button
                          type="button"
                          className={profileClass(
                            "profile-button",
                            usesPrimaryActionStyle ? "primary-btn" : "ghost-btn"
                          )}
                          onClick={() =>
                            onStorageAddonChange({
                              storageAddonId: addon.id,
                              action: isActive ? "remove" : "add",
                            })
                          }
                          aria-disabled={blocksPlanEligibility ? true : undefined}
                          disabled={
                            !isStorageAddonManagementAvailable || isBusy || blocksPlanEligibility
                          }
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
        <p className="tiny subdued">Need more than 1 TB? Contact support for a storage review.</p>

        {billingContractLoading ? (
          <p className="tiny subdued">Syncing active storage entitlements…</p>
        ) : null}
      </ProfilePanel>

      <ProfilePanel
        eyebrow="Payment history"
        title="Recent storage payments"
        icon={Receipt}
        className="profile-panel-stack"
      >
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
      </ProfilePanel>
    </>
  );
}
