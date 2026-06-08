/**
 * Admin global-stats panel.
 * Renders the v1 admin stats workspace for overview, models, workflows,
 * assets, and project activity.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import styles from "../../../styles/admin.module.css";
import type {
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

const humanizeKey = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "Unknown";

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
}) => (
  <TableShell>
    <div className={styles.adminTable} style={TABLE_WIDE_STYLE}>
      <div
        className={styles.adminTableHead}
        style={{
          gridTemplateColumns: "minmax(0, 1.8fr) 0.75fr 0.8fr 1fr 0.95fr 0.9fr 1.15fr",
        }}
      >
        <span>Model</span>
        <span>Clicks</span>
        <span>Accepted</span>
        <span>Success rate</span>
        <span>Saved</span>
        <span>Users</span>
        <span>Last used</span>
      </div>
      {rows.length ? (
        rows.map((row) => {
          const accepted = row.acceptedGenerations[selectedWindow];
          const successful = row.successfulGenerations[selectedWindow];
          return (
            <div
              key={row.modelId}
              className={styles.adminTableRow}
              style={{
                gridTemplateColumns: "minmax(0, 1.8fr) 0.75fr 0.8fr 1fr 0.95fr 0.9fr 1.15fr",
              }}
            >
              <span className={styles.adminMonoCell}>{row.modelId}</span>
              <span>
                {formatCountWindowValue(row.generateClicks, selectedWindow)}
                <small className={styles.adminInlineMeta}>
                  {formatCountWindowMeta(row.generateClicks)}
                </small>
              </span>
              <span>
                {formatCountWindowValue(row.acceptedGenerations, selectedWindow)}
                <small className={styles.adminInlineMeta}>
                  pending {formatCount(row.pendingGenerations)} • running{" "}
                  {formatCount(row.runningGenerations)}
                </small>
              </span>
              <span>
                {formatSuccessRate(successful, accepted)}
                <small className={styles.adminInlineMeta}>
                  {formatCount(successful)} success •{" "}
                  {formatCount(row.failedGenerations[selectedWindow])} fail
                </small>
              </span>
              <span>
                {formatCountWindowValue(row.savedGenerations, selectedWindow)}
                <small className={styles.adminInlineMeta}>
                  savers {formatCount(row.uniqueSavingUsers)}
                </small>
              </span>
              <span>
                {formatCount(row.uniqueGenerationUsers)}
                <small className={styles.adminInlineMeta}>
                  clickers {formatCount(row.uniqueClickUsers)}
                </small>
              </span>
              <span>
                {formatDateTime(row.lastGenerationAt ?? row.lastGenerateClickAt)}
                <small className={styles.adminInlineMeta}>
                  saved {formatDateTime(row.lastSavedGenerationAt)}
                </small>
              </span>
            </div>
          );
        })
      ) : (
        <EmptyTableRow message="No model usage stats are available yet." />
      )}
    </div>
  </TableShell>
);

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

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Product health</p>
            <h2 className={styles.adminSectionTitle}>Product signal health</h2>
            <p className={styles.adminSubtext}>
              Monitor the live contract powering model, workflow, asset, and project analytics for
              this workspace.
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

        <section className={styles.adminGrid} aria-label="Stats data health">
          <MetricCard
            label="Coverage"
            value={health.degraded ? "Degraded" : "Healthy"}
            meta={
              health.degraded && health.reason
                ? health.reason
                : "All shipped v1 sections are available from the live admin stats contract."
            }
          />
          <MetricCard
            label="Overview source"
            value={formatHealthSource(health.overviewSource)}
            meta={`Models ${formatHealthSource(health.modelsSource)} • Workflows ${formatHealthSource(
              health.workflowsSource
            )}`}
          />
          <MetricCard
            label="Assets source"
            value={formatHealthSource(health.assetsSource)}
            meta={`Projects ${formatHealthSource(health.projectsSource)} • Window ${selectedWindowLabel}`}
          />
        </section>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Core metrics</p>
            <h2 className={styles.adminSectionTitle}>Overview</h2>
            <p className={styles.adminSubtext}>
              Global usage totals show demand, conversion, and retained value for the current
              window.
            </p>
          </div>
        </div>

        <section className={styles.adminGrid} aria-label="Global stats overview">
          <MetricCard
            label="Generate clicks"
            value={formatCountWindowValue(overview.generateClicks, selectedWindow)}
            meta={formatCountWindowMeta(overview.generateClicks)}
          />
          <MetricCard
            label="Accepted runs"
            value={formatCountWindowValue(overview.acceptedGenerations, selectedWindow)}
            meta={formatCountWindowMeta(overview.acceptedGenerations)}
          />
          <MetricCard
            label="Success rate"
            value={formatSuccessRate(
              overview.successfulGenerations[selectedWindow],
              overview.acceptedGenerations[selectedWindow]
            )}
            meta={`Success ${formatCountWindowValue(
              overview.successfulGenerations,
              selectedWindow
            )} • Fail ${formatCountWindowValue(overview.failedGenerations, selectedWindow)}`}
          />
          <MetricCard
            label="Saved generations"
            value={formatCountWindowValue(overview.savedGenerations, selectedWindow)}
            meta={formatCountWindowMeta(overview.savedGenerations)}
          />
          <MetricCard
            label="Project-attached"
            value={formatCountWindowValue(overview.projectAttachedGenerations, selectedWindow)}
            meta={formatCountWindowMeta(overview.projectAttachedGenerations)}
          />
          <MetricCard
            label="Unique users"
            value={formatCount(overview.uniqueGenerationUsers)}
            meta={`Clickers ${formatCount(overview.uniqueClickUsers)} • Savers ${formatCount(
              overview.uniqueSavingUsers
            )}`}
          />
          <MetricCard
            label="In-flight"
            value={formatCount(overview.pendingGenerations + overview.runningGenerations)}
            meta={`Pending ${formatCount(overview.pendingGenerations)} • Running ${formatCount(
              overview.runningGenerations
            )}`}
          />
          <MetricCard
            label="Unique models"
            value={formatCount(overview.uniqueModels)}
            meta={`Runs ${formatDateTime(overview.lastGenerationAt)} • Clicks ${formatDateTime(
              overview.lastGenerateClickAt
            )}`}
          />
        </section>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Model mix</p>
            <h2 className={styles.adminSectionTitle}>Models</h2>
            <p className={styles.adminSubtext}>
              Per-model demand and value retention combine explicit generate clicks with
              server-authoritative accepted runs and saves.
            </p>
          </div>
        </div>
        <ModelsTable rows={models} selectedWindow={selectedWindow} />
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Workflow depth</p>
            <h2 className={styles.adminSectionTitle}>Workflows</h2>
            <p className={styles.adminSubtext}>
              Workflow analytics use generate-click telemetry for intent and `generation_projection`
              for style, character, and reference-assisted generation context.
            </p>
          </div>
        </div>

        <section className={styles.adminGrid} aria-label="Workflow highlights">
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
          <MetricCard
            label="Style clicks"
            value={formatCountWindowValue(workflows.highlights.styleClicks, selectedWindow)}
            meta={formatCountWindowMeta(workflows.highlights.styleClicks)}
          />
          <MetricCard
            label="Character clicks"
            value={formatCountWindowValue(workflows.highlights.characterModeClicks, selectedWindow)}
            meta={formatCountWindowMeta(workflows.highlights.characterModeClicks)}
          />
          <MetricCard
            label="Reference clicks"
            value={formatCountWindowValue(
              workflows.highlights.referenceAssistedClicks,
              selectedWindow
            )}
            meta={formatCountWindowMeta(workflows.highlights.referenceAssistedClicks)}
          />
        </section>

        <div className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <h3 className={styles.adminSectionTitle}>By tool</h3>
              <p className={styles.adminSubtext}>
                Click-based workflow intent broken down by the active AI Studio tool.
              </p>
            </div>
          </div>
          <WorkflowToolTable rows={workflows.byTool} selectedWindow={selectedWindow} />
        </div>

        <div className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <h3 className={styles.adminSectionTitle}>By mode</h3>
              <p className={styles.adminSubtext}>
                Accepted runs and enriched workflow context grouped by studio mode.
              </p>
            </div>
          </div>
          <WorkflowModeTable rows={workflows.byMode} selectedWindow={selectedWindow} />
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className={styles.adminSectionEyebrow}>Retained outputs</p>
            <h2 className={styles.adminSectionTitle}>Assets</h2>
            <p className={styles.adminSubtext}>
              Media event metrics are best for behavioral insight, not audit-grade truth, because
              some events are emitted from client interaction hooks.
            </p>
          </div>
        </div>

        <section className={styles.adminGrid} aria-label="Autosave overview">
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
              Project association tables show whether generated work is making it into durable,
              organized product usage.
            </p>
          </div>
        </div>

        <section className={styles.adminGrid} aria-label="Project usage summary">
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
          <MetricCard
            label="Attached media"
            value={formatCountWindowValue(projects.summary.attachedMedia, selectedWindow)}
            meta={formatCountWindowMeta(projects.summary.attachedMedia)}
          />
          <MetricCard
            label="Attached prompts"
            value={formatCountWindowValue(projects.summary.attachedPrompts, selectedWindow)}
            meta={formatCountWindowMeta(projects.summary.attachedPrompts)}
          />
        </section>

        <ProjectLeaderboardTable rows={projects.leaderboard} selectedWindow={selectedWindow} />
      </section>
    </>
  );
}
