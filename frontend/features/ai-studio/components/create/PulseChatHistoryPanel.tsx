/**
 * Left-rail project Pulse chat history card.
 * Lists saved project-owned Pulse threads and exposes explicit reopen actions.
 */
import React from "react";
import { ChatCircleDots, X } from "phosphor-react";
import { AppMessage } from "../../../../components/AppMessage";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";
import type { PulseChatThreadListItem } from "../../pulseChats/pulseChatThread";

export type PulseChatHistoryPanelProps = {
  threads: PulseChatThreadListItem[];
  activeThreadId: string | null;
  loading: boolean;
  error: string | null;
  openingThreadId: string | null;
  onOpenThread: (threadId: string) => void;
};

const PULSE_CHAT_RAIL_VISIBLE_LIMIT = 6;

const formatUpdatedAt = (value: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const elapsedMs = Date.now() - timestamp;
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

const resolveVisibleThreads = (
  threads: PulseChatThreadListItem[],
  activeThreadId: string | null
): PulseChatThreadListItem[] => {
  if (threads.length <= PULSE_CHAT_RAIL_VISIBLE_LIMIT) return threads;

  const visibleThreads = threads.slice(0, PULSE_CHAT_RAIL_VISIBLE_LIMIT);
  if (!activeThreadId || visibleThreads.some((thread) => thread.threadId === activeThreadId)) {
    return visibleThreads;
  }

  const activeThread = threads.find((thread) => thread.threadId === activeThreadId);
  if (!activeThread) return visibleThreads;

  return [...threads.slice(0, PULSE_CHAT_RAIL_VISIBLE_LIMIT - 1), activeThread];
};

export function PulseChatHistoryPanel({
  threads,
  activeThreadId,
  loading,
  error,
  openingThreadId,
  onOpenThread,
}: PulseChatHistoryPanelProps) {
  const [isAllChatsOpen, setIsAllChatsOpen] = React.useState(false);
  const allChatsModalId = React.useId();
  const hasThreads = threads.length > 0;
  const visibleThreads = React.useMemo(
    () => resolveVisibleThreads(threads, activeThreadId),
    [activeThreadId, threads]
  );
  const hasHiddenThreads = visibleThreads.length < threads.length;
  const closeAllChats = React.useCallback(() => setIsAllChatsOpen(false), []);
  const openAllChats = React.useCallback(() => setIsAllChatsOpen(true), []);
  const allChatsBackdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(closeAllChats);
  useAiStudioModalActivity("pulse-chat-history-modal", isAllChatsOpen);

  React.useEffect(() => {
    if (!hasHiddenThreads) {
      setIsAllChatsOpen(false);
    }
  }, [hasHiddenThreads]);

  React.useEffect(() => {
    if (!isAllChatsOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAllChats();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAllChats, isAllChatsOpen]);

  const renderThreadButton = (
    thread: PulseChatThreadListItem,
    options: { onAfterOpen?: () => void } = {}
  ) => {
    const isActive = activeThreadId === thread.threadId;
    const isOpening = openingThreadId === thread.threadId;
    return (
      <button
        key={thread.threadId}
        type="button"
        className={`create-composer-presets-btn create-composer-presets-btn--selected create-composer-chats-thread-btn ${isActive ? "create-composer-presets-btn--active" : ""}`.trim()}
        aria-pressed={isActive}
        disabled={isOpening}
        onClick={() => {
          onOpenThread(thread.threadId);
          options.onAfterOpen?.();
        }}
      >
        <span className="create-composer-chats-thread-title">
          {isOpening ? "Opening..." : thread.title}
        </span>
        <span className="create-composer-chats-thread-meta">
          {thread.presetLabel ?? "Pulse"} · {formatUpdatedAt(thread.updatedAt)}
        </span>
      </button>
    );
  };

  return (
    <section className="create-composer-presets-panel" aria-label="Pulse chats">
      <div className="create-composer-presets-card create-composer-chats-card">
        <div className="create-composer-presets-title-card">
          <p className="create-composer-presets-title">Chats</p>
          <span className="create-composer-presets-title-icon" aria-hidden="true">
            <ChatCircleDots size={14} weight="regular" />
          </span>
        </div>
        <div className="create-composer-chats-list" aria-label="Saved pulse chats">
          {loading && !hasThreads ? (
            <p className="create-composer-chats-empty">Loading chats...</p>
          ) : null}
          {error && !hasThreads ? (
            <AppMessage
              className="create-composer-chats-empty"
              tone="error"
              mode="inline"
              message={error}
            />
          ) : null}
          {!loading && !error && !hasThreads ? (
            <p className="create-composer-chats-empty">
              Start a Pulse in this project to build your first saved chat.
            </p>
          ) : null}
          {visibleThreads.map((thread) => renderThreadButton(thread))}
          {hasHiddenThreads ? (
            <button
              type="button"
              className="create-composer-presets-btn create-composer-chats-more-btn"
              aria-controls={allChatsModalId}
              aria-expanded={isAllChatsOpen}
              aria-label={`See all saved Pulse chats (${threads.length})`}
              onClick={openAllChats}
            >
              See more chats
            </button>
          ) : null}
        </div>
      </div>
      {isAllChatsOpen ? (
        <AiStudioModalLayer>
          <div className="create-composer-chats-modal-backdrop" {...allChatsBackdropDismiss}>
            <div
              id={allChatsModalId}
              className="create-composer-chats-modal"
              role="dialog"
              aria-modal="true"
              aria-label="All Pulse chats"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="create-composer-chats-modal-header">
                <div className="create-composer-chats-modal-title-group">
                  <p className="create-composer-chats-modal-title">All Pulse chats</p>
                  <span className="create-composer-chats-modal-count">{threads.length}</span>
                </div>
                <button
                  type="button"
                  className="ghost-btn mini create-composer-chats-modal-close"
                  aria-label="Close all Pulse chats"
                  onClick={closeAllChats}
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div
                className="create-composer-chats-modal-scroll"
                aria-label="All saved Pulse chats"
              >
                {threads.map((thread) =>
                  renderThreadButton(thread, {
                    onAfterOpen: closeAllChats,
                  })
                )}
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}
    </section>
  );
}
