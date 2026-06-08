import React from "react";
import { AppMessage } from "../../components/AppMessage";
import { getStripeStatus } from "./PricingPageChrome";
import type { AdminPricingStateResponse } from "./types";
import {
  buildCreditPackageDraft,
  formatCredits,
  formatCurrencyFromCents,
  formatUsd,
  type CreditPackageDraft,
} from "./pricingPageUtils";
import styles from "../../styles/admin.module.css";

type PricingCreditPackagesSectionProps = {
  pricingState: AdminPricingStateResponse | null;
  creditDraft: CreditPackageDraft | null;
  setCreditDraft: React.Dispatch<React.SetStateAction<CreditPackageDraft | null>>;
  creditSaving: boolean;
  creditMessage: string | null;
  creditError: string | null;
  setCreditMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setCreditError: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmCreditPackage: () => void;
};

export function PricingCreditPackagesSection({
  pricingState,
  creditDraft,
  setCreditDraft,
  creditSaving,
  creditMessage,
  creditError,
  setCreditMessage,
  setCreditError,
  onConfirmCreditPackage,
}: PricingCreditPackagesSectionProps) {
  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Credit top-ups</p>
          <h2 className={styles.adminSectionTitle}>Public credit packages</h2>
          <p className="tiny subdued">
            Active and inactive checkout packages so operators can disable and later reactivate rows
            from one workspace.
          </p>
        </div>
      </div>

      {pricingState ? (
        <div className={styles.adminTable}>
          <div className={`${styles.pricingCatalogHead} ${styles.adminTableHead}`}>
            <span>Package</span>
            <span>Price</span>
            <span>Credits</span>
            <span>Unit economics</span>
            <span>Stripe price</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {pricingState.creditPackages.map((pkg) => {
            const stripeStatus = getStripeStatus({
              priceCents: pkg.priceCents,
              stripePriceId: pkg.stripePriceId,
              isActive: pkg.isActive,
            });
            return (
              <div key={pkg.id} className={styles.pricingCatalogRow}>
                <span className={styles.pricingPrimaryCell}>
                  <strong>{pkg.displayName}</strong>
                </span>
                <span>{formatCurrencyFromCents(pkg.priceCents)}</span>
                <span>{formatCredits(pkg.creditAmountCents)}</span>
                <span>{formatUsd((pkg.priceCents / 100 / pkg.creditAmountCents) * 1000)}</span>
                <span className={stripeStatus.className}>{stripeStatus.label}</span>
                <span className={pkg.isActive ? styles.pillOk : styles.pillWarn}>
                  {pkg.isActive ? "active" : "inactive"}
                </span>
                <span>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => {
                      setCreditDraft(buildCreditPackageDraft(pkg));
                      setCreditError(null);
                      setCreditMessage(null);
                    }}
                  >
                    Edit
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {creditMessage ? (
        <AppMessage
          className={styles.announcementResult}
          tone="success"
          mode="banner"
          message={creditMessage}
        />
      ) : null}
      {creditError ? (
        <AppMessage
          className={styles.announcementError}
          tone="error"
          mode="banner"
          message={creditError}
        />
      ) : null}

      {creditDraft ? (
        <div className={styles.pricingEditorCard}>
          <p className="eyebrow">Edit credit package</p>
          <div className={styles.pricingFormGrid}>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Display name</span>
              <input
                className={styles.searchInput}
                value={creditDraft.displayName}
                onChange={(event) =>
                  setCreditDraft((current) =>
                    current ? { ...current, displayName: event.target.value } : current
                  )
                }
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Credits</span>
              <input
                className={styles.searchInput}
                value={creditDraft.creditAmountCents}
                onChange={(event) =>
                  setCreditDraft((current) =>
                    current ? { ...current, creditAmountCents: event.target.value } : current
                  )
                }
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Price (cents)</span>
              <input
                className={styles.searchInput}
                value={creditDraft.priceCents}
                onChange={(event) =>
                  setCreditDraft((current) =>
                    current ? { ...current, priceCents: event.target.value } : current
                  )
                }
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Stripe price id</span>
              <input
                className={styles.searchInput}
                value={creditDraft.stripePriceId}
                onChange={(event) =>
                  setCreditDraft((current) =>
                    current ? { ...current, stripePriceId: event.target.value } : current
                  )
                }
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Sort order</span>
              <input
                className={styles.searchInput}
                value={creditDraft.sortOrder}
                onChange={(event) =>
                  setCreditDraft((current) =>
                    current ? { ...current, sortOrder: event.target.value } : current
                  )
                }
              />
            </label>
            <label className={styles.pricingCheckboxField}>
              <input
                type="checkbox"
                checked={creditDraft.isActive}
                onChange={(event) =>
                  setCreditDraft((current) =>
                    current ? { ...current, isActive: event.target.checked } : current
                  )
                }
              />
              <span>Active package</span>
            </label>
          </div>
          <div className={styles.pricingEditorActions}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={onConfirmCreditPackage}
              disabled={creditSaving}
            >
              {creditSaving ? "Saving…" : "Save package"}
            </button>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => setCreditDraft(null)}
              disabled={creditSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
