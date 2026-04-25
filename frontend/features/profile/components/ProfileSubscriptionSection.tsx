/**
 * Subscription section for the profile workspace.
 * Presents the active plan summary and public plan catalog using the shared settings panel language.
 */
import { CheckCircle, WarningCircle } from "phosphor-react";
import { buildPlanView, getPlanTierRank, type BillingPlanRecord } from "../../billing/catalog";
import { formatStorageBytes } from "../../billing/storage";
import { formatCurrencyFromCents } from "../profilePageModel";

type ActivePlanView = ReturnType<typeof buildPlanView>;

type ProfileSubscriptionSectionProps = {
  activePlan: ActivePlanView;
  activePlanRank: number;
  activeAddonStorageBytes: number;
  currentSubscriptionCreditsCents: number;
  currentSubscriptionPriceCents: number;
  currentSubscriptionStorageLimitBytes: number;
  planLabel: string;
  subscriptionStatusLabel: string;
  subscriptionRenewalText: string;
  contractDescriptor: string;
  billingPlans: BillingPlanRecord[];
  billingPlansLoading: boolean;
  portalActionLabel: string;
  portalLoading: boolean;
  portalManagementAvailable: boolean;
  onOpenBillingPortal: () => void;
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
  currentSubscriptionPriceCents,
  currentSubscriptionStorageLimitBytes,
  planLabel,
  subscriptionStatusLabel,
  subscriptionRenewalText,
  contractDescriptor,
  billingPlans,
  billingPlansLoading,
  portalActionLabel,
  portalLoading,
  portalManagementAvailable,
  onOpenBillingPortal,
  onRequestCancel,
}: ProfileSubscriptionSectionProps) {
  return (
    <>
      <details className="panel profile-detail-panel profile-billing-how">
        <summary>How subscriptions work</summary>
        <p>
          Monthly plans include recurring credits. You can upgrade or downgrade anytime. Upgrades
          take effect immediately with prorated charges. Downgrades apply at the end of your billing
          period. Credits never expire.
        </p>
      </details>

      <div className="profile-summary-grid">
        <article className="panel profile-summary-card">
          <p className="tiny subdued">Current plan</p>
          <p className="summary-value">{planLabel}</p>
          <p className="tiny subdued">{activePlan.description}</p>
        </article>

        <article className="panel profile-summary-card">
          <p className="tiny subdued">Current recurring price</p>
          <p className="summary-value small">
            {formatCurrencyFromCents(currentSubscriptionPriceCents)} / month
          </p>
          <p className="tiny subdued">{contractDescriptor}</p>
        </article>

        <article className="panel profile-summary-card">
          <p className="tiny subdued">Status</p>
          <p className="summary-value small">{subscriptionStatusLabel}</p>
          <p className="tiny subdued">{subscriptionRenewalText}</p>
        </article>

        <article className="panel profile-summary-card">
          <p className="tiny subdued">Monthly credits</p>
          <p className="summary-value">{currentSubscriptionCreditsCents.toLocaleString()}</p>
          <p className="tiny subdued">Renews automatically each billing cycle</p>
        </article>

        <article className="panel profile-summary-card">
          <p className="tiny subdued">Storage included</p>
          <p className="summary-value small">
            {formatStorageBytes(currentSubscriptionStorageLimitBytes)}
          </p>
          <p className="tiny subdued">
            {activeAddonStorageBytes > 0
              ? `${formatStorageBytes(activeAddonStorageBytes)} extra from active add-ons`
              : "Base plan capacity before any recurring add-ons"}
          </p>
        </article>
      </div>

      <section className="panel profile-panel profile-panel-stack">
        <div className="panel-header profile-panel-header">
          <div>
            <p className="eyebrow">All plans</p>
            <h2 className="profile-panel-title">Choose your subscription</h2>
            <p className="subdued tiny">
              Your current contract stays above. These tiles show the public offers available if you
              change plans now.
            </p>
          </div>
        </div>

        <div className="profile-plan-grid">
          {billingPlansLoading ? (
            <div className="profile-plan-card">
              <p className="tiny subdued">Loading plans…</p>
            </div>
          ) : billingPlans.length === 0 ? (
            <div className="profile-plan-card">
              <p className="tiny subdued">No active plans configured yet.</p>
            </div>
          ) : (
            billingPlans.map((plan) => {
              const planView = buildPlanView({ planId: plan.id, plans: billingPlans });
              const isCurrentPlan = activePlan.id === plan.id;
              const candidatePlanRank = getPlanTierRank(plan.id, billingPlans);
              const isHigherTier = candidatePlanRank > activePlanRank;
              const isLowerTier = candidatePlanRank < activePlanRank;
              const isFree = plan.monthly_price_cents === 0;

              return (
                <div
                  key={plan.id}
                  className={`profile-plan-card ${isCurrentPlan ? "current" : ""}`}
                >
                  <div className="profile-plan-top">
                    <div>
                      <p className="tiny subdued">
                        {isFree ? "Free tier" : "Monthly subscription"}
                      </p>
                      <h3 className="profile-plan-card-title">{planView.displayName}</h3>
                    </div>
                    {isCurrentPlan ? (
                      <span className="profile-plan-badge">Current Plan</span>
                    ) : (
                      <CheckCircle size={18} />
                    )}
                  </div>

                  <p className="meta-value">
                    {formatCurrencyFromCents(plan.monthly_price_cents)}
                    <span className="tiny subdued"> / month</span>
                  </p>

                  <p className="tiny subdued">{planView.description}</p>

                  <div className="profile-divider" />

                  <div className="profile-card-footer">
                    <p className="tiny subdued">
                      <strong>{plan.monthly_credits_cents.toLocaleString()}</strong> credits/month
                    </p>
                    <p className="tiny subdued">
                      <strong>{formatStorageBytes(planView.storageLimitBytes)}</strong> storage
                      included
                    </p>
                  </div>

                  <div className="profile-actions">
                    {isCurrentPlan ? (
                      <button type="button" className="profile-button ghost-btn" disabled>
                        Current Plan
                      </button>
                    ) : !portalManagementAvailable ? (
                      <button type="button" className="profile-button ghost-btn" disabled>
                        Billing portal unavailable
                      </button>
                    ) : isHigherTier ? (
                      <button
                        type="button"
                        className="profile-button primary-btn"
                        onClick={onOpenBillingPortal}
                        disabled={portalLoading}
                      >
                        {portalLoading ? "Opening portal…" : `Upgrade to ${planView.displayName}`}
                      </button>
                    ) : isLowerTier && !isFree ? (
                      <button
                        type="button"
                        className="profile-button ghost-btn"
                        onClick={onOpenBillingPortal}
                        disabled={portalLoading}
                      >
                        {portalLoading ? "Opening portal…" : `Downgrade to ${planView.displayName}`}
                      </button>
                    ) : isFree && !isCurrentPlan ? (
                      <button
                        type="button"
                        className="profile-button ghost-btn"
                        onClick={() => onRequestCancel(plan.id)}
                      >
                        Cancel subscription
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <aside className="profile-callout">
        <WarningCircle size={18} />
        <p className="tiny">
          {portalManagementAvailable
            ? `Plan changes are managed through Stripe's secure billing portal. If you are on a legacy contract, changing plans may move you onto the current public offer for the selected tier.`
            : `${portalActionLabel}. Contact support if you need plan changes for this account.`}
        </p>
      </aside>
    </>
  );
}
