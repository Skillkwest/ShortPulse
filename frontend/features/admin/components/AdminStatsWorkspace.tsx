/**
 * Admin stats workspace.
 * Splits the stats route into Product / Marketing / Sales lenses while
 * reusing the existing product stats panel.
 */
import React from "react";
import styles from "../../../styles/admin.module.css";
import { AdminGlobalStatsPanel } from "./AdminGlobalStatsPanel";
import type {
  AdminGlobalModelUsageRow,
  AdminGlobalStatsAssets,
  AdminGlobalStatsHealth,
  AdminGlobalStatsOverview,
  AdminGlobalStatsProjects,
  AdminGlobalStatsWorkflows,
  AdminGrowthStatsResponse,
  AdminStatsCountWindow,
} from "../types";

type CountWindowKey = keyof AdminStatsCountWindow;
type StatsLens = "product" | "marketing" | "sales";

type AdminStatsWorkspaceProps = {
  overview: AdminGlobalStatsOverview;
  models: AdminGlobalModelUsageRow[];
  workflows: AdminGlobalStatsWorkflows;
  assets: AdminGlobalStatsAssets;
  projects: AdminGlobalStatsProjects;
  health: AdminGlobalStatsHealth;
  growth: AdminGrowthStatsResponse;
  generatedAt: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

const WINDOW_OPTIONS: Array<{ key: CountWindowKey; label: string }> = [
  { key: "total", label: "All time" },
  { key: "last24h", label: "24h" },
  { key: "last7d", label: "7d" },
];

const TOOLBAR_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const SEGMENTED_CONTROL_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: 4,
  borderRadius: 999,
  border: "1px solid var(--admin-border-soft)",
  background: "var(--admin-surface-2)",
};

const TABLE_SCROLL_STYLE: React.CSSProperties = {
  overflowX: "auto",
};

const TABLE_WIDE_STYLE: React.CSSProperties = {
  minWidth: 900,
};

const formatCount = (value: number): string => value.toLocaleString();
const formatPct = (value: number): string => `${Number(value || 0).toFixed(1)}%`;
const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};
const formatDurationHours = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value < 1) return `${Math.round(value * 60)}m`;
  return `${value.toFixed(1)}h`;
};
const formatCountWindowValue = (window: AdminStatsCountWindow, selectedWindow: CountWindowKey) =>
  formatCount(window[selectedWindow]);
const formatCountWindowMeta = (window: AdminStatsCountWindow) =>
  `All ${formatCount(window.total)} • 24h ${formatCount(window.last24h)} • 7d ${formatCount(window.last7d)}`;
const tabClassName = (active: boolean) =>
  active ? `${styles.tabButton} ${styles.tabActive}` : styles.tabButton;

const MetricCard = ({ label, value, meta }: { label: string; value: string; meta: string }) => (
  <article className={styles.adminCard}>
    <div className={styles.adminCardTop}>
      <span className={styles.adminLabel}>{label}</span>
    </div>
    <p className={styles.adminMetric}>{value}</p>
    <p className={styles.adminSubtext}>{meta}</p>
  </article>
);

const GrowthHealthWarning = ({ reason }: { reason: string | null }) =>
  reason ? (
    <div className={styles.adminWarningPanel} role="status">
      <p className={styles.adminWarningTitle}>Growth stats are partially degraded.</p>
      <p className={styles.adminWarningDescription}>
        Marketing and sales metrics are showing safe fallback values until the growth contract is
        available again.
      </p>
      <p className={styles.adminWarningMeta}>{reason}</p>
    </div>
  ) : null;

const MarketingPanel = ({
  growth,
  loading,
  onRefresh,
}: Pick<AdminStatsWorkspaceProps, "growth" | "loading" | "onRefresh">) => {
  const [selectedWindow, setSelectedWindow] = React.useState<CountWindowKey>("total");
  const { marketing, health } = growth;

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <h2 className={styles.adminSectionTitle}>Marketing</h2>
            <p className="tiny subdued">
              Track signup velocity, activation speed, source quality, and retention after value.
            </p>
          </div>
          <div style={TOOLBAR_STYLE}>
            <div style={SEGMENTED_CONTROL_STYLE} role="tablist" aria-label="Marketing stats window">
              {WINDOW_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={tabClassName(option.key === selectedWindow)}
                  onClick={() => setSelectedWindow(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="button" className="ghost-btn mini" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <GrowthHealthWarning reason={health.reason} />
        <div className={styles.adminGrid}>
          <MetricCard
            label="Signups"
            value={formatCountWindowValue(marketing.summary.signups, selectedWindow)}
            meta={formatCountWindowMeta(marketing.summary.signups)}
          />
          <MetricCard
            label="Activated Users"
            value={formatCountWindowValue(marketing.summary.activatedUsers, selectedWindow)}
            meta={formatCountWindowMeta(marketing.summary.activatedUsers)}
          />
          <MetricCard
            label="Activation Rate"
            value={formatPct(marketing.summary.activationRatePct[selectedWindow])}
            meta={`All ${formatPct(marketing.summary.activationRatePct.total)} • 24h ${formatPct(marketing.summary.activationRatePct.last24h)} • 7d ${formatPct(marketing.summary.activationRatePct.last7d)}`}
          />
          <MetricCard
            label="Signup → Activation"
            value={formatDurationHours(marketing.summary.medianHours.signupToActivation)}
            meta={`Generate ${formatDurationHours(marketing.summary.medianHours.signupToGenerate)} • Success ${formatDurationHours(marketing.summary.medianHours.signupToSuccess)}`}
          />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <h2 className={styles.adminSectionTitle}>Retention By Activation</h2>
            <p className="tiny subdued">
              Compare D1, D7, and D30 return behavior for users who reached value vs users who did
              not.
            </p>
          </div>
        </div>
        <div className={styles.adminGrid}>
          <MetricCard
            label="Activated D7"
            value={formatPct(marketing.retention.activated.d7RatePct)}
            meta={`Eligible ${formatCount(marketing.retention.activated.eligibleD7)} • Returned ${formatCount(marketing.retention.activated.retainedD7)}`}
          />
          <MetricCard
            label="Activated D30"
            value={formatPct(marketing.retention.activated.d30RatePct)}
            meta={`Eligible ${formatCount(marketing.retention.activated.eligibleD30)} • Returned ${formatCount(marketing.retention.activated.retainedD30)}`}
          />
          <MetricCard
            label="Non-Activated D7"
            value={formatPct(marketing.retention.nonActivated.d7RatePct)}
            meta={`Eligible ${formatCount(marketing.retention.nonActivated.eligibleD7)} • Returned ${formatCount(marketing.retention.nonActivated.retainedD7)}`}
          />
          <MetricCard
            label="Non-Activated D30"
            value={formatPct(marketing.retention.nonActivated.d30RatePct)}
            meta={`Eligible ${formatCount(marketing.retention.nonActivated.eligibleD30)} • Returned ${formatCount(marketing.retention.nonActivated.retainedD30)}`}
          />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <h2 className={styles.adminSectionTitle}>Acquisition Sources</h2>
            <p className="tiny subdued">
              First-touch attribution shows which sources and campaigns produce activated,
              qualified, and paid users.
            </p>
          </div>
        </div>
        <div style={TABLE_SCROLL_STYLE}>
          <div className={styles.adminTable} style={TABLE_WIDE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{ gridTemplateColumns: "minmax(0, 1.4fr) 0.7fr 0.8fr 0.9fr 0.7fr 0.7fr" }}
            >
              <span>Source</span>
              <span>Signups</span>
              <span>Activated</span>
              <span>Activation Rate</span>
              <span>PQLs</span>
              <span>Paid</span>
            </div>
            {growth.marketing.attribution.sources.length ? (
              growth.marketing.attribution.sources.map((row) => (
                <div
                  key={row.sourceKey}
                  className={styles.adminTableRow}
                  style={{ gridTemplateColumns: "minmax(0, 1.4fr) 0.7fr 0.8fr 0.9fr 0.7fr 0.7fr" }}
                >
                  <span className={styles.adminMonoCell}>{row.sourceKey}</span>
                  <span>{formatCount(row.signups)}</span>
                  <span>{formatCount(row.activatedUsers)}</span>
                  <span>{formatPct(row.activationRatePct)}</span>
                  <span>{formatCount(row.pqlUsers)}</span>
                  <span>{formatCount(row.paidUsers)}</span>
                </div>
              ))
            ) : (
              <div className={styles.adminTableRow}>
                <span>No attributed signup rows are available yet.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <h2 className={styles.adminSectionTitle}>Campaigns</h2>
            <p className="tiny subdued">
              Campaign rows use the same stitched attribution contract as source rows.
            </p>
          </div>
        </div>
        <div style={TABLE_SCROLL_STYLE}>
          <div className={styles.adminTable} style={TABLE_WIDE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{ gridTemplateColumns: "minmax(0, 1.5fr) 0.7fr 0.8fr 0.9fr 0.7fr 0.7fr" }}
            >
              <span>Campaign</span>
              <span>Signups</span>
              <span>Activated</span>
              <span>Activation Rate</span>
              <span>PQLs</span>
              <span>Paid</span>
            </div>
            {growth.marketing.attribution.campaigns.length ? (
              growth.marketing.attribution.campaigns.map((row) => (
                <div
                  key={row.campaignKey}
                  className={styles.adminTableRow}
                  style={{ gridTemplateColumns: "minmax(0, 1.5fr) 0.7fr 0.8fr 0.9fr 0.7fr 0.7fr" }}
                >
                  <span className={styles.adminMonoCell}>{row.campaignKey}</span>
                  <span>{formatCount(row.signups)}</span>
                  <span>{formatCount(row.activatedUsers)}</span>
                  <span>{formatPct(row.activationRatePct)}</span>
                  <span>{formatCount(row.pqlUsers)}</span>
                  <span>{formatCount(row.paidUsers)}</span>
                </div>
              ))
            ) : (
              <div className={styles.adminTableRow}>
                <span>No attributed campaign rows are available yet.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

const SalesPanel = ({
  growth,
  loading,
  onRefresh,
}: Pick<AdminStatsWorkspaceProps, "growth" | "loading" | "onRefresh">) => {
  const [selectedWindow, setSelectedWindow] = React.useState<CountWindowKey>("total");
  const { sales, health } = growth;

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <h2 className={styles.adminSectionTitle}>Sales</h2>
            <p className="tiny subdued">
              Watch pricing intent, checkout behavior, paid conversions, and qualified users from
              one operator view.
            </p>
          </div>
          <div style={TOOLBAR_STYLE}>
            <div style={SEGMENTED_CONTROL_STYLE} role="tablist" aria-label="Sales stats window">
              {WINDOW_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={tabClassName(option.key === selectedWindow)}
                  onClick={() => setSelectedWindow(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="button" className="ghost-btn mini" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <GrowthHealthWarning reason={health.reason} />
        <div className={styles.adminGrid}>
          <MetricCard
            label="Pricing Views"
            value={formatCountWindowValue(sales.summary.pricingViewedUsers, selectedWindow)}
            meta={formatCountWindowMeta(sales.summary.pricingViewedUsers)}
          />
          <MetricCard
            label="Upgrade Clicks"
            value={formatCountWindowValue(sales.summary.upgradeClickedUsers, selectedWindow)}
            meta={formatCountWindowMeta(sales.summary.upgradeClickedUsers)}
          />
          <MetricCard
            label="Checkout Starts"
            value={formatCountWindowValue(sales.summary.checkoutStartedUsers, selectedWindow)}
            meta={formatCountWindowMeta(sales.summary.checkoutStartedUsers)}
          />
          <MetricCard
            label="Paid Converted"
            value={formatCountWindowValue(sales.summary.paidConvertedUsers, selectedWindow)}
            meta={formatCountWindowMeta(sales.summary.paidConvertedUsers)}
          />
          <MetricCard
            label="PQL Users"
            value={formatCountWindowValue(sales.summary.pqlUsers, selectedWindow)}
            meta={`Activated → PQL ${formatPct(sales.summary.activatedToPqlRatePct)}`}
          />
          <MetricCard
            label="PQL → Paid"
            value={formatPct(sales.summary.pqlToPaidRatePct)}
            meta={`Completed checkouts ${formatCountWindowValue(sales.summary.checkoutCompletedUsers, selectedWindow)}`}
          />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <h2 className={styles.adminSectionTitle}>High-Intent Users</h2>
            <p className="tiny subdued">
              Qualified and monetization-adjacent users are ranked by PQL score, checkout activity,
              and paid conversion state.
            </p>
          </div>
        </div>
        <div style={TABLE_SCROLL_STYLE}>
          <div className={styles.adminTable} style={{ minWidth: 1250 }}>
            <div
              className={styles.adminTableHead}
              style={{
                gridTemplateColumns:
                  "minmax(0, 1.4fr) minmax(0, 0.9fr) 0.55fr 0.7fr 0.7fr 0.7fr 0.7fr 0.9fr 1fr 1fr",
              }}
            >
              <span>User</span>
              <span>Source</span>
              <span>PQL</span>
              <span>Saved</span>
              <span>Success</span>
              <span>Days</span>
              <span>Projects</span>
              <span>Spend</span>
              <span>Checkout</span>
              <span>Paid</span>
            </div>
            {sales.highIntentUsers.length ? (
              sales.highIntentUsers.map((row) => (
                <div
                  key={row.userId}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns:
                      "minmax(0, 1.4fr) minmax(0, 0.9fr) 0.55fr 0.7fr 0.7fr 0.7fr 0.7fr 0.9fr 1fr 1fr",
                  }}
                >
                  <span className={styles.adminMonoCell}>
                    {row.email}
                    <small className={styles.adminInlineMeta}>{row.campaignKey}</small>
                  </span>
                  <span className={styles.adminMonoCell}>{row.sourceKey}</span>
                  <span>
                    {row.isPql ? `Yes (${row.pqlScore})` : row.pqlScore}
                    <small className={styles.adminInlineMeta}>
                      activated {formatDateTime(row.activatedAt)}
                    </small>
                  </span>
                  <span>{formatCount(row.savedOutputs)}</span>
                  <span>{formatCount(row.successfulGenerations)}</span>
                  <span>{formatCount(row.activeDays)}</span>
                  <span>
                    {formatCount(row.projectsCreated)}
                    <small className={styles.adminInlineMeta}>
                      attached {formatCount(row.projectAttachedGenerations)}
                    </small>
                  </span>
                  <span>{formatCount(row.creditSpendCents)}</span>
                  <span>
                    {formatDateTime(row.checkoutStartedAt)}
                    <small className={styles.adminInlineMeta}>
                      upgrade {formatDateTime(row.upgradeClickedAt)}
                    </small>
                  </span>
                  <span>
                    {formatDateTime(row.paidConvertedAt)}
                    <small className={styles.adminInlineMeta}>
                      completed {formatDateTime(row.checkoutCompletedAt)}
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.adminTableRow}>
                <span>No high-intent users are available yet.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

/**
 * Top-level admin stats workspace with Product / Marketing / Sales lenses.
 */
export const AdminStatsWorkspace = ({
  overview,
  models,
  workflows,
  assets,
  projects,
  health,
  growth,
  generatedAt,
  loading,
  error,
  onRefresh,
}: AdminStatsWorkspaceProps) => {
  const [activeLens, setActiveLens] = React.useState<StatsLens>("product");

  return (
    <>
      <div className={styles.tabRow} role="tablist" aria-label="Stats workspace lens">
        {(["product", "marketing", "sales"] as StatsLens[]).map((lens) => (
          <button
            key={lens}
            type="button"
            className={tabClassName(activeLens === lens)}
            onClick={() => setActiveLens(lens)}
          >
            {lens[0]?.toUpperCase()}
            {lens.slice(1)}
          </button>
        ))}
      </div>

      {activeLens === "product" ? (
        <AdminGlobalStatsPanel
          overview={overview}
          models={models}
          workflows={workflows}
          assets={assets}
          projects={projects}
          health={health}
          generatedAt={generatedAt}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
        />
      ) : null}

      {activeLens === "marketing" ? (
        <MarketingPanel growth={growth} loading={loading} onRefresh={onRefresh} />
      ) : null}

      {activeLens === "sales" ? (
        <SalesPanel growth={growth} loading={loading} onRefresh={onRefresh} />
      ) : null}
    </>
  );
};
