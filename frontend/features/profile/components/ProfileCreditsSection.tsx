/**
 * Credits section for the profile workspace.
 * Separates one-time credit purchasing and billing history from recurring plan and storage management.
 */
import { ArrowsClockwise, CheckCircle, CreditCard, Receipt } from "phosphor-react";
import type { BillingLedgerEvent } from "../profilePageModel";
import {
  formatCurrencyFromCents,
  formatDateTimeLabel,
  resolveLedgerLabel,
  resolveLedgerReference,
} from "../profilePageModel";
import { profileClass } from "../profileRouteStyles";
import { ProfileExplainer, ProfileMetricCard, ProfilePanel } from "./ProfileSurface";

type CreditPackageCard = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  badge: string | null;
  unitUsdPerThousand: number;
};

const formatCompactDate = (value: string | null): string => {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatCompactTime = (value: string | null): string => {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

type ProfileCreditsSectionProps = {
  activePlanClassName: string;
  balanceCents: number | null;
  balanceError: string | null;
  balanceLoading: boolean;
  nextCreditRenewalAmount: number;
  nextCreditRenewalAt: string | null;
  balanceUpdatedAt: string | null;
  billingActivity: BillingLedgerEvent[];
  billingActivityLoading: boolean;
  billingIdentityDescription: string;
  checkoutLoadingId: string | null;
  packageCards: readonly CreditPackageCard[];
  packagesLoading: boolean;
  portalActionLabel: string;
  portalLoading: boolean;
  portalManagementAvailable: boolean;
  refreshingCredits: boolean;
  onCheckout: (packageId: string) => void;
  onOpenBillingPortal: () => void;
  onRefreshCredits: () => void;
};

/**
 * Renders the credits and billing panel stack.
 */
export function ProfileCreditsSection({
  activePlanClassName,
  balanceCents,
  balanceError,
  balanceLoading,
  nextCreditRenewalAmount,
  nextCreditRenewalAt,
  balanceUpdatedAt,
  billingActivity,
  billingActivityLoading,
  billingIdentityDescription,
  checkoutLoadingId,
  packageCards,
  packagesLoading,
  portalActionLabel,
  portalLoading,
  portalManagementAvailable,
  refreshingCredits,
  onCheckout,
  onOpenBillingPortal,
  onRefreshCredits,
}: ProfileCreditsSectionProps) {
  const balanceDisplayValue = balanceLoading
    ? "…"
    : balanceCents == null
      ? "Unavailable"
      : balanceCents.toLocaleString();
  const balanceHelperText = balanceLoading
    ? "Syncing spendable credits from your account snapshot."
    : balanceCents == null
      ? balanceError || "Unable to load spendable credits right now."
      : "Spendable credits ready for AI generations right now.";

  return (
    <>
      <ProfileExplainer summary="How credits work">
        <p>
          Credit packs are one-time top-ups. Every generation debits credits based on model cost,
          and your spendable balance syncs from Supabase in real time.
        </p>
      </ProfileExplainer>

      <article className={profileClass("panel", "profile-credit-hero-card", activePlanClassName)}>
        <div className={profileClass("profile-credit-hero-copy")}>
          <p className="eyebrow">Available balance</p>
          <h2 className={profileClass("profile-credit-hero-title")}>Your credits</h2>
          <p className={profileClass("profile-credit-hero-value")}>{balanceDisplayValue}</p>
          <p className="tiny subdued">{balanceHelperText}</p>
        </div>

        <div className={profileClass("profile-credit-hero-meta")}>
          <ProfileMetricCard
            className="profile-credit-hero-stat-card"
            label="Next renewal"
            value={formatCompactDate(nextCreditRenewalAt)}
            helper={
              nextCreditRenewalAt ? "Plan credits refresh automatically" : "No renewal scheduled"
            }
          />
          <ProfileMetricCard
            className="profile-credit-hero-stat-card"
            label="Incoming credits"
            value={`+${nextCreditRenewalAmount.toLocaleString()}`}
            helper="Credits added on renewal"
          />
          <ProfileMetricCard
            className="profile-credit-hero-stat-card"
            label="Last synced"
            value={formatCompactTime(balanceUpdatedAt)}
            helper={formatCompactDate(balanceUpdatedAt)}
          />
        </div>
      </article>

      {!portalManagementAvailable ? (
        <aside className={profileClass("profile-callout")}>
          <CreditCard size={18} />
          <p className="tiny">{billingIdentityDescription}</p>
        </aside>
      ) : null}

      <div className={profileClass("profile-section-stack")}>
        <ProfilePanel
          eyebrow="Credits & top-ups"
          title="Buy credits"
          description="One-time purchases. Taxes may apply. Receipts are available in Stripe."
          className="profile-panel-stack"
          headerAction={
            <button
              type="button"
              className={profileClass("profile-inline-action")}
              onClick={onRefreshCredits}
              disabled={refreshingCredits || balanceLoading}
            >
              <ArrowsClockwise size={15} />
              {refreshingCredits ? "Syncing…" : "Refresh credits"}
            </button>
          }
        >
          <div className={profileClass("profile-plan-grid")}>
            {packagesLoading ? (
              <div className={profileClass("profile-plan-card")}>
                <p className="tiny subdued">Loading credit packages…</p>
              </div>
            ) : packageCards.length === 0 ? (
              <div className={profileClass("profile-plan-card")}>
                <p className="tiny subdued">No active credit packages are configured yet.</p>
              </div>
            ) : (
              packageCards.map((pkg) => (
                <div key={pkg.id} className={profileClass("profile-plan-card")}>
                  <div className={profileClass("profile-plan-top")}>
                    <div>
                      <p className="tiny subdued">Credit package</p>
                      <h3 className={profileClass("profile-plan-card-title")}>
                        {pkg.display_name}
                      </h3>
                    </div>
                    {pkg.badge ? (
                      <span className={profileClass("profile-plan-badge")}>{pkg.badge}</span>
                    ) : (
                      <CheckCircle size={18} />
                    )}
                  </div>

                  <p className="meta-value">
                    {pkg.credit_amount_cents.toLocaleString()}{" "}
                    <span className="tiny subdued">credits</span>
                  </p>
                  <p className="tiny subdued">
                    {formatCurrencyFromCents(pkg.price_cents)} one-time purchase
                  </p>
                  <p className="tiny subdued">{`$${pkg.unitUsdPerThousand.toFixed(2)} / 1,000 credits`}</p>

                  <div className={profileClass("profile-actions")}>
                    <button
                      type="button"
                      className={profileClass("profile-button", "primary-btn")}
                      onClick={() => onCheckout(pkg.id)}
                      aria-label={`Buy ${pkg.display_name} for ${formatCurrencyFromCents(pkg.price_cents)}`}
                      disabled={checkoutLoadingId === pkg.id}
                    >
                      {checkoutLoadingId === pkg.id ? "Starting checkout…" : "Buy credits"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ProfilePanel>

        <ProfilePanel
          eyebrow="Payment details"
          title="Invoices and payment method"
          icon={CreditCard}
          className="profile-panel-stack"
        >
          {portalManagementAvailable ? (
            <div className={profileClass("profile-actions")}>
              <button
                type="button"
                className={profileClass("profile-button", "primary-btn")}
                onClick={onOpenBillingPortal}
                disabled={portalLoading}
              >
                {portalLoading ? "Opening secure portal…" : portalActionLabel}
              </button>
            </div>
          ) : null}

          <div className={profileClass("profile-receipts")}>
            <div className={profileClass("profile-receipts-header")}>
              <h3 className={profileClass("profile-subsection-title")}>Recent credit activity</h3>
              <Receipt size={16} />
            </div>

            {billingActivityLoading ? <p className="tiny subdued">Loading activity…</p> : null}
            {!billingActivityLoading && billingActivity.length === 0 ? (
              <p className="tiny subdued">No recent billing events yet.</p>
            ) : null}
            {!billingActivityLoading && billingActivity.length > 0 ? (
              <ul className={profileClass("profile-receipt-list")}>
                {billingActivity.map((event) => {
                  const reference = resolveLedgerReference(event);
                  const amountLabel = `${event.change_cents > 0 ? "+" : ""}${event.change_cents.toLocaleString()} credits`;
                  return (
                    <li key={event.id} className={profileClass("profile-receipt-item")}>
                      <div>
                        <p className="label">{resolveLedgerLabel(event)}</p>
                        <p className="tiny subdued">
                          {formatDateTimeLabel(event.created_at)}
                          {reference ? ` · Ref ${reference}` : ""}
                        </p>
                      </div>
                      <p className="tiny">{amountLabel}</p>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </ProfilePanel>
      </div>
    </>
  );
}
