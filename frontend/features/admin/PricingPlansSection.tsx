import React from "react";
import { AppMessage } from "../../components/AppMessage";
import { formatStorageBytes } from "../billing/storage";
import { getPlanStatusClassName, getPlanStatusLabel } from "./PricingPageChrome";
import type { AdminPricingStateResponse } from "./types";
import {
  buildEmptyPlanCreateDraft,
  formatCredits,
  formatCurrencyFromCents,
  type PlanCreateDraft,
  type PlanOfferDraft,
} from "./pricingPageUtils";
import styles from "../../styles/admin.module.css";

type PricingPlansSectionProps = {
  pricingState: AdminPricingStateResponse | null;
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
};

export function PricingPlansSection({
  pricingState,
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
}: PricingPlansSectionProps) {
  return (
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
            <span>Max active</span>
          </div>
          {pricingState.plans.map((plan) => (
            <div key={plan.offerId} className={styles.pricingPlanCatalogRow}>
              <span className={styles.pricingPrimaryCell}>
                <strong>{plan.displayName}</strong>
              </span>
              <span>{formatCredits(plan.accountCount)}</span>
              <span className={getPlanStatusClassName(plan.status)}>
                {getPlanStatusLabel(plan.status)}
              </span>
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
              <span>{plan.maxConcurrentGenerations}</span>
            </div>
          ))}
        </div>
      ) : null}

      {planMessage ? (
        <AppMessage
          className={styles.announcementResult}
          tone="success"
          mode="banner"
          message={planMessage}
        />
      ) : null}
      {planError ? (
        <AppMessage
          className={styles.announcementError}
          tone="error"
          mode="banner"
          message={planError}
        />
      ) : null}

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
                    const parsedMonthly = Number(event.target.value);
                    return {
                      ...current,
                      recurringPriceCents: event.target.value,
                      annualRecurringPriceCents:
                        current.annualRecurringPriceCents.trim() === "" &&
                        Number.isFinite(parsedMonthly)
                          ? String(Math.max(0, Math.trunc(parsedMonthly)) * 12)
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
              <span className="tiny subdued">Max active generations</span>
              <input
                className={styles.searchInput}
                value={planDraft.maxConcurrentGenerations}
                onChange={(event) =>
                  setPlanDraft((current) =>
                    current ? { ...current, maxConcurrentGenerations: event.target.value } : current
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
            This creates the ShortPulse plan row, first monthly and annual public offers, and the
            Stripe product plus recurring prices.
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
              <span className="tiny subdued">Max active generations</span>
              <input
                className={styles.searchInput}
                value={planOfferDraft.maxConcurrentGenerations}
                onChange={(event) =>
                  setPlanOfferDraft((current) =>
                    current ? { ...current, maxConcurrentGenerations: event.target.value } : current
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
  );
}
