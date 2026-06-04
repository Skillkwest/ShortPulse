/**
 * Left-rail project Pulse chat history card.
 * Lists saved project-owned Pulse threads and exposes explicit reopen actions.
 */
import React from "react";
import { ChatCircleDots } from "phosphor-react";
import type { PulseChatThreadListItem } from "../../pulseChats/pulseChatThread";

export type PulseChatHistoryPanelProps = {
  threads: PulseChatThreadListItem[];
  activeThreadId: string | null;
  loading: boolean;
  error: string | null;
  openingThreadId: string | null;
  onOpenThread: (threadId: string) => void;
};

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

export function PulseChatHistoryPanel({
  threads,
  activeThreadId,
  loading,
  error,
  openingThreadId,
  onOpenThread,
}: PulseChatHistoryPanelProps) {
  const hasThreads = threads.length > 0;

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
          {error && !hasThreads ? <p className="create-composer-chats-empty">{error}</p> : null}
          {!loading && !error && !hasThreads ? (
            <p className="create-composer-chats-empty">
              Start a Pulse in this project to build your first saved chat.
            </p>
          ) : null}
          {threads.map((thread) => {
            const isActive = activeThreadId === thread.threadId;
            const isOpening = openingThreadId === thread.threadId;
            return (
              <button
                key={thread.threadId}
                type="button"
                className={`create-composer-presets-btn create-composer-presets-btn--selected create-composer-chats-thread-btn ${isActive ? "create-composer-presets-btn--active" : ""}`.trim()}
                aria-pressed={isActive}
                disabled={isOpening}
                onClick={() => onOpenThread(thread.threadId)}
              >
                <span className="create-composer-chats-thread-title">
                  {isOpening ? "Opening..." : thread.title}
                </span>
                <span className="create-composer-chats-thread-meta">
                  {thread.presetLabel ?? "Pulse"} · {formatUpdatedAt(thread.updatedAt)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
