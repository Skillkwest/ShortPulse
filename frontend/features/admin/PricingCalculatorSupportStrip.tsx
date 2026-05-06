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
  const effectiveMonthlyProfit = effectiveMonthlyRevenue - totalMonthlyCost;
  const effectiveMarginPercent =
    effectiveMonthlyRevenue > 0 ? (effectiveMonthlyProfit / effectiveMonthlyRevenue) * 100 : null;

  return (
    <section className={`${styles.adminSection} ${styles.pricingCalculatorSupportStrip}`}>
      <div className={styles.adminSectionHead}>
        <div>
          <h2 className={styles.adminSectionTitle}>Plan Calculator</h2>
          <p className="tiny subdued">
            Pressure-test usage mix, plan revenue, and margin against the current pricing grid.
          </p>
        </div>
        <span className={`${styles.pill} ${isDraftDirty ? styles.pillWarn : styles.pillOk}`}>
          {isDraftDirty ? "Using draft grid" : "Using live grid"}
        </span>
      </div>

      <div className={styles.pricingCalculatorSupportGrid}>
        <article className={styles.pricingSupportPanel}>
          <div className={styles.pricingSupportHeader}>
            <div>
              <h3 className={styles.pricingSupportTitle}>Usage Mix</h3>
              <p className="tiny subdued">
                Model the runs you expect this plan to absorb each month.
              </p>
            </div>
            <button type="button" className="ghost-btn mini" onClick={addUsageMixRow}>
              Add row
            </button>
          </div>

          <div className={styles.adminTableScroller}>
            <div className={`${styles.adminTable} ${styles.pricingSupportTable}`}>
              <div className={`${styles.adminTableHead} ${styles.pricingSupportUsageTotalsHead}`}>
                <span>Runs / month</span>
                <span>Billed credits</span>
                <span>Provider cost / month</span>
              </div>
              <div className={`${styles.adminTableRow} ${styles.pricingSupportUsageTotalsRow}`}>
                <span>{formatFractionalCredits(totalMonthlyRuns)}</span>
                <span>{formatFractionalCredits(totalBilledCredits)}</span>
                <span>{formatProviderCostUsd(totalMonthlyCost)}</span>
              </div>
            </div>
          </div>

          <div className={styles.adminTableScroller}>
            <div className={`${styles.adminTable} ${styles.pricingSupportTable}`}>
              <div className={`${styles.adminTableHead} ${styles.pricingSupportUsageHead}`}>
                <span>Model / spec</span>
                <span>Type</span>
                <span>Duration (s)</span>
                <span>Runs / month</span>
                <span>Share</span>
                <span>Billed credits</span>
                <span>$ / run</span>
                <span>Rev / run</span>
                <span>Profit / run</span>
                <span>Cost / month</span>
                <span>Rev / month</span>
                <span>Profit / month</span>
                <span>Action</span>
              </div>
              {usageMixRows.map((row) => {
                const analysisRow = usageRows.find((candidate) => candidate.id === row.id) ?? null;
                return (
                  <div
                    key={row.id}
                    className={`${styles.adminTableRow} ${styles.pricingSupportUsageRow}`}
                  >
                    <span>
                      <select
                        aria-label="Model / spec"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
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
                    </span>
                    <span>{analysisRow?.typeLabel ?? "—"}</span>
                    <span>
                      <input
                        aria-label="Duration (s)"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={row.durationSeconds}
                        onChange={(event) =>
                          updateUsageMixRow(row.id, { durationSeconds: event.target.value })
                        }
                      />
                    </span>
                    <span>
                      <input
                        aria-label="Runs / month"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={row.runsPerMonth}
                        onChange={(event) =>
                          updateUsageMixRow(row.id, { runsPerMonth: event.target.value })
                        }
                      />
                    </span>
                    <span>
                      {analysisRow?.runSharePercent != null
                        ? formatPercent(analysisRow.runSharePercent)
                        : "—"}
                    </span>
                    <span>
                      {formatFractionalCredits(analysisRow?.billedCreditsPerRun ?? Number.NaN)}
                    </span>
                    <span>{formatProviderCostUsd(analysisRow?.providerCostPerRunUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow?.revenuePerRunUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow?.profitPerRunUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow?.providerCostPerMonthUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow?.revenuePerMonthUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow?.profitPerMonthUsd)}</span>
                    <span>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => removeUsageMixRow(row.id)}
                        disabled={usageMixRows.length <= 1}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article className={styles.pricingSupportPanel}>
          <div className={styles.pricingSupportHeader}>
            <div>
              <h3 className={styles.pricingSupportTitle}>Plan Inputs</h3>
              <p className="tiny subdued">
                Tune credits, discounts, and fees without mutating the live catalog rows below.
              </p>
            </div>
          </div>

          {selectedPlan ? (
            <>
              <div className={styles.adminTableScroller}>
                <div className={`${styles.adminTable} ${styles.pricingSupportTable}`}>
                  <div className={`${styles.adminTableHead} ${styles.pricingSupportPlanInputHead}`}>
                    <span>Plan</span>
                    <span>Price ($)</span>
                    <span>Included credits</span>
                    <span>Discount %</span>
                    <span>Affiliate %</span>
                    <span>Processor %</span>
                    <span>Processor flat ($)</span>
                  </div>
                  <div className={`${styles.adminTableRow} ${styles.pricingSupportPlanInputRow}`}>
                    <span>
                      <select
                        aria-label="Plan"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={selectedPlan.planId}
                        onChange={(event) => setSelectedPlanId(event.target.value)}
                      >
                        {plans.map((plan) => (
                          <option key={plan.planId} value={plan.planId}>
                            {plan.displayName}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span>
                      <input
                        aria-label="Plan price ($)"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={selectedPlanDraft?.priceUsd ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(selectedPlan.planId, "priceUsd", event.target.value)
                        }
                      />
                    </span>
                    <span>
                      <input
                        aria-label="Included credits"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={selectedPlanDraft?.includedCredits ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(
                            selectedPlan.planId,
                            "includedCredits",
                            event.target.value
                          )
                        }
                      />
                    </span>
                    <span>
                      <input
                        aria-label="Discount %"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={selectedPlanDraft?.discountPct ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(selectedPlan.planId, "discountPct", event.target.value)
                        }
                      />
                    </span>
                    <span>
                      <input
                        aria-label="Affiliate %"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={selectedPlanDraft?.affiliatePct ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(selectedPlan.planId, "affiliatePct", event.target.value)
                        }
                      />
                    </span>
                    <span>
                      <input
                        aria-label="Processor %"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={selectedPlanDraft?.processorPct ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(selectedPlan.planId, "processorPct", event.target.value)
                        }
                      />
                    </span>
                    <span>
                      <input
                        aria-label="Processor flat ($)"
                        className={`${styles.searchInput} ${styles.pricingSupportCellInput}`}
                        value={selectedPlanDraft?.processorFlatUsd ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(
                            selectedPlan.planId,
                            "processorFlatUsd",
                            event.target.value
                          )
                        }
                      />
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.adminTableScroller}>
                <div className={`${styles.adminTable} ${styles.pricingSupportTable}`}>
                  <div
                    className={`${styles.adminTableHead} ${styles.pricingSupportPlanOutputHead}`}
                  >
                    <span>Gross</span>
                    <span>Discount</span>
                    <span>Processor fee</span>
                    <span>Affiliate cost</span>
                    <span>Net revenue</span>
                    <span>$ / credit</span>
                    <span>Included credits</span>
                  </div>
                  <div className={`${styles.adminTableRow} ${styles.pricingSupportPlanOutputRow}`}>
                    <span>{formatProviderCostUsd(planSummary.grossUsd)}</span>
                    <span>{formatProviderCostUsd(planSummary.discountAmountUsd)}</span>
                    <span>{formatProviderCostUsd(planSummary.processorFeeUsd)}</span>
                    <span>{formatProviderCostUsd(planSummary.affiliateCostUsd)}</span>
                    <span>{formatProviderCostUsd(planSummary.netRevenueUsd)}</span>
                    <span>{formatProviderCostUsd(planSummary.dollarPerCredit)}</span>
                    <span>
                      {planSummary.includedCredits != null
                        ? formatCredits(Math.round(planSummary.includedCredits))
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </article>

        <article className={styles.pricingSupportPanel}>
          <div className={styles.pricingSupportHeader}>
            <div>
              <h3 className={styles.pricingSupportTitle}>Projected Margin</h3>
              <p className="tiny subdued">
                Compare estimated plan revenue against the modeled provider cost from your usage
                mix.
              </p>
            </div>
          </div>

          <div className={styles.adminTableScroller}>
            <div className={`${styles.adminTable} ${styles.pricingSupportTable}`}>
              <div className={`${styles.adminTableHead} ${styles.pricingSupportSummaryHead}`}>
                <span>Plan</span>
                <span>Revenue / month</span>
                <span>Cost / month</span>
                <span>Profit / month</span>
                <span>Margin</span>
              </div>
              <div className={`${styles.adminTableRow} ${styles.pricingSupportSummaryRow}`}>
                <span>{selectedPlan?.displayName ?? "—"}</span>
                <span>{formatProviderCostUsd(effectiveMonthlyRevenue)}</span>
                <span>{formatProviderCostUsd(totalMonthlyCost)}</span>
                <span>{formatProviderCostUsd(effectiveMonthlyProfit)}</span>
                <span>
                  {effectiveMarginPercent != null ? formatPercent(effectiveMarginPercent) : "—"}
                </span>
              </div>
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
