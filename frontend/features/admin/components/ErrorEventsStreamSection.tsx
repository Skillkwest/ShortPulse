import type {
  AdminErrorEventIncidentFilter,
  AdminErrorEventRow,
  AdminErrorEventSignalFilter,
  AdminErrorEventsHealth,
  AdminErrorEventSummary,
  AdminErrorStatus,
  AdminPagination,
} from "../types";
import {
  eventIncidentFilterLabel,
  eventSignalFilterLabel,
  formatDateTime,
  incidentStatusLabel,
  sourceLabel,
} from "../logic/errorIncidentViewUtils";
import { ErrorEventDetailModal } from "./ErrorEventDetailModal";
import styles from "../../../styles/admin.module.css";

type ErrorEventsStreamSectionProps = {
  errorEvents: AdminErrorEventRow[];
  errorEventsLoading: boolean;
  errorEventsError: string | null;
  errorEventsSummary: AdminErrorEventSummary;
  errorEventsHealth: AdminErrorEventsHealth;
  errorEventsPagination: AdminPagination;
  errorEventSignalFilter: AdminErrorEventSignalFilter;
  errorEventIncidentFilter: AdminErrorEventIncidentFilter;
  visibleEvents: AdminErrorEventRow[];
  resolveVisibleTargetCount: number;
  bulkResolveSubmitting: boolean;
  bulkResolveResult: string | null;
  copiedEventId: string | null;
  selectedEvent: AdminErrorEventRow | null;
  selectedIncidentId: string | null;
  eventMetadataText: string;
  statusUpdatingErrorId: string | null;
  onErrorEventSignalFilterChange: (value: AdminErrorEventSignalFilter) => void;
  onEventPrevPage: () => void;
  onEventNextPage: () => void;
  onResolveVisibleEvents: () => void;
  onCopyEvent: (row: AdminErrorEventRow) => void;
  onOpenSelectedEvent: (eventId: string) => void;
  onCloseSelectedEvent: () => void;
  onResolveEventRow: (row: AdminErrorEventRow) => void;
  onIgnoreEventRow: (row: AdminErrorEventRow) => void;
  onUpdateErrorStatus: (errorId: string, status: AdminErrorStatus) => Promise<void>;
  onUpdateErrorEventStatus: (eventId: string, status: AdminErrorStatus) => Promise<void>;
};

export function ErrorEventsStreamSection({
  errorEvents,
  errorEventsLoading,
  errorEventsError,
  errorEventsSummary,
  errorEventsHealth,
  errorEventsPagination,
  errorEventSignalFilter,
  errorEventIncidentFilter,
  visibleEvents,
  resolveVisibleTargetCount,
  bulkResolveSubmitting,
  bulkResolveResult,
  copiedEventId,
  selectedEvent,
  selectedIncidentId,
  eventMetadataText,
  statusUpdatingErrorId,
  onErrorEventSignalFilterChange,
  onEventPrevPage,
  onEventNextPage,
  onResolveVisibleEvents,
  onCopyEvent,
  onOpenSelectedEvent,
  onCloseSelectedEvent,
  onResolveEventRow,
  onIgnoreEventRow,
  onUpdateErrorStatus,
  onUpdateErrorEventStatus,
}: ErrorEventsStreamSectionProps) {
  const eventResultStart =
    errorEventsPagination.totalCount === 0
      ? 0
      : (errorEventsPagination.page - 1) * errorEventsPagination.perPage + 1;
  const eventResultEnd = Math.min(
    errorEventsPagination.page * errorEventsPagination.perPage,
    errorEventsPagination.totalCount
  );
  const admissionLast15m = errorEventsSummary.admissionDeniedTelemetry.last15m;
  const admissionLastHour = errorEventsSummary.admissionDeniedTelemetry.lastHour;

  return (
    <>
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
          <div
            className={`${styles.adminCard} ${
              errorEventsSummary.providerRunningTimeout15mBreached ? styles.warning : ""
            }`}
          >
            <div className={styles.adminCardTop}>
              <span className={styles.adminLabel}>15m running timeouts</span>
            </div>
            <p className={styles.adminMetric}>
              {errorEventsSummary.providerRunningTimeout15mCount}
            </p>
            <p className={styles.adminSubtext}>
              {`Threshold ${errorEventsSummary.providerRunningTimeout15mThreshold} · ${
                errorEventsSummary.providerRunningTimeout15mBreached ? "Elevated" : "Normal"
              }`}
            </p>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => onErrorEventSignalFilterChange("provider_running_timeout")}
              disabled={errorEventsLoading || errorEventSignalFilter === "provider_running_timeout"}
            >
              Filter stream
            </button>
          </div>
        </section>

        <div className={styles.searchRow}>
          <p className="tiny subdued">
            Admission pressure split: shared provider saturation vs per-user burst limiting.
          </p>
          <span className="tiny subdued">
            {`15m total ${admissionLast15m.total} · 1h total ${admissionLastHour.total}`}
          </span>
        </div>

        <section className={styles.adminGrid}>
          <div className={styles.adminCard}>
            <div className={styles.adminCardTop}>
              <span className={styles.adminLabel}>Shared-provider pressure</span>
            </div>
            <p className={styles.adminMetric}>{admissionLast15m.byScope.shared_provider ?? 0}</p>
            <p className={styles.adminSubtext}>
              {`15m shared-provider limiter events · 1h ${admissionLastHour.byScope.shared_provider ?? 0}`}
            </p>
          </div>
          <div className={styles.adminCard}>
            <div className={styles.adminCardTop}>
              <span className={styles.adminLabel}>Per-user pressure</span>
            </div>
            <p className={styles.adminMetric}>{admissionLast15m.byScope.per_user ?? 0}</p>
            <p className={styles.adminSubtext}>
              {`15m per-user limiter events · 1h ${admissionLastHour.byScope.per_user ?? 0}`}
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
              onClick={onResolveVisibleEvents}
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
                    onClick={() => onCopyEvent(row)}
                    disabled={errorEventsLoading}
                  >
                    {copiedEventId === row.id ? "Copied" : "Copy triage"}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => onOpenSelectedEvent(row.id)}
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
                          onClick={() => onResolveEventRow(row)}
                          disabled={errorEventsLoading || statusUpdatingErrorId === row.incidentId}
                        >
                          {statusUpdatingErrorId === row.incidentId ? "Updating…" : "Resolve"}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => onIgnoreEventRow(row)}
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
                        onClick={() => onResolveEventRow(row)}
                        disabled={errorEventsLoading || statusUpdatingErrorId === row.id}
                      >
                        {statusUpdatingErrorId === row.id ? "Updating…" : "Resolve"}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => onIgnoreEventRow(row)}
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

      <ErrorEventDetailModal
        selectedEvent={selectedEvent}
        selectedIncidentId={selectedIncidentId}
        eventMetadataText={eventMetadataText}
        copiedEventId={copiedEventId}
        statusUpdatingErrorId={statusUpdatingErrorId}
        onClose={onCloseSelectedEvent}
        onCopyEvent={onCopyEvent}
        onUpdateErrorStatus={onUpdateErrorStatus}
        onUpdateErrorEventStatus={onUpdateErrorEventStatus}
      />
    </>
  );
}
