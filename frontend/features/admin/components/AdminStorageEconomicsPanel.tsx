/**
 * Admin storage panel for provider usage, plan capacity, and local storage risk.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import styles from "../../../styles/admin.module.css";
import type {
  AdminStorageAccountHealthRow,
  AdminStorageEconomicsResponse,
  AdminStorageLifecycleRow,
  AdminStorageProviderUsage,
  AdminStorageProviderUsageStatus,
} from "../types";

type AdminStorageEconomicsPanelProps = {
  storageEconomics: AdminStorageEconomicsResponse;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
};

const BYTES_PER_GB = 1024 * 1024 * 1024;
const TABLE_WIDE_STYLE: React.CSSProperties = {
  minWidth: 1320,
};
const ADDON_TABLE_STYLE: React.CSSProperties = {
  minWidth: 920,
};
const RISK_TABLE_STYLE: React.CSSProperties = {
  minWidth: 1100,
};
const ACCOUNT_TABLE_STYLE: React.CSSProperties = {
  minWidth: 980,
};
const LIFECYCLE_TABLE_STYLE: React.CSSProperties = {
  minWidth: 1120,
};

const formatCount = (value: number): string => value.toLocaleString();
const formatMoney = (cents: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
const formatPct = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
const formatGb = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)} GB`;
const formatMb = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)} MB`;
const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
  const gb = bytes / BYTES_PER_GB;
  if (gb < 1) return `${(gb * 1024).toFixed(1)} MB`;
  if (gb < 10) return `${gb.toFixed(2)} GB`;
  return `${gb.toFixed(1)} GB`;
};

const PROVIDER_SOURCE_LABELS: Record<AdminStorageProviderUsage["source"], string> = {
  manual: "Manual entry",
  supabase_usage_page: "Supabase usage page",
  supabase_export: "Supabase export",
  api_import: "Production database",
  unavailable: "No source",
};

const PROVIDER_STATUS_LABELS: Record<AdminStorageProviderUsageStatus, string> = {
  current: "Current",
  stale: "Stale",
  unavailable: "No snapshot",
};

const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  product_tracked: "Product rows",
  live_storage_metadata: "Storage metadata",
  provider_snapshot: "Provider snapshot",
  configured_estimate: "Configured estimate",
  local_billing_rows: "Billing rows",
  app_error_events: "Telemetry",
  lifecycle_rpc: "Lifecycle RPC",
  unavailable: "Unavailable",
};

const formatLifecycleAction = (value: string): string =>
  value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const formatDate = (value: string | null): string => {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const formatProviderGb = (hasSnapshot: boolean, value: number | null): string =>
  hasSnapshot ? formatGb(value) : "—";

const formatProviderQuotaMeta = ({
  hasSnapshot,
  quotaUsedPct,
  includedGb,
  projectedGb,
}: {
  hasSnapshot: boolean;
  quotaUsedPct: number | null;
  includedGb: number;
  projectedGb: number | null;
}): string => {
  if (!hasSnapshot) return "No Supabase usage snapshot";
  const projection = projectedGb === null ? "" : ` • projected ${formatGb(projectedGb)}`;
  return `${formatPct(quotaUsedPct)} of ${formatGb(includedGb)} included${projection}`;
};

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

const AccountHealthTable = ({
  rows,
  emptyMessage,
}: {
  rows: AdminStorageAccountHealthRow[];
  emptyMessage: string;
}) => (
  <TableShell>
    <div className={styles.adminTable} style={ACCOUNT_TABLE_STYLE}>
      <div
        className={styles.adminTableHead}
        style={{
          gridTemplateColumns: "minmax(0, 1.3fr) 0.7fr 0.9fr 0.9fr 0.6fr minmax(0, 1.5fr)",
        }}
      >
        <span>User</span>
        <span>Plan</span>
        <span>Tracked</span>
        <span>Limit</span>
        <span>Add-ons</span>
        <span>Decision signal</span>
      </div>
      {rows.length ? (
        rows.map((row) => (
          <div
            key={`${row.userId}:${row.opportunityTypes.join(",")}`}
            className={styles.adminTableRow}
            style={{
              gridTemplateColumns: "minmax(0, 1.3fr) 0.7fr 0.9fr 0.9fr 0.6fr minmax(0, 1.5fr)",
            }}
          >
            <span className={styles.adminMonoCell}>{row.userEmail ?? row.userId}</span>
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
        <EmptyTableRow message={emptyMessage} />
      )}
    </div>
  </TableShell>
);

const LifecycleRowsTable = ({ rows }: { rows: AdminStorageLifecycleRow[] }) => (
  <TableShell>
    <div className={styles.adminTable} style={LIFECYCLE_TABLE_STYLE}>
      <div
        className={styles.adminTableHead}
        style={{
          gridTemplateColumns: "0.9fr minmax(0, 1.4fr) minmax(0, 1.4fr) 0.7fr 0.8fr 0.8fr",
        }}
      >
        <span>Action</span>
        <span>Class</span>
        <span>Reason</span>
        <span>Objects</span>
        <span>Total</span>
        <span>Missing size</span>
      </div>
      {rows.length ? (
        rows.map((row) => (
          <div
            key={`${row.manifestAction}:${row.safePathClass}:${row.manifestReason}`}
            className={styles.adminTableRow}
            style={{
              gridTemplateColumns: "0.9fr minmax(0, 1.4fr) minmax(0, 1.4fr) 0.7fr 0.8fr 0.8fr",
            }}
          >
            <span>{formatLifecycleAction(row.manifestAction)}</span>
            <span className={styles.adminMonoCell}>{row.safePathClass}</span>
            <span>{row.manifestReason}</span>
            <span>{formatCount(row.objectCount)}</span>
            <span>{formatMb(row.totalMb)}</span>
            <span>{formatCount(row.objectsMissingSizeMetadata)}</span>
          </div>
        ))
      ) : (
        <EmptyTableRow message="No lifecycle class rows are available yet." />
      )}
    </div>
  </TableShell>
);

export const AdminStorageEconomicsPanel = ({
  storageEconomics,
  loading,
  error,
  onRefresh,
}: AdminStorageEconomicsPanelProps) => {
  const {
    providerUsage,
    overview,
    byPlan,
    addonPackages,
    funnel,
    riskQueue,
    accountHealth,
    lifecycleHealth,
    trend,
    evidence,
    dataGaps,
    generatedAt,
  } = storageEconomics;
  const hasProviderSnapshot =
    providerUsage.status !== "unavailable" && providerUsage.source !== "unavailable";
  const providerEgressEvidence = evidence.find((row) => row.metricKey === "provider_egress");
  const hasProviderEgressSnapshot = providerEgressEvidence?.source === "provider_snapshot";
  const providerOverageCostCents =
    providerUsage.observedTotalOverageCostCents ?? providerUsage.estimatedTotalOverageCostCents;
  const generatedAtLabel = generatedAt ? formatDate(generatedAt) : "No refresh timestamp";

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Storage intelligence</p>
            <h2 className={styles.adminSectionTitle}>Executive snapshot</h2>
            <p className={styles.adminSubtext}>
              The fastest read on storage growth, account pressure, add-on revenue, and provider
              cost pressure.
            </p>
          </div>
          <div className={styles.adminHeaderActions}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={onRefresh}
              disabled={loading}
              title="Reload live ShortPulse storage and Supabase production usage."
              aria-label="Reload ShortPulse storage data"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        {error ? (
          <AppMessage
            className={styles.adminWarningPanel}
            tone="warning"
            mode="banner"
            title="Storage data is unavailable."
            role="status"
          >
            <p className={styles.adminWarningDescription}>{error}</p>
          </AppMessage>
        ) : null}
        {!hasProviderSnapshot ? (
          <AppMessage
            className={styles.adminWarningPanel}
            tone="warning"
            mode="banner"
            title="No Supabase usage snapshot is available."
            role="status"
          >
            <p className={styles.adminWarningDescription}>
              The automatic production snapshot could not be built from Supabase data.
            </p>
          </AppMessage>
        ) : null}
        <div className={styles.adminGrid}>
          <MetricCard
            label="Product Tracked"
            value={formatBytes(overview.totalTrackedBytes)}
            meta={`${formatCount(overview.accountsWithMedia)} of ${formatCount(
              overview.trackedAccounts
            )} accounts with media`}
          />
          <MetricCard
            label="Provider Storage"
            value={formatProviderGb(hasProviderSnapshot, providerUsage.storageUsedGb)}
            meta={formatProviderQuotaMeta({
              hasSnapshot: hasProviderSnapshot,
              quotaUsedPct: providerUsage.storageQuotaUsedPct,
              includedGb: providerUsage.storageIncludedGb,
              projectedGb: providerUsage.projectedStorageUsedGb,
            })}
          />
          <MetricCard
            label="Add-on MRR"
            value={formatMoney(overview.activeAddonMrrCents)}
            meta={`${formatCount(overview.activeAddonSubscribers)} active subscriber${overview.activeAddonSubscribers === 1 ? "" : "s"}`}
          />
          <MetricCard
            label="Overage Pressure"
            value={hasProviderSnapshot ? formatMoney(providerOverageCostCents) : "—"}
            meta={
              !hasProviderSnapshot
                ? "No Supabase egress snapshot"
                : !hasProviderEgressSnapshot
                  ? "Configured egress estimate"
                  : providerUsage.observedTotalOverageCostCents === null
                    ? "Estimated from provider snapshot"
                    : "Observed cost from provider snapshot"
            }
          />
          <MetricCard
            label="Quota Risk"
            value={`${formatCount(overview.accountsOver80Pct)} near / ${formatCount(
              overview.accountsOverQuota
            )} over`}
            meta={`${formatCount(overview.baselineStorageUsers)} baseline storage users`}
          />
          <MetricCard
            label="Lifecycle Review"
            value={formatMb(lifecycleHealth.manualReviewMb)}
            meta={
              lifecycleHealth.status === "unavailable"
                ? "Lifecycle health unavailable"
                : `${formatCount(lifecycleHealth.manualReviewObjectCount)} manual-review objects`
            }
          />
          <MetricCard
            label="Trend"
            value={trend.status === "unavailable" ? "No history" : "Available"}
            meta={trend.reason ?? `${formatCount(trend.snapshots.length)} snapshots`}
          />
          <MetricCard label="Refreshed" value={generatedAtLabel} meta="Admin API payload time" />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Provider pressure</p>
            <h2 className={styles.adminSectionTitle}>Supabase usage</h2>
            <p className={styles.adminSubtext}>
              Automatic production storage plus provider snapshot or configured-estimate evidence
              for egress and overage.
            </p>
          </div>
        </div>
        <div className={styles.adminGrid}>
          <MetricCard
            label="Snapshot"
            value={PROVIDER_STATUS_LABELS[providerUsage.status]}
            meta={
              hasProviderSnapshot
                ? `${formatDate(providerUsage.capturedAt)} • ${PROVIDER_SOURCE_LABELS[providerUsage.source]}`
                : "No source connected"
            }
          />
          <MetricCard
            label="Supabase Plan"
            value={hasProviderSnapshot ? (providerUsage.supabasePlan ?? "—") : "—"}
            meta={
              hasProviderSnapshot
                ? `${providerUsage.computePlan} compute • ${formatMoney(providerUsage.computeMonthlyCostCents)}/mo`
                : "No provider plan snapshot"
            }
          />
          <MetricCard
            label="Uncached Egress"
            value={formatProviderGb(hasProviderSnapshot, providerUsage.uncachedEgressGb)}
            meta={formatProviderQuotaMeta({
              hasSnapshot: hasProviderSnapshot,
              quotaUsedPct: providerUsage.uncachedEgressQuotaUsedPct,
              includedGb: providerUsage.uncachedEgressIncludedGb,
              projectedGb: providerUsage.projectedUncachedEgressGb,
            })}
          />
          <MetricCard
            label="Cached Egress"
            value={formatProviderGb(hasProviderSnapshot, providerUsage.cachedEgressGb)}
            meta={formatProviderQuotaMeta({
              hasSnapshot: hasProviderSnapshot,
              quotaUsedPct: providerUsage.cachedEgressQuotaUsedPct,
              includedGb: providerUsage.cachedEgressIncludedGb,
              projectedGb: providerUsage.projectedCachedEgressGb,
            })}
          />
          <MetricCard
            label="Total Egress"
            value={hasProviderSnapshot ? formatGb(providerUsage.totalEgressGb) : "—"}
            meta={
              !hasProviderSnapshot
                ? "No Supabase egress snapshot"
                : !hasProviderEgressSnapshot
                  ? "Configured egress estimate; no provider egress snapshot"
                  : providerUsage.egressMultiple === null
                    ? "No product-tracked storage comparison"
                    : `${providerUsage.egressMultiple.toFixed(2)}x product-tracked storage`
            }
          />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Revenue</p>
            <h2 className={styles.adminSectionTitle}>Capacity and margin snapshot</h2>
            <p className="tiny subdued">
              Product-tracked storage, recurring add-on revenue, and estimated margin pressure.
            </p>
          </div>
        </div>
        <div className={styles.adminGrid}>
          <MetricCard
            label="Sold Add-on Capacity"
            value={formatBytes(overview.activeAddonSoldCapacityBytes)}
            meta={`${formatMoney(overview.estimatedAddonCost2xCents)} est. 2x variable cost`}
          />
          <MetricCard
            label="Add-on Margin"
            value={formatPct(overview.estimatedAddonGrossMargin2xPct)}
            meta={`${formatPct(overview.estimatedAddonGrossMargin1xPct)} at 1x egress`}
          />
          <MetricCard
            label="Storage Revenue"
            value={formatMoney(overview.estimatedTotalStorageRevenueCents)}
            meta={`${formatMoney(overview.estimatedPlanMrrCents)} plan MRR + ${formatMoney(
              overview.activeAddonMrrCents
            )} add-on MRR`}
          />
          <MetricCard
            label="Business Margin"
            value={formatPct(overview.estimatedBusinessStorageMarginPct)}
            meta={`${formatMoney(overview.estimatedBusinessStorageCostCents)} estimated shared cost`}
          />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Account health</p>
            <h2 className={styles.adminSectionTitle}>Top storage accounts</h2>
            <p className={styles.adminSubtext}>
              The accounts most likely to drive product, sales, or customer-success decisions.
            </p>
          </div>
        </div>
        <AccountHealthTable
          rows={accountHealth.topStorageAccounts}
          emptyMessage="No tracked storage accounts are available yet."
        />
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Account health</p>
            <h2 className={styles.adminSectionTitle}>Quota and add-on opportunities</h2>
            <p className={styles.adminSubtext}>
              Near-quota, over-quota, baseline, and storage add-on opportunity accounts.
            </p>
          </div>
        </div>
        <AccountHealthTable
          rows={[...accountHealth.quotaPressureAccounts, ...accountHealth.addonOpportunityAccounts]}
          emptyMessage="No quota pressure or add-on opportunity accounts are available yet."
        />
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Lifecycle health</p>
            <h2 className={styles.adminSectionTitle}>Storage object classes</h2>
            <p className={styles.adminSubtext}>
              Aggregate lifecycle classes only. This is report-only and does not authorize cleanup.
            </p>
          </div>
        </div>
        <div className={styles.adminGrid}>
          <MetricCard
            label="Total Objects"
            value={formatCount(lifecycleHealth.totalObjectCount)}
            meta={formatMb(lifecycleHealth.totalMb)}
          />
          <MetricCard
            label="Protected"
            value={formatCount(lifecycleHealth.protectedObjectCount)}
            meta={formatMb(lifecycleHealth.protectedMb)}
          />
          <MetricCard
            label="Manual Review"
            value={formatCount(lifecycleHealth.manualReviewObjectCount)}
            meta={formatMb(lifecycleHealth.manualReviewMb)}
          />
          <MetricCard
            label="Integrity Problems"
            value={formatCount(lifecycleHealth.integrityProblemObjectCount)}
            meta={formatMb(lifecycleHealth.integrityProblemMb)}
          />
          <MetricCard
            label="Delete Candidates"
            value={formatCount(lifecycleHealth.deleteCandidateObjectCount)}
            meta={`${formatMb(lifecycleHealth.deleteCandidateMb)} report-only`}
          />
        </div>
        {lifecycleHealth.reason ? (
          <AppMessage
            className={styles.adminWarningPanel}
            tone="warning"
            mode="banner"
            message={lifecycleHealth.reason}
          />
        ) : null}
        <LifecycleRowsTable rows={lifecycleHealth.rows} />
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
                gridTemplateColumns: "minmax(0, 1.3fr) 0.7fr 0.8fr 0.9fr 0.9fr 0.9fr 0.9fr",
              }}
            >
              <span>Plan</span>
              <span>Accounts</span>
              <span>With Media</span>
              <span>Plan Limit</span>
              <span>Catalog Price</span>
              <span>Contract MRR</span>
              <span>Tracked</span>
            </div>
            {byPlan.length ? (
              byPlan.map((row) => (
                <div
                  key={row.planId}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns: "minmax(0, 1.3fr) 0.7fr 0.8fr 0.9fr 0.9fr 0.9fr 0.9fr",
                  }}
                >
                  <span className={styles.adminMonoCell}>{row.displayName}</span>
                  <span>{formatCount(row.accountCount)}</span>
                  <span>{formatCount(row.usersWithMedia)}</span>
                  <span>{formatBytes(row.catalogStorageLimitBytes)}</span>
                  <span>{formatMoney(row.catalogRecurringPriceCents)}</span>
                  <span>{formatMoney(row.contractMrrCents)}</span>
                  <span>{formatBytes(row.totalTrackedBytes)}</span>
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
              Sold capacity, MRR, and tracked usage by active add-on package.
            </p>
          </div>
        </div>
        <TableShell>
          <div className={styles.adminTable} style={ADDON_TABLE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{
                gridTemplateColumns: "minmax(0, 1.3fr) 0.9fr 0.7fr 0.6fr 0.8fr 0.9fr 0.9fr 0.8fr",
              }}
            >
              <span>Package</span>
              <span>Catalog</span>
              <span>Subscribers</span>
              <span>Qty</span>
              <span>MRR</span>
              <span>Sold</span>
              <span>Tracked</span>
              <span>Margin 2x</span>
            </div>
            {addonPackages.length ? (
              addonPackages.map((row) => (
                <div
                  key={row.storageAddonId}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns:
                      "minmax(0, 1.3fr) 0.9fr 0.7fr 0.6fr 0.8fr 0.9fr 0.9fr 0.8fr",
                  }}
                >
                  <span className={styles.adminMonoCell}>{row.displayName}</span>
                  <span>{formatBytes(row.catalogStorageLimitBytes)}</span>
                  <span>{formatCount(row.activeSubscribers)}</span>
                  <span>{formatCount(row.activeQuantity)}</span>
                  <span>{formatMoney(row.mrrCents)}</span>
                  <span>{formatBytes(row.soldCapacityBytes)}</span>
                  <span>{formatBytes(row.trackedUsageBytes)}</span>
                  <span>{formatPct(row.estimatedMargin2xPct)}</span>
                </div>
              ))
            ) : (
              <EmptyTableRow message="No recurring storage add-on catalog rows are available yet." />
            )}
          </div>
        </TableShell>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Conversion</p>
            <h2 className={styles.adminSectionTitle}>Storage add-on conversion</h2>
            <p className="tiny subdued">Storage add-on funnel events recorded in app telemetry.</p>
          </div>
        </div>
        <TableShell>
          <div className={styles.adminTable} style={ADDON_TABLE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{ gridTemplateColumns: "minmax(0, 1.2fr) 0.7fr 0.7fr 0.7fr" }}
            >
              <span>Event</span>
              <span>Total</span>
              <span>Last 24h</span>
              <span>Last 7d</span>
            </div>
            {[
              ["Impressions", funnel.impressions],
              ["Add clicks", funnel.addClicks],
              ["Warnings", funnel.warningViews],
              ["Requests", funnel.addRequests],
              ["Successes", funnel.addSuccesses],
              ["Failures", funnel.addFailures],
              ["Removals", funnel.removals],
            ].map(([label, window]) => (
              <div
                key={label as string}
                className={styles.adminTableRow}
                style={{ gridTemplateColumns: "minmax(0, 1.2fr) 0.7fr 0.7fr 0.7fr" }}
              >
                <span>{label as string}</span>
                <span>{formatCount((window as typeof funnel.impressions).total)}</span>
                <span>{formatCount((window as typeof funnel.impressions).last24h)}</span>
                <span>{formatCount((window as typeof funnel.impressions).last7d)}</span>
              </div>
            ))}
          </div>
        </TableShell>
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
                  <span className={styles.adminMonoCell}>{row.userEmail ?? row.userId}</span>
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
            <p className={styles.adminSectionEyebrow}>Evidence</p>
            <h2 className={styles.adminSectionTitle}>Source confidence</h2>
            <p className={styles.adminSubtext}>
              What each metric is allowed to prove before making a product or sales decision.
            </p>
          </div>
        </div>
        <TableShell>
          <div className={styles.adminTable} style={ACCOUNT_TABLE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{
                gridTemplateColumns: "minmax(0, 1fr) 0.8fr 0.7fr minmax(0, 1.7fr)",
              }}
            >
              <span>Metric</span>
              <span>Source</span>
              <span>Status</span>
              <span>Boundary</span>
            </div>
            {evidence.length ? (
              evidence.map((row) => (
                <div
                  key={row.metricKey}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns: "minmax(0, 1fr) 0.8fr 0.7fr minmax(0, 1.7fr)",
                  }}
                >
                  <span>{row.label}</span>
                  <span>{EVIDENCE_SOURCE_LABELS[row.source] ?? row.source}</span>
                  <span>{formatLifecycleAction(row.status)}</span>
                  <span>{row.details}</span>
                </div>
              ))
            ) : (
              <EmptyTableRow message="No evidence source rows are available yet." />
            )}
          </div>
        </TableShell>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Boundaries</p>
            <h2 className={styles.adminSectionTitle}>Estimate boundaries</h2>
            <p className="tiny subdued">
              Known limits before using this page for pricing, sales, or operating calls.
            </p>
          </div>
        </div>
        {dataGaps.length ? (
          <div className={styles.adminWarningPanel}>
            <ul className={styles.adminWarningList}>
              {dataGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        ) : (
          <AppMessage
            className={styles.adminWarningPanel}
            tone="success"
            mode="banner"
            message="No storage data gaps reported by the admin API."
          />
        )}
      </section>
    </>
  );
};
