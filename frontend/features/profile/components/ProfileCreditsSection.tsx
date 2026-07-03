/**
 * Credits section for the profile workspace.
 * Separates one-time credit purchasing and credit activity from account billing management.
 */
import { ArrowsClockwise, Receipt } from "phosphor-react";
import type { BillingLedgerEvent } from "../profilePageModel";
import {
  formatCurrencyFromCents,
  formatDateTimeLabel,
  resolveLedgerLabel,
  resolveLedgerReference,
} from "../profilePageModel";
import { profileClass } from "../profileRouteStyles";
import { ProfileMetricCard, ProfilePanel } from "./ProfileSurface";

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

const formatCreditPackageLabel = (credits: number): string =>
  `${Math.max(0, credits).toLocaleString()} credits`;

type ProfileCreditsSectionProps = {
  activePlanClassName: string;
  balanceCents: number | null;
  balanceError: string | null;
  balanceLoading: boolean;
  nextCreditRenewalAmount: number;
  nextCreditRenewalAt: string | null;
  billingActivity: BillingLedgerEvent[];
  billingActivityLoading: boolean;
  checkoutLoadingId: string | null;
  packageCards: readonly CreditPackageCard[];
  packagesLoading: boolean;
  refreshingCredits: boolean;
  onCheckout: (packageId: string) => void;
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
  billingActivity,
  billingActivityLoading,
  checkoutLoadingId,
  packageCards,
  packagesLoading,
  refreshingCredits,
  onCheckout,
  onRefreshCredits,
}: ProfileCreditsSectionProps) {
  const balanceDisplayValue = balanceLoading
    ? "…"
    : balanceCents == null
      ? "Unavailable"
      : balanceCents.toLocaleString();

  return (
    <>
      <article className={profileClass("panel", "profile-credit-hero-card", activePlanClassName)}>
        <div className={profileClass("profile-credit-hero-copy")}>
          <p className="eyebrow">Available balance</p>
          <p className={profileClass("profile-credit-hero-value")}>{balanceDisplayValue}</p>
          {balanceCents == null && balanceError ? (
            <p className="tiny subdued">{balanceError}</p>
          ) : null}
        </div>

        <div className={profileClass("profile-credit-hero-meta")}>
          <ProfileMetricCard
            className="profile-credit-hero-stat-card"
            label="Next renewal"
            value={formatCompactDate(nextCreditRenewalAt)}
          />
          <ProfileMetricCard
            className="profile-credit-hero-stat-card"
            label="Incoming credits"
            value={`+${nextCreditRenewalAmount.toLocaleString()}`}
          />
        </div>
      </article>

      <div className={profileClass("profile-section-stack")}>
        <ProfilePanel
          eyebrow="Credits & top-ups"
          title="Buy credits"
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
              packageCards.map((pkg) => {
                const creditPackageLabel = formatCreditPackageLabel(pkg.credit_amount_cents);
                return (
                  <div key={pkg.id} className={profileClass("profile-plan-card")}>
                    <div className={profileClass("profile-plan-top")}>
                      <div>
                        <p className="tiny subdued">Credit top-up</p>
                        <h3 className={profileClass("profile-plan-card-title")}>
                          {creditPackageLabel}
                        </h3>
                      </div>
                      {pkg.badge ? (
                        <span className={profileClass("profile-plan-badge")}>{pkg.badge}</span>
                      ) : null}
                    </div>

                    <p className="tiny subdued">
                      {formatCurrencyFromCents(pkg.price_cents)} one-time purchase
                    </p>
                    <p className="tiny subdued">{`$${pkg.unitUsdPerThousand.toFixed(2)} / 1,000 credits`}</p>

                    <div className={profileClass("profile-actions")}>
                      <button
                        type="button"
                        className={profileClass("profile-button", "primary-btn")}
                        onClick={() => onCheckout(pkg.id)}
                        aria-label={`Buy ${creditPackageLabel} for ${formatCurrencyFromCents(pkg.price_cents)}`}
                        disabled={checkoutLoadingId === pkg.id}
                      >
                        {checkoutLoadingId === pkg.id ? "Starting checkout…" : "Buy credits"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ProfilePanel>

        <ProfilePanel
          eyebrow="Credit activity"
          title="Recent credit activity"
          icon={Receipt}
          className="profile-panel-stack"
        >
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
