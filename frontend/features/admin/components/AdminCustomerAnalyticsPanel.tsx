/**
 * Admin customer analytics panel.
 * Renders one customer's detailed credit, billing, revenue, generation, and source-health stats.
 */
import { type FormEvent } from "react";
import { AppMessage } from "../../../components/AppMessage";
import { formatStorageBytes } from "../../billing/storage";
import type { AdminUserAnalyticsResponse } from "../types";
import styles from "../../../styles/admin.module.css";

type AdminCustomerAnalyticsPanelProps = {
  customerIdInput: string;
  activeCustomerId: string | null;
  analytics: AdminUserAnalyticsResponse | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  setCustomerIdInput: (value: string) => void;
  loadCustomerAnalytics: (nextCustomerId?: string) => Promise<void>;
  formatUsd: (value: number | null) => string;
};

const formatCompactDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatInteger = (value: number | null | undefined): string =>
  value == null ? "—" : Math.trunc(value).toLocaleString();

const formatCurrencyCents = (
  valueCents: number | null | undefined,
  formatUsd: (value: number | null) => string
): string => (valueCents == null ? "—" : formatUsd(valueCents / 100));

const sourceStatusLabel = (
  status: AdminUserAnalyticsResponse["sourceHealth"][number]["status"]
) => {
  if (status === "exact") return "Exact";
  if (status === "partial") return "Partial";
  return "Unavailable";
};

const sourceStatusClassName = (
  status: AdminUserAnalyticsResponse["sourceHealth"][number]["status"]
): string => {
  if (status === "exact") return styles.pillOk;
  if (status === "partial") return styles.pillWarn;
  return styles.pillCritical;
};

/**
 * Displays a selected customer's detailed analytics inside the admin analytics page.
 */
export function AdminCustomerAnalyticsPanel({
  customerIdInput,
  activeCustomerId,
  analytics,
  loading,
  error,
  loaded,
  setCustomerIdInput,
  loadCustomerAnalytics,
  formatUsd,
}: AdminCustomerAnalyticsPanelProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadCustomerAnalytics();
  };
  const targetLabel = analytics?.target.email ?? activeCustomerId ?? "No customer selected";

  return (
    <section className={styles.adminSection} data-testid="admin-customer-analytics-panel">
      <div className={styles.adminSectionHead}>
        <div>
          <p className={styles.adminSectionEyebrow}>Customer analytics</p>
          <h2 className={styles.adminSectionTitle}>Customer detail</h2>
          <p className={styles.adminSubtext}>
            Detailed account analytics for one selected customer.
          </p>
        </div>
        <form className={styles.adminCustomerAnalyticsLookup} onSubmit={handleSubmit}>
          <label className={`${styles.manualAdjustField} ${styles.controlFieldCompact}`}>
            <span className={styles.adminLabel}>Customer user id</span>
            <input
              className={styles.searchInput}
              type="text"
              value={customerIdInput}
              onChange={(event) => setCustomerIdInput(event.target.value)}
              placeholder="Paste user id"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className={`ghost-btn mini ${styles.manualAdjustPrimaryAction}`}
            disabled={loading || !customerIdInput.trim()}
          >
            {loading ? "Loading…" : "Load customer"}
          </button>
        </form>
      </div>

      <div className={styles.adminCustomerAnalyticsMetaRow}>
        <span className={styles.statsWorkspaceMetaPill}>{targetLabel}</span>
        {analytics?.generatedAt ? (
          <span className={styles.statsWorkspaceMetaPill}>
            Snapshot {formatCompactDate(analytics.generatedAt)}
          </span>
        ) : null}
        {loaded && analytics ? (
          <span className={styles.statsWorkspaceMetaPill}>
            {analytics.billing.paymentExempt ? "Payment exempt" : "Billable account"}
          </span>
        ) : null}
      </div>

      {error ? (
        <AppMessage
          className={styles.adminWarningPanel}
          tone="warning"
          mode="banner"
          title="Customer analytics unavailable"
          role="status"
          ariaLive="polite"
        >
          <p className={styles.adminWarningMeta}>{error}</p>
        </AppMessage>
      ) : null}

      {loading && !analytics ? (
        <p className={styles.controlNote}>Loading customer analytics…</p>
      ) : null}

      {analytics ? (
        <div className={styles.customerAnalyticsStack}>
          <div className={styles.customerAnalyticsGrid}>
            <article className={styles.customerAnalyticsCard}>
              <p className={styles.customerAnalyticsCardTitle}>Credits</p>
              <dl className={styles.customerAnalyticsMetricList}>
                <div>
                  <dt>Current spendable</dt>
                  <dd>{formatInteger(analytics.credits.spendableCredits)}</dd>
                </div>
                <div>
                  <dt>Total spent</dt>
                  <dd>{formatInteger(analytics.credits.totalCreditsSpent)}</dd>
                </div>
                <div>
                  <dt>This cycle spent</dt>
                  <dd>{formatInteger(analytics.credits.currentCycleSpentCredits)}</dd>
                </div>
                <div>
                  <dt>Generation spend</dt>
                  <dd>{formatInteger(analytics.credits.generationCreditsSpent)}</dd>
                </div>
                <div>
                  <dt>Expiring</dt>
                  <dd>{formatInteger(analytics.credits.expiringCredits)}</dd>
                </div>
                <div>
                  <dt>Next expiry</dt>
                  <dd>
                    {analytics.credits.nextExpiringCredits > 0
                      ? `${analytics.credits.nextExpiringCredits.toLocaleString()} on ${formatCompactDate(
                          analytics.credits.nextExpiresAt
                        )}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </article>

            <article className={styles.customerAnalyticsCard}>
              <p className={styles.customerAnalyticsCardTitle}>Revenue</p>
              <dl className={styles.customerAnalyticsMetricList}>
                <div>
                  <dt>Total revenue</dt>
                  <dd>{formatCurrencyCents(analytics.revenue.totalRevenueCents, formatUsd)}</dd>
                </div>
                <div>
                  <dt>MRR</dt>
                  <dd>
                    {formatCurrencyCents(analytics.billing.monthlyRecurringRevenueCents, formatUsd)}
                  </dd>
                </div>
                <div>
                  <dt>Subscription revenue</dt>
                  <dd>
                    {formatCurrencyCents(analytics.revenue.subscriptionRevenueCents, formatUsd)}
                  </dd>
                </div>
                <div>
                  <dt>Top-up revenue</dt>
                  <dd>{formatCurrencyCents(analytics.revenue.topUpRevenueCents, formatUsd)}</dd>
                </div>
                <div>
                  <dt>Invoices</dt>
                  <dd>{formatInteger(analytics.revenue.invoiceCount)}</dd>
                </div>
                <div>
                  <dt>Renewal / end</dt>
                  <dd>{formatCompactDate(analytics.billing.renewalAt)}</dd>
                </div>
              </dl>
              <p className={styles.controlNote}>{analytics.revenue.note}</p>
            </article>

            <article className={styles.customerAnalyticsCard}>
              <p className={styles.customerAnalyticsCardTitle}>Generations</p>
              <dl className={styles.customerAnalyticsMetricList}>
                <div>
                  <dt>Total</dt>
                  <dd>{formatInteger(analytics.generations.total)}</dd>
                </div>
                <div>
                  <dt>Succeeded</dt>
                  <dd>{formatInteger(analytics.generations.succeeded)}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd>{formatInteger(analytics.generations.failed)}</dd>
                </div>
                <div>
                  <dt>Last 30d</dt>
                  <dd>{formatInteger(analytics.generations.last30dTotal)}</dd>
                </div>
                <div>
                  <dt>Images</dt>
                  <dd>{formatInteger(analytics.mediaBreakdown.images)}</dd>
                </div>
                <div>
                  <dt>Videos</dt>
                  <dd>{formatInteger(analytics.mediaBreakdown.videos)}</dd>
                </div>
              </dl>
            </article>

            <article className={styles.customerAnalyticsCard}>
              <p className={styles.customerAnalyticsCardTitle}>Audio</p>
              <dl className={styles.customerAnalyticsMetricList}>
                <div>
                  <dt>Total audio</dt>
                  <dd>{formatInteger(analytics.mediaBreakdown.audio)}</dd>
                </div>
                <div>
                  <dt>Voices</dt>
                  <dd>{formatInteger(analytics.mediaBreakdown.voices)}</dd>
                </div>
                <div>
                  <dt>Music</dt>
                  <dd>{formatInteger(analytics.mediaBreakdown.music)}</dd>
                </div>
                <div>
                  <dt>Sound effects</dt>
                  <dd>{formatInteger(analytics.mediaBreakdown.soundEffects)}</dd>
                </div>
                <div>
                  <dt>Unknown audio</dt>
                  <dd>{formatInteger(analytics.mediaBreakdown.unknownAudio)}</dd>
                </div>
                <div>
                  <dt>Unknown media</dt>
                  <dd>{formatInteger(analytics.mediaBreakdown.unknown)}</dd>
                </div>
              </dl>
            </article>

            <article className={styles.customerAnalyticsCard}>
              <p className={styles.customerAnalyticsCardTitle}>Top-ups</p>
              <dl className={styles.customerAnalyticsMetricList}>
                <div>
                  <dt>Purchases</dt>
                  <dd>{formatInteger(analytics.topUps.purchaseCount)}</dd>
                </div>
                <div>
                  <dt>Credits purchased</dt>
                  <dd>{formatInteger(analytics.topUps.creditsPurchased)}</dd>
                </div>
                <div>
                  <dt>Revenue</dt>
                  <dd>{formatCurrencyCents(analytics.topUps.revenueCents, formatUsd)}</dd>
                </div>
              </dl>
            </article>

            <article className={styles.customerAnalyticsCard}>
              <p className={styles.customerAnalyticsCardTitle}>Storage</p>
              <dl className={styles.customerAnalyticsMetricList}>
                <div>
                  <dt>Used</dt>
                  <dd>
                    {analytics.storage.usedBytes == null
                      ? "—"
                      : formatStorageBytes(analytics.storage.usedBytes)}
                  </dd>
                </div>
                <div>
                  <dt>Limit</dt>
                  <dd>
                    {analytics.storage.totalLimitBytes == null
                      ? "—"
                      : formatStorageBytes(analytics.storage.totalLimitBytes)}
                  </dd>
                </div>
                <div>
                  <dt>Add-ons</dt>
                  <dd>
                    {analytics.storage.addonLimitBytes == null
                      ? "—"
                      : formatStorageBytes(analytics.storage.addonLimitBytes)}
                  </dd>
                </div>
                <div>
                  <dt>Remaining</dt>
                  <dd>
                    {analytics.storage.remainingBytes == null
                      ? "—"
                      : formatStorageBytes(analytics.storage.remainingBytes)}
                  </dd>
                </div>
              </dl>
            </article>
          </div>

          <div className={styles.customerAnalyticsGridCompact}>
            <article className={styles.customerAnalyticsCard}>
              <p className={styles.customerAnalyticsCardTitle}>Agent usage</p>
              <p className={styles.controlNote}>
                Standard mode: {analytics.agentUsage.standard.note}
              </p>
              <p className={styles.controlNote}>Pulse mode: {analytics.agentUsage.pulse.note}</p>
            </article>

            <article className={styles.customerAnalyticsCard}>
              <p className={styles.customerAnalyticsCardTitle}>Source health</p>
              <div className={styles.customerAnalyticsSourceList}>
                {analytics.sourceHealth.map((note) => (
                  <div key={`${note.key}-${note.label}`}>
                    <span className={`${styles.pill} ${sourceStatusClassName(note.status)}`}>
                      {sourceStatusLabel(note.status)}
                    </span>
                    <span>
                      <strong>{note.label}</strong> · {note.detail}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : !loading && !error ? (
        <p className={styles.controlNote}>No customer analytics loaded.</p>
      ) : null}
    </section>
  );
}
