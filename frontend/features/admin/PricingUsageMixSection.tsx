import React from "react";
import {
  buildUsageMixAnalysisRows,
  computePlanEconomicsSummary,
  type ModelEconomicsRow,
  type PlanEconomicsDraft,
  type UsageMixDraftRow,
} from "./pricingAnalysis";
import { formatCredits, formatPercent, formatProviderCostUsd } from "./pricingFormatting";
import type { AdminPricingModelRow, AdminPricingPlanRow } from "./types";
import type { AdminPricingCustomRowsDocument } from "../../lib/model-runtime/adminPricingCustomRows";
import type { ModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

export function PricingUsageMixSection({
  plans,
  selectedPlanId,
  setSelectedPlanId,
  selectedPlanDraft,
  usageMixRows,
  updateUsageMixRow,
  addUsageMixRow,
  removeUsageMixRow,
  models,
  modelRows,
  pricingPolicy,
  customRowsDocument,
  isDraftDirty,
}: {
  plans: AdminPricingPlanRow[];
  selectedPlanId: string;
  setSelectedPlanId: React.Dispatch<React.SetStateAction<string>>;
  selectedPlanDraft: PlanEconomicsDraft | null | undefined;
  usageMixRows: UsageMixDraftRow[];
  updateUsageMixRow: (rowId: string, patch: Partial<UsageMixDraftRow>) => void;
  addUsageMixRow: () => void;
  removeUsageMixRow: (rowId: string) => void;
  models: AdminPricingModelRow[];
  modelRows: ModelEconomicsRow[];
  pricingPolicy: ModelPricingPolicyDocument;
  customRowsDocument: AdminPricingCustomRowsDocument;
  isDraftDirty: boolean;
}) {
  const selectedPlan = plans.find((plan) => plan.planId === selectedPlanId) ?? null;
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
        customRowsDocument,
      }),
    [customRowsDocument, models, planSummary, pricingPolicy, usageMixRows]
  );

  const totalMonthlyCost = usageRows.reduce(
    (sum, row) => sum + (row.providerCostPerMonthUsd ?? 0),
    0
  );
  const totalMonthlyProfit = usageRows.reduce((sum, row) => sum + (row.profitPerMonthUsd ?? 0), 0);
  const totalMonthlyRuns = usageRows.reduce((sum, row) => sum + (row.runsPerMonth ?? 0), 0);

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Analysis</p>
          <h2 className={styles.adminSectionTitle}>Usage Mix</h2>
          <p className="tiny subdued">
            Forecast plan fulfillment cost from the same pricing-grid draft with local volume
            assumptions only.
          </p>
        </div>
        <span className={`${styles.pill} ${isDraftDirty ? styles.pillWarn : styles.pillOk}`}>
          {isDraftDirty ? "Using draft grid" : "Using live grid"}
        </span>
      </div>

      <div className={styles.pricingUsageToolbar}>
        <label className={styles.manualAdjustField}>
          <span className="tiny subdued">Plan</span>
          <select
            className={styles.searchInput}
            value={selectedPlanId}
            onChange={(event) => setSelectedPlanId(event.target.value)}
          >
            {plans.map((plan) => (
              <option key={plan.planId} value={plan.planId}>
                {plan.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.pricingUsageToolbarActions}>
          <button type="button" className="ghost-btn mini" onClick={addUsageMixRow}>
            Add usage row
          </button>
        </div>
      </div>

      {selectedPlan ? (
        <p className="tiny subdued">
          Using plan assumptions from <strong>{selectedPlan.displayName}</strong>. Price, credits,
          and fee assumptions come from the Plan Economics tab; model costs and billed credits come
          from the Pricing Grid draft.
        </p>
      ) : null}

      <div className={styles.pricingOverviewGrid}>
        <div className={styles.adminCard}>
          <p className={styles.adminLabel}>Monthly runs</p>
          <p className={styles.adminMetric}>{formatCredits(Math.round(totalMonthlyRuns))}</p>
          <p className={styles.adminSubtext}>Total assumed monthly generations across all rows.</p>
        </div>
        <div className={styles.adminCard}>
          <p className={styles.adminLabel}>Provider cost / month</p>
          <p className={styles.adminMetric}>{formatProviderCostUsd(totalMonthlyCost)}</p>
          <p className={styles.adminSubtext}>Projected raw fulfillment cost at provider rates.</p>
        </div>
        <div className={styles.adminCard}>
          <p className={styles.adminLabel}>Profit / month</p>
          <p className={styles.adminMetric}>{formatProviderCostUsd(totalMonthlyProfit)}</p>
          <p className={styles.adminSubtext}>
            Revenue implied by the selected plan assumptions minus provider cost.
          </p>
        </div>
      </div>

      <div className={styles.pricingUsageMixList}>
        {usageMixRows.map((row) => (
          <div key={row.id} className={styles.pricingUsageMixCard}>
            <div className={styles.pricingUsageMixInputs}>
              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">Model / spec</span>
                <select
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
                    <option key={modelRow.key} value={`${modelRow.modelId}:${modelRow.variantId}`}>
                      {modelRow.modelLabel} · {modelRow.specLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">Duration (s)</span>
                <input
                  className={styles.searchInput}
                  value={row.durationSeconds}
                  onChange={(event) =>
                    updateUsageMixRow(row.id, { durationSeconds: event.target.value })
                  }
                />
              </label>

              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">Runs / month</span>
                <input
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
                Remove row
              </button>
            </div>

            {(() => {
              const analysisRow = usageRows.find((candidate) => candidate.id === row.id);
              return analysisRow ? (
                <div className={`${styles.adminTable} ${styles.pricingUsageMixResultTable}`}>
                  <div className={`${styles.pricingUsageMixResultHead} ${styles.adminTableHead}`}>
                    <span>Type</span>
                    <span>Share</span>
                    <span>$ / run</span>
                    <span>Revenue / run</span>
                    <span>Profit / run</span>
                    <span>$ / month</span>
                    <span>Revenue / month</span>
                    <span>Profit / month</span>
                  </div>
                  <div className={styles.pricingUsageMixResultRow}>
                    <span>{analysisRow.typeLabel}</span>
                    <span>
                      {analysisRow.runSharePercent != null
                        ? formatPercent(analysisRow.runSharePercent)
                        : "—"}
                    </span>
                    <span>{formatProviderCostUsd(analysisRow.providerCostPerRunUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow.revenuePerRunUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow.profitPerRunUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow.providerCostPerMonthUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow.revenuePerMonthUsd)}</span>
                    <span>{formatProviderCostUsd(analysisRow.profitPerMonthUsd)}</span>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        ))}
      </div>

      <p className="tiny subdued">
        Usage Mix is analysis-only. Changing volume assumptions here never changes live runtime
        pricing.
      </p>
    </section>
  );
}
