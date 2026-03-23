import type { AdminErrorEventRow, AdminErrorStatus } from "../types";
import { formatDateTime, incidentStatusLabel } from "../logic/errorIncidentViewUtils";
import styles from "../../../styles/admin.module.css";

type ErrorEventDetailModalProps = {
  selectedEvent: AdminErrorEventRow | null;
  selectedIncidentId: string | null;
  eventMetadataText: string;
  copiedEventId: string | null;
  statusUpdatingErrorId: string | null;
  onClose: () => void;
  onCopyEvent: (row: AdminErrorEventRow) => void;
  onUpdateErrorStatus: (errorId: string, status: AdminErrorStatus) => Promise<void>;
  onUpdateErrorEventStatus: (eventId: string, status: AdminErrorStatus) => Promise<void>;
};

export function ErrorEventDetailModal({
  selectedEvent,
  selectedIncidentId,
  eventMetadataText,
  copiedEventId,
  statusUpdatingErrorId,
  onClose,
  onCopyEvent,
  onUpdateErrorStatus,
  onUpdateErrorEventStatus,
}: ErrorEventDetailModalProps) {
  if (!selectedEvent) return null;

  return (
    <section
      className={styles.adminModalBackdrop}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
          <button type="button" className="ghost-btn mini" onClick={onClose}>
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
            onClick={() => onCopyEvent(selectedEvent)}
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
                  {statusUpdatingErrorId === selectedIncidentId ? "Updating…" : "Reopen incident"}
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
  );
}
