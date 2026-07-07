/**
 * Admin global-stats panel.
 * Renders the v1 admin stats workspace for overview, models, workflows,
 * assets, and project activity.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import styles from "../../../styles/admin.module.css";
import type {
  AdminGenerationBreakdown,
  AdminGenerationBreakdownModelMediaTypeRow,
  AdminGenerationBreakdownUserRow,
  AdminAssetEventUsageRow,
  AdminGlobalModelUsageRow,
  AdminGlobalStatsAssets,
  AdminGlobalStatsHealth,
  AdminGlobalStatsOverview,
  AdminGlobalStatsProjects,
  AdminGlobalStatsWorkflows,
  AdminProjectLeaderboardRow,
  AdminStatsCountWindow,
  AdminWorkflowModeUsageRow,
  AdminWorkflowToolUsageRow,
} from "../types";

type AdminGlobalStatsPanelProps = {
  overview: AdminGlobalStatsOverview;
  models: AdminGlobalModelUsageRow[];
  generationBreakdown: AdminGenerationBreakdown;
  workflows: AdminGlobalStatsWorkflows;
  assets: AdminGlobalStatsAssets;
  projects: AdminGlobalStatsProjects;
  health: AdminGlobalStatsHealth;
  generatedAt: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

type CountWindowKey = keyof AdminStatsCountWindow;

const WINDOW_OPTIONS: Array<{ key: CountWindowKey; label: string }> = [
  { key: "total", label: "All time" },
  { key: "last24h", label: "24h" },
  { key: "last7d", label: "7d" },
];

const TABLE_WIDE_STYLE: React.CSSProperties = {
  minWidth: 900,
};

const TABLE_MEDIUM_STYLE: React.CSSProperties = {
  minWidth: 640,
};

const TOP_TABLE_ROW_LIMIT = 8;

const formatCount = (value: number): string => value.toLocaleString();

const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

const formatCountWindowValue = (
  window: AdminStatsCountWindow,
  selectedWindow: CountWindowKey
): string => formatCount(window[selectedWindow]);

const formatCountWindowMeta = (window: AdminStatsCountWindow): string =>
  `All ${formatCount(window.total)} • 24h ${formatCount(window.last24h)} • 7d ${formatCount(window.last7d)}`;
const segmentedButtonClassName = (active: boolean) =>
  active
    ? `${styles.adminSegmentedButton} ${styles.adminSegmentedButtonActive}`
    : styles.adminSegmentedButton;

const formatSuccessRate = (successful: number, total: number): string => {
  if (total <= 0) return "—";
  return `${Math.round((successful / total) * 100)}%`;
};

const formatPercent = (part: number, total: number): string => {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
};

const humanizeKey = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "Unknown";

const formatMediaType = (value: string): string =>
  value === "audio" ? "Audio / sound" : humanizeKey(value);

const formatHealthSource = (value: string): string =>
  value === "rpc" ? "RPC" : value === "legacy_fallback" ? "Legacy fallback" : "Unavailable";

const formatStatsErrorSummary = (value: string | null): string => {
  if (!value) return "Stats data is temporarily unavailable.";
  const normalized = value.trim();
  if (normalized.toLowerCase().includes("failed to load")) {
    return "Stats data is temporarily unavailable.";
  }
  return "Some stats sources failed to load.";
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

const SignalCard = ({
  label,
  value,
  meta,
  accent = false,
}: {
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
}) => (
  <article
    className={
      accent ? `${styles.adminSignalCard} ${styles.adminSignalCardAccent}` : styles.adminSignalCard
    }
  >
    <span className={styles.adminLabel}>{label}</span>
    <strong className={styles.adminSignalValue}>{value}</strong>
    <span className={styles.adminSignalMeta}>{meta}</span>
  </article>
);

const SignalPill = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.adminSignalPill}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const MixRow = ({ label, value, total }: { label: string; value: number; total: number }) => {
  const percent = formatPercent(value, total);

  return (
    <div className={styles.adminMixRow}>
      <div className={styles.adminMixRowTop}>
        <span>{label}</span>
        <strong>
          {formatCount(value)} <small>{percent}</small>
        </strong>
      </div>
      <div className={styles.adminMixTrack} aria-hidden="true">
        <span className={styles.adminMixFill} style={{ width: percent }} />
      </div>
    </div>
  );
};

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

const ModelsTable = ({
  rows,
  selectedWindow,
}: {
  rows: AdminGlobalModelUsageRow[];
  selectedWindow: CountWindowKey;
}) => {
  const visibleRows = rows.slice(0, TOP_TABLE_ROW_LIMIT);

  return (
    <TableShell>
      <div className={styles.adminTable} style={{ minWidth: 760 }}>
        <div
          className={styles.adminTableHead}
          style={{
            gridTemplateColumns: "minmax(0, 1.8fr) 0.85fr 0.85fr 0.85fr 0.75fr 1fr",
          }}
        >
          <span>Model</span>
          <span>Runs</span>
          <span>Success rate</span>
          <span>Saved</span>
          <span>Users</span>
          <span>Last used</span>
        </div>
        {visibleRows.length ? (
          visibleRows.map((row) => {
            const accepted = row.acceptedGenerations[selectedWindow];
            const successful = row.successfulGenerations[selectedWindow];
            return (
              <div
                key={row.modelId}
                className={styles.adminTableRow}
                style={{
                  gridTemplateColumns: "minmax(0, 1.8fr) 0.85fr 0.85fr 0.85fr 0.75fr 1fr",
                }}
              >
                <span className={styles.adminMonoCell}>{row.modelId}</span>
                <span>
                  {formatCountWindowValue(row.acceptedGenerations, selectedWindow)}
                  <small className={styles.adminInlineMeta}>
                    clicks {formatCountWindowValue(row.generateClicks, selectedWindow)}
                  </small>
                </span>
                <span>
                  {formatSuccessRate(successful, accepted)}
                  <small className={styles.adminInlineMeta}>
                    {formatCount(successful)} success •{" "}
                    {formatCount(row.failedGenerations[selectedWindow])} fail
                  </small>
                </span>
                <span>{formatCountWindowValue(row.savedGenerations, selectedWindow)}</span>
                <span>{formatCount(row.uniqueGenerationUsers)}</span>
                <span>{formatDateTime(row.lastGenerationAt ?? row.lastGenerateClickAt)}</span>
              </div>
            );
          })
        ) : (
          <EmptyTableRow message="No model usage stats are available yet." />
        )}
        {rows.length > visibleRows.length ? (
          <p className={styles.adminTableFootnote}>
            Showing top {visibleRows.length} of {formatCount(rows.length)} model rows.
          </p>
        ) : null}
      </div>
    </TableShell>
  );
};

const GenerationUsersTable = ({
  rows,
  selectedWindow,
}: {
  rows: AdminGenerationBreakdownUserRow[];
  selectedWindow: CountWindowKey;
}) => {
  const visibleRows = rows.slice(0, TOP_TABLE_ROW_LIMIT);

  return (
    <TableShell>
      <div className={styles.adminTable} style={{ minWidth: 820 }}>
        <div
          className={styles.adminTableHead}
          style={{
            gridTemplateColumns: "minmax(0, 1.7fr) 0.8fr 1.25fr 0.85fr 0.75fr 1fr",
          }}
        >
          <span>User</span>
          <span>Runs</span>
          <span>Mix</span>
          <span>Success</span>
          <span>Models</span>
          <span>Last run</span>
        </div>
        {visibleRows.length ? (
          visibleRows.map((row) => (
            <div
              key={row.userId}
              className={styles.adminTableRow}
              style={{
                gridTemplateColumns: "minmax(0, 1.7fr) 0.8fr 1.25fr 0.85fr 0.75fr 1fr",
              }}
            >
              <span>
                {row.email ?? "Unknown email"}
                <small className={styles.adminInlineMeta}>{row.userId}</small>
              </span>
              <span>
                {formatCountWindowValue(row.acceptedGenerations, selectedWindow)}
                <small className={styles.adminInlineMeta}>
                  {formatCountWindowMeta(row.acceptedGenerations)}
                </small>
              </span>
              <span>
                Image {formatCountWindowValue(row.imageGenerations, selectedWindow)}
                <small className={styles.adminInlineMeta}>
                  Video {formatCountWindowValue(row.videoGenerations, selectedWindow)} • Audio{" "}
                  {formatCountWindowValue(row.audioGenerations, selectedWindow)}
                </small>
              </span>
              <span>
                {formatCountWindowValue(row.successfulGenerations, selectedWindow)}
                <small className={styles.adminInlineMeta}>
                  failed {formatCountWindowValue(row.failedGenerations, selectedWindow)}
                </small>
              </span>
              <span>{formatCount(row.uniqueModels)}</span>
              <span>{formatDateTime(row.lastGenerationAt)}</span>
            </div>
          ))
        ) : (
          <EmptyTableRow message="No per-user generation stats are available yet." />
        )}
        {rows.length > visibleRows.length ? (
          <p className={styles.adminTableFootnote}>
            Showing top {visibleRows.length} of {formatCount(rows.length)} user rows.
          </p>
        ) : null}
      </div>
    </TableShell>
  );
};

const ModelMediaTypeTable = ({
  rows,
  selectedWindow,
}: {
  rows: AdminGenerationBreakdownModelMediaTypeRow[];
  selectedWindow: CountWindowKey;
}) => {
  const visibleRows = rows.slice(0, TOP_TABLE_ROW_LIMIT);

  return (
    <TableShell>
      <div className={styles.adminTable} style={{ minWidth: 780 }}>
        <div
          className={styles.adminTableHead}
          style={{
            gridTemplateColumns: "minmax(0, 1.7fr) 0.8fr 0.85fr 0.9fr 0.75fr 1fr",
          }}
        >
          <span>Model</span>
          <span>Type</span>
          <span>Runs</span>
          <span>Success</span>
          <span>Users</span>
          <span>Last run</span>
        </div>
        {visibleRows.length ? (
          visibleRows.map((row) => (
            <div
              key={`${row.modelId}:${row.mediaType}`}
              className={styles.adminTableRow}
              style={{
                gridTemplateColumns: "minmax(0, 1.7fr) 0.8fr 0.85fr 0.9fr 0.75fr 1fr",
              }}
            >
              <span className={styles.adminMonoCell}>{row.modelId}</span>
              <span>{formatMediaType(row.mediaType)}</span>
              <span>
                {formatCountWindowValue(row.acceptedGenerations, selectedWindow)}
                <small className={styles.adminInlineMeta}>
                  {formatCountWindowMeta(row.acceptedGenerations)}
                </small>
              </span>
              <span>
                {formatCountWindowValue(row.successfulGenerations, selectedWindow)}
                <small className={styles.adminInlineMeta}>
                  failed {formatCountWindowValue(row.failedGenerations, selectedWindow)}
                </small>
              </span>
              <span>{formatCount(row.uniqueUsers)}</span>
              <span>{formatDateTime(row.lastGenerationAt)}</span>
            </div>
          ))
        ) : (
          <EmptyTableRow message="No model/media type generation stats are available yet." />
        )}
        {rows.length > visibleRows.length ? (
          <p className={styles.adminTableFootnote}>
            Showing top {visibleRows.length} of {formatCount(rows.length)} model/type rows.
          </p>
        ) : null}
      </div>
    </TableShell>
  );
};

const WorkflowToolTable = ({
  rows,
  selectedWindow,
}: {
  rows: AdminWorkflowToolUsageRow[];
  selectedWindow: CountWindowKey;
}) => (
  <TableShell>
    <div className={styles.adminTable} style={TABLE_WIDE_STYLE}>
      <div
        className={styles.adminTableHead}
        style={{
          gridTemplateColumns: "minmax(0, 1.2fr) 0.9fr 0.9fr 0.95fr 0.9fr 0.8fr 1fr",
        }}
      >
        <span>Tool</span>
        <span>Clicks</span>
        <span>Style clicks</span>
        <span>Character clicks</span>
        <span>Ref clicks</span>
        <span>Users</span>
        <span>Last click</span>
      </div>
      {rows.length ? (
        rows.map((row) => (
          <div
            key={row.toolKey}
            className={styles.adminTableRow}
            style={{
              gridTemplateColumns: "minmax(0, 1.2fr) 0.9fr 0.9fr 0.95fr 0.9fr 0.8fr 1fr",
            }}
          >
            <span>{humanizeKey(row.toolKey)}</span>
            <span>
              {formatCountWindowValue(row.generateClicks, selectedWindow)}
              <small className={styles.adminInlineMeta}>
                {formatCountWindowMeta(row.generateClicks)}
              </small>
            </span>
            <span>{formatCountWindowValue(row.styleClicks, selectedWindow)}</span>
            <span>{formatCountWindowValue(row.characterModeClicks, selectedWindow)}</span>
            <span>{formatCountWindowValue(row.referenceAssistedClicks, selectedWindow)}</span>
            <span>{formatCount(row.uniqueClickUsers)}</span>
            <span>{formatDateTime(row.lastGenerateClickAt)}</span>
          </div>
        ))
      ) : (
        <EmptyTableRow message="No workflow click stats are available yet." />
      )}
    </div>
  </TableShell>
);

const WorkflowModeTable = ({
  rows,
  selectedWindow,
}: {
  rows: AdminWorkflowModeUsageRow[];
  selectedWindow: CountWindowKey;
}) => (
  <TableShell>
    <div className={styles.adminTable} style={TABLE_WIDE_STYLE}>
      <div
        className={styles.adminTableHead}
        style={{
          gridTemplateColumns: "minmax(0, 1fr) 0.8fr 0.85fr 0.95fr 0.9fr 0.9fr 0.9fr 1fr",
        }}
      >
        <span>Mode</span>
        <span>Clicks</span>
        <span>Accepted</span>
        <span>Success rate</span>
        <span>Styled runs</span>
        <span>Character runs</span>
        <span>Ref runs</span>
        <span>Last run</span>
      </div>
      {rows.length ? (
        rows.map((row) => {
          const accepted = row.acceptedGenerations[selectedWindow];
          const successful = row.successfulGenerations[selectedWindow];
          return (
            <div
              key={row.modeKey}
              className={styles.adminTableRow}
              style={{
                gridTemplateColumns: "minmax(0, 1fr) 0.8fr 0.85fr 0.95fr 0.9fr 0.9fr 0.9fr 1fr",
              }}
            >
              <span>{humanizeKey(row.modeKey)}</span>
              <span>{formatCountWindowValue(row.generateClicks, selectedWindow)}</span>
              <span>{formatCountWindowValue(row.acceptedGenerations, selectedWindow)}</span>
              <span>
                {formatSuccessRate(successful, accepted)}
                <small className={styles.adminInlineMeta}>
                  {formatCount(successful)} success •{" "}
                  {formatCount(row.failedGenerations[selectedWindow])} fail
                </small>
              </span>
              <span>{formatCountWindowValue(row.styleAppliedGenerations, selectedWindow)}</span>
              <span>{formatCountWindowValue(row.characterModeGenerations, selectedWindow)}</span>
              <span>
                {formatCountWindowValue(row.referenceAssistedGenerations, selectedWindow)}
              </span>
              <span>{formatDateTime(row.lastGenerationAt)}</span>
            </div>
          );
        })
      ) : (
        <EmptyTableRow message="No workflow mode stats are available yet." />
      )}
    </div>
  </TableShell>
);

const AssetEventsTable = ({
  rows,
  selectedWindow,
}: {
  rows: AdminAssetEventUsageRow[];
  selectedWindow: CountWindowKey;
}) => (
  <TableShell>
    <div className={styles.adminTable} style={TABLE_MEDIUM_STYLE}>
      <div
        className={styles.adminTableHead}
        style={{
          gridTemplateColumns: "minmax(0, 1.2fr) 0.9fr 0.8fr 1fr",
        }}
      >
        <span>Event</span>
        <span>Count</span>
        <span>Users</span>
        <span>Last event</span>
      </div>
      {rows.length ? (
        rows.map((row) => (
          <div
            key={row.eventType}
            className={styles.adminTableRow}
            style={{
              gridTemplateColumns: "minmax(0, 1.2fr) 0.9fr 0.8fr 1fr",
            }}
          >
            <span>{humanizeKey(row.eventType)}</span>
            <span>
              {formatCountWindowValue(row.count, selectedWindow)}
              <small className={styles.adminInlineMeta}>{formatCountWindowMeta(row.count)}</small>
            </span>
            <span>{formatCount(row.uniqueUsers)}</span>
            <span>{formatDateTime(row.lastEventAt)}</span>
          </div>
        ))
      ) : (
        <EmptyTableRow message="No media asset event stats are available yet." />
      )}
    </div>
  </TableShell>
);

const ProjectLeaderboardTable = ({
  rows,
  selectedWindow,
}: {
  rows: AdminProjectLeaderboardRow[];
  selectedWindow: CountWindowKey;
}) => (
  <TableShell>
    <div className={styles.adminTable} style={TABLE_WIDE_STYLE}>
      <div
        className={styles.adminTableHead}
        style={{
          gridTemplateColumns: "minmax(0, 1.6fr) 1fr 1fr 1fr 1.1fr",
        }}
      >
        <span>Project</span>
        <span>Generations</span>
        <span>Media</span>
        <span>Prompts</span>
        <span>Last activity</span>
      </div>
      {rows.length ? (
        rows.map((row) => (
          <div
            key={row.projectId}
            className={styles.adminTableRow}
            style={{
              gridTemplateColumns: "minmax(0, 1.6fr) 1fr 1fr 1fr 1.1fr",
            }}
          >
            <span>
              {row.title}
              <small className={styles.adminInlineMeta}>{row.projectId}</small>
            </span>
            <span>
              {formatCountWindowValue(row.generationCount, selectedWindow)}
              <small className={styles.adminInlineMeta}>
                {formatCountWindowMeta(row.generationCount)}
              </small>
            </span>
            <span>
              {formatCountWindowValue(row.mediaCount, selectedWindow)}
              <small className={styles.adminInlineMeta}>
                {formatCountWindowMeta(row.mediaCount)}
              </small>
            </span>
            <span>
              {formatCountWindowValue(row.promptCount, selectedWindow)}
              <small className={styles.adminInlineMeta}>
                {formatCountWindowMeta(row.promptCount)}
              </small>
            </span>
            <span>
              {formatDateTime(row.lastActivityAt)}
              <small className={styles.adminInlineMeta}>
                updated {formatDateTime(row.updatedAt)}
              </small>
            </span>
          </div>
        ))
      ) : (
        <EmptyTableRow message="No project leaderboard stats are available yet." />
      )}
    </div>
  </TableShell>
);

/**
 * Displays the current admin global stats snapshot.
 */
export function AdminGlobalStatsPanel({
  overview,
  models,
  generationBreakdown,
  workflows,
  assets,
  projects,
  health,
  generatedAt,
  loading,
  error,
  onRefresh,
}: AdminGlobalStatsPanelProps) {
  const [selectedWindow, setSelectedWindow] = React.useState<CountWindowKey>("total");
  const selectedWindowLabel =
    WINDOW_OPTIONS.find((option) => option.key === selectedWindow)?.label ?? "All time";
  const acceptedRuns = overview.acceptedGenerations[selectedWindow];
  const successfulRuns = overview.successfulGenerations[selectedWindow];
  const savedRuns = overview.savedGenerations[selectedWindow];
  const attachedRuns = overview.projectAttachedGenerations[selectedWindow];
  const inFlightRuns = overview.pendingGenerations + overview.runningGenerations;
  const generationSummary = generationBreakdown.summary;
  const mediaTypeTotal = generationSummary.acceptedGenerations[selectedWindow];
  const downloadEvents = assets.events.find((row) => row.eventType === "download");
  const downloadCount = downloadEvents?.count[selectedWindow] ?? 0;

  return (
    <>
      <section className={`${styles.adminSection} ${styles.adminSignalHeroSection}`}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Product health</p>
            <h2 className={styles.adminSectionTitle}>Product signals</h2>
            <p className={styles.adminSubtext}>
              The fastest read on demand, generation quality, and whether outputs are turning into
              saved work.
            </p>
          </div>
          <div className={styles.adminToolbar}>
            <div className={styles.adminSegmentedControl} aria-label="Time window">
              {WINDOW_OPTIONS.map((option) => {
                const isActive = selectedWindow === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={segmentedButtonClassName(isActive)}
                    onClick={() => setSelectedWindow(option.key)}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <button type="button" className="ghost-btn mini" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {generatedAt ? (
          <p className={styles.adminSubtext}>Snapshot generated {formatDateTime(generatedAt)}</p>
        ) : null}
        {error ? (
          <AppMessage
            className={styles.adminWarningPanel}
            tone="warning"
            mode="banner"
            title={formatStatsErrorSummary(error)}
            role="status"
            ariaLive="polite"
          >
            <p className={styles.adminWarningDescription}>
              The stats workspace has fallen back to safe empty values until the next refresh
              succeeds.
            </p>
            <p className={styles.adminWarningMeta}>{error}</p>
          </AppMessage>
        ) : null}

        <div className={styles.adminSignalHero}>
          <SignalCard
            label="Generation demand"
            value={formatCount(acceptedRuns)}
            meta={`${formatCountWindowValue(overview.generateClicks, selectedWindow)} generate clicks in ${selectedWindowLabel}`}
            accent
          />
          <SignalCard
            label="Generation quality"
            value={formatSuccessRate(successfulRuns, acceptedRuns)}
            meta={`${formatCount(successfulRuns)} success • ${formatCount(
              overview.failedGenerations[selectedWindow]
            )} failed`}
          />
          <SignalCard
            label="Saved value"
            value={formatPercent(savedRuns, acceptedRuns)}
            meta={`${formatCount(savedRuns)} saved • ${formatCount(attachedRuns)} project-attached`}
          />
        </div>

        <div className={styles.adminSignalMetaGrid} aria-label="Product signal context">
          <SignalPill
            label="Generation users"
            value={formatCount(overview.uniqueGenerationUsers)}
          />
          <SignalPill label="Active models" value={formatCount(overview.uniqueModels)} />
          <SignalPill label="Downloads" value={formatCount(downloadCount)} />
          <SignalPill label="In flight" value={formatCount(inFlightRuns)} />
          <SignalPill
            label="Data contract"
            value={health.degraded ? "Degraded" : formatHealthSource(health.overviewSource)}
          />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Generation volume</p>
            <h2 className={styles.adminSectionTitle}>Generation breakdown</h2>
            <p className={styles.adminSubtext}>
              Fleet-wide runs by media type, plus the highest-signal user and model slices.
            </p>
          </div>
        </div>

        <div className={styles.adminSignalColumns}>
          <article className={styles.adminPanel}>
            <div className={styles.adminPanelHeader}>
              <div>
                <h3 className={styles.adminSectionTitle}>Media mix</h3>
                <p className={styles.adminSubtext}>
                  Accepted generations for {selectedWindowLabel.toLowerCase()}.
                </p>
              </div>
            </div>
            <div className={styles.adminMixList}>
              <MixRow
                label="Image"
                value={generationSummary.imageGenerations[selectedWindow]}
                total={mediaTypeTotal}
              />
              <MixRow
                label="Video"
                value={generationSummary.videoGenerations[selectedWindow]}
                total={mediaTypeTotal}
              />
              <MixRow
                label="Audio / sound"
                value={generationSummary.audioGenerations[selectedWindow]}
                total={mediaTypeTotal}
              />
              <MixRow
                label="Unknown"
                value={generationSummary.unknownGenerations[selectedWindow]}
                total={mediaTypeTotal}
              />
            </div>
            <div className={styles.adminPanelMetaGrid}>
              <SignalPill label="Users" value={formatCount(generationSummary.uniqueUsers)} />
              <SignalPill label="Models" value={formatCount(generationSummary.uniqueModels)} />
              <SignalPill
                label="Last run"
                value={formatDateTime(generationSummary.lastGenerationAt)}
              />
            </div>
          </article>

          <article className={styles.adminPanel}>
            <div className={styles.adminPanelHeader}>
              <div>
                <h3 className={styles.adminSectionTitle}>Top users</h3>
                <p className={styles.adminSubtext}>Who is generating the most output.</p>
              </div>
            </div>
            <GenerationUsersTable
              rows={generationBreakdown.users}
              selectedWindow={selectedWindow}
            />
          </article>

          <article className={styles.adminPanel}>
            <div className={styles.adminPanelHeader}>
              <div>
                <h3 className={styles.adminSectionTitle}>Top model/type pairs</h3>
                <p className={styles.adminSubtext}>Where generation volume is concentrating.</p>
              </div>
            </div>
            <ModelMediaTypeTable
              rows={generationBreakdown.modelMediaTypes}
              selectedWindow={selectedWindow}
            />
          </article>
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Model mix</p>
            <h2 className={styles.adminSectionTitle}>Top models</h2>
            <p className={styles.adminSubtext}>
              Demand, reliability, and saved output by model. Debug-only columns are intentionally
              left out of the main read.
            </p>
          </div>
        </div>
        <ModelsTable rows={models} selectedWindow={selectedWindow} />
      </section>

      <details className={styles.adminDetails}>
        <summary className={styles.adminDetailsSummary}>
          Secondary diagnostics
          <span>Workflow, asset, project, and source-health tables</span>
        </summary>

        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <p className={styles.adminSectionEyebrow}>Workflow depth</p>
              <h2 className={styles.adminSectionTitle}>Workflows</h2>
              <p className={styles.adminSubtext}>
                Use this when intent source or workflow features need diagnosis.
              </p>
            </div>
          </div>

          <section className={styles.adminQuietGrid} aria-label="Workflow highlights">
            <MetricCard
              label="Style-applied runs"
              value={formatCountWindowValue(
                workflows.highlights.styleAppliedGenerations,
                selectedWindow
              )}
              meta={formatCountWindowMeta(workflows.highlights.styleAppliedGenerations)}
            />
            <MetricCard
              label="Character runs"
              value={formatCountWindowValue(
                workflows.highlights.characterModeGenerations,
                selectedWindow
              )}
              meta={formatCountWindowMeta(workflows.highlights.characterModeGenerations)}
            />
            <MetricCard
              label="Reference runs"
              value={formatCountWindowValue(
                workflows.highlights.referenceAssistedGenerations,
                selectedWindow
              )}
              meta={formatCountWindowMeta(workflows.highlights.referenceAssistedGenerations)}
            />
          </section>

          <div className={styles.adminPanelStack}>
            <article className={styles.adminPanel}>
              <div className={styles.adminPanelHeader}>
                <h3 className={styles.adminSectionTitle}>By tool</h3>
              </div>
              <WorkflowToolTable rows={workflows.byTool} selectedWindow={selectedWindow} />
            </article>

            <article className={styles.adminPanel}>
              <div className={styles.adminPanelHeader}>
                <h3 className={styles.adminSectionTitle}>By mode</h3>
              </div>
              <WorkflowModeTable rows={workflows.byMode} selectedWindow={selectedWindow} />
            </article>
          </div>
        </section>

        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <p className={styles.adminSectionEyebrow}>Retained outputs</p>
              <h2 className={styles.adminSectionTitle}>Assets</h2>
              <p className={styles.adminSubtext}>
                Media event metrics are behavioral signals, not audit-grade accounting.
              </p>
            </div>
          </div>

          <section className={styles.adminQuietGrid} aria-label="Autosave overview">
            <MetricCard
              label="Autosave persisted"
              value={formatCountWindowValue(assets.autosave.autoPersisted, selectedWindow)}
              meta={formatCountWindowMeta(assets.autosave.autoPersisted)}
            />
            <MetricCard
              label="Autosave skipped"
              value={formatCountWindowValue(assets.autosave.autosaveSkipped, selectedWindow)}
              meta={formatCountWindowMeta(assets.autosave.autosaveSkipped)}
            />
          </section>

          <AssetEventsTable rows={assets.events} selectedWindow={selectedWindow} />
        </section>

        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <p className={styles.adminSectionEyebrow}>Serious work</p>
              <h2 className={styles.adminSectionTitle}>Projects</h2>
              <p className={styles.adminSubtext}>
                Whether generated work is becoming durable, organized product usage.
              </p>
            </div>
          </div>

          <section className={styles.adminQuietGrid} aria-label="Project usage summary">
            <MetricCard
              label="Projects created"
              value={formatCountWindowValue(projects.summary.projectsCreated, selectedWindow)}
              meta={formatCountWindowMeta(projects.summary.projectsCreated)}
            />
            <MetricCard
              label="Active projects"
              value={formatCountWindowValue(
                projects.summary.activeProjectsWithGenerations,
                selectedWindow
              )}
              meta={formatCountWindowMeta(projects.summary.activeProjectsWithGenerations)}
            />
            <MetricCard
              label="Attached generations"
              value={formatCountWindowValue(projects.summary.attachedGenerations, selectedWindow)}
              meta={formatCountWindowMeta(projects.summary.attachedGenerations)}
            />
          </section>

          <ProjectLeaderboardTable rows={projects.leaderboard} selectedWindow={selectedWindow} />
        </section>

        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <p className={styles.adminSectionEyebrow}>Data contract</p>
              <h2 className={styles.adminSectionTitle}>Source health</h2>
            </div>
          </div>
          <section className={styles.adminQuietGrid} aria-label="Stats data health">
            <MetricCard
              label="Coverage"
              value={health.degraded ? "Degraded" : "Healthy"}
              meta={
                health.degraded && health.reason
                  ? health.reason
                  : "All shipped v1 sections are available."
              }
            />
            <MetricCard
              label="Overview source"
              value={formatHealthSource(health.overviewSource)}
              meta={`Models ${formatHealthSource(
                health.modelsSource
              )} • Workflows ${formatHealthSource(health.workflowsSource)}`}
            />
            <MetricCard
              label="Assets source"
              value={formatHealthSource(health.assetsSource)}
              meta={`Projects ${formatHealthSource(health.projectsSource)}`}
            />
          </section>
        </section>
      </details>
    </>
  );
}
