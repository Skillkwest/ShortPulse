/**
 * Subscription section for the profile workspace.
 * Presents the active plan summary and public plan catalog using the shared settings panel language.
 */
import { useEffect, useMemo, useState } from "react";
import { Receipt, WarningCircle } from "phosphor-react";
import { BillingIntervalToggle } from "../../billing/components/BillingIntervalToggle";
import { SubscriptionPlanCard } from "../../billing/components/SubscriptionPlanCard";
import {
  buildPlanView,
  filterPublicSubscriptionPlans,
  getPlanTierRank,
  resolvePlanPricingForInterval,
  type BillingInterval,
  type BillingPlanRecord,
} from "../../billing/catalog";
import { formatStorageBytes } from "../../billing/storage";
import {
  formatCurrencyAmount,
  formatCurrencyFromCents,
  formatDateTimeLabel,
  formatStatusLabel,
  type SubscriptionTransaction,
} from "../profilePageModel";

type ActivePlanView = ReturnType<typeof buildPlanView>;

type ProfileSubscriptionSectionProps = {
  activePlan: ActivePlanView;
  activePlanRank: number;
  activeAddonStorageBytes: number;
  currentSubscriptionCreditsCents: number;
  currentSubscriptionBillingInterval: BillingInterval;
  currentSubscriptionPriceCents: number;
  currentSubscriptionStorageLimitBytes: number;
  subscriptionRenewalText: string;
  billingPlans: BillingPlanRecord[];
  billingPlansLoading: boolean;
  isInternalCompContract: boolean;
  planChangeLoadingPlanId: string | null;
  subscriptionTransactions: SubscriptionTransaction[];
  subscriptionTransactionsLoading: boolean;
  subscriptionTransactionsError: string | null;
  onRequestPlanChange: (planId: string, billingInterval: BillingInterval) => void;
  onRequestCancel: (planId: string) => void;
};

/**
 * Renders the subscription panel stack.
 */
export function ProfileSubscriptionSection({
  activePlan,
  activePlanRank,
  activeAddonStorageBytes,
  currentSubscriptionCreditsCents,
  currentSubscriptionBillingInterval,
  currentSubscriptionPriceCents,
  currentSubscriptionStorageLimitBytes,
  subscriptionRenewalText,
  billingPlans,
  billingPlansLoading,
  isInternalCompContract,
  planChangeLoadingPlanId,
  subscriptionTransactions,
  subscriptionTransactionsLoading,
  subscriptionTransactionsError,
  onRequestPlanChange,
  onRequestCancel,
}: ProfileSubscriptionSectionProps) {
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<BillingInterval>(
    currentSubscriptionBillingInterval
  );
  const visibleBillingPlans = useMemo(
    () => filterPublicSubscriptionPlans(billingPlans),
    [billingPlans]
  );
  const renewalHelperText =
    subscriptionRenewalText === "Not scheduled"
      ? "No active renewal is scheduled"
      : "Plan term refreshes automatically";
  const monthlyCreditsHelperText = "Credits added each renewal cycle";
  const storageIncludedHelperText = "Included with your base plan";
  const activeAddonsHelperText =
    activeAddonStorageBytes > 0
      ? "Recurring storage add-ons renew monthly"
      : "No recurring storage add-ons active";
  const showRenewalChip = activePlan.id !== "free";
  const annualSavingsPercent = useMemo(
    () =>
      Math.max(
        0,
        ...visibleBillingPlans.map((plan) => {
          const pricing = resolvePlanPricingForInterval(plan, "year");
          return pricing.hasLiveOffer && pricing.savingsAmountCents > 0
            ? Math.round(pricing.savingsPercent)
            : 0;
        })
      ),
    [visibleBillingPlans]
  );
  const activePlanDisplayName =
    activePlan.id === "free" ? "No active paid plan" : activePlan.displayName;
  const currentPlanSummary = isInternalCompContract
    ? "Managed internally"
    : currentSubscriptionPriceCents === 0
      ? "No active paid subscription"
      : currentSubscriptionBillingInterval === "year"
        ? `${formatCurrencyFromCents(Math.round(currentSubscriptionPriceCents / 12))} per month billed annually`
        : `${formatCurrencyFromCents(currentSubscriptionPriceCents)} / month`;

  useEffect(() => {
    setSelectedBillingInterval(currentSubscriptionBillingInterval);
  }, [currentSubscriptionBillingInterval]);

  return (
    <>
      <details className="panel profile-detail-panel profile-billing-how">
        <summary>How subscriptions work</summary>
        <p>
          Paid plans include recurring credits whether you choose monthly or annual billing. You can
          upgrade or downgrade anytime. Upgrades take effect immediately with prorated charges.
          Downgrades apply at the end of your billing period. Credits never expire.
        </p>
      </details>

      <article
        className={`panel profile-hero-card profile-subscription-hero-card ${activePlan.className}`}
      >
        <div className="profile-hero-copy">
          <p className="eyebrow">Current plan</p>
          <h2 className="profile-hero-title">Your subscription</h2>
          <p className="profile-hero-value profile-hero-value-text">{activePlanDisplayName}</p>
          <p className="tiny subdued">
            {currentPlanSummary} · {activePlan.description}
          </p>
        </div>

        <div className="profile-hero-meta">
          {showRenewalChip ? (
            <div className="profile-hero-stat-card">
              <p className="profile-hero-stat-label">Next renewal</p>
              <p className="profile-hero-stat-value">{subscriptionRenewalText}</p>
              <p className="profile-hero-stat-helper">{renewalHelperText}</p>
            </div>
          ) : null}
          <div className="profile-hero-stat-card">
            <p className="profile-hero-stat-label">Monthly credits</p>
            <p className="profile-hero-stat-value">
              {currentSubscriptionCreditsCents.toLocaleString()}
            </p>
            <p className="profile-hero-stat-helper">{monthlyCreditsHelperText}</p>
          </div>
          <div className="profile-hero-stat-card">
            <p className="profile-hero-stat-label">Storage included</p>
            <p className="profile-hero-stat-value">
              {formatStorageBytes(currentSubscriptionStorageLimitBytes)}
            </p>
            <p className="profile-hero-stat-helper">{storageIncludedHelperText}</p>
          </div>
          {activeAddonStorageBytes > 0 ? (
            <div className="profile-hero-stat-card">
              <p className="profile-hero-stat-label">Active add-ons</p>
              <p className="profile-hero-stat-value">
                +{formatStorageBytes(activeAddonStorageBytes)}
              </p>
              <p className="profile-hero-stat-helper">{activeAddonsHelperText}</p>
            </div>
          ) : null}
        </div>
      </article>

      <section className="panel profile-panel profile-panel-stack">
        <div className="panel-header profile-panel-header">
          <div>
            <p className="eyebrow">All plans</p>
            <h2 className="profile-panel-title">Available plans</h2>
            <p className="subdued tiny">
              Compare the public offers available if you change plans now, including your current
              plan.
            </p>
          </div>
        </div>

        <BillingIntervalToggle
          selectedBillingInterval={selectedBillingInterval}
          annualSavingsPercent={annualSavingsPercent}
          onChange={setSelectedBillingInterval}
          className="profile-subscription-interval-toggle"
        />

        <div className="profile-plan-grid subscription-plan-grid">
          {billingPlansLoading ? (
            <div className="profile-plan-card">
              <p className="tiny subdued">Loading plans…</p>
            </div>
          ) : visibleBillingPlans.length === 0 ? (
            <div className="profile-plan-card">
              <p className="tiny subdued">No active plans configured yet.</p>
            </div>
          ) : (
            visibleBillingPlans.map((plan) => {
              const planView = buildPlanView({ planId: plan.id, plans: visibleBillingPlans });
              const planPricing = resolvePlanPricingForInterval(plan, selectedBillingInterval);
              const isCurrentPlan = activePlan.id === plan.id;
              const candidatePlanRank = getPlanTierRank(plan.id, visibleBillingPlans);
              const isHigherTier = candidatePlanRank > activePlanRank;
              const isLowerTier = candidatePlanRank < activePlanRank;
              const isFree = plan.monthly_price_cents === 0;
              const isCurrentInternalCompPlan = isInternalCompContract && isCurrentPlan && !isFree;
              const isActionLoading = planChangeLoadingPlanId === plan.id;
              const paidPlanLabel = activePlan.id === "free" || isInternalCompContract;
              const billingLabel = selectedBillingInterval === "year" ? "annual" : "monthly";
              const intervalUnavailable =
                selectedBillingInterval === "year" &&
                !isCurrentPlan &&
                !isFree &&
                !planPricing.hasLiveOffer;
              const actionButton = isCurrentPlan ? (
                <button type="button" className="profile-button ghost-btn" disabled>
                  Current Plan
                </button>
              ) : intervalUnavailable ? (
                <button
                  type="button"
                  className={`profile-button ${isHigherTier ? "primary-btn" : "ghost-btn"}`}
                  disabled
                >
                  Annual unavailable
                </button>
              ) : isCurrentInternalCompPlan ? (
                <button
                  type="button"
                  className="profile-button primary-btn"
                  onClick={() => onRequestPlanChange(plan.id, selectedBillingInterval)}
                  disabled={isActionLoading}
                >
                  {isActionLoading
                    ? "Starting checkout…"
                    : `Switch to ${planView.displayName} ${billingLabel} billing`}
                </button>
              ) : isHigherTier ? (
                <button
                  type="button"
                  className="profile-button primary-btn"
                  onClick={() => onRequestPlanChange(plan.id, selectedBillingInterval)}
                  disabled={isActionLoading}
                >
                  {isActionLoading
                    ? paidPlanLabel
                      ? "Starting billing flow…"
                      : "Opening Stripe…"
                    : paidPlanLabel
                      ? `Choose ${planView.displayName}`
                      : `Upgrade to ${planView.displayName}`}
                </button>
              ) : isLowerTier && !isFree ? (
                <button
                  type="button"
                  className="profile-button ghost-btn"
                  onClick={() => onRequestPlanChange(plan.id, selectedBillingInterval)}
                  disabled={isActionLoading}
                >
                  {isActionLoading
                    ? paidPlanLabel
                      ? "Starting billing flow…"
                      : "Opening Stripe…"
                    : paidPlanLabel
                      ? `Choose ${planView.displayName}`
                      : `Downgrade to ${planView.displayName}`}
                </button>
              ) : isFree ? (
                <button
                  type="button"
                  className="profile-button ghost-btn"
                  onClick={() => onRequestCancel(plan.id)}
                >
                  {isInternalCompContract ? "End paid access" : "Cancel paid subscription"}
                </button>
              ) : null;

              return (
                <SubscriptionPlanCard
                  key={plan.id}
                  plan={plan}
                  plans={visibleBillingPlans}
                  billingInterval={selectedBillingInterval}
                  isCurrent={isCurrentPlan}
                  stateBadgeLabel={isCurrentPlan ? "Current Plan" : null}
                  className="profile-subscription-plan-card"
                  actionSlot={
                    actionButton ? <div className="profile-actions">{actionButton}</div> : null
                  }
                />
              );
            })
          )}
        </div>

        {activePlan.id !== "free" && visibleBillingPlans.every((plan) => plan.id !== "free") ? (
          <div className="profile-actions">
            <button
              type="button"
              className="profile-button ghost-btn"
              onClick={() => onRequestCancel("free")}
            >
              {isInternalCompContract ? "End paid access" : "Cancel paid subscription"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel profile-panel profile-panel-stack">
        <div className="panel-header profile-panel-header">
          <div>
            <p className="eyebrow">Payment history</p>
            <h2 className="profile-panel-title">Recent subscription payments</h2>
            <p className="subdued tiny">
              {isInternalCompContract
                ? "This account is managed internally, so there are no Stripe subscription charges to show here."
                : "Recent recurring subscription invoices charged through Stripe."}
            </p>
          </div>
          <span className="profile-panel-icon-chip" aria-hidden="true">
            <Receipt size={18} weight="bold" />
          </span>
        </div>

        <div className="profile-receipts profile-receipts-standalone">
          <div className="profile-receipts-header">
            <h3 className="profile-subsection-title">Recent transactions</h3>
            <Receipt size={16} />
          </div>

          {subscriptionTransactionsLoading ? (
            <p className="tiny subdued">Loading recent payments…</p>
          ) : null}
          {!subscriptionTransactionsLoading && subscriptionTransactionsError ? (
            <p className="tiny subdued">{subscriptionTransactionsError}</p>
          ) : null}
          {!subscriptionTransactionsLoading &&
          !subscriptionTransactionsError &&
          subscriptionTransactions.length === 0 ? (
            <p className="tiny subdued">
              {isInternalCompContract
                ? "No Stripe subscription payments are available for this internally managed account."
                : "No recent subscription payments yet."}
            </p>
          ) : null}
          {!subscriptionTransactionsLoading &&
          !subscriptionTransactionsError &&
          subscriptionTransactions.length > 0 ? (
            <ul className="profile-receipt-list">
              {subscriptionTransactions.map((transaction) => {
                const timestamp = transaction.paidAt ?? transaction.createdAt;
                return (
                  <li key={transaction.id} className="profile-receipt-item">
                    <div>
                      <p className="label">{transaction.title}</p>
                      <p className="tiny subdued">
                        {formatDateTimeLabel(timestamp)}
                        {transaction.invoiceNumber ? ` · Invoice ${transaction.invoiceNumber}` : ""}
                      </p>
                      {transaction.receiptUrl ? (
                        <a
                          href={transaction.receiptUrl}
                          className="tiny subdued profile-receipt-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View invoice
                        </a>
                      ) : null}
                    </div>

                    <div className="profile-receipt-item-meta">
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

      {!isInternalCompContract ? (
        <aside className="profile-callout">
          <WarningCircle size={18} />
          <p className="tiny">
            Plan changes run through Stripe&apos;s secure billing flow. If you are on a legacy
            contract, changing plans may move you onto the current public offer for the selected
            tier.
          </p>
        </aside>
      ) : null}
    </>
  );
}
