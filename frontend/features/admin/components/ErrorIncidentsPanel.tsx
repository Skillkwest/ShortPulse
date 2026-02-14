/**
 * Admin error incidents panel.
 * Renders summary cards, filters, and grouped incident rows for operator triage.
 */
import React, { useCallback, useMemo, useState } from "react";
import { WarningCircle } from "phosphor-react";
import type {
  AdminErrorLogRow,
  AdminErrorEventRow,
  AdminErrorEventSummary,
  AdminErrorSummary,
  AdminPagination,
  AdminErrorStatus,
} from "../types";
import styles from "../../../styles/admin.module.css";

type ErrorIncidentsPanelProps = {
  errors: AdminErrorLogRow[];
  errorsLoading: boolean;
  errorsError: string | null;
  errorSummary: AdminErrorSummary;
  errorEvents: AdminErrorEventRow[];
  errorEventsLoading: boolean;
  errorEventsError: string | null;
  errorEventsSummary: AdminErrorEventSummary;
  errorEventsPagination: AdminPagination;
  errorStatusFilter: "open" | "all";
  errorScopeFilter: "all" | "app" | "generation";
  errorSeverityFilter: "all" | "high" | "medium" | "low";
  errorSourceFilter: string;
  errorEventSyntheticFilter: "all" | "exclude" | "only";
  errorSearch: string;
  errorPagination: AdminPagination;
  statusUpdatingErrorId: string | null;
  testIncidentSubmittingScope: "app" | "generation" | null;
  testIncidentResult: string | null;
  onErrorStatusFilterChange: (value: "open" | "all") => void;
  onErrorScopeFilterChange: (value: "all" | "app" | "generation") => void;
  onErrorSeverityFilterChange: (value: "all" | "high" | "medium" | "low") => void;
  onErrorSourceFilterChange: (value: string) => void;
  onErrorEventSyntheticFilterChange: (value: "all" | "exclude" | "only") => void;
  onErrorSearchChange: (value: string) => void;
  onUpdateErrorStatus: (errorId: string, status: AdminErrorStatus) => void;
  onTriggerTestIncident: (scope: "app" | "generation") => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onEventPrevPage: () => void;
  onEventNextPage: () => void;
  onRefresh: () => void;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const sourceLabel = (value: string): string =>
  value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");

const incidentStatusLabel = (status: AdminErrorStatus | null): string => {
  if (status === "resolved") return "Resolved";
  if (status === "ignored") return "Ignored";
  if (status === "open") return "Open";
  return "Unlinked";
};

const buildIncidentPacket = (row: AdminErrorLogRow): string =>
  JSON.stringify(
    {
      // Versioned so we can evolve this format without breaking ad-hoc tooling.
      shortpulseIncidentVersion: 2,
      copiedAt: new Date().toISOString(),
      incident: {
        id: row.id,
        fingerprint: row.fingerprint,
        status: row.status,
        severity: row.severity,
        source: row.source,
        scope: row.scope,
        message: row.message,
        stack: row.stack,
        route: row.route,
        endpoint: row.endpoint,
        requestId: row.requestId,
        httpStatus: row.httpStatus,
        userId: row.userId,
        userEmail: row.userEmail,
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        occurrencesCount: row.occurrencesCount,
        triage: (() => {
          const metadata = (row.metadata ?? {}) as Record<string, unknown>;
          const breadcrumbs = Array.isArray(metadata.breadcrumbs) ? metadata.breadcrumbs : null;
          const buildId = typeof metadata.build_id === "string" ? metadata.build_id : null;
          const sessionId = typeof metadata.session_id === "string" ? metadata.session_id : null;
          const clientRelease =
            typeof metadata.client_release === "string" ? metadata.client_release : null;
          const clientEnvironment =
            typeof metadata.client_environment === "string" ? metadata.client_environment : null;
          const visibilityState =
            typeof metadata.visibility_state === "string" ? metadata.visibility_state : null;
          const reactComponentStack =
            typeof metadata.react_component_stack === "string"
              ? metadata.react_component_stack
              : null;

          return {
            buildId,
            sessionId,
            clientRelease,
            clientEnvironment,
            visibilityState,
            reactComponentStack,
            breadcrumbs,
          };
        })(),
        // Keep the full raw metadata (sanitized at ingest) for deep debugging.
        metadata: row.metadata ?? {},
      },
    },
    null,
    2
  );

const buildEventPacket = (row: AdminErrorEventRow): string =>
  JSON.stringify(
    {
      shortpulseEventVersion: 1,
      copiedAt: new Date().toISOString(),
      event: {
        id: row.id,
        incidentId: row.incidentId,
        fingerprint: row.fingerprint,
        source: row.source,
        scope: row.scope,
        severity: row.severity,
        message: row.message,
        stack: row.stack,
        route: row.route,
        endpoint: row.endpoint,
        requestId: row.requestId,
        httpStatus: row.httpStatus,
        userId: row.userId,
        userEmail: row.userEmail,
        occurredAt: row.occurredAt,
        createdAt: row.createdAt,
        metadata: row.metadata ?? {},
      },
    },
    null,
    2
  );

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof window === "undefined") return false;

  // Prefer the async Clipboard API when available. This can fail if the browser
  // blocks clipboard writes (permissions, insecure context, etc).
  try {
    if (navigator?.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy fallback below.
  }

  // Fallback for environments where `navigator.clipboard` is unavailable/blocked.
  // `document.execCommand("copy")` is deprecated but still widely supported.
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.width = "1px";
    textarea.style.height = "1px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

/**
 * Displays operator-focused app incident telemetry.
 */
export function ErrorIncidentsPanel({
  errors,
  errorsLoading,
  errorsError,
  errorSummary,
  errorEvents,
  errorEventsLoading,
  errorEventsError,
  errorEventsSummary,
  errorEventsPagination,
  errorStatusFilter,
  errorScopeFilter,
  errorSeverityFilter,
  errorSourceFilter,
  errorEventSyntheticFilter,
  errorSearch,
  errorPagination,
  statusUpdatingErrorId,
  testIncidentSubmittingScope,
  testIncidentResult,
  onErrorStatusFilterChange,
  onErrorScopeFilterChange,
  onErrorSeverityFilterChange,
  onErrorSourceFilterChange,
  onErrorEventSyntheticFilterChange,
  onErrorSearchChange,
  onUpdateErrorStatus,
  onTriggerTestIncident,
  onPrevPage,
  onNextPage,
  onEventPrevPage,
  onEventNextPage,
  onRefresh,
}: ErrorIncidentsPanelProps) {
  const [copiedIncidentId, setCopiedIncidentId] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AdminErrorEventRow | null>(null);
  const errorSourceOptions = useMemo(() => {
    const values = new Set([
      ...errors.map((row) => row.source),
      ...errorEvents.map((row) => row.source),
    ]);
    return ["all", ...Array.from(values).sort()];
  }, [errorEvents, errors]);

  const resultStart =
    errorPagination.totalCount === 0 ? 0 : (errorPagination.page - 1) * errorPagination.perPage + 1;
  const resultEnd = Math.min(
    errorPagination.page * errorPagination.perPage,
    errorPagination.totalCount
  );
  const eventResultStart =
    errorEventsPagination.totalCount === 0
      ? 0
      : (errorEventsPagination.page - 1) * errorEventsPagination.perPage + 1;
  const eventResultEnd = Math.min(
    errorEventsPagination.page * errorEventsPagination.perPage,
    errorEventsPagination.totalCount
  );

  const handleCopyIncident = useCallback(async (row: AdminErrorLogRow) => {
    const success = await copyToClipboard(buildIncidentPacket(row));
    if (!success) return;
    setCopiedIncidentId(row.id);
    window.setTimeout(() => {
      setCopiedIncidentId((current) => (current === row.id ? null : current));
    }, 1200);
  }, []);

  const handleCopyEvent = useCallback(async (row: AdminErrorEventRow) => {
    const success = await copyToClipboard(buildEventPacket(row));
    if (!success) return;
    setCopiedEventId(row.id);
    window.setTimeout(() => {
      setCopiedEventId((current) => (current === row.id ? null : current));
    }, 1200);
  }, []);

  const eventMetadataText = useMemo(() => {
    if (!selectedEvent) return "";
    return JSON.stringify(selectedEvent.metadata ?? {}, null, 2);
  }, [selectedEvent]);
  const selectedIncidentId = selectedEvent?.incidentId ?? null;

  return (
    <section className={styles.adminSection}>
      <div className={styles.adminSectionHead}>
        <div>
          <p className="eyebrow">Errors</p>
          <p className="tiny subdued">
            Actionable app/runtime failures grouped by fingerprint and user.
          </p>
        </div>
        <div className={styles.tabRow}>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => onTriggerTestIncident("app")}
            disabled={errorsLoading || testIncidentSubmittingScope !== null}
          >
            {testIncidentSubmittingScope === "app" ? "Creating…" : "Trigger app test"}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => onTriggerTestIncident("generation")}
            disabled={errorsLoading || testIncidentSubmittingScope !== null}
          >
            {testIncidentSubmittingScope === "generation" ? "Creating…" : "Trigger generation test"}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onRefresh}
            disabled={errorsLoading}
          >
            {errorsLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <section className={styles.adminGrid}>
        <div className={`${styles.adminCard} ${styles.alert}`}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Open incidents</span>
            <WarningCircle size={18} />
          </div>
          <p className={styles.adminMetric}>{errorSummary.openCount}</p>
          <p className={styles.adminSubtext}>
            {`App ${errorSummary.appOpenCount} · Generation ${errorSummary.generationOpenCount}`}
          </p>
        </div>
        <div className={styles.adminCard}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>High severity open</span>
          </div>
          <p className={styles.adminMetric}>{errorSummary.highSeverityOpenCount}</p>
          <p className={styles.adminSubtext}>Needs immediate attention</p>
        </div>
        <div className={`${styles.adminCard} ${styles.warning}`}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Seen in last 24h</span>
          </div>
          <p className={styles.adminMetric}>{errorSummary.last24hCount}</p>
          <p className={styles.adminSubtext}>Recent activity volume</p>
        </div>
      </section>

      <div className={styles.filterGrid}>
        <select
          className={styles.searchInput}
          value={errorStatusFilter}
          onChange={(event) => onErrorStatusFilterChange(event.target.value as "open" | "all")}
        >
          <option value="open">Status: Open</option>
          <option value="all">Status: All</option>
        </select>

        <select
          className={styles.searchInput}
          value={errorScopeFilter}
          onChange={(event) =>
            onErrorScopeFilterChange(event.target.value as "all" | "app" | "generation")
          }
        >
          <option value="all">Scope: All</option>
          <option value="app">Scope: App</option>
          <option value="generation">Scope: Generation</option>
        </select>

        <select
          className={styles.searchInput}
          value={errorSeverityFilter}
          onChange={(event) =>
            onErrorSeverityFilterChange(event.target.value as "all" | "high" | "medium" | "low")
          }
        >
          <option value="all">Severity: All</option>
          <option value="high">Severity: High</option>
          <option value="medium">Severity: Medium</option>
          <option value="low">Severity: Low</option>
        </select>

        <select
          className={styles.searchInput}
          value={errorSourceFilter}
          onChange={(event) => onErrorSourceFilterChange(event.target.value)}
        >
          {errorSourceOptions.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "Source: All" : `Source: ${sourceLabel(value)}`}
            </option>
          ))}
        </select>

        <select
          className={styles.searchInput}
          value={errorEventSyntheticFilter}
          onChange={(event) =>
            onErrorEventSyntheticFilterChange(event.target.value as "all" | "exclude" | "only")
          }
        >
          <option value="all">Events: Real + synthetic</option>
          <option value="exclude">Events: Real only</option>
          <option value="only">Events: Synthetic only</option>
        </select>

        <input
          className={styles.searchInput}
          type="search"
          value={errorSearch}
          onChange={(event) => onErrorSearchChange(event.target.value)}
          placeholder="Search message, user, endpoint, request id, fingerprint, source"
        />
      </div>
      <div className={styles.searchRow}>
        <p className="tiny subdued">
          Showing {resultStart}-{resultEnd} of {errorPagination.totalCount}
        </p>
        <div className={styles.tabRow}>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onPrevPage}
            disabled={errorsLoading || !errorPagination.hasPrevPage}
          >
            Prev
          </button>
          <span className="tiny subdued">
            Page {errorPagination.page} of {errorPagination.totalPages}
          </span>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onNextPage}
            disabled={errorsLoading || !errorPagination.hasNextPage}
          >
            Next
          </button>
        </div>
      </div>
      {testIncidentResult ? <p className="tiny subdued">{testIncidentResult}</p> : null}

      <div className={styles.adminTable}>
        <div className={styles.adminErrorsHead}>
          <span>Severity</span>
          <span>Source</span>
          <span>User</span>
          <span>Error</span>
          <span>Location</span>
          <span>Hits</span>
          <span>Last seen</span>
          <span>Actions</span>
        </div>

        {errorsError ? (
          <div className={`${styles.adminErrorsRow} ${styles.severityMedium}`}>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">{errorsError}</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
          </div>
        ) : errors.length === 0 ? (
          <div className={`${styles.adminErrorsRow} ${styles.severityLow}`}>
            <span className="subdued">None</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
            <span className="subdued">No incidents matched the current filters.</span>
            <span className="subdued">—</span>
            <span className="subdued">0</span>
            <span className="subdued">—</span>
            <span className="subdued">—</span>
          </div>
        ) : (
          errors.map((row) => (
            <div
              key={row.id}
              className={`${styles.adminErrorsRow} ${
                row.severity === "high"
                  ? styles.severityHigh
                  : row.severity === "low"
                    ? styles.severityLow
                    : styles.severityMedium
              }`}
            >
              <span
                className={`${styles.pill} ${row.severity === "high" ? styles.pillWarn : styles.pillOk}`}
              >
                {row.severity}
              </span>
              <div className={styles.errorCell}>
                <span>{sourceLabel(row.source)}</span>
                <span className="tiny subdued">{`Scope ${row.scope}`}</span>
              </div>
              <div className={styles.errorCell}>
                <span>{row.userEmail ?? "Unknown user"}</span>
                <span className="tiny subdued">{row.userId ?? "No user id"}</span>
              </div>
              <div className={styles.errorCell}>
                <span>{row.message}</span>
                <span className="tiny subdued">
                  {`Status ${row.status}`}
                  {" · "}
                  {row.httpStatus ? `HTTP ${row.httpStatus}` : "No HTTP status"}
                  {row.requestId ? ` · req ${row.requestId}` : ""}
                  {row.fingerprint ? ` · fp ${row.fingerprint.slice(0, 10)}` : ""}
                </span>
              </div>
              <div className={styles.errorCell}>
                <span>{row.endpoint ?? row.route ?? "Unknown route"}</span>
                <span className="tiny subdued">{row.route ?? "No route context"}</span>
              </div>
              <span className="mono">{row.occurrencesCount.toLocaleString()}</span>
              <div className={styles.errorCell}>
                <span>{formatDateTime(row.lastSeenAt)}</span>
                <span className="tiny subdued">First: {formatDateTime(row.firstSeenAt)}</span>
              </div>
              <div className={styles.errorActions}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => {
                    void handleCopyIncident(row);
                  }}
                  disabled={statusUpdatingErrorId === row.id}
                >
                  {copiedIncidentId === row.id ? "Copied" : "Copy"}
                </button>
                {row.status === "open" ? (
                  <>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => onUpdateErrorStatus(row.id, "resolved")}
                      disabled={statusUpdatingErrorId === row.id}
                    >
                      {statusUpdatingErrorId === row.id ? "Updating…" : "Resolve"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => onUpdateErrorStatus(row.id, "ignored")}
                      disabled={statusUpdatingErrorId === row.id}
                    >
                      Ignore
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => onUpdateErrorStatus(row.id, "open")}
                    disabled={statusUpdatingErrorId === row.id}
                  >
                    {statusUpdatingErrorId === row.id ? "Updating…" : "Reopen"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Event Stream</p>
            <p className="tiny subdued">Raw per-occurrence events (every logged failure).</p>
          </div>
          <div className={styles.tabRow}>
            <span className="tiny subdued">{`1h ${errorEventsSummary.lastHourCount} · 24h ${errorEventsSummary.last24hCount}`}</span>
            <span className="tiny subdued">
              {`App ${errorEventsSummary.app24hCount} · Generation ${errorEventsSummary.generation24hCount} · High ${errorEventsSummary.high24hCount}`}
            </span>
          </div>
        </div>

        <div className={styles.searchRow}>
          <p className="tiny subdued">
            Showing {eventResultStart}-{eventResultEnd} of {errorEventsPagination.totalCount}
          </p>
          <div className={styles.tabRow}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={onEventPrevPage}
              disabled={errorEventsLoading || !errorEventsPagination.hasPrevPage}
            >
              Prev
            </button>
            <span className="tiny subdued">
              Page {errorEventsPagination.page} of {errorEventsPagination.totalPages}
            </span>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={onEventNextPage}
              disabled={errorEventsLoading || !errorEventsPagination.hasNextPage}
            >
              Next
            </button>
          </div>
        </div>

        <div className={styles.adminTable}>
          <div className={styles.adminEventsHead}>
            <span>Time</span>
            <span>Severity</span>
            <span>Source</span>
            <span>Error</span>
            <span>User</span>
            <span>Incident</span>
            <span>Actions</span>
          </div>
          {errorEventsError ? (
            <div className={`${styles.adminEventsRow} ${styles.severityMedium}`}>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
              <span className="subdued">{errorEventsError}</span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
            </div>
          ) : errorEvents.length === 0 ? (
            <div className={`${styles.adminEventsRow} ${styles.severityLow}`}>
              <span className="subdued">None</span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
              <span className="subdued">No events matched the current filters.</span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
            </div>
          ) : (
            errorEvents.map((row) => (
              <div
                key={row.id}
                className={`${styles.adminEventsRow} ${
                  row.severity === "high"
                    ? styles.severityHigh
                    : row.severity === "low"
                      ? styles.severityLow
                      : styles.severityMedium
                }`}
              >
                <div className={styles.errorCell}>
                  <span>{formatDateTime(row.occurredAt)}</span>
                  <span className="tiny subdued">
                    {row.requestId ? `req ${row.requestId}` : "—"}
                  </span>
                </div>
                <span
                  className={`${styles.pill} ${row.severity === "high" ? styles.pillWarn : styles.pillOk}`}
                >
                  {row.severity}
                </span>
                <div className={styles.errorCell}>
                  <span>{sourceLabel(row.source)}</span>
                  <span className="tiny subdued">{`Scope ${row.scope}`}</span>
                </div>
                <div className={styles.errorCell}>
                  <span>{row.message}</span>
                  <span className="tiny subdued">
                    {row.httpStatus ? `HTTP ${row.httpStatus}` : "No HTTP status"}
                  </span>
                </div>
                <div className={styles.errorCell}>
                  <span>{row.userEmail ?? "Unknown user"}</span>
                  <span className="tiny subdued">{row.userId ?? "No user id"}</span>
                </div>
                <div className={styles.errorCell}>
                  <span>{row.incidentId ? row.incidentId.slice(0, 10) : "Unlinked"}</span>
                  <span className="tiny subdued">
                    {`${incidentStatusLabel(row.incidentStatus)} · ${
                      row.fingerprint ? `fp ${row.fingerprint.slice(0, 10)}` : "No fingerprint"
                    }`}
                  </span>
                </div>
                <div className={styles.errorActions}>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => {
                      void handleCopyEvent(row);
                    }}
                    disabled={errorEventsLoading}
                  >
                    {copiedEventId === row.id ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => setSelectedEvent(row)}
                    disabled={errorEventsLoading}
                  >
                    View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {selectedEvent ? (
        <section className={styles.adminModalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.adminModalCard}>
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">Event Detail</p>
                <p className="tiny subdued">
                  {selectedEvent.id}
                  {selectedEvent.requestId ? ` · req ${selectedEvent.requestId}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </button>
            </div>
            <div className={styles.adminModalGrid}>
              <div className={styles.errorCell}>
                <span className="tiny subdued">Occurred</span>
                <span>{formatDateTime(selectedEvent.occurredAt)}</span>
              </div>
              <div className={styles.errorCell}>
                <span className="tiny subdued">Severity</span>
                <span>{selectedEvent.severity}</span>
              </div>
              <div className={styles.errorCell}>
                <span className="tiny subdued">Scope</span>
                <span>{selectedEvent.scope}</span>
              </div>
              <div className={styles.errorCell}>
                <span className="tiny subdued">Incident</span>
                <span>
                  {selectedEvent.incidentId
                    ? `${selectedEvent.incidentId} · ${incidentStatusLabel(selectedEvent.incidentStatus)}`
                    : "Unlinked"}
                </span>
              </div>
            </div>
            <div className={styles.errorCell}>
              <span className="tiny subdued">Message</span>
              <span>{selectedEvent.message}</span>
            </div>
            <div className={styles.errorCell}>
              <span className="tiny subdued">Source</span>
              <span>{selectedEvent.source}</span>
            </div>
            <div className={styles.errorCell}>
              <span className="tiny subdued">Route / endpoint</span>
              <span>{selectedEvent.endpoint ?? selectedEvent.route ?? "Unknown route"}</span>
            </div>
            {selectedEvent.stack ? (
              <div className={styles.errorCell}>
                <span className="tiny subdued">Stack</span>
                <pre className={styles.adminPreBlock}>{selectedEvent.stack}</pre>
              </div>
            ) : null}
            <div className={styles.errorCell}>
              <span className="tiny subdued">Metadata</span>
              <pre className={styles.adminPreBlock}>{eventMetadataText}</pre>
            </div>
            <div className={styles.errorActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => {
                  void handleCopyEvent(selectedEvent);
                }}
              >
                {copiedEventId === selectedEvent.id ? "Copied" : "Copy event JSON"}
              </button>
              {selectedEvent.incidentId ? (
                <>
                  {selectedEvent.incidentStatus === "open" ? (
                    <>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() =>
                          selectedIncidentId && onUpdateErrorStatus(selectedIncidentId, "resolved")
                        }
                        disabled={statusUpdatingErrorId === selectedIncidentId}
                      >
                        {statusUpdatingErrorId === selectedIncidentId
                          ? "Updating…"
                          : "Resolve incident"}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() =>
                          selectedIncidentId && onUpdateErrorStatus(selectedIncidentId, "ignored")
                        }
                        disabled={statusUpdatingErrorId === selectedIncidentId}
                      >
                        Ignore incident
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() =>
                        selectedIncidentId && onUpdateErrorStatus(selectedIncidentId, "open")
                      }
                      disabled={statusUpdatingErrorId === selectedIncidentId}
                    >
                      {statusUpdatingErrorId === selectedIncidentId
                        ? "Updating…"
                        : "Reopen incident"}
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
