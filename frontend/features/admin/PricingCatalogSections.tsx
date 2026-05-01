/**
 * Catalog-management sections for the admin pricing workspace.
 */
import React from "react";
import { formatStorageBytes } from "../billing/storage";
import { getPlanStatusClassName, getStripeStatus } from "./PricingPageChrome";
import type { AdminPricingStateResponse } from "./types";
import {
  buildCreditPackageDraft,
  buildEmptyPlanCreateDraft,
  buildPlanOfferDraft,
  buildStorageOfferDraft,
  formatCredits,
  formatCurrencyFromCents,
  formatDateTime,
  formatUsd,
  parseIntegerInput,
  type CreditPackageDraft,
  type PlanCreateDraft,
  type PlanOfferDraft,
  type StorageOfferDraft,
} from "./pricingPageUtils";
import styles from "../../styles/admin.module.css";

type PricingCatalogSectionsProps = {
  pricingState: AdminPricingStateResponse | null;
  showPlansSection: boolean;
  showCreditsSection: boolean;
  showMediaAddonsSection: boolean;
  planDraft: PlanCreateDraft | null;
  setPlanDraft: React.Dispatch<React.SetStateAction<PlanCreateDraft | null>>;
  planOfferDraft: PlanOfferDraft | null;
  setPlanOfferDraft: React.Dispatch<React.SetStateAction<PlanOfferDraft | null>>;
  planSaving: boolean;
  planMessage: string | null;
  planError: string | null;
  setPlanMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setPlanError: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmPlanCreate: () => void;
  onConfirmPlanOffer: () => void;
  creditDraft: CreditPackageDraft | null;
  setCreditDraft: React.Dispatch<React.SetStateAction<CreditPackageDraft | null>>;
  creditSaving: boolean;
  creditMessage: string | null;
  creditError: string | null;
  setCreditMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setCreditError: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmCreditPackage: () => void;
  storageDraft: StorageOfferDraft | null;
  setStorageDraft: React.Dispatch<React.SetStateAction<StorageOfferDraft | null>>;
  storageSaving: boolean;
  storageMessage: string | null;
  storageError: string | null;
  setStorageMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setStorageError: React.Dispatch<React.SetStateAction<string | null>>;
  onConfirmStorageOffer: () => void;
};

export function PricingCatalogSections({
  pricingState,
  showPlansSection,
  showCreditsSection,
  showMediaAddonsSection,
  planDraft,
  setPlanDraft,
  planOfferDraft,
  setPlanOfferDraft,
  planSaving,
  planMessage,
  planError,
  setPlanMessage,
  setPlanError,
  onConfirmPlanCreate,
  onConfirmPlanOffer,
  creditDraft,
  setCreditDraft,
  creditSaving,
  creditMessage,
  creditError,
  setCreditMessage,
  setCreditError,
  onConfirmCreditPackage,
  storageDraft,
  setStorageDraft,
  storageSaving,
  storageMessage,
  storageError,
  setStorageMessage,
  setStorageError,
  onConfirmStorageOffer,
}: PricingCatalogSectionsProps) {
  return (
    <>
      {showPlansSection ? (
        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <p className="eyebrow">Subscriptions</p>
              <h2 className={styles.adminSectionTitle}>Public plans</h2>
            </div>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => {
                const nextSortOrder =
                  (pricingState?.plans.reduce(
                    (maxOrder, row) => Math.max(maxOrder, row.sortOrder),
                    0
                  ) ?? 0) + 10;
                setPlanDraft(buildEmptyPlanCreateDraft(nextSortOrder));
                setPlanOfferDraft(null);
                setPlanError(null);
                setPlanMessage(null);
              }}
            >
              Create new plan
            </button>
          </div>

          {pricingState ? (
            <div className={styles.adminTable}>
              <div className={`${styles.pricingPlanCatalogHead} ${styles.adminTableHead}`}>
                <span>Plan</span>
                <span>Accounts</span>
                <span>Status</span>
                <span>Monthly</span>
                <span>Annual</span>
                <span>Credits</span>
                <span>Storage</span>
                <span>Monthly Stripe</span>
                <span>Annual Stripe</span>
                <span>Action</span>
              </div>
              {pricingState.plans.map((plan) => {
                const monthlyStripeStatus = getStripeStatus({
                  priceCents: plan.monthlyOffer?.recurringPriceCents ?? plan.recurringPriceCents,
                  stripePriceId: plan.monthlyOffer?.stripePriceId ?? null,
                  isActive: Boolean(plan.monthlyOffer?.isActive ?? plan.isActive),
                });
                const annualStripeStatus = plan.annualOffer
                  ? getStripeStatus({
                      priceCents: plan.annualOffer.recurringPriceCents,
                      stripePriceId: plan.annualOffer.stripePriceId,
                      isActive: plan.annualOffer.isActive,
                    })
                  : { label: "Not configured", className: styles.pillInfo, isMono: false };
                return (
                  <div key={plan.offerId} className={styles.pricingPlanCatalogRow}>
                    <span className={styles.pricingPrimaryCell}>
                      <strong>{plan.displayName}</strong>
                    </span>
                    <span>{formatCredits(plan.accountCount)}</span>
                    <span className={getPlanStatusClassName(plan.status)}>{plan.status}</span>
                    <span>
                      {formatCurrencyFromCents(
                        plan.monthlyOffer?.recurringPriceCents ?? plan.recurringPriceCents
                      )}
                    </span>
                    <span>
                      {plan.annualOffer
                        ? formatCurrencyFromCents(plan.annualOffer.recurringPriceCents)
                        : "—"}
                    </span>
                    <span>{formatCredits(plan.monthlyCreditsCents)}</span>
                    <span>{formatStorageBytes(plan.storageLimitBytes)}</span>
                    <span className={monthlyStripeStatus.className}>
                      {monthlyStripeStatus.label}
                    </span>
                    <span className={annualStripeStatus.className}>{annualStripeStatus.label}</span>
                    <span className={styles.pricingEditorActions}>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => {
                          setPlanOfferDraft(buildPlanOfferDraft(plan, "month"));
                          setPlanDraft(null);
                          setPlanError(null);
                          setPlanMessage(null);
                        }}
                      >
                        {plan.monthlyOffer ? "Edit monthly" : "Create monthly"}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => {
                          setPlanOfferDraft(buildPlanOfferDraft(plan, "year"));
                          setPlanDraft(null);
                          setPlanError(null);
                          setPlanMessage(null);
                        }}
                      >
                        {plan.annualOffer ? "Edit annual" : "Create annual"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {planMessage ? <p className={styles.announcementResult}>{planMessage}</p> : null}
          {planError ? <p className={styles.announcementError}>{planError}</p> : null}

          {planDraft ? (
            <div className={styles.pricingEditorCard}>
              <p className="eyebrow">Create new plan</p>
              <div className={styles.pricingFormGrid}>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Plan id</span>
                  <input
                    className={styles.searchInput}
                    value={planDraft.planId}
                    onChange={(event) =>
                      setPlanDraft((current) =>
                        current ? { ...current, planId: event.target.value } : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Display name</span>
                  <input
                    className={styles.searchInput}
                    value={planDraft.displayName}
                    onChange={(event) =>
                      setPlanDraft((current) =>
                        current ? { ...current, displayName: event.target.value } : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Recurring price (cents)</span>
                  <input
                    className={styles.searchInput}
                    value={planDraft.recurringPriceCents}
                    onChange={(event) =>
                      setPlanDraft((current) => {
                        if (!current) return current;
                        const parsedMonthly = parseIntegerInput(event.target.value);
                        return {
                          ...current,
                          recurringPriceCents: event.target.value,
                          annualRecurringPriceCents:
                            current.annualRecurringPriceCents.trim() === "" && parsedMonthly != null
                              ? String(Math.max(0, parsedMonthly) * 12)
                              : current.annualRecurringPriceCents,
                        };
                      })
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Annual price (cents)</span>
                  <input
                    className={styles.searchInput}
                    value={planDraft.annualRecurringPriceCents}
                    onChange={(event) =>
                      setPlanDraft((current) =>
                        current
                          ? { ...current, annualRecurringPriceCents: event.target.value }
                          : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Monthly credits</span>
                  <input
                    className={styles.searchInput}
                    value={planDraft.monthlyCreditsCents}
                    onChange={(event) =>
                      setPlanDraft((current) =>
                        current ? { ...current, monthlyCreditsCents: event.target.value } : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Storage bytes</span>
                  <input
                    className={styles.searchInput}
                    value={planDraft.storageLimitBytes}
                    onChange={(event) =>
                      setPlanDraft((current) =>
                        current ? { ...current, storageLimitBytes: event.target.value } : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Sort order</span>
                  <input
                    className={styles.searchInput}
                    value={planDraft.sortOrder}
                    onChange={(event) =>
                      setPlanDraft((current) =>
                        current ? { ...current, sortOrder: event.target.value } : current
                      )
                    }
                  />
                </label>
              </div>
              <p className="tiny subdued">
                This creates the ShortPulse plan row, first monthly and annual public offers, and
                the Stripe product plus recurring prices.
              </p>
              <p className="tiny subdued">
                Stripe product preview:{" "}
                <strong>
                  {planDraft.displayName.trim()
                    ? `Plan - ${planDraft.displayName.trim()}`
                    : "Plan - <DisplayName>"}
                </strong>
              </p>
              <div className={styles.pricingEditorActions}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={onConfirmPlanCreate}
                  disabled={planSaving}
                >
                  {planSaving ? "Creating…" : "Create plan"}
                </button>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => setPlanDraft(null)}
                  disabled={planSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {planOfferDraft ? (
            <div className={styles.pricingEditorCard}>
              <p className="eyebrow">Edit plan pricing</p>
              <h3 className={styles.adminSectionTitle}>{planOfferDraft.displayName}</h3>
              <div className={styles.pricingFormGrid}>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Billing interval</span>
                  <input
                    className={styles.searchInput}
                    value={planOfferDraft.billingInterval === "year" ? "Annual" : "Monthly"}
                    disabled
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Offer name</span>
                  <input
                    className={styles.searchInput}
                    value={planOfferDraft.offerName}
                    onChange={(event) =>
                      setPlanOfferDraft((current) =>
                        current ? { ...current, offerName: event.target.value } : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Recurring price (cents)</span>
                  <input
                    className={styles.searchInput}
                    value={planOfferDraft.recurringPriceCents}
                    onChange={(event) =>
                      setPlanOfferDraft((current) =>
                        current ? { ...current, recurringPriceCents: event.target.value } : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Monthly credits</span>
                  <input
                    className={styles.searchInput}
                    value={planOfferDraft.monthlyCreditsCents}
                    onChange={(event) =>
                      setPlanOfferDraft((current) =>
                        current ? { ...current, monthlyCreditsCents: event.target.value } : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Storage bytes</span>
                  <input
                    className={styles.searchInput}
                    value={planOfferDraft.storageLimitBytes}
                    onChange={(event) =>
                      setPlanOfferDraft((current) =>
                        current ? { ...current, storageLimitBytes: event.target.value } : current
                      )
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Stripe price id</span>
                  <input
                    className={styles.searchInput}
                    value={planOfferDraft.stripePriceId}
                    onChange={(event) =>
                      setPlanOfferDraft((current) =>
                        current ? { ...current, stripePriceId: event.target.value } : current
                      )
                    }
                  />
                </label>
              </div>
              <p className="tiny subdued">
                Saving creates and activates a new current public offer for new buyers. Existing
                subscriber contracts keep their locked pricing.
              </p>
              <div className={styles.pricingEditorActions}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={onConfirmPlanOffer}
                  disabled={planSaving}
                >
                  {planSaving ? "Saving…" : "Save pricing"}
                </button>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => setPlanOfferDraft(null)}
                  disabled={planSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showCreditsSection ? (
        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <p className="eyebrow">Credit top-ups</p>
              <h2 className={styles.adminSectionTitle}>Active credit packages</h2>
              <p className="tiny subdued">Direct package rows currently exposed to checkout.</p>
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

          {creditMessage ? <p className={styles.announcementResult}>{creditMessage}</p> : null}
          {creditError ? <p className={styles.announcementError}>{creditError}</p> : null}

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
      ) : null}

      {showMediaAddonsSection ? (
        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <p className="eyebrow">Storage add-ons</p>
              <h2 className={styles.adminSectionTitle}>Active public storage offers</h2>
              <p className="tiny subdued">
                Current recurring storage acquisition rows and linked Stripe identifiers.
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
                const stripeStatus = getStripeStatus({
                  priceCents: addon.recurringPriceCents,
                  stripePriceId: addon.stripePriceId,
                  isActive: addon.isActive,
                });
                return (
                  <div key={addon.offerId} className={styles.pricingCatalogRow}>
                    <span className={styles.pricingPrimaryCell}>
                      <strong>{addon.displayName}</strong>
                    </span>
                    <span>{formatCurrencyFromCents(addon.recurringPriceCents)}</span>
                    <span>{formatStorageBytes(addon.storageLimitBytes)}</span>
                    <span className={styles.pricingMonoCell}>{addon.offerId}</span>
                    <span className={stripeStatus.className}>{stripeStatus.label}</span>
                    <span>{formatDateTime(addon.effectiveStartAt)}</span>
                    <span>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => {
                          setStorageDraft(buildStorageOfferDraft(addon));
                          setStorageError(null);
                          setStorageMessage(null);
                        }}
                      >
                        Create next
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {storageMessage ? <p className={styles.announcementResult}>{storageMessage}</p> : null}
          {storageError ? <p className={styles.announcementError}>{storageError}</p> : null}

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
      ) : null}
    </>
  );
}
