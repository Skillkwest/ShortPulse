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
import { ProfilePanel } from "./ProfileSurface";

type ProfileTransactionsSectionProps = {
  transactions: SubscriptionTransaction[];
  transactionsError: string | null;
  transactionsLoading: boolean;
};

/**
 * Renders the consolidated billing payment history for the user.
 */
export function ProfileTransactionsSection({
  transactions,
  transactionsError,
  transactionsLoading,
}: ProfileTransactionsSectionProps) {
  return (
    <>
      <ProfilePanel
        eyebrow="Billing overview"
        title="Payment history"
        icon={CreditCard}
        className="profile-panel-stack"
      >
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
