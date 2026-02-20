/**
 * Admin error incidents panel.
 * Renders summary cards, filters, and grouped incident rows for operator triage.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WarningCircle } from "phosphor-react";
import type {
  AdminErrorEventIncidentFilter,
  AdminErrorLogRow,
  AdminErrorEventRow,
  AdminErrorEventSignalFilter,
  AdminErrorEventsHealth,
  AdminErrorEventSummary,
  AdminErrorSummary,
  AdminPagination,
  AdminErrorStatus,
} from "../types";
import { buildEventTriagePacket, buildIncidentTriagePacket } from "../logic/triagePackets";
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
  errorEventsHealth: AdminErrorEventsHealth;
  errorEventsPagination: AdminPagination;
  errorStatusFilter: "open" | "all";
  errorScopeFilter: "all" | "app" | "generation";
  errorSeverityFilter: "all" | "high" | "medium" | "low";
  errorSourceFilter: string;
  errorEventSyntheticFilter: "all" | "exclude" | "only";
  errorEventSignalFilter: AdminErrorEventSignalFilter;
  errorEventIncidentFilter: AdminErrorEventIncidentFilter;
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
  onErrorEventSignalFilterChange: (value: AdminErrorEventSignalFilter) => void;
  onErrorEventIncidentFilterChange: (value: AdminErrorEventIncidentFilter) => void;
  onErrorSearchChange: (value: string) => void;
  onUpdateErrorStatus: (errorId: string, status: AdminErrorStatus) => Promise<void>;
  onUpdateErrorEventStatus: (eventId: string, status: AdminErrorStatus) => Promise<void>;
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

const eventSignalFilterLabel = (value: AdminErrorEventSignalFilter): string => {
  if (value === "character_mode_reference_refresh_empty") {
    return "Character Mode: reference refresh empty";
  }
  if (value === "character_mode_bundle_unavailable_fallback") {
    return "Character Mode: bundle unavailable fallback";
  }
  return "All event signals";
};

const eventIncidentFilterLabel = (value: AdminErrorEventIncidentFilter): string => {
  if (value === "actionable") return "Actionable (open + unlinked)";
  if (value === "open") return "Open incidents only";
  if (value === "resolved") return "Resolved incidents only";
  if (value === "ignored") return "Ignored incidents only";
  if (value === "unlinked") return "Unlinked events only";
  return "All incident states";
};

const eventMatchesIncidentFilter = (
  row: AdminErrorEventRow,
  filter: AdminErrorEventIncidentFilter
): boolean => {
  if (filter === "all") return true;
  if (filter === "actionable") {
    return row.incidentStatus === "open" || row.incidentId === null;
  }
  if (filter === "unlinked") {
    return row.incidentId === null;
  }
  return row.incidentStatus === filter;
};

const incidentStatusLabel = (status: AdminErrorStatus | null): string => {
  if (status === "resolved") return "Resolved";
  if (status === "ignored") return "Ignored";
  if (status === "open") return "Open";
  return "Unlinked";
};

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
  errorEventsHealth,
  errorEventsPagination,
  errorStatusFilter,
  errorScopeFilter,
  errorSeverityFilter,
  errorSourceFilter,
  errorEventSyntheticFilter,
  errorEventSignalFilter,
  errorEventIncidentFilter,
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
  onErrorEventSignalFilterChange,
  onErrorEventIncidentFilterChange,
  onErrorSearchChange,
  onUpdateErrorStatus,
  onUpdateErrorEventStatus,
  onTriggerTestIncident,
  onPrevPage,
  onNextPage,
  onEventPrevPage,
  onEventNextPage,
  onRefresh,
}: ErrorIncidentsPanelProps) {
  const [copiedIncidentId, setCopiedIncidentId] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [bulkResolveSubmitting, setBulkResolveSubmitting] = useState(false);
  const [bulkResolveResult, setBulkResolveResult] = useState<string | null>(null);
  const autoAdvancedEventPageRef = useRef<number | null>(null);
  const errorSourceOptions = useMemo(() => {
    const values = new Set([
      ...errors.map((row) => row.source),
      ...errorEvents.map((row) => row.source),
    ]);
    return ["all", ...Array.from(values).sort()];
  }, [errorEvents, errors]);
  const visibleEvents = useMemo(
    () => errorEvents.filter((row) => eventMatchesIncidentFilter(row, errorEventIncidentFilter)),
    [errorEventIncidentFilter, errorEvents]
  );
  const selectedEvent = useMemo(
    () => errorEvents.find((row) => row.id === selectedEventId) ?? null,
    [errorEvents, selectedEventId]
  );
  const selectedIncidentId = selectedEvent?.incidentId ?? null;
  const resolvableVisibleIncidentIds = useMemo(
    () =>
      Array.from(
        new Set(
          visibleEvents
            .map((row) => (row.incidentStatus === "open" ? row.incidentId : null))
            .filter((incidentId): incidentId is string => Boolean(incidentId))
        )
      ),
    [visibleEvents]
  );
  const resolvableVisibleUnlinkedEventIds = useMemo(
    () => visibleEvents.filter((row) => row.incidentId === null).map((row) => row.id),
    [visibleEvents]
  );
  const resolveVisibleTargetCount =
    resolvableVisibleIncidentIds.length + resolvableVisibleUnlinkedEventIds.length;

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
  const telemetryHealthLabel = errorEventsHealth.degraded ? "Degraded" : "Healthy";
  const telemetryHealthSubtext = errorEventsHealth.degraded
    ? "Event stream fallback active"
    : "Event stream available";

  const handleCopyIncident = useCallback(async (row: AdminErrorLogRow) => {
    const success = await copyToClipboard(buildIncidentTriagePacket(row));
    if (!success) return;
    setCopiedIncidentId(row.id);
    window.setTimeout(() => {
      setCopiedIncidentId((current) => (current === row.id ? null : current));
    }, 1200);
  }, []);

  const handleCopyEvent = useCallback(async (row: AdminErrorEventRow) => {
    const success = await copyToClipboard(buildEventTriagePacket(row));
    if (!success) return;
    setCopiedEventId(row.id);
    window.setTimeout(() => {
      setCopiedEventId((current) => (current === row.id ? null : current));
    }, 1200);
  }, []);

  const handleEventStatusUpdate = useCallback(
    async (incidentId: string | null, status: AdminErrorStatus) => {
      if (!incidentId) return;
      await onUpdateErrorStatus(incidentId, status);
    },
    [onUpdateErrorStatus]
  );

  const handleResolveEventRow = useCallback(
    async (row: AdminErrorEventRow) => {
      if (row.incidentId && row.incidentStatus === "open") {
        await handleEventStatusUpdate(row.incidentId, "resolved");
        return;
      }
      if (row.incidentId === null) {
        await onUpdateErrorEventStatus(row.id, "resolved");
      }
    },
    [handleEventStatusUpdate, onUpdateErrorEventStatus]
  );

  const handleIgnoreEventRow = useCallback(
    async (row: AdminErrorEventRow) => {
      if (row.incidentId && row.incidentStatus === "open") {
        await handleEventStatusUpdate(row.incidentId, "ignored");
        return;
      }
      if (row.incidentId === null) {
        await onUpdateErrorEventStatus(row.id, "ignored");
      }
    },
    [handleEventStatusUpdate, onUpdateErrorEventStatus]
  );

  const resolveVisibleEvents = useCallback(async () => {
    if (resolveVisibleTargetCount === 0 || bulkResolveSubmitting) return;

    setBulkResolveSubmitting(true);
    setBulkResolveResult(null);
    try {
      for (const incidentId of resolvableVisibleIncidentIds) {
        await handleEventStatusUpdate(incidentId, "resolved");
      }
      for (const eventId of resolvableVisibleUnlinkedEventIds) {
        await onUpdateErrorEventStatus(eventId, "resolved");
      }

      const linkedResolvedCount = resolvableVisibleIncidentIds.length;
      const promotedResolvedCount = resolvableVisibleUnlinkedEventIds.length;
      setBulkResolveResult(
        `Resolved ${linkedResolvedCount} linked incident${linkedResolvedCount === 1 ? "" : "s"} and resolved ${promotedResolvedCount} unlinked event${promotedResolvedCount === 1 ? "" : "s"}.`
      );
    } finally {
      setBulkResolveSubmitting(false);
    }
  }, [
    bulkResolveSubmitting,
    handleEventStatusUpdate,
    onUpdateErrorEventStatus,
    resolvableVisibleIncidentIds,
    resolvableVisibleUnlinkedEventIds,
    resolveVisibleTargetCount,
  ]);

  const eventMetadataText = useMemo(() => {
    if (!selectedEvent) return "";
    return JSON.stringify(selectedEvent.metadata ?? {}, null, 2);
  }, [selectedEvent]);

  useEffect(() => {
    const shouldAutoAdvance =
      !errorEventsLoading &&
      errorEventIncidentFilter !== "all" &&
      errorEvents.length > 0 &&
      visibleEvents.length === 0 &&
      errorEventsPagination.hasNextPage;
    if (!shouldAutoAdvance) {
      autoAdvancedEventPageRef.current = null;
      return;
    }
    if (autoAdvancedEventPageRef.current === errorEventsPagination.page) {
      return;
    }
    autoAdvancedEventPageRef.current = errorEventsPagination.page;
    onEventNextPage();
  }, [
    errorEventIncidentFilter,
    errorEvents.length,
    errorEventsLoading,
    errorEventsPagination.hasNextPage,
    errorEventsPagination.page,
    onEventNextPage,
    visibleEvents.length,
  ]);

  useEffect(() => {
    if (!selectedEventId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEventId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedEventId]);

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
        <div className={`${styles.adminCard} ${errorEventsHealth.degraded ? styles.warning : ""}`}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Telemetry health</span>
          </div>
          <p className={styles.adminMetric}>{telemetryHealthLabel}</p>
          <p className={styles.adminSubtext}>{telemetryHealthSubtext}</p>
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

        <select
          className={styles.searchInput}
          value={errorEventIncidentFilter}
          onChange={(event) =>
            onErrorEventIncidentFilterChange(event.target.value as AdminErrorEventIncidentFilter)
          }
        >
          <option value="actionable">Events: Actionable</option>
          <option value="all">Events: All incident states</option>
          <option value="open">Events: Open incidents</option>
          <option value="resolved">Events: Resolved incidents</option>
          <option value="ignored">Events: Ignored incidents</option>
          <option value="unlinked">Events: Unlinked only</option>
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
                  {copiedIncidentId === row.id ? "Copied" : "Copy triage"}
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
            <p className="tiny subdued">
              Raw per-occurrence events (failures plus selected telemetry signals).
            </p>
          </div>
          <div className={styles.tabRow}>
            <span className="tiny subdued">{`15m ${errorEventsSummary.last15mCount} · 1h ${errorEventsSummary.lastHourCount} · 24h ${errorEventsSummary.last24hCount}`}</span>
            <span className="tiny subdued">
              {`App ${errorEventsSummary.app24hCount} · Generation ${errorEventsSummary.generation24hCount} · High ${errorEventsSummary.high24hCount}`}
            </span>
          </div>
        </div>
        {errorEventsHealth.degraded ? (
          <p className="tiny subdued">
            Event stream is currently in degraded mode.{" "}
            {errorEventsHealth.reason ?? "Telemetry occurrence storage is unavailable."}
          </p>
        ) : null}

        <section className={styles.adminGrid}>
          <div
            className={`${styles.adminCard} ${
              errorEventsSummary.total15mBreached ? styles.alert : ""
            }`}
          >
            <div className={styles.adminCardTop}>
              <span className={styles.adminLabel}>15m total events</span>
            </div>
            <p className={styles.adminMetric}>{errorEventsSummary.last15mCount}</p>
            <p className={styles.adminSubtext}>
              {`Threshold ${errorEventsSummary.total15mThreshold} · ${
                errorEventsSummary.total15mBreached ? "Alert" : "Normal"
              }`}
            </p>
          </div>
          <div
            className={`${styles.adminCard} ${
              errorEventsSummary.high15mBreached ? styles.alert : ""
            }`}
          >
            <div className={styles.adminCardTop}>
              <span className={styles.adminLabel}>15m high severity</span>
            </div>
            <p className={styles.adminMetric}>{errorEventsSummary.high15mCount}</p>
            <p className={styles.adminSubtext}>
              {`Threshold ${errorEventsSummary.high15mThreshold} · ${
                errorEventsSummary.high15mBreached ? "Alert" : "Normal"
              }`}
            </p>
          </div>
          <div
            className={`${styles.adminCard} ${
              errorEventsSummary.generation15mBreached ? styles.warning : ""
            }`}
          >
            <div className={styles.adminCardTop}>
              <span className={styles.adminLabel}>15m generation events</span>
            </div>
            <p className={styles.adminMetric}>{errorEventsSummary.generation15mCount}</p>
            <p className={styles.adminSubtext}>
              {`Threshold ${errorEventsSummary.generation15mThreshold} · ${
                errorEventsSummary.generation15mBreached ? "Elevated" : "Normal"
              }`}
            </p>
          </div>
        </section>

        <div className={styles.searchRow}>
          <p className="tiny subdued">
            Character Mode telemetry frequency: refresh-empty and bundle-unavailable fallback.
          </p>
          <div className={styles.tabRow}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => onErrorEventSignalFilterChange("all")}
              disabled={errorEventsLoading || errorEventSignalFilter === "all"}
            >
              Clear signal filter
            </button>
            <span className="tiny subdued">{eventSignalFilterLabel(errorEventSignalFilter)}</span>
          </div>
        </div>

        <section className={styles.adminGrid}>
          <div className={styles.adminCard}>
            <div className={styles.adminCardTop}>
              <span className={styles.adminLabel}>Reference refresh empty</span>
            </div>
            <p className={styles.adminMetric}>
              {errorEventsSummary.characterModeReferenceRefreshEmptyLast24hCount}
            </p>
            <p className={styles.adminSubtext}>
              {`1h ${errorEventsSummary.characterModeReferenceRefreshEmptyLastHourCount} · 24h ${errorEventsSummary.characterModeReferenceRefreshEmptyLast24hCount}`}
            </p>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() =>
                onErrorEventSignalFilterChange("character_mode_reference_refresh_empty")
              }
              disabled={
                errorEventsLoading ||
                errorEventSignalFilter === "character_mode_reference_refresh_empty"
              }
            >
              Filter stream
            </button>
          </div>
          <div className={styles.adminCard}>
            <div className={styles.adminCardTop}>
              <span className={styles.adminLabel}>Bundle unavailable fallback</span>
            </div>
            <p className={styles.adminMetric}>
              {errorEventsSummary.characterModeBundleUnavailableFallbackLast24hCount}
            </p>
            <p className={styles.adminSubtext}>
              {`1h ${errorEventsSummary.characterModeBundleUnavailableFallbackLastHourCount} · 24h ${errorEventsSummary.characterModeBundleUnavailableFallbackLast24hCount}`}
            </p>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() =>
                onErrorEventSignalFilterChange("character_mode_bundle_unavailable_fallback")
              }
              disabled={
                errorEventsLoading ||
                errorEventSignalFilter === "character_mode_bundle_unavailable_fallback"
              }
            >
              Filter stream
            </button>
          </div>
        </section>

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
        <div className={styles.searchRow}>
          <p className="tiny subdued">
            {`Display filter: ${eventIncidentFilterLabel(errorEventIncidentFilter)} · visible ${visibleEvents.length} of ${errorEvents.length} loaded`}
          </p>
          <div className={styles.tabRow}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => {
                void resolveVisibleEvents();
              }}
              disabled={resolveVisibleTargetCount === 0 || bulkResolveSubmitting}
            >
              {bulkResolveSubmitting
                ? "Resolving…"
                : `Resolve visible (${resolveVisibleTargetCount})`}
            </button>
          </div>
        </div>
        {bulkResolveResult ? <p className="tiny subdued">{bulkResolveResult}</p> : null}

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
          ) : visibleEvents.length === 0 ? (
            <div className={`${styles.adminEventsRow} ${styles.severityLow}`}>
              <span className="subdued">Filtered</span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
              <span className="subdued">
                No loaded events matched the display filter. Try `Events: All incident states`.
              </span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
              <span className="subdued">—</span>
            </div>
          ) : (
            visibleEvents.map((row) => (
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
                    {copiedEventId === row.id ? "Copied" : "Copy triage"}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => setSelectedEventId(row.id)}
                    disabled={errorEventsLoading}
                  >
                    View
                  </button>
                  {row.incidentId ? (
                    row.incidentStatus === "open" ? (
                      <>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => {
                            void handleResolveEventRow(row);
                          }}
                          disabled={errorEventsLoading || statusUpdatingErrorId === row.incidentId}
                        >
                          {statusUpdatingErrorId === row.incidentId ? "Updating…" : "Resolve"}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => {
                            void handleIgnoreEventRow(row);
                          }}
                          disabled={errorEventsLoading || statusUpdatingErrorId === row.incidentId}
                        >
                          Ignore
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() =>
                          row.incidentId && onUpdateErrorStatus(row.incidentId, "open")
                        }
                        disabled={errorEventsLoading || statusUpdatingErrorId === row.incidentId}
                      >
                        {statusUpdatingErrorId === row.incidentId ? "Updating…" : "Reopen"}
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => {
                          void handleResolveEventRow(row);
                        }}
                        disabled={errorEventsLoading || statusUpdatingErrorId === row.id}
                      >
                        {statusUpdatingErrorId === row.id ? "Updating…" : "Resolve"}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => {
                          void handleIgnoreEventRow(row);
                        }}
                        disabled={errorEventsLoading || statusUpdatingErrorId === row.id}
                      >
                        Ignore
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {selectedEvent ? (
        <section
          className={styles.adminModalBackdrop}
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedEventId(null)}
        >
          <div className={styles.adminModalCard} onClick={(event) => event.stopPropagation()}>
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
                onClick={() => setSelectedEventId(null)}
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
                {copiedEventId === selectedEvent.id ? "Copied" : "Copy triage packet"}
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
              ) : (
                <>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => onUpdateErrorEventStatus(selectedEvent.id, "resolved")}
                    disabled={statusUpdatingErrorId === selectedEvent.id}
                  >
                    {statusUpdatingErrorId === selectedEvent.id ? "Updating…" : "Resolve event"}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => onUpdateErrorEventStatus(selectedEvent.id, "ignored")}
                    disabled={statusUpdatingErrorId === selectedEvent.id}
                  >
                    Ignore event
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
