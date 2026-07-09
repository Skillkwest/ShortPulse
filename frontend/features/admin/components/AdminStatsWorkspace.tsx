/**
 * Admin stats workspace.
 * Splits the stats route into Product / Marketing / Sales lenses while reusing
 * the existing product stats panel.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import styles from "../../../styles/admin.module.css";
import { AdminGlobalStatsPanel } from "./AdminGlobalStatsPanel";
import type {
  AdminFirstValueFunnel,
  AdminFirstValueFunnelStep,
  AdminGenerationBreakdown,
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
  generationBreakdown: AdminGenerationBreakdown;
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

const TABLE_WIDE_STYLE: React.CSSProperties = {
  minWidth: 900,
};

const HIGH_INTENT_TABLE_STYLE: React.CSSProperties = {
  minWidth: 1250,
};

const CONVERSION_TARGET_TABLE_STYLE: React.CSSProperties = {
  minWidth: 1320,
};

const LENS_OPTIONS: Array<{
  key: StatsLens;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    key: "product",
    label: "Product",
    eyebrow: "Core product signals",
    description:
      "Keep demand, workflow quality, saved outputs, and project depth in one operator surface.",
  },
  {
    key: "marketing",
    label: "Marketing",
    eyebrow: "Activation and acquisition",
    description:
      "Read signup quality, time-to-value, retention after activation, and source-level signal.",
  },
  {
    key: "sales",
    label: "Sales",
    eyebrow: "Intent and monetization",
    description:
      "Track pricing interest, PQL depth, checkout starts, and paid conversion from one view.",
  },
];

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
const formatStorageBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${(value / 1024 ** 3).toFixed(0)} GB`;
};
const formatCampaignBucket = (value: string): string =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
const formatSubscriptionBucket = (value: string): string => {
  if (value === "lapsed_or_canceled") return "Lapsed";
  if (value === "currently_subscribed") return "Current";
  return "Never paid";
};
const formatGenerationBucket = (value: string): string => {
  if (value === "saved_output") return "Saved output";
  if (value === "successful_no_save") return "Success, no save";
  if (value === "generated_no_success") return "Generated, no success";
  return "No generation";
};
const formatCountWindowValue = (window: AdminStatsCountWindow, selectedWindow: CountWindowKey) =>
  formatCount(window[selectedWindow]);
const formatCountWindowMeta = (window: AdminStatsCountWindow) =>
  `All ${formatCount(window.total)} • 24h ${formatCount(window.last24h)} • 7d ${formatCount(window.last7d)}`;
const segmentedButtonClassName = (active: boolean) =>
  active
    ? `${styles.adminSegmentedButton} ${styles.adminSegmentedButtonActive}`
    : styles.adminSegmentedButton;

const MetricCard = ({ label, value, meta }: { label: string; value: string; meta: string }) => (
  <article className={styles.adminCard}>
    <div className={styles.adminCardTop}>
      <span className={styles.adminLabel}>{label}</span>
    </div>
    <p className={styles.adminMetric}>{value}</p>
    <p className={styles.adminSubtext}>{meta}</p>
  </article>
);

const formatFunnelRate = (value: number, baseline: number): string => {
  if (baseline <= 0) return "—";
  return formatPct((value / baseline) * 100);
};

const FirstValueFunnelPanel = ({
  funnel,
  selectedWindow,
}: {
  funnel: AdminFirstValueFunnel;
  selectedWindow: CountWindowKey;
}) => {
  const signupStep = funnel.steps.find((step) => step.stepKey === "signed_up");
  const signupCount = signupStep?.users[selectedWindow] ?? 0;

  return (
    <div className={styles.adminFunnelPanel}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className={styles.adminSectionEyebrow}>First value</p>
          <h2 className={styles.adminSectionTitle}>First-value funnel</h2>
          <p className="tiny subdued">
            A signup only matters when it reaches successful creation and retained output value.
          </p>
        </div>
      </div>

      <div className={styles.adminFunnelList}>
        {funnel.steps.length ? (
          funnel.steps.map((step: AdminFirstValueFunnelStep, index) => {
            const users = step.users[selectedWindow];
            return (
              <div
                key={step.stepKey}
                className={
                  step.tracked
                    ? styles.adminFunnelStep
                    : `${styles.adminFunnelStep} ${styles.adminFunnelStepGap}`
                }
              >
                <span className={styles.adminFunnelIndex}>{index + 1}</span>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.source}</small>
                </span>
                <span className={styles.adminFunnelMetric}>
                  {step.tracked ? formatCount(users) : "Gap"}
                  <small>
                    {step.tracked
                      ? `${formatFunnelRate(users, signupCount)} of signups`
                      : "Not tracked"}
                  </small>
                </span>
              </div>
            );
          })
        ) : (
          <div className={`${styles.adminFunnelStep} ${styles.adminFunnelStepGap}`}>
            <span className={styles.adminFunnelIndex}>!</span>
            <span>
              <strong>First-value funnel unavailable</strong>
              <small>Apply the first-value funnel stats migration to populate this signal.</small>
            </span>
            <span className={styles.adminFunnelMetric}>Gap</span>
          </div>
        )}
      </div>

      {funnel.gaps.length ? (
        <div className={styles.adminFunnelGaps}>
          {funnel.gaps.map((gap) => (
            <span key={gap}>{gap}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const GrowthHealthWarning = ({ reason }: { reason: string | null }) =>
  reason ? (
    <AppMessage
      className={styles.adminWarningPanel}
      tone="warning"
      mode="banner"
      title="Growth stats are partially degraded."
      role="status"
    >
      <p className={styles.adminWarningDescription}>
        Marketing and sales metrics are showing safe fallback values until the growth contract is
        available again.
      </p>
      <p className={styles.adminWarningMeta}>{reason}</p>
    </AppMessage>
  ) : null;

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

const WindowToolbar = ({
  selectedWindow,
  onSelectWindow,
  ariaLabel,
  loading,
  onRefresh,
}: {
  selectedWindow: CountWindowKey;
  onSelectWindow: (window: CountWindowKey) => void;
  ariaLabel: string;
  loading: boolean;
  onRefresh: () => void;
}) => (
  <div className={styles.adminToolbar}>
    <div className={styles.adminSegmentedControl} role="tablist" aria-label={ariaLabel}>
      {WINDOW_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          className={segmentedButtonClassName(option.key === selectedWindow)}
          onClick={() => onSelectWindow(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
    <button type="button" className="ghost-btn mini" onClick={onRefresh} disabled={loading}>
      {loading ? "Refreshing…" : "Refresh"}
    </button>
  </div>
);

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
            <p className={styles.adminSectionEyebrow}>Growth</p>
            <h2 className={styles.adminSectionTitle}>Marketing performance</h2>
            <p className="tiny subdued">
              Track signup velocity, activation speed, source quality, and retention after value.
            </p>
          </div>
          <WindowToolbar
            selectedWindow={selectedWindow}
            onSelectWindow={setSelectedWindow}
            ariaLabel="Marketing stats window"
            loading={loading}
            onRefresh={onRefresh}
          />
        </div>
        <GrowthHealthWarning reason={health.reason} />
        <FirstValueFunnelPanel
          funnel={marketing.firstValueFunnel}
          selectedWindow={selectedWindow}
        />
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
            <p className={styles.adminSectionEyebrow}>Conversion targets</p>
            <h2 className={styles.adminSectionTitle}>Signed up, not subscribed</h2>
            <p className="tiny subdued">
              Prioritize account-first signups that have not reached a current paid subscription.
            </p>
          </div>
        </div>
        <div className={styles.adminGrid}>
          <MetricCard
            label="Not Subscribed"
            value={formatCount(marketing.cohorts.summary.signedUpNotSubscribed)}
            meta={`${formatCount(marketing.cohorts.summary.neverSubscribed)} never paid • ${formatCount(marketing.cohorts.summary.lapsedOrCanceled)} lapsed`}
          />
          <MetricCard
            label="No Generation Yet"
            value={formatCount(marketing.cohorts.summary.notSubscribedNoGeneration)}
            meta="Best fit for first-generation onboarding campaigns"
          />
          <MetricCard
            label="Generated, Not Paid"
            value={formatCount(marketing.cohorts.summary.notSubscribedWithGeneration)}
            meta={`${formatCount(marketing.cohorts.summary.notSubscribedWithSuccess)} with success • ${formatCount(marketing.cohorts.summary.notSubscribedWithSavedOutput)} saved`}
          />
          <MetricCard
            label="Current Subscribers"
            value={formatCount(marketing.cohorts.summary.currentlySubscribed)}
            meta={`${formatCount(marketing.cohorts.summary.subscribedAndGenerated)} generated • ${formatCount(marketing.cohorts.summary.subscribedNoGeneration)} no generation`}
          />
          <MetricCard
            label="Bought Credits"
            value={formatCount(marketing.cohorts.summary.boughtCredits)}
            meta={`${formatCount(marketing.cohorts.summary.subscribedBoughtCredits)} also currently subscribed`}
          />
          <MetricCard
            label="Storage Add-ons"
            value={formatCount(marketing.cohorts.summary.activeStorageAddons)}
            meta={`${formatCount(marketing.cohorts.summary.subscribedBoughtCreditsAndAddons)} bought credits and add-ons`}
          />
        </div>
        <TableShell>
          <div className={styles.adminTable} style={CONVERSION_TARGET_TABLE_STYLE}>
            <div
              className={styles.adminTableHead}
              style={{
                gridTemplateColumns:
                  "minmax(0, 1.45fr) 0.95fr 0.9fr 0.95fr 0.9fr 0.75fr 0.75fr 0.85fr 1.2fr",
              }}
            >
              <span>User</span>
              <span>Source</span>
              <span>Subscription</span>
              <span>Generation</span>
              <span>Last Activity</span>
              <span>Success</span>
              <span>Saved</span>
              <span>Add-ons</span>
              <span>Campaign</span>
            </div>
            {marketing.cohorts.conversionTargetRows.length ? (
              marketing.cohorts.conversionTargetRows.map((row) => (
                <div
                  key={row.userId}
                  className={styles.adminTableRow}
                  style={{
                    gridTemplateColumns:
                      "minmax(0, 1.45fr) 0.95fr 0.9fr 0.95fr 0.9fr 0.75fr 0.75fr 0.85fr 1.2fr",
                  }}
                >
                  <span className={styles.adminMonoCell}>
                    {row.email}
                    <small className={styles.adminInlineMeta}>
                      signed up {formatDateTime(row.signedUpAt)}
                    </small>
                  </span>
                  <span className={styles.adminMonoCell}>
                    {row.sourceKey}
                    <small className={styles.adminInlineMeta}>{row.campaignKey}</small>
                  </span>
                  <span>{formatSubscriptionBucket(row.subscriptionBucket)}</span>
                  <span>
                    {formatGenerationBucket(row.generationBucket)}
                    <small className={styles.adminInlineMeta}>
                      first {formatDateTime(row.firstGenerationAt)}
                    </small>
                  </span>
                  <span>{formatDateTime(row.lastActivityAt ?? row.lastGenerationAt)}</span>
                  <span>{formatCount(row.successfulGenerations)}</span>
                  <span>{formatCount(row.savedOutputs)}</span>
                  <span>
                    {formatStorageBytes(row.activeStorageAddonBytes)}
                    <small className={styles.adminInlineMeta}>
                      top-ups {formatCount(row.topUpPurchaseCount)}
                    </small>
                  </span>
                  <span>{formatCampaignBucket(row.recommendedCampaignBucket)}</span>
                </div>
              ))
            ) : (
              <EmptyTableRow message="No signed-up non-subscriber targets are available yet." />
            )}
          </div>
        </TableShell>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Retention</p>
            <h2 className={styles.adminSectionTitle}>Retention by activation</h2>
            <p className="tiny subdued">
              Compare D1, D7, and D30 return behavior for users who reached value versus users who
              did not.
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
            <p className={styles.adminSectionEyebrow}>Attribution</p>
            <h2 className={styles.adminSectionTitle}>Acquisition sources</h2>
            <p className="tiny subdued">
              First-touch attribution shows which sources and campaigns produce activated,
              qualified, and paid users.
            </p>
          </div>
        </div>
        <TableShell>
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
            {marketing.attribution.sources.length ? (
              marketing.attribution.sources.map((row) => (
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
              <EmptyTableRow message="No attributed signup rows are available yet." />
            )}
          </div>
        </TableShell>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Attribution</p>
            <h2 className={styles.adminSectionTitle}>Campaigns</h2>
            <p className="tiny subdued">
              Campaign rows use the same stitched attribution contract as source rows.
            </p>
          </div>
        </div>
        <TableShell>
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
            {marketing.attribution.campaigns.length ? (
              marketing.attribution.campaigns.map((row) => (
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
              <EmptyTableRow message="No attributed campaign rows are available yet." />
            )}
          </div>
        </TableShell>
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
            <p className={styles.adminSectionEyebrow}>Revenue</p>
            <h2 className={styles.adminSectionTitle}>Sales performance</h2>
            <p className="tiny subdued">
              Watch pricing intent, checkout behavior, paid conversion, and qualified users from one
              operator view.
            </p>
          </div>
          <WindowToolbar
            selectedWindow={selectedWindow}
            onSelectWindow={setSelectedWindow}
            ariaLabel="Sales stats window"
            loading={loading}
            onRefresh={onRefresh}
          />
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
            <p className={styles.adminSectionEyebrow}>Pipeline</p>
            <h2 className={styles.adminSectionTitle}>High-intent users</h2>
            <p className="tiny subdued">
              Qualified and monetization-adjacent users are ranked by PQL score, checkout activity,
              and paid conversion state.
            </p>
          </div>
        </div>
        <TableShell>
          <div className={styles.adminTable} style={HIGH_INTENT_TABLE_STYLE}>
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
              <EmptyTableRow message="No high-intent users are available yet." />
            )}
          </div>
        </TableShell>
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
  generationBreakdown,
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
  const activeLensConfig =
    LENS_OPTIONS.find((option) => option.key === activeLens) ?? LENS_OPTIONS[0];
  const activeLensDegraded = activeLens === "product" ? health.degraded : growth.health.degraded;
  const activeLensReason =
    activeLens === "product" ? (error ?? health.reason) : growth.health.reason;
  const activeLensMetaReason = activeLens === "product" && error ? null : activeLensReason;
  const activeStatusLabel = activeLensDegraded ? "Fallback mode" : "Live contract";

  return (
    <>
      <section className={styles.statsWorkspaceHero}>
        <div className={styles.statsWorkspaceHeroMain}>
          <p className={styles.statsWorkspaceEyebrow}>{activeLensConfig.eyebrow}</p>
          <div className={styles.statsWorkspaceTitleRow}>
            <h2 className={styles.statsWorkspaceTitle}>{activeLensConfig.label} analytics</h2>
            <span
              className={`${styles.statsWorkspaceStatusPill} ${
                activeLensDegraded
                  ? styles.statsWorkspaceStatusPillWarn
                  : styles.statsWorkspaceStatusPillOk
              }`}
            >
              {activeStatusLabel}
            </span>
          </div>
          <p className={styles.statsWorkspaceDescription}>{activeLensConfig.description}</p>
          <div className={styles.statsWorkspaceMetaRow}>
            <span className={styles.statsWorkspaceMetaPill}>
              Snapshot {generatedAt ? formatDateTime(generatedAt) : "pending first refresh"}
            </span>
            {activeLensMetaReason ? (
              <span className={styles.statsWorkspaceMetaPill}>{activeLensMetaReason}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.statsLensGrid} role="tablist" aria-label="Stats workspace lens">
          {LENS_OPTIONS.map((lens) => (
            <button
              key={lens.key}
              type="button"
              aria-label={lens.label}
              aria-pressed={activeLens === lens.key}
              className={
                activeLens === lens.key
                  ? `${styles.statsLensButton} ${styles.statsLensButtonActive}`
                  : styles.statsLensButton
              }
              onClick={() => setActiveLens(lens.key)}
            >
              <span className={styles.statsLensButtonLabel}>{lens.label}</span>
            </button>
          ))}
        </div>
      </section>

      {activeLens === "product" ? (
        <AdminGlobalStatsPanel
          overview={overview}
          models={models}
          generationBreakdown={generationBreakdown}
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
