import React from "react";
import { AppMessage } from "../../components/AppMessage";
import { formatStorageBytes } from "../billing/storage";
import { isManualReviewStorageAddon } from "../../lib/billing/storageAddonEligibility";
import { getStripeStatus } from "./PricingPageChrome";
import type { AdminPricingStateResponse } from "./types";
import {
  buildStorageOfferDraft,
  formatCurrencyFromCents,
  formatDateTime,
  type StorageOfferDraft,
} from "./pricingPageUtils";
import styles from "../../styles/admin.module.css";

type PricingStorageAddonsSectionProps = {
  pricingState: AdminPricingStateResponse | null;
  storageDraft: StorageOfferDraft | null;
  setStorageDraft: React.Dispatch<React.SetStateAction<StorageOfferDraft | null>>;
  storageSaving: boolean;
  storageMessage: string | null;
  storageError: string | null;
  setStorageMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setStorageError: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmStorageOffer: () => void;
};

export function PricingStorageAddonsSection({
  pricingState,
  storageDraft,
  setStorageDraft,
  storageSaving,
  storageMessage,
  storageError,
  setStorageMessage,
  setStorageError,
  onConfirmStorageOffer,
}: PricingStorageAddonsSectionProps) {
  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Storage add-ons</p>
          <h2 className={styles.adminSectionTitle}>Storage add-ons</h2>
          <p className="tiny subdued">
            Self-serve offers can be activated here; manual-review storage stays non-public.
          </p>
        </div>
      </div>

      {pricingState ? (
        <div className={styles.adminTable}>
          <div className={`${styles.pricingCatalogHead} ${styles.adminTableHead}`}>
            <span>Add-on</span>
            <span>Monthly price</span>
            <span>Storage</span>
            <span>Offer id</span>
            <span>Stripe price</span>
            <span>Effective</span>
            <span>Action</span>
          </div>
          {pricingState.storageAddons.map((addon) => {
            const isManualReview = isManualReviewStorageAddon(addon.storageAddonId);
            const stripeStatus = addon.offerId
              ? getStripeStatus({
                  priceCents: addon.recurringPriceCents,
                  stripePriceId: addon.stripePriceId,
                  isActive: addon.isActive,
                })
              : {
                  label: "Not configured",
                  className: styles.pillWarn,
                  isMono: false,
                };
            return (
              <div key={addon.storageAddonId} className={styles.pricingCatalogRow}>
                <span className={styles.pricingPrimaryCell}>
                  <strong>{addon.displayName}</strong>
                  <small>
                    {isManualReview
                      ? "Manual review"
                      : addon.acquisitionEnabled
                        ? "Self-serve"
                        : "Inactive"}
                  </small>
                </span>
                <span>
                  {addon.offerId ? formatCurrencyFromCents(addon.recurringPriceCents) : "—"}
                </span>
                <span>{addon.offerId ? formatStorageBytes(addon.storageLimitBytes) : "—"}</span>
                <span className={styles.pricingMonoCell}>{addon.offerId ?? "Not configured"}</span>
                <span className={stripeStatus.className}>{stripeStatus.label}</span>
                <span>{addon.offerId ? formatDateTime(addon.effectiveStartAt) : "—"}</span>
                <span>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => {
                      if (isManualReview) return;
                      setStorageDraft(buildStorageOfferDraft(addon));
                      setStorageError(null);
                      setStorageMessage(null);
                    }}
                    disabled={isManualReview}
                  >
                    {isManualReview
                      ? "Manual review only"
                      : addon.offerId
                        ? "Create next"
                        : "Create first offer"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {storageMessage ? (
        <AppMessage
          className={styles.announcementResult}
          tone="success"
          mode="banner"
          message={storageMessage}
        />
      ) : null}
      {storageError ? (
        <AppMessage
          className={styles.announcementError}
          tone="error"
          mode="banner"
          message={storageError}
        />
      ) : null}

      {storageDraft ? (
        <div className={styles.pricingEditorCard}>
          <p className="eyebrow">Create next storage offer</p>
          <div className={styles.pricingFormGrid}>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Offer name</span>
              <input
                className={styles.searchInput}
                value={storageDraft.offerName}
                onChange={(event) =>
                  setStorageDraft((current) =>
                    current ? { ...current, offerName: event.target.value } : current
                  )
                }
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Storage bytes</span>
              <input
                className={styles.searchInput}
                value={storageDraft.storageLimitBytes}
                onChange={(event) =>
                  setStorageDraft((current) =>
                    current ? { ...current, storageLimitBytes: event.target.value } : current
                  )
                }
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Recurring price (cents)</span>
              <input
                className={styles.searchInput}
                value={storageDraft.recurringPriceCents}
                onChange={(event) =>
                  setStorageDraft((current) =>
                    current ? { ...current, recurringPriceCents: event.target.value } : current
                  )
                }
              />
            </label>
            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Stripe price id</span>
              <input
                className={styles.searchInput}
                value={storageDraft.stripePriceId}
                onChange={(event) =>
                  setStorageDraft((current) =>
                    current ? { ...current, stripePriceId: event.target.value } : current
                  )
                }
              />
            </label>
          </div>
          <p className="tiny subdued">
            This creates a new current public recurring storage offer for new buyers only.
          </p>
          <div className={styles.pricingEditorActions}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={onConfirmStorageOffer}
              disabled={storageSaving}
            >
              {storageSaving ? "Creating…" : "Create and activate"}
            </button>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => setStorageDraft(null)}
              disabled={storageSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
