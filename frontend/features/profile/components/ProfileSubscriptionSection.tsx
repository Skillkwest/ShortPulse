/**
 * Subscription section for the profile workspace.
 * Presents the active plan summary and public plan catalog using the shared settings panel language.
 */
import { useEffect, useMemo, useState } from "react";
import { Receipt, WarningCircle } from "phosphor-react";
import { GenerationAccessCtaButton } from "../../ai-studio/components/shared/GenerationAccessCtaButton";
import { AI_STUDIO_PLAN_CTA } from "../../ai-studio/logic/generationAccessCta";
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
  formatDateTimeLabel,
  formatStatusLabel,
  type SubscriptionTransaction,
} from "../profilePageModel";
import { profileClass } from "../profileRouteStyles";
import { ProfileMetricCard, ProfilePanel } from "./ProfileSurface";

type ActivePlanView = ReturnType<typeof buildPlanView>;

type PendingStorageCarryoverUpgrade = {
  planId: string;
  planDisplayName: string;
  billingInterval: BillingInterval;
};

const formatHeroConcurrentGenerationsValue = (value: number, planId: string): string => {
  const normalizedValue = Math.max(0, Math.round(value));
  if (planId === "starter") {
    return `${normalizedValue.toLocaleString()} (Image only)`;
  }
  return normalizedValue.toLocaleString();
};

type ProfileSubscriptionSectionProps = {
  activePlan: ActivePlanView;
  activePlanRank: number;
  activeAddonStorageBytes: number;
  currentSubscriptionCreditsCents: number;
  currentSubscriptionBillingInterval: BillingInterval;
  currentSubscriptionPriceCents: number;
  currentSubscriptionStorageLimitBytes: number;
  currentSubscriptionMaxConcurrentGenerations: number;
  recurringPaymentLabel: string;
  subscriptionPeriodLabel: string;
  subscriptionRenewalText: string;
  isSubscriptionCancellationScheduled: boolean;
  billingPlans: BillingPlanRecord[];
  billingPlansLoading: boolean;
  isInternalCompContract: boolean;
  showLegacyPlanChangeNotice: boolean;
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
  currentSubscriptionMaxConcurrentGenerations,
  recurringPaymentLabel,
  subscriptionPeriodLabel,
  subscriptionRenewalText,
  isSubscriptionCancellationScheduled,
  billingPlans,
  billingPlansLoading,
  isInternalCompContract,
  showLegacyPlanChangeNotice,
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
  const [pendingStorageCarryoverUpgrade, setPendingStorageCarryoverUpgrade] =
    useState<PendingStorageCarryoverUpgrade | null>(null);
  const visibleBillingPlans = useMemo(
    () => filterPublicSubscriptionPlans(billingPlans),
    [billingPlans]
  );
  const showRenewalChip = currentSubscriptionPriceCents > 0 || isInternalCompContract;
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
  const activePlanDisplayName = activePlan.displayName;
  const showBaselinePlanCta = activePlan.id === "free";
  const cancelSubscriptionButton =
    activePlan.id !== "free" && !isSubscriptionCancellationScheduled ? (
      <button
        type="button"
        className={profileClass(
          "profile-button",
          "ghost-btn",
          "profile-subscription-cancel-button",
          "profile-subscription-cancel-header-button"
        )}
        onClick={() => onRequestCancel("free")}
      >
        Cancel subscription
      </button>
    ) : null;

  useEffect(() => {
    setSelectedBillingInterval(currentSubscriptionBillingInterval);
  }, [currentSubscriptionBillingInterval]);

  useEffect(() => {
    setPendingStorageCarryoverUpgrade(null);
  }, [selectedBillingInterval, currentSubscriptionBillingInterval, activeAddonStorageBytes]);

  return (
    <>
      <article
        className={profileClass(
          "panel",
          "profile-hero-card",
          "profile-subscription-hero-card",
          activePlan.className
        )}
      >
        <div className={profileClass("profile-hero-copy")}>
          <p className="eyebrow">Current plan</p>
          <p className={profileClass("profile-hero-value", "profile-hero-value-text")}>
            {activePlanDisplayName}
          </p>
        </div>

        {showBaselinePlanCta ? (
          <div className={profileClass("profile-hero-meta", "profile-subscription-plan-cta-slot")}>
            <GenerationAccessCtaButton cta={AI_STUDIO_PLAN_CTA} />
          </div>
        ) : (
          <div className={profileClass("profile-hero-meta")}>
            <ProfileMetricCard
              className="profile-hero-stat-card"
              label="Subscription"
              value={recurringPaymentLabel}
            />
            {showRenewalChip ? (
              <ProfileMetricCard
                className="profile-hero-stat-card"
                label={subscriptionPeriodLabel}
                value={subscriptionRenewalText}
              />
            ) : null}
            <ProfileMetricCard
              className="profile-hero-stat-card"
              label="Monthly credits"
              value={currentSubscriptionCreditsCents.toLocaleString()}
            />
            <ProfileMetricCard
              className="profile-hero-stat-card"
              label="Storage included"
              value={formatStorageBytes(currentSubscriptionStorageLimitBytes)}
            />
            <ProfileMetricCard
              className="profile-hero-stat-card"
              label="Concurrent generations"
              value={formatHeroConcurrentGenerationsValue(
                currentSubscriptionMaxConcurrentGenerations,
                activePlan.id
              )}
            />
            {activeAddonStorageBytes > 0 ? (
              <ProfileMetricCard
                className="profile-hero-stat-card"
                label="Active add-ons"
                value={`+${formatStorageBytes(activeAddonStorageBytes)}`}
              />
            ) : null}
          </div>
        )}
      </article>

      {isSubscriptionCancellationScheduled ? (
        <aside className={profileClass("profile-callout")}>
          <WarningCircle size={18} />
          <p className="tiny">
            Cancellation scheduled. You can keep using this plan, remaining subscription credits,
            and recurring storage add-ons until {subscriptionRenewalText}. Paid top-up credits stay
            available.
          </p>
        </aside>
      ) : null}

      {showBaselinePlanCta ? null : (
        <ProfilePanel
          eyebrow="All plans"
          title="Available plans"
          className="profile-panel-stack"
          headerAction={cancelSubscriptionButton}
        >
          <BillingIntervalToggle
            selectedBillingInterval={selectedBillingInterval}
            annualSavingsPercent={annualSavingsPercent}
            onChange={setSelectedBillingInterval}
            className={profileClass("profile-subscription-interval-toggle")}
          />

          <div className={profileClass("profile-plan-grid", "subscription-plan-grid")}>
            {billingPlansLoading ? (
              <div className={profileClass("profile-plan-card")}>
                <p className="tiny subdued">Loading plans…</p>
              </div>
            ) : visibleBillingPlans.length === 0 ? (
              <div className={profileClass("profile-plan-card")}>
                <p className="tiny subdued">No active plans configured yet.</p>
              </div>
            ) : (
              visibleBillingPlans.map((plan) => {
                const planView = buildPlanView({ planId: plan.id, plans: visibleBillingPlans });
                const planPricing = resolvePlanPricingForInterval(plan, selectedBillingInterval);
                const isCurrentPlan = activePlan.id === plan.id;
                const isCurrentBillingInterval =
                  isCurrentPlan && selectedBillingInterval === currentSubscriptionBillingInterval;
                const isPlanIntervalChange =
                  isCurrentPlan && selectedBillingInterval !== currentSubscriptionBillingInterval;
                const candidatePlanRank = getPlanTierRank(plan.id, visibleBillingPlans);
                const isHigherTier = candidatePlanRank > activePlanRank;
                const isLowerTier = candidatePlanRank < activePlanRank;
                const isFree = plan.monthly_price_cents === 0;
                const isCurrentInternalCompPlan =
                  isInternalCompContract && isCurrentPlan && !isFree;
                const isActionLoading = planChangeLoadingPlanId === plan.id;
                const paidPlanLabel = currentSubscriptionPriceCents === 0 || isInternalCompContract;
                const billingLabel = selectedBillingInterval === "year" ? "annual" : "monthly";
                const intervalUnavailable =
                  selectedBillingInterval === "year" && !isFree && !planPricing.hasLiveOffer;
                const intervalChangeLabel =
                  selectedBillingInterval === "year"
                    ? "Upgrade to annual billing"
                    : "Downgrade to monthly billing";
                const requiresStorageCarryoverConfirmation =
                  activeAddonStorageBytes > 0 &&
                  currentSubscriptionPriceCents > 0 &&
                  !isInternalCompContract &&
                  isHigherTier &&
                  selectedBillingInterval === currentSubscriptionBillingInterval;
                const handlePlanChangeClick = () => {
                  if (requiresStorageCarryoverConfirmation) {
                    setPendingStorageCarryoverUpgrade({
                      planId: plan.id,
                      planDisplayName: planView.displayName,
                      billingInterval: selectedBillingInterval,
                    });
                    return;
                  }
                  onRequestPlanChange(plan.id, selectedBillingInterval);
                };
                const higherTierLoadingLabel = requiresStorageCarryoverConfirmation
                  ? "Updating plan..."
                  : "Opening billing…";
                const actionButton = isCurrentBillingInterval ? (
                  <button
                    type="button"
                    className={profileClass("profile-button", "ghost-btn")}
                    disabled
                  >
                    Current Plan
                  </button>
                ) : intervalUnavailable ? (
                  <button
                    type="button"
                    className={profileClass(
                      "profile-button",
                      isHigherTier ? "primary-btn" : "ghost-btn"
                    )}
                    disabled
                  >
                    Annual unavailable
                  </button>
                ) : isPlanIntervalChange && !isFree ? (
                  <button
                    type="button"
                    className={profileClass(
                      "profile-button",
                      selectedBillingInterval === "year" ? "primary-btn" : "ghost-btn"
                    )}
                    onClick={() => onRequestPlanChange(plan.id, selectedBillingInterval)}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? "Opening billing…" : intervalChangeLabel}
                  </button>
                ) : isCurrentInternalCompPlan ? (
                  <button
                    type="button"
                    className={profileClass("profile-button", "primary-btn")}
                    onClick={() => onRequestPlanChange(plan.id, selectedBillingInterval)}
                    disabled={isActionLoading}
                  >
                    {isActionLoading
                      ? "Opening billing…"
                      : `Switch to ${planView.displayName} ${billingLabel} billing`}
                  </button>
                ) : isHigherTier ? (
                  <button
                    type="button"
                    className={profileClass("profile-button", "primary-btn")}
                    onClick={handlePlanChangeClick}
                    disabled={isActionLoading}
                  >
                    {isActionLoading
                      ? higherTierLoadingLabel
                      : paidPlanLabel
                        ? `Choose ${planView.displayName}`
                        : `Upgrade to ${planView.displayName}`}
                  </button>
                ) : isLowerTier && !isFree ? (
                  <button
                    type="button"
                    className={profileClass("profile-button", "ghost-btn")}
                    onClick={() => onRequestPlanChange(plan.id, selectedBillingInterval)}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? "Opening billing…" : `Downgrade to ${planView.displayName}`}
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
                    className={profileClass("profile-subscription-plan-card")}
                    actionSlot={
                      actionButton ? (
                        <div className={profileClass("profile-actions")}>{actionButton}</div>
                      ) : null
                    }
                  />
                );
              })
            )}
          </div>

          {pendingStorageCarryoverUpgrade ? (
            <aside className={profileClass("profile-callout")}>
              <WarningCircle size={18} />
              <div>
                <p className="tiny">
                  Confirm upgrade to {pendingStorageCarryoverUpgrade.planDisplayName}. Your +
                  {formatStorageBytes(activeAddonStorageBytes)} recurring storage add-on stays
                  active.
                </p>
                <div className={profileClass("profile-actions")}>
                  <button
                    type="button"
                    className={profileClass("profile-button", "primary-btn")}
                    onClick={() =>
                      onRequestPlanChange(
                        pendingStorageCarryoverUpgrade.planId,
                        pendingStorageCarryoverUpgrade.billingInterval
                      )
                    }
                    disabled={planChangeLoadingPlanId === pendingStorageCarryoverUpgrade.planId}
                  >
                    {planChangeLoadingPlanId === pendingStorageCarryoverUpgrade.planId
                      ? "Updating plan..."
                      : "Confirm upgrade"}
                  </button>
                  <button
                    type="button"
                    className={profileClass("profile-button", "ghost-btn")}
                    onClick={() => setPendingStorageCarryoverUpgrade(null)}
                    disabled={planChangeLoadingPlanId === pendingStorageCarryoverUpgrade.planId}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </aside>
          ) : null}
        </ProfilePanel>
      )}

      <ProfilePanel
        eyebrow="Payment history"
        title="Recent subscription payments"
        icon={Receipt}
        className="profile-panel-stack"
      >
        <div className={profileClass("profile-receipts", "profile-receipts-standalone")}>
          <div className={profileClass("profile-receipts-header")}>
            <h3 className={profileClass("profile-subsection-title")}>Recent transactions</h3>
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
            <ul className={profileClass("profile-receipt-list")}>
              {subscriptionTransactions.map((transaction) => {
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

      {showLegacyPlanChangeNotice ? (
        <aside className={profileClass("profile-callout")}>
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
