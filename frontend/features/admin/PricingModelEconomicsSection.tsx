import React from "react";
import type { ModelEconomicsRow } from "./pricingAnalysis";
import { formatFractionalCredits, formatPercent, formatProviderCostUsd } from "./pricingFormatting";
import styles from "../../styles/admin.module.css";

export function PricingModelEconomicsSection({
  rows,
  isDraftDirty,
}: {
  rows: ModelEconomicsRow[];
  isDraftDirty: boolean;
}) {
  const totalBilledCredits = rows.reduce((sum, row) => sum + (row.billedCredits ?? 0), 0);
  const averageMargin =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + (row.marginPercent ?? 0), 0) / rows.length
      : null;

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Analysis</p>
          <h2 className={styles.adminSectionTitle}>Model Economics</h2>
          <p className="tiny subdued">
            Read-only projection from the current pricing-grid draft. Nothing on this tab can go
            live directly.
          </p>
        </div>
        <span className={`${styles.pill} ${isDraftDirty ? styles.pillWarn : styles.pillOk}`}>
          {isDraftDirty ? "Using draft grid" : "Using live grid"}
        </span>
      </div>

      <div className={styles.pricingOverviewGrid}>
        <div className={styles.adminCard}>
          <p className={styles.adminLabel}>Projected rows</p>
          <p className={styles.adminMetric}>{rows.length}</p>
          <p className={styles.adminSubtext}>
            Each model/spec projection is derived from the draft grid.
          </p>
        </div>
        <div className={styles.adminCard}>
          <p className={styles.adminLabel}>Billed credits</p>
          <p className={styles.adminMetric}>{formatFractionalCredits(totalBilledCredits)}</p>
          <p className={styles.adminSubtext}>
            Sum of per-run billed credits across current projections.
          </p>
        </div>
        <div className={styles.adminCard}>
          <p className={styles.adminLabel}>Avg margin</p>
          <p className={styles.adminMetric}>
            {averageMargin != null ? formatPercent(averageMargin) : "—"}
          </p>
          <p className={styles.adminSubtext}>
            Average per-row gross margin at the current draft prices.
          </p>
        </div>
      </div>

      <div className={styles.adminTableScroller}>
        <div className={`${styles.adminTable} ${styles.pricingAnalysisTable}`}>
          <div className={`${styles.pricingAnalysisHead} ${styles.adminTableHead}`}>
            <span>Provider</span>
            <span>Model</span>
            <span>Type</span>
            <span>Spec</span>
            <span>Dur</span>
            <span>$ at cost</span>
            <span>$ / sec</span>
            <span>Credits at cost</span>
            <span>Markup</span>
            <span>Round</span>
            <span>Billed credits</span>
            <span>$ billed</span>
            <span>Margin</span>
          </div>
          {rows.map((row) => (
            <div key={row.key} className={styles.pricingAnalysisRow}>
              <span className={styles.pricingProviderLabel}>{row.provider}</span>
              <span className={styles.pricingPrimaryCell}>
                <strong>{row.modelLabel}</strong>
              </span>
              <span>{row.typeLabel}</span>
              <span>{row.specLabel}</span>
              <span>{row.durationSeconds != null ? row.durationSeconds : "—"}</span>
              <span>{formatProviderCostUsd(row.providerCostUsd)}</span>
              <span>{formatProviderCostUsd(row.costPerSecondUsd)}</span>
              <span>{formatFractionalCredits(row.creditsAtCost ?? Number.NaN)}</span>
              <span>{row.markupBps != null ? formatPercent(row.markupBps / 100) : "—"}</span>
              <span>
                {row.roundingIncrement != null
                  ? formatFractionalCredits(row.roundingIncrement)
                  : "—"}
              </span>
              <span>{formatFractionalCredits(row.billedCredits ?? Number.NaN)}</span>
              <span>{formatProviderCostUsd(row.billedUsd)}</span>
              <span>
                {row.marginPercent != null
                  ? `${formatProviderCostUsd(row.marginUsd)} · ${formatPercent(row.marginPercent)}`
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
