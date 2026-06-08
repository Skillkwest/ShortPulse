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
import { profileClass } from "../profileRouteStyles";
import { ProfileExplainer, ProfilePanel } from "./ProfileSurface";

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
      <ProfileExplainer summary="How transaction history works">
        <p>
          This feed combines recurring subscription invoices, storage add-on charges, and one-time
          credit top-ups so you can review every recent billing payment in one place.
        </p>
      </ProfileExplainer>

      <ProfilePanel
        eyebrow="Billing overview"
        title="Recent transactions"
        description={`${userEmail ? `Billing email: ${userEmail}. ` : ""}${
          portalManagementAvailable
            ? "Includes automatic subscription payments and manual credit purchases."
            : "This account is managed internally, so Stripe-backed billing history may be limited."
        }`}
        icon={CreditCard}
        className="profile-panel-stack"
      >
        {portalManagementAvailable ? (
          <div className={profileClass("profile-actions")}>
            <button
              type="button"
              className={profileClass("profile-button", "ghost-btn")}
              onClick={onOpenBillingPortal}
              disabled={portalLoading}
            >
              {portalLoading ? "Opening secure portal…" : portalActionLabel}
            </button>
          </div>
        ) : null}

        <div className={profileClass("profile-receipts", "profile-receipts-standalone")}>
          <div className={profileClass("profile-receipts-header")}>
            <h3 className={profileClass("profile-subsection-title")}>Recent transactions</h3>
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
            <ul className={profileClass("profile-receipt-list")}>
              {transactions.map((transaction) => {
                const timestamp = transaction.paidAt ?? transaction.createdAt;
                return (
                  <li key={transaction.id} className={profileClass("profile-receipt-item")}>
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
