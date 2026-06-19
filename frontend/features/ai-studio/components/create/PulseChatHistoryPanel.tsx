/**
 * Left-rail project Pulse chat history card.
 * Lists saved project-owned Pulse threads and exposes explicit reopen actions.
 */
import React from "react";
import { ChatCircleDots, PencilSimple, Trash, X } from "phosphor-react";
import { AppMessage } from "../../../../components/AppMessage";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";
import { formatPulseChatTimestamp } from "../../pulseChats/pulseChatTitles";
import type { PulseChatThreadListItem } from "../../pulseChats/pulseChatThread";

export type PulseChatHistoryPanelProps = {
  threads: PulseChatThreadListItem[];
  activeThreadId: string | null;
  loading: boolean;
  error: string | null;
  openingThreadId: string | null;
  onOpenThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
};

const PULSE_CHAT_RAIL_VISIBLE_LIMIT = 6;
const CONTEXT_MENU_VIEWPORT_PADDING_PX = 8;
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

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
  onRenameThread,
  onDeleteThread,
}: PulseChatHistoryPanelProps) {
  const [isAllChatsOpen, setIsAllChatsOpen] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{
    threadId: string;
    title: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingThreadId, setRenamingThreadId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null);
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

  const closeContextMenu = React.useCallback(() => setContextMenu(null), []);
  const cancelRename = React.useCallback(() => {
    setRenamingThreadId(null);
    setRenameDraft("");
  }, []);

  const commitRename = React.useCallback(() => {
    if (!renamingThreadId) return;
    const nextTitle = renameDraft.trim();
    if (!nextTitle) {
      cancelRename();
      return;
    }
    onRenameThread(renamingThreadId, nextTitle);
    cancelRename();
  }, [cancelRename, onRenameThread, renameDraft, renamingThreadId]);

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

  React.useEffect(() => {
    if (!contextMenu) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && contextMenuRef.current?.contains(target)) return;
      closeContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeContextMenu();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeContextMenu, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeContextMenu, true);
    };
  }, [closeContextMenu, contextMenu]);

  useIsomorphicLayoutEffect(() => {
    if (!contextMenu) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      const menuNode = contextMenuRef.current;
      if (!menuNode) return;
      const { height, width } = menuNode.getBoundingClientRect();
      if (!(height > 0) || !(width > 0)) return;
      const nextX = Math.min(
        Math.max(CONTEXT_MENU_VIEWPORT_PADDING_PX, contextMenu.x),
        Math.max(
          CONTEXT_MENU_VIEWPORT_PADDING_PX,
          window.innerWidth - width - CONTEXT_MENU_VIEWPORT_PADDING_PX
        )
      );
      const nextY = Math.min(
        Math.max(CONTEXT_MENU_VIEWPORT_PADDING_PX, contextMenu.y),
        Math.max(
          CONTEXT_MENU_VIEWPORT_PADDING_PX,
          window.innerHeight - height - CONTEXT_MENU_VIEWPORT_PADDING_PX
        )
      );
      if (nextX === contextMenu.x && nextY === contextMenu.y) return;
      setContextMenu((current) => (current ? { ...current, x: nextX, y: nextY } : current));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [contextMenu]);

  React.useEffect(() => {
    if (!renamingThreadId) return;
    if (threads.some((thread) => thread.threadId === renamingThreadId)) return;
    cancelRename();
  }, [cancelRename, renamingThreadId, threads]);

  const openThreadContextMenu = (
    event: React.MouseEvent<HTMLElement>,
    thread: PulseChatThreadListItem
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      threadId: thread.threadId,
      title: thread.title,
      x: Math.min(
        Math.max(CONTEXT_MENU_VIEWPORT_PADDING_PX, event.clientX),
        window.innerWidth - CONTEXT_MENU_VIEWPORT_PADDING_PX
      ),
      y: Math.min(
        Math.max(CONTEXT_MENU_VIEWPORT_PADDING_PX, event.clientY),
        window.innerHeight - CONTEXT_MENU_VIEWPORT_PADDING_PX
      ),
    });
  };

  const startRename = (threadId: string, title: string) => {
    setRenamingThreadId(threadId);
    setRenameDraft(title);
    closeContextMenu();
  };

  const deleteThread = (threadId: string) => {
    onDeleteThread(threadId);
    if (renamingThreadId === threadId) {
      cancelRename();
    }
    closeContextMenu();
  };

  const renderThreadButton = (
    thread: PulseChatThreadListItem,
    options: { onAfterOpen?: () => void } = {}
  ) => {
    const isActive = activeThreadId === thread.threadId;
    const isOpening = openingThreadId === thread.threadId;
    const isRenaming = renamingThreadId === thread.threadId;
    const timestamp = formatPulseChatTimestamp(thread.updatedAt);
    if (isRenaming) {
      return (
        <div
          key={thread.threadId}
          className="create-composer-chats-thread-row is-renaming"
          onContextMenu={(event) => openThreadContextMenu(event, thread)}
        >
          <input
            className="create-composer-chats-rename-input"
            type="text"
            value={renameDraft}
            maxLength={56}
            autoFocus
            aria-label={`Rename ${thread.title}`}
            onChange={(event) => setRenameDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelRename();
              }
            }}
          />
        </div>
      );
    }
    return (
      <button
        key={thread.threadId}
        type="button"
        className={`create-composer-chats-thread-btn ${isActive ? "is-active" : ""} ${
          isOpening ? "is-opening" : ""
        }`.trim()}
        aria-pressed={isActive}
        disabled={isOpening}
        onContextMenu={(event) => openThreadContextMenu(event, thread)}
        onClick={() => {
          onOpenThread(thread.threadId);
          options.onAfterOpen?.();
        }}
      >
        <span className="create-composer-chats-thread-main">
          <span className="create-composer-chats-thread-title">
            {isOpening ? "Opening..." : thread.title}
          </span>
          {timestamp ? (
            <span className="create-composer-chats-thread-time">{timestamp}</span>
          ) : null}
        </span>
        <span className="create-composer-chats-thread-pulse">{thread.presetLabel ?? "Pulse"}</span>
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
      {contextMenu ? (
        <AiStudioModalLayer>
          <div
            ref={contextMenuRef}
            className="create-composer-chats-context-menu"
            role="menu"
            aria-label={`${contextMenu.title} chat actions`}
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
          >
            <button
              type="button"
              className="create-composer-chats-context-menu-item"
              role="menuitem"
              onClick={() => startRename(contextMenu.threadId, contextMenu.title)}
            >
              <PencilSimple size={14} weight="bold" aria-hidden />
              Rename
            </button>
            <button
              type="button"
              className="create-composer-chats-context-menu-item is-danger"
              role="menuitem"
              onClick={() => deleteThread(contextMenu.threadId)}
            >
              <Trash size={14} weight="bold" aria-hidden />
              Delete
            </button>
          </div>
        </AiStudioModalLayer>
      ) : null}
    </section>
  );
}
