import React from "react";
import type {
  PlanEconomicsDraft,
  PlanEconomicsSummary,
  ModelEconomicsRow,
} from "./pricingAnalysis";
import { computePlanEconomicsSummary } from "./pricingAnalysis";
import {
  formatCredits,
  formatPercent,
  formatProviderCostUsd,
  formatUsd,
} from "./pricingFormatting";
import type { AdminPricingPlanRow } from "./types";
import styles from "../../styles/admin.module.css";

const renderPlanModelProjectionRows = (
  rows: ModelEconomicsRow[],
  summary: PlanEconomicsSummary
) => {
  const dollarPerCredit = summary.dollarPerCredit;
  return rows.map((row) => {
    const revenuePerRunUsd =
      row.billedCredits != null && dollarPerCredit != null
        ? row.billedCredits * dollarPerCredit
        : null;
    const profitPerRunUsd =
      revenuePerRunUsd != null && row.providerCostUsd != null
        ? revenuePerRunUsd - row.providerCostUsd
        : null;
    const marginPercent =
      revenuePerRunUsd != null && revenuePerRunUsd > 0 && profitPerRunUsd != null
        ? (profitPerRunUsd / revenuePerRunUsd) * 100
        : null;

    return (
      <div key={row.key} className={styles.pricingAnalysisRow}>
        <span className={styles.pricingPrimaryCell}>
          <strong>{row.modelLabel}</strong>
          <small>{row.specLabel}</small>
        </span>
        <span>{formatProviderCostUsd(row.providerCostUsd)}</span>
        <span>
          {row.billedCredits != null ? formatCredits(Math.round(row.billedCredits)) : "—"}
        </span>
        <span>{revenuePerRunUsd != null ? formatProviderCostUsd(revenuePerRunUsd) : "—"}</span>
        <span>
          {profitPerRunUsd != null && marginPercent != null
            ? `${formatProviderCostUsd(profitPerRunUsd)} · ${formatPercent(marginPercent)}`
            : "—"}
        </span>
      </div>
    );
  });
};

export function PricingPlanEconomicsSection({
  plans,
  draftsByPlanId,
  updateDraft,
  modelRows,
  isDraftDirty,
}: {
  plans: AdminPricingPlanRow[];
  draftsByPlanId: Record<string, PlanEconomicsDraft>;
  updateDraft: (planId: string, field: keyof PlanEconomicsDraft, value: string) => void;
  modelRows: ModelEconomicsRow[];
  isDraftDirty: boolean;
}) {
  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Analysis</p>
          <h2 className={styles.adminSectionTitle}>Plan Economics</h2>
          <p className="tiny subdued">
            Plan inputs stay local to this tab. Model costs and billed credits always come from the
            current pricing-grid draft.
          </p>
        </div>
        <span className={`${styles.pill} ${isDraftDirty ? styles.pillWarn : styles.pillOk}`}>
          {isDraftDirty ? "Grid draft is active" : "Live grid is active"}
        </span>
      </div>

      <div className={styles.pricingPlanSimulatorList}>
        {plans.map((plan) => {
          const draft = draftsByPlanId[plan.planId];
          const summary = computePlanEconomicsSummary(draft);
          const liveMonthlyPriceCents =
            plan.monthlyOffer?.recurringPriceCents ?? plan.recurringPriceCents;
          const liveMonthlyCredits =
            plan.monthlyOffer?.monthlyCreditsCents ?? plan.monthlyCreditsCents;
          return (
            <article key={plan.planId} className={styles.pricingPlanSimulatorCard}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Plan</p>
                  <h3 className={styles.adminSectionTitle}>{plan.displayName}</h3>
                  <p className="tiny subdued">
                    Live monthly price {formatUsd(liveMonthlyPriceCents / 100)} · live included
                    credits {formatCredits(liveMonthlyCredits)}
                  </p>
                </div>
              </div>

              <div className={styles.pricingFormGrid}>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Plan price ($)</span>
                  <input
                    className={styles.searchInput}
                    value={draft?.priceUsd ?? ""}
                    onChange={(event) => updateDraft(plan.planId, "priceUsd", event.target.value)}
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Included credits</span>
                  <input
                    className={styles.searchInput}
                    value={draft?.includedCredits ?? ""}
                    onChange={(event) =>
                      updateDraft(plan.planId, "includedCredits", event.target.value)
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Discount %</span>
                  <input
                    className={styles.searchInput}
                    value={draft?.discountPct ?? ""}
                    onChange={(event) =>
                      updateDraft(plan.planId, "discountPct", event.target.value)
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Affiliate %</span>
                  <input
                    className={styles.searchInput}
                    value={draft?.affiliatePct ?? ""}
                    onChange={(event) =>
                      updateDraft(plan.planId, "affiliatePct", event.target.value)
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Processor %</span>
                  <input
                    className={styles.searchInput}
                    value={draft?.processorPct ?? ""}
                    onChange={(event) =>
                      updateDraft(plan.planId, "processorPct", event.target.value)
                    }
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Processor flat ($)</span>
                  <input
                    className={styles.searchInput}
                    value={draft?.processorFlatUsd ?? ""}
                    onChange={(event) =>
                      updateDraft(plan.planId, "processorFlatUsd", event.target.value)
                    }
                  />
                </label>
              </div>

              <div className={styles.pricingPlanSummaryGrid}>
                <div className={styles.adminCard}>
                  <p className={styles.adminLabel}>Net revenue</p>
                  <p className={styles.adminMetric}>
                    {summary.netRevenueUsd != null
                      ? formatProviderCostUsd(summary.netRevenueUsd)
                      : "—"}
                  </p>
                  <p className={styles.adminSubtext}>
                    After discount, processor, and affiliate assumptions.
                  </p>
                </div>
                <div className={styles.adminCard}>
                  <p className={styles.adminLabel}>$ / credit</p>
                  <p className={styles.adminMetric}>
                    {summary.dollarPerCredit != null
                      ? formatProviderCostUsd(summary.dollarPerCredit)
                      : "—"}
                  </p>
                  <p className={styles.adminSubtext}>
                    Retained revenue divided by included credits.
                  </p>
                </div>
                <div className={styles.adminCard}>
                  <p className={styles.adminLabel}>Processor fee</p>
                  <p className={styles.adminMetric}>
                    {summary.processorFeeUsd != null
                      ? formatProviderCostUsd(summary.processorFeeUsd)
                      : "—"}
                  </p>
                  <p className={styles.adminSubtext}>
                    Variable plus flat fee on post-discount revenue.
                  </p>
                </div>
              </div>

              <div className={styles.adminTableScroller}>
                <div className={`${styles.adminTable} ${styles.pricingPlanProjectionTable}`}>
                  <div className={`${styles.pricingPlanProjectionHead} ${styles.adminTableHead}`}>
                    <span>Model</span>
                    <span>$ at cost</span>
                    <span>Billed credits</span>
                    <span>Revenue / run</span>
                    <span>Profit / run</span>
                  </div>
                  {renderPlanModelProjectionRows(modelRows, summary)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
