/**
 * Admin storage panel for provider usage, plan capacity, and local storage risk.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import styles from "../../../styles/admin.module.css";
import type {
  AdminStorageEconomicsResponse,
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

export const AdminStorageEconomicsPanel = ({
  storageEconomics,
  loading,
  error,
  onRefresh,
}: AdminStorageEconomicsPanelProps) => {
  const { providerUsage, byPlan, addonPackages, riskQueue } = storageEconomics;
  const hasProviderSnapshot =
    providerUsage.status !== "unavailable" && providerUsage.source !== "unavailable";
  const providerOverageCostCents =
    providerUsage.observedTotalOverageCostCents ?? providerUsage.estimatedTotalOverageCostCents;

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Supabase pressure</p>
            <h2 className={styles.adminSectionTitle}>Supabase usage</h2>
            <p className="tiny subdued">
              Automatic production snapshot for Supabase storage, egress, and overage.
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
            label="Storage"
            value={formatProviderGb(hasProviderSnapshot, providerUsage.storageUsedGb)}
            meta={formatProviderQuotaMeta({
              hasSnapshot: hasProviderSnapshot,
              quotaUsedPct: providerUsage.storageQuotaUsedPct,
              includedGb: providerUsage.storageIncludedGb,
              projectedGb: providerUsage.projectedStorageUsedGb,
            })}
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
                : providerUsage.egressMultiple === null
                  ? "No product-tracked storage comparison"
                  : `${providerUsage.egressMultiple.toFixed(2)}x product-tracked storage`
            }
          />
          <MetricCard
            label="Overage"
            value={hasProviderSnapshot ? formatMoney(providerOverageCostCents) : "—"}
            meta={
              !hasProviderSnapshot
                ? "—"
                : providerUsage.observedTotalOverageCostCents === null
                  ? "Estimated from snapshot"
                  : "Observed cost from snapshot"
            }
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
                gridTemplateColumns: "minmax(0, 1.3fr) 0.9fr 0.7fr 0.6fr 0.8fr 0.9fr 0.9fr",
              }}
            >
              <span>Package</span>
              <span>Catalog</span>
              <span>Subscribers</span>
              <span>Qty</span>
              <span>MRR</span>
              <span>Sold</span>
              <span>Tracked</span>
            </div>
            {addonPackages.length ? (
              addonPackages.map((row) => (
                <div
                  key={row.storageAddonId}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns: "minmax(0, 1.3fr) 0.9fr 0.7fr 0.6fr 0.8fr 0.9fr 0.9fr",
                  }}
                >
                  <span className={styles.adminMonoCell}>{row.displayName}</span>
                  <span>{formatBytes(row.catalogStorageLimitBytes)}</span>
                  <span>{formatCount(row.activeSubscribers)}</span>
                  <span>{formatCount(row.activeQuantity)}</span>
                  <span>{formatMoney(row.mrrCents)}</span>
                  <span>{formatBytes(row.soldCapacityBytes)}</span>
                  <span>{formatBytes(row.trackedUsageBytes)}</span>
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
    </>
  );
};
