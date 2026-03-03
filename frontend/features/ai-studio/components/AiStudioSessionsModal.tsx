/**
 * AI Studio sessions modal.
 * Presents recent persisted sessions and drives explicit confirm-before-switch interactions.
 */
import React, { useMemo } from "react";
import type { AiStudioSessionListApiItem } from "../logic/sessionApiClient";

type AiStudioSessionsModalProps = {
  isOpen: boolean;
  currentSessionId: string | null;
  sessions: AiStudioSessionListApiItem[];
  nextCursor: string | null;
  isLoadingSessions: boolean;
  isLoadingMoreSessions: boolean;
  sessionsLoadError: string | null;
  pendingSessionSwitch: AiStudioSessionListApiItem | null;
  switchError: string | null;
  isSwitchingSession: boolean;
  onClose: () => void;
  onReloadSessions: () => void;
  onLoadMoreSessions: () => void;
  onRequestSessionSwitch: (item: AiStudioSessionListApiItem) => void;
  onCancelSessionSwitch: () => void;
  onConfirmSessionSwitch: () => void;
};

const formatSessionTimestamp = (isoTimestamp: string): string => {
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * Renders a modal list of recent AI Studio sessions.
 */
export function AiStudioSessionsModal({
  isOpen,
  currentSessionId,
  sessions,
  nextCursor,
  isLoadingSessions,
  isLoadingMoreSessions,
  sessionsLoadError,
  pendingSessionSwitch,
  switchError,
  isSwitchingSession,
  onClose,
  onReloadSessions,
  onLoadMoreSessions,
  onRequestSessionSwitch,
  onCancelSessionSwitch,
  onConfirmSessionSwitch,
}: AiStudioSessionsModalProps) {
  const hasSessions = sessions.length > 0;
  const titleId = useMemo(() => "ai-sessions-modal-title", []);
  if (!isOpen) return null;

  return (
    <div className="media-library-modal-backdrop ai-sessions-modal-backdrop" onClick={onClose}>
      <div
        className="media-library-modal ai-sessions-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="media-library-modal-header ai-sessions-modal-header">
          <div>
            <p className="eyebrow">AI Studio</p>
            <h2 id={titleId} className="ai-sessions-modal-title">
              Sessions
            </h2>
          </div>
          <button type="button" className="ghost-btn mini" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ai-sessions-modal-body">
          {isLoadingSessions ? <p className="tiny subdued">Loading sessions…</p> : null}
          {!isLoadingSessions && sessionsLoadError ? (
            <div className="inline-error-hint">
              <p className="status-error">{sessionsLoadError}</p>
              <button type="button" className="ghost-btn mini" onClick={onReloadSessions}>
                Retry
              </button>
            </div>
          ) : null}
          {!isLoadingSessions && !sessionsLoadError && !hasSessions ? (
            <p className="tiny subdued">No previous sessions yet.</p>
          ) : null}
          {!isLoadingSessions && hasSessions ? (
            <div className="history-list ai-sessions-history-list">
              {sessions.map((item) => {
                const isCurrent = currentSessionId === item.sessionId;
                const isPending = pendingSessionSwitch?.sessionId === item.sessionId;
                const title = item.title?.trim() || "Untitled session";
                return (
                  <button
                    key={item.sessionId}
                    type="button"
                    className={`history-card ${isCurrent ? "is-active" : ""}`}
                    disabled={isCurrent || isSwitchingSession}
                    onClick={() => onRequestSessionSwitch(item)}
                  >
                    <div className="history-top">
                      <h3 className="history-title">{title}</h3>
                      {isCurrent ? <span className="status-chip">Current</span> : null}
                      {isPending ? <span className="status-chip is-running">Pending</span> : null}
                    </div>
                    <p className="tiny subdued">
                      Updated {formatSessionTimestamp(item.updatedAt)} · Save #{item.saveSeq}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {nextCursor && !isLoadingSessions ? (
            <div className="ai-sessions-modal-actions">
              <button
                type="button"
                className="ghost-btn mini"
                disabled={isLoadingMoreSessions}
                onClick={onLoadMoreSessions}
              >
                {isLoadingMoreSessions ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {pendingSessionSwitch ? (
        <div className="art-confirm-backdrop" onClick={onCancelSessionSwitch}>
          <div
            className="art-confirm-card ai-sessions-confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="art-confirm-title">Switch sessions?</p>
            <p className="art-confirm-copy">
              Save your current session and load{" "}
              <strong>{pendingSessionSwitch.title?.trim() || "Untitled session"}</strong>.
            </p>
            {switchError ? <p className="status-error">{switchError}</p> : null}
            <div className="art-confirm-actions">
              <button
                type="button"
                className="ghost-btn mini"
                disabled={isSwitchingSession}
                onClick={onCancelSessionSwitch}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ghost-btn mini prompt-save-modal-btn"
                disabled={isSwitchingSession}
                onClick={onConfirmSessionSwitch}
              >
                {isSwitchingSession ? "Switching…" : "Save + switch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
