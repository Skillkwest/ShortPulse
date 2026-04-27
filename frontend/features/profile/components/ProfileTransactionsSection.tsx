/**
 * Unified payment-history section for the profile workspace.
 * Brings recurring subscription charges and manual credit purchases into one view.
 */
import { CreditCard, Receipt } from "phosphor-react";
import {
  formatCurrencyAmount,
  formatDateTimeLabel,
  formatStatusLabel,
  type SubscriptionTransaction,
} from "../profilePageModel";

type ProfileTransactionsSectionProps = {
  portalActionLabel: string;
  portalLoading: boolean;
  portalManagementAvailable: boolean;
  transactions: SubscriptionTransaction[];
  transactionsError: string | null;
  transactionsLoading: boolean;
  userEmail: string | null | undefined;
  onOpenBillingPortal: () => void;
};

/**
 * Renders the consolidated billing payment history for the user.
 */
export function ProfileTransactionsSection({
  portalActionLabel,
  portalLoading,
  portalManagementAvailable,
  transactions,
  transactionsError,
  transactionsLoading,
  userEmail,
  onOpenBillingPortal,
}: ProfileTransactionsSectionProps) {
  return (
    <>
      <details className="panel profile-detail-panel profile-billing-how">
        <summary>How transaction history works</summary>
        <p>
          This feed combines recurring subscription invoices, storage add-on charges, and one-time
          credit top-ups so you can review every recent billing payment in one place.
        </p>
      </details>

      <section className="panel profile-panel profile-panel-stack">
        <div className="panel-header profile-panel-header">
          <div>
            <p className="eyebrow">Billing overview</p>
            <h2 className="profile-panel-title">Recent transactions</h2>
            <p className="subdued tiny">
              {userEmail ? `Billing email: ${userEmail}. ` : ""}
              {portalManagementAvailable
                ? "Includes automatic subscription payments and manual credit purchases."
                : "This account is managed internally, so Stripe-backed billing history may be limited."}
            </p>
          </div>
          <span className="profile-panel-icon-chip" aria-hidden="true">
            <CreditCard size={18} weight="bold" />
          </span>
        </div>

        {portalManagementAvailable ? (
          <div className="profile-actions">
            <button
              type="button"
              className="profile-button ghost-btn"
              onClick={onOpenBillingPortal}
              disabled={portalLoading}
            >
              {portalLoading ? "Opening secure portal…" : portalActionLabel}
            </button>
          </div>
        ) : null}

        <div className="profile-receipts profile-receipts-standalone">
          <div className="profile-receipts-header">
            <h3 className="profile-subsection-title">Recent transactions</h3>
            <Receipt size={16} />
          </div>

          {transactionsLoading ? (
            <p className="tiny subdued">Loading recent transactions…</p>
          ) : null}
          {!transactionsLoading && transactionsError ? (
            <p className="tiny subdued">{transactionsError}</p>
          ) : null}
          {!transactionsLoading && !transactionsError && transactions.length === 0 ? (
            <p className="tiny subdued">No recent billing transactions yet.</p>
          ) : null}
          {!transactionsLoading && !transactionsError && transactions.length > 0 ? (
            <ul className="profile-receipt-list">
              {transactions.map((transaction) => {
                const timestamp = transaction.paidAt ?? transaction.createdAt;
                return (
                  <li key={transaction.id} className="profile-receipt-item">
                    <div>
                      <p className="label">{transaction.title}</p>
                      <p className="tiny subdued">
                        {transaction.kindLabel}
                        {timestamp ? ` · ${formatDateTimeLabel(timestamp)}` : ""}
                        {transaction.reference ? ` · Ref ${transaction.reference}` : ""}
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
    </>
  );
}
