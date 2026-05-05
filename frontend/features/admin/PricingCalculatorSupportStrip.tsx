/**
 * Compact support modules for the admin pricing calculator.
 * They read from the shared draft grid and help interpret plan economics,
 * usage mix, and weighted outcomes without becoming a second pricing editor.
 */
import React from "react";
import {
  buildUsageMixAnalysisRows,
  computePlanEconomicsSummary,
  type ModelEconomicsRow,
  type PlanEconomicsDraft,
  type UsageMixDraftRow,
} from "./pricingAnalysis";
import {
  formatCredits,
  formatFractionalCredits,
  formatPercent,
  formatProviderCostUsd,
} from "./pricingFormatting";
import type { AdminPricingModelRow, AdminPricingPlanRow } from "./types";
import type { ModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

type PricingCalculatorSupportStripProps = {
  plans: AdminPricingPlanRow[];
  selectedPlanId: string;
  setSelectedPlanId: React.Dispatch<React.SetStateAction<string>>;
  selectedPlanDraft: PlanEconomicsDraft | null | undefined;
  updatePlanDraft: (planId: string, field: keyof PlanEconomicsDraft, value: string) => void;
  usageMixRows: UsageMixDraftRow[];
  updateUsageMixRow: (rowId: string, patch: Partial<UsageMixDraftRow>) => void;
  addUsageMixRow: () => void;
  removeUsageMixRow: (rowId: string) => void;
  models: AdminPricingModelRow[];
  modelRows: ModelEconomicsRow[];
  pricingPolicy: ModelPricingPolicyDocument;
  isDraftDirty: boolean;
};

export function PricingCalculatorSupportStrip({
  plans,
  selectedPlanId,
  setSelectedPlanId,
  selectedPlanDraft,
  updatePlanDraft,
  usageMixRows,
  updateUsageMixRow,
  addUsageMixRow,
  removeUsageMixRow,
  models,
  modelRows,
  pricingPolicy,
  isDraftDirty,
}: PricingCalculatorSupportStripProps) {
  const selectedPlan = React.useMemo(
    () => plans.find((plan) => plan.planId === selectedPlanId) ?? plans[0] ?? null,
    [plans, selectedPlanId]
  );

  const planSummary = React.useMemo(
    () => computePlanEconomicsSummary(selectedPlanDraft),
    [selectedPlanDraft]
  );

  const usageRows = React.useMemo(
    () =>
      buildUsageMixAnalysisRows({
        rows: usageMixRows,
        models,
        pricingPolicy,
        planSummary,
      }),
    [models, planSummary, pricingPolicy, usageMixRows]
  );

  const totalMonthlyRuns = usageRows.reduce((sum, row) => sum + (row.runsPerMonth ?? 0), 0);
  const totalBilledCredits = usageRows.reduce(
    (sum, row) => sum + (row.billedCreditsPerRun ?? 0) * (row.runsPerMonth ?? 0),
    0
  );
  const totalMonthlyCost = usageRows.reduce(
    (sum, row) => sum + (row.providerCostPerMonthUsd ?? 0),
    0
  );
  const totalMonthlyRevenue = usageRows.reduce(
    (sum, row) => sum + (row.revenuePerMonthUsd ?? 0),
    0
  );
  const effectiveMonthlyRevenue =
    totalMonthlyRevenue > 0 ? totalMonthlyRevenue : (planSummary.netRevenueUsd ?? 0);
  const totalMonthlyProfit = usageRows.reduce((sum, row) => sum + (row.profitPerMonthUsd ?? 0), 0);
  const effectiveMonthlyProfit =
    usageRows.length > 0 && totalMonthlyRevenue > 0
      ? totalMonthlyProfit
      : effectiveMonthlyRevenue - totalMonthlyCost;
  const effectiveMarginPercent =
    effectiveMonthlyRevenue > 0 ? (effectiveMonthlyProfit / effectiveMonthlyRevenue) * 100 : null;

  return (
    <section className={`${styles.adminSection} ${styles.pricingCalculatorSupportStrip}`}>
      <div className={styles.adminSectionHead}>
        <div>
          <h2 className={styles.adminSectionTitle}>Plan Calculator</h2>
        </div>
        <span className={`${styles.pill} ${isDraftDirty ? styles.pillWarn : styles.pillOk}`}>
          {isDraftDirty ? "Using draft grid" : "Using live grid"}
        </span>
      </div>

      <div className={styles.pricingCalculatorSupportGrid}>
        <article className={styles.pricingSupportPanel}>
          <div className={styles.pricingSupportHeader}>
            <h3 className={styles.pricingSupportTitle}>Plan Economics</h3>
            <label className={styles.manualAdjustField}>
              <span className="sr-only">Plan</span>
              <select
                aria-label="Plan"
                className={`${styles.searchInput} ${styles.pricingSupportSelect}`}
                value={selectedPlan?.planId ?? ""}
                onChange={(event) => setSelectedPlanId(event.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.planId} value={plan.planId}>
                    {plan.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedPlan ? (
            <div className={styles.pricingSupportFormGrid}>
              <label className={styles.manualAdjustField}>
                <span className={styles.pricingSupportLabel}>Plan price ($)</span>
                <input
                  aria-label="Plan price ($)"
                  className={styles.searchInput}
                  value={selectedPlanDraft?.priceUsd ?? ""}
                  onChange={(event) =>
                    updatePlanDraft(selectedPlan.planId, "priceUsd", event.target.value)
                  }
                />
              </label>
              <label className={styles.manualAdjustField}>
                <span className={styles.pricingSupportLabel}>Included credits</span>
                <input
                  aria-label="Included credits"
                  className={styles.searchInput}
                  value={selectedPlanDraft?.includedCredits ?? ""}
                  onChange={(event) =>
                    updatePlanDraft(selectedPlan.planId, "includedCredits", event.target.value)
                  }
                />
              </label>
              <label className={styles.manualAdjustField}>
                <span className={styles.pricingSupportLabel}>Discount %</span>
                <input
                  aria-label="Discount %"
                  className={styles.searchInput}
                  value={selectedPlanDraft?.discountPct ?? ""}
                  onChange={(event) =>
                    updatePlanDraft(selectedPlan.planId, "discountPct", event.target.value)
                  }
                />
              </label>
              <label className={styles.manualAdjustField}>
                <span className={styles.pricingSupportLabel}>Affiliate %</span>
                <input
                  aria-label="Affiliate %"
                  className={styles.searchInput}
                  value={selectedPlanDraft?.affiliatePct ?? ""}
                  onChange={(event) =>
                    updatePlanDraft(selectedPlan.planId, "affiliatePct", event.target.value)
                  }
                />
              </label>
              <label className={styles.manualAdjustField}>
                <span className={styles.pricingSupportLabel}>Processor %</span>
                <input
                  aria-label="Processor %"
                  className={styles.searchInput}
                  value={selectedPlanDraft?.processorPct ?? ""}
                  onChange={(event) =>
                    updatePlanDraft(selectedPlan.planId, "processorPct", event.target.value)
                  }
                />
              </label>
              <label className={styles.manualAdjustField}>
                <span className={styles.pricingSupportLabel}>Processor flat ($)</span>
                <input
                  aria-label="Processor flat ($)"
                  className={styles.searchInput}
                  value={selectedPlanDraft?.processorFlatUsd ?? ""}
                  onChange={(event) =>
                    updatePlanDraft(selectedPlan.planId, "processorFlatUsd", event.target.value)
                  }
                />
              </label>
            </div>
          ) : null}

          <div className={styles.pricingSupportMetricGrid}>
            <div className={styles.pricingSupportMetric}>
              <span className={styles.pricingSupportMetricLabel}>Net revenue</span>
              <strong>{formatProviderCostUsd(planSummary.netRevenueUsd)}</strong>
            </div>
            <div className={styles.pricingSupportMetric}>
              <span className={styles.pricingSupportMetricLabel}>$ / credit</span>
              <strong>{formatProviderCostUsd(planSummary.dollarPerCredit)}</strong>
            </div>
            <div className={styles.pricingSupportMetric}>
              <span className={styles.pricingSupportMetricLabel}>Processor fee</span>
              <strong>{formatProviderCostUsd(planSummary.processorFeeUsd)}</strong>
            </div>
            <div className={styles.pricingSupportMetric}>
              <span className={styles.pricingSupportMetricLabel}>Included credits</span>
              <strong>
                {planSummary.includedCredits != null
                  ? formatCredits(Math.round(planSummary.includedCredits))
                  : "—"}
              </strong>
            </div>
          </div>
        </article>

        <article className={styles.pricingSupportPanel}>
          <div className={styles.pricingSupportHeader}>
            <h3 className={styles.pricingSupportTitle}>Usage Mix</h3>
            <button type="button" className="ghost-btn mini" onClick={addUsageMixRow}>
              Add row
            </button>
          </div>

          <div className={styles.pricingSupportMetricGrid}>
            <div className={styles.pricingSupportMetric}>
              <span className={styles.pricingSupportMetricLabel}>Runs / month</span>
              <strong>{formatFractionalCredits(totalMonthlyRuns)}</strong>
            </div>
            <div className={styles.pricingSupportMetric}>
              <span className={styles.pricingSupportMetricLabel}>Billed credits</span>
              <strong>{formatFractionalCredits(totalBilledCredits)}</strong>
            </div>
            <div className={styles.pricingSupportMetric}>
              <span className={styles.pricingSupportMetricLabel}>Provider cost</span>
              <strong>{formatProviderCostUsd(totalMonthlyCost)}</strong>
            </div>
          </div>

          <div className={styles.pricingUsageMixMiniHead}>
            <span>Type</span>
            <span>Share</span>
            <span>$ / run</span>
            <span>Rev / run</span>
            <span>Profit / run</span>
          </div>

          <div className={styles.pricingUsageMixList}>
            {usageMixRows.map((row) => {
              const analysisRow = usageRows.find((candidate) => candidate.id === row.id) ?? null;
              return (
                <div key={row.id} className={styles.pricingUsageMixCard}>
                  <div className={styles.pricingUsageMixInputs}>
                    <label className={styles.manualAdjustField}>
                      <span className={styles.pricingSupportLabel}>Model / spec</span>
                      <select
                        aria-label="Model / spec"
                        className={styles.searchInput}
                        value={`${row.modelId}:${row.variantId}`}
                        onChange={(event) => {
                          const [modelId, variantId = "default"] = event.target.value.split(":");
                          const selectedRow =
                            modelRows.find(
                              (candidate) =>
                                candidate.modelId === modelId && candidate.variantId === variantId
                            ) ?? null;
                          updateUsageMixRow(row.id, {
                            modelId,
                            variantId,
                            durationSeconds:
                              selectedRow?.durationSeconds != null
                                ? String(selectedRow.durationSeconds)
                                : "",
                          });
                        }}
                      >
                        {modelRows.map((modelRow) => (
                          <option
                            key={modelRow.key}
                            value={`${modelRow.modelId}:${modelRow.variantId}`}
                          >
                            {modelRow.modelLabel} · {modelRow.specLabel}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.manualAdjustField}>
                      <span className={styles.pricingSupportLabel}>Duration (s)</span>
                      <input
                        aria-label="Duration (s)"
                        className={styles.searchInput}
                        value={row.durationSeconds}
                        onChange={(event) =>
                          updateUsageMixRow(row.id, { durationSeconds: event.target.value })
                        }
                      />
                    </label>

                    <label className={styles.manualAdjustField}>
                      <span className={styles.pricingSupportLabel}>Runs / month</span>
                      <input
                        aria-label="Runs / month"
                        className={styles.searchInput}
                        value={row.runsPerMonth}
                        onChange={(event) =>
                          updateUsageMixRow(row.id, { runsPerMonth: event.target.value })
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => removeUsageMixRow(row.id)}
                      disabled={usageMixRows.length <= 1}
                    >
                      Remove
                    </button>
                  </div>

                  <div className={styles.pricingUsageMixMiniTable}>
                    <span>{analysisRow?.typeLabel ?? "—"}</span>
                    <span>
                      {analysisRow?.runSharePercent != null
                        ? formatPercent(analysisRow.runSharePercent)
                        : "—"}
                    </span>
                    <span>{formatProviderCostUsd(analysisRow?.providerCostPerRunUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow?.revenuePerRunUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow?.profitPerRunUsd)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className={styles.pricingSupportPanel}>
          <div className={styles.pricingSupportHeader}>
            <h3 className={styles.pricingSupportTitle}>Summary</h3>
          </div>

          <div className={styles.pricingSupportMetricStack}>
            <div className={styles.pricingSupportMetricRow}>
              <span>Plan</span>
              <strong>{selectedPlan?.displayName ?? "—"}</strong>
            </div>
            <div className={styles.pricingSupportMetricRow}>
              <span>Revenue / month</span>
              <strong>{formatProviderCostUsd(effectiveMonthlyRevenue)}</strong>
            </div>
            <div className={styles.pricingSupportMetricRow}>
              <span>Cost / month</span>
              <strong>{formatProviderCostUsd(totalMonthlyCost)}</strong>
            </div>
            <div className={styles.pricingSupportMetricRow}>
              <span>Profit / month</span>
              <strong>{formatProviderCostUsd(effectiveMonthlyProfit)}</strong>
            </div>
            <div className={styles.pricingSupportMetricRow}>
              <span>Margin</span>
              <strong>
                {effectiveMarginPercent != null ? formatPercent(effectiveMarginPercent) : "—"}
              </strong>
            </div>
          </div>

          {effectiveMarginPercent != null && effectiveMarginPercent < 0 ? (
            <p className={styles.pricingSupportWarning}>Projected margin is negative.</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}
