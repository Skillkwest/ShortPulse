/**
 * Admin storage-economics panel for the stats workspace.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import styles from "../../../styles/admin.module.css";
import type { AdminStorageEconomicsResponse } from "../types";

type AdminStorageEconomicsPanelProps = {
  storageEconomics: AdminStorageEconomicsResponse;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

const BYTES_PER_GB = 1024 * 1024 * 1024;
const TABLE_WIDE_STYLE: React.CSSProperties = {
  minWidth: 1150,
};
const RISK_TABLE_STYLE: React.CSSProperties = {
  minWidth: 1100,
};

const formatCount = (value: number): string => value.toLocaleString();
const formatMoney = (cents: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
const formatUnitUsd = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
const formatPct = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
  const gb = bytes / BYTES_PER_GB;
  if (gb < 1) return `${(gb * 1024).toFixed(1)} MB`;
  if (gb < 10) return `${gb.toFixed(2)} GB`;
  return `${gb.toFixed(1)} GB`;
};
const formatCountWindowMeta = (value: { total: number; last24h: number; last7d: number }) =>
  `All ${formatCount(value.total)} • 24h ${formatCount(value.last24h)} • 7d ${formatCount(value.last7d)}`;

const MetricCard = ({ label, value, meta }: { label: string; value: string; meta: string }) => (
  <article className={styles.adminCard}>
    <div className={styles.adminCardTop}>
      <span className={styles.adminLabel}>{label}</span>
    </div>
    <p className={styles.adminMetric}>{value}</p>
    <p className={styles.adminSubtext}>{meta}</p>
  </article>
);

const TableShell = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.adminTableShell}>
    <div className={styles.adminTableScroller}>{children}</div>
  </div>
);

const EmptyTableRow = ({ message }: { message: string }) => (
  <div
    className={`${styles.adminTableRow} ${styles.adminTableEmptyRow}`}
    style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
  >
    <span>{message}</span>
  </div>
);

export const AdminStorageEconomicsPanel = ({
  storageEconomics,
  loading,
  error,
  onRefresh,
}: AdminStorageEconomicsPanelProps) => {
  const { overview, byPlan, addonPackages, funnel, riskQueue, dataGaps, assumptions } =
    storageEconomics;

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Storage economics</p>
            <h2 className={styles.adminSectionTitle}>Capacity and margin snapshot</h2>
            <p className="tiny subdued">
              Product-tracked media storage, recurring add-on MRR, estimated infrastructure cost,
              and capacity risk.
            </p>
          </div>
          <button type="button" className="ghost-btn mini" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {error ? (
          <AppMessage
            className={styles.adminWarningPanel}
            tone="warning"
            mode="banner"
            title="Storage economics are unavailable."
            role="status"
          >
            <p className={styles.adminWarningDescription}>{error}</p>
          </AppMessage>
        ) : null}
        <div className={styles.adminGrid}>
          <MetricCard
            label="Tracked Storage"
            value={formatBytes(overview.totalTrackedBytes)}
            meta={`${formatCount(overview.accountsWithMedia)} media accounts of ${formatCount(overview.trackedAccounts)} tracked`}
          />
          <MetricCard
            label="P90 Account Usage"
            value={formatBytes(overview.p90TrackedBytes)}
            meta={`Median ${formatBytes(overview.medianTrackedBytes)}`}
          />
          <MetricCard
            label="Near/Over Quota"
            value={formatCount(overview.accountsOver80Pct)}
            meta={`${formatCount(overview.accountsOverQuota)} over quota • ${formatCount(overview.baselineStorageUsers)} baseline users`}
          />
          <MetricCard
            label="Add-on MRR"
            value={formatMoney(overview.activeAddonMrrCents)}
            meta={`${formatCount(overview.activeAddonSubscribers)} subscribers • ${formatBytes(overview.activeAddonSoldCapacityBytes)} sold`}
          />
          <MetricCard
            label="Estimated Cost 1x"
            value={formatMoney(overview.estimatedVariableCost1xCents)}
            meta={`Margin ${formatPct(overview.estimatedGrossMargin1xPct)} • storage ${formatMoney(overview.estimatedStorageCostCents)}`}
          />
          <MetricCard
            label="Estimated Cost 2x"
            value={formatMoney(overview.estimatedVariableCost2xCents)}
            meta={`Margin ${formatPct(overview.estimatedGrossMargin2xPct)} • egress ${formatMoney(overview.estimatedEgressCost2xCents)}`}
          />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Plans</p>
            <h2 className={styles.adminSectionTitle}>Storage by plan</h2>
            <p className="tiny subdued">
              Catalog plan entitlements plus usage distribution by active billing contract or
              profile plan.
            </p>
          </div>
        </div>
        <TableShell>
          <div className={styles.adminTable} style={TABLE_WIDE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{
                gridTemplateColumns:
                  "minmax(0, 1.2fr) 0.6fr 0.7fr 0.8fr 0.8fr 0.8fr 0.8fr 0.7fr 0.7fr 0.7fr 0.7fr",
              }}
            >
              <span>Plan</span>
              <span>Accounts</span>
              <span>With Media</span>
              <span>Plan Limit</span>
              <span>Tracked</span>
              <span>P90</span>
              <span>Total Limit</span>
              <span>Over 80%</span>
              <span>Over</span>
              <span>Baseline</span>
              <span>Growth</span>
            </div>
            {byPlan.length ? (
              byPlan.map((row) => (
                <div
                  key={row.planId}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns:
                      "minmax(0, 1.2fr) 0.6fr 0.7fr 0.8fr 0.8fr 0.8fr 0.8fr 0.7fr 0.7fr 0.7fr 0.7fr",
                  }}
                >
                  <span className={styles.adminMonoCell}>
                    {row.displayName}
                    <small className={styles.adminInlineMeta}>
                      {row.planId} • {row.isActive ? "active" : "inactive"}
                    </small>
                  </span>
                  <span>{formatCount(row.accountCount)}</span>
                  <span>{formatCount(row.usersWithMedia)}</span>
                  <span>{formatBytes(row.catalogStorageLimitBytes)}</span>
                  <span>{formatBytes(row.totalTrackedBytes)}</span>
                  <span>{formatBytes(row.p90TrackedBytes)}</span>
                  <span>{formatBytes(row.baseLimitBytes + row.addonLimitBytes)}</span>
                  <span>{formatCount(row.accountsOver80Pct)}</span>
                  <span>{formatCount(row.accountsOverQuota)}</span>
                  <span>{formatCount(row.baselineStorageUsers)}</span>
                  <span>
                    {row.monthlyStorageGrowthBytes === null
                      ? "—"
                      : formatBytes(row.monthlyStorageGrowthBytes)}
                  </span>
                </div>
              ))
            ) : (
              <EmptyTableRow message="No plan storage rows are available yet." />
            )}
          </div>
        </TableShell>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Add-ons</p>
            <h2 className={styles.adminSectionTitle}>Recurring storage packages</h2>
            <p className="tiny subdued">
              Sold capacity, MRR, tracked usage, and estimated cost by active add-on package.
            </p>
          </div>
        </div>
        <TableShell>
          <div className={styles.adminTable} style={TABLE_WIDE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{
                gridTemplateColumns:
                  "minmax(0, 1.3fr) 0.7fr 0.6fr 0.8fr 0.9fr 0.9fr 0.9fr 0.7fr 0.7fr",
              }}
            >
              <span>Package</span>
              <span>Subscribers</span>
              <span>Qty</span>
              <span>MRR</span>
              <span>Sold</span>
              <span>Tracked</span>
              <span>Cost 2x</span>
              <span>Margin 1x</span>
              <span>Margin 2x</span>
            </div>
            {addonPackages.length ? (
              addonPackages.map((row) => (
                <div
                  key={row.storageAddonId}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns:
                      "minmax(0, 1.3fr) 0.7fr 0.6fr 0.8fr 0.9fr 0.9fr 0.9fr 0.7fr 0.7fr",
                  }}
                >
                  <span className={styles.adminMonoCell}>
                    {row.displayName}
                    <small className={styles.adminInlineMeta}>{row.storageAddonId}</small>
                  </span>
                  <span>{formatCount(row.activeSubscribers)}</span>
                  <span>{formatCount(row.activeQuantity)}</span>
                  <span>{formatMoney(row.mrrCents)}</span>
                  <span>{formatBytes(row.soldCapacityBytes)}</span>
                  <span>{formatBytes(row.trackedUsageBytes)}</span>
                  <span>
                    {formatMoney(
                      row.estimatedStorageCostCents +
                        row.estimatedEgressCost2xCents +
                        row.estimatedStripeFeeCents
                    )}
                  </span>
                  <span>{formatPct(row.estimatedMargin1xPct)}</span>
                  <span>{formatPct(row.estimatedMargin2xPct)}</span>
                </div>
              ))
            ) : (
              <EmptyTableRow message="No active recurring storage add-ons are available yet." />
            )}
          </div>
        </TableShell>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Funnel</p>
            <h2 className={styles.adminSectionTitle}>Storage add-on conversion</h2>
            <p className="tiny subdued">
              Sanitized telemetry counts for add-on visibility, mutation attempts, and outcomes.
            </p>
          </div>
        </div>
        <div className={styles.adminGrid}>
          <MetricCard
            label="Impressions"
            value={formatCount(funnel.impressions.total)}
            meta={formatCountWindowMeta(funnel.impressions)}
          />
          <MetricCard
            label="Add Clicks"
            value={formatCount(funnel.addClicks.total)}
            meta={formatCountWindowMeta(funnel.addClicks)}
          />
          <MetricCard
            label="Warnings"
            value={formatCount(funnel.warningViews.total)}
            meta={formatCountWindowMeta(funnel.warningViews)}
          />
          <MetricCard
            label="Requests"
            value={formatCount(funnel.addRequests.total)}
            meta={formatCountWindowMeta(funnel.addRequests)}
          />
          <MetricCard
            label="Successes"
            value={formatCount(funnel.addSuccesses.total)}
            meta={formatCountWindowMeta(funnel.addSuccesses)}
          />
          <MetricCard
            label="Failures"
            value={formatCount(funnel.addFailures.total)}
            meta={formatCountWindowMeta(funnel.addFailures)}
          />
          <MetricCard
            label="Removals"
            value={formatCount(funnel.removals.total)}
            meta={formatCountWindowMeta(funnel.removals)}
          />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Risk</p>
            <h2 className={styles.adminSectionTitle}>Storage risk queue</h2>
            <p className="tiny subdued">
              Local billing and storage rows that need review before making pricing or policy calls.
            </p>
          </div>
        </div>
        <TableShell>
          <div className={styles.adminTable} style={RISK_TABLE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{
                gridTemplateColumns: "minmax(0, 1.2fr) 0.7fr 0.8fr 0.8fr 0.6fr minmax(0, 1.8fr)",
              }}
            >
              <span>User</span>
              <span>Plan</span>
              <span>Usage</span>
              <span>Limit</span>
              <span>Add-ons</span>
              <span>Reason</span>
            </div>
            {riskQueue.length ? (
              riskQueue.map((row) => (
                <div
                  key={`${row.userId}:${row.riskTypes.join(",")}`}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns:
                      "minmax(0, 1.2fr) 0.7fr 0.8fr 0.8fr 0.6fr minmax(0, 1.8fr)",
                  }}
                >
                  <span className={styles.adminMonoCell}>{row.userId}</span>
                  <span>{row.planId}</span>
                  <span>
                    {formatBytes(row.trackedBytes)}
                    <small className={styles.adminInlineMeta}>{formatPct(row.usagePct)}</small>
                  </span>
                  <span>{formatBytes(row.totalLimitBytes)}</span>
                  <span>{formatCount(row.activeAddonCount)}</span>
                  <span>{row.details}</span>
                </div>
              ))
            ) : (
              <EmptyTableRow message="No storage risk rows are available yet." />
            )}
          </div>
        </TableShell>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Assumptions</p>
            <h2 className={styles.adminSectionTitle}>Estimate boundaries</h2>
            <p className="tiny subdued">
              Storage is estimated at {formatUnitUsd(assumptions.storageCostPerGbMonth)}/GB-month
              and egress at {formatUnitUsd(assumptions.uncachedEgressCostPerGb)}/GB. Stripe is
              estimated at {formatPct(assumptions.stripePercent * 100)} plus{" "}
              {formatMoney(assumptions.stripeFixedCents)} per transaction, with{" "}
              {formatMoney(assumptions.computeMonthlyCostCents)} {assumptions.computePlan} compute
              included when active storage add-on subscribers exist.
            </p>
          </div>
        </div>
        {dataGaps.length ? (
          <ul className={styles.pricingWarningList}>
            {dataGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
};
