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

type CreditPackageCard = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  badge: string | null;
  unitUsdPerThousand: number;
};

type ProfileCreditsSectionProps = {
  balanceCents: number | null;
  balanceLoading: boolean;
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
  userEmail: string | null | undefined;
  onCheckout: (packageId: string) => void;
  onOpenBillingPortal: () => void;
  onRefreshCredits: () => void;
};

/**
 * Renders the credits and billing panel stack.
 */
export function ProfileCreditsSection({
  balanceCents,
  balanceLoading,
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
  userEmail,
  onCheckout,
  onOpenBillingPortal,
  onRefreshCredits,
}: ProfileCreditsSectionProps) {
  return (
    <>
      <details className="panel profile-detail-panel profile-billing-how">
        <summary>How credits work</summary>
        <p>
          Credit packs are one-time top-ups. Every generation debits credits based on model cost,
          and your spendable balance syncs from Supabase in real time.
        </p>
      </details>

      <div className="profile-summary-grid">
        <article className="panel profile-summary-card">
          <p className="tiny subdued">Credits</p>
          <p className="summary-value">
            {balanceLoading ? "…" : (balanceCents ?? 0).toLocaleString()}
          </p>
          <p className="tiny subdued">Last synced: {formatDateTimeLabel(balanceUpdatedAt)}</p>
        </article>

        <article className="panel profile-summary-card">
          <p className="tiny subdued">Billing identity</p>
          <p className="summary-value small">{userEmail ?? "No billing email"}</p>
          <p className="tiny subdued">{billingIdentityDescription}</p>
        </article>
      </div>

      <div className="profile-section-stack">
        <section className="panel profile-panel profile-panel-stack">
          <div className="panel-header profile-panel-header">
            <div>
              <p className="eyebrow">Payment details</p>
              <h2 className="profile-panel-title">Invoices and payment method</h2>
              <p className="subdued tiny">
                Open the billing portal for invoices, receipts, card updates, and subscription
                charges.
              </p>
            </div>
            <span className="profile-panel-icon-chip" aria-hidden="true">
              <CreditCard size={18} weight="bold" />
            </span>
          </div>

          <div className="profile-actions">
            <button
              type="button"
              className="profile-button primary-btn"
              onClick={onOpenBillingPortal}
              disabled={portalLoading || !portalManagementAvailable}
            >
              {portalLoading ? "Opening secure portal…" : portalActionLabel}
            </button>
          </div>
          {!portalManagementAvailable ? (
            <p className="tiny subdued">
              This entitlement is managed internally, so Stripe billing controls are unavailable on
              this account.
            </p>
          ) : null}

          <div className="profile-receipts">
            <div className="profile-receipts-header">
              <h3 className="profile-subsection-title">Recent credit activity</h3>
              <Receipt size={16} />
            </div>

            {billingActivityLoading ? <p className="tiny subdued">Loading activity…</p> : null}
            {!billingActivityLoading && billingActivity.length === 0 ? (
              <p className="tiny subdued">No recent billing events yet.</p>
            ) : null}
            {!billingActivityLoading && billingActivity.length > 0 ? (
              <ul className="profile-receipt-list">
                {billingActivity.map((event) => {
                  const reference = resolveLedgerReference(event);
                  const amountLabel = `${event.change_cents > 0 ? "+" : ""}${event.change_cents.toLocaleString()} credits`;
                  return (
                    <li key={event.id} className="profile-receipt-item">
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
        </section>

        <section className="panel profile-panel profile-panel-stack">
          <div className="panel-header profile-panel-header">
            <div>
              <p className="eyebrow">Credits & top-ups</p>
              <h2 className="profile-panel-title">Buy credits</h2>
              <p className="subdued tiny">
                One-time purchases. Taxes may apply. Receipts are available in Stripe.
              </p>
            </div>
            <button
              type="button"
              className="profile-inline-action"
              onClick={onRefreshCredits}
              disabled={refreshingCredits || balanceLoading}
            >
              <ArrowsClockwise size={15} />
              {refreshingCredits ? "Syncing…" : "Refresh credits"}
            </button>
          </div>

          <div className="profile-plan-grid">
            {packagesLoading ? (
              <div className="profile-plan-card">
                <p className="tiny subdued">Loading credit packages…</p>
              </div>
            ) : packageCards.length === 0 ? (
              <div className="profile-plan-card">
                <p className="tiny subdued">No active credit packages are configured yet.</p>
              </div>
            ) : (
              packageCards.map((pkg) => (
                <div key={pkg.id} className="profile-plan-card">
                  <div className="profile-plan-top">
                    <div>
                      <p className="tiny subdued">Credit package</p>
                      <h3 className="profile-plan-card-title">{pkg.display_name}</h3>
                    </div>
                    {pkg.badge ? (
                      <span className="profile-plan-badge">{pkg.badge}</span>
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

                  <div className="profile-actions">
                    <button
                      type="button"
                      className="profile-button primary-btn"
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
        </section>
      </div>
    </>
  );
}
