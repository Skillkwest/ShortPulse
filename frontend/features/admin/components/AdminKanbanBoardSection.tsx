/**
 * Ophestivus board section.
 * Provides the shared operator task board on the admin Ophestivus page.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ClockCounterClockwise,
  DotsSixVertical,
  Plus,
  Trash,
  X,
} from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  ADMIN_KANBAN_COLUMNS,
  type AdminKanbanActionLogEntry,
  type AdminKanbanItem,
  type AdminKanbanStatus,
  parseAdminKanbanActionLog,
  parseAdminKanbanItems,
} from "../data/adminKanbanBoard";
import styles from "../../../styles/adminKanban.module.css";

const formatItemDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const formatActionDate = (value: string): string =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatStatusLabel = (status: AdminKanbanStatus | null): string | null =>
  ADMIN_KANBAN_COLUMNS.find((column) => column.id === status)?.label ?? null;

const formatActionLabel = (entry: AdminKanbanActionLogEntry): string => {
  if (entry.action === "created") return "Created item";
  if (entry.action === "updated") return "Updated item";
  if (entry.action === "archived") return "Archived item";
  return "Moved item";
};

const formatTransitionLabel = (entry: AdminKanbanActionLogEntry): string | null => {
  const fromStatus = formatStatusLabel(entry.fromStatus);
  const toStatus = formatStatusLabel(entry.toStatus);
  if (fromStatus && toStatus) return `${fromStatus} -> ${toStatus}`;
  if (toStatus) return toStatus;
  if (fromStatus) return fromStatus;
  return null;
};

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof payload?.error === "string" && payload.error ? payload.error : fallback;
};

const readItemPayload = async (response: Response): Promise<AdminKanbanItem | null> => {
  const payload = (await response.json().catch(() => null)) as { item?: unknown } | null;
  return parseAdminKanbanItems(payload?.item ? [payload.item] : [])[0] ?? null;
};

/**
 * Renders the shared Ophestivus board with add, move, drag/drop, and archive controls.
 * Inputs: none.
 * Outputs: the Ophestivus board UI.
 * Side effects: reads and writes the admin kanban API through the active Supabase session.
 */
export function AdminKanbanBoardSection() {
  const [items, setItems] = useState<AdminKanbanItem[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActionLogOpen, setIsActionLogOpen] = useState(false);
  const [isActionLogLoading, setIsActionLogLoading] = useState(false);
  const [actionLogError, setActionLogError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<AdminKanbanActionLogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadItems = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchWithAuth("/api/admin/kanban/items", {
          method: "GET",
          shortpulseSkipErrorLogging: true,
        });
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Unable to load kanban items."));
        }
        const payload = (await response.json().catch(() => ({}))) as { items?: unknown };
        if (!cancelled) {
          setItems(parseAdminKanbanItems(payload.items));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load kanban items.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, []);

  const itemCountsByStatus = useMemo(
    () =>
      ADMIN_KANBAN_COLUMNS.reduce<Record<AdminKanbanStatus, number>>(
        (counts, column) => ({
          ...counts,
          [column.id]: items.filter((item) => item.status === column.id).length,
        }),
        {
          backlog: 0,
          in_progress: 0,
          complete: 0,
          published: 0,
        }
      ),
    [items]
  );
  const totalItemCount = items.length;
  const boardItemCountLabel = `${totalItemCount} active ${totalItemCount === 1 ? "item" : "items"}`;

  const replaceItem = (updatedItem: AdminKanbanItem) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  const loadActionLog = async () => {
    setIsActionLogLoading(true);
    setActionLogError(null);
    try {
      const response = await fetchWithAuth("/api/admin/kanban/activity", {
        method: "GET",
        shortpulseSkipErrorLogging: true,
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Unable to load Ophestivus action log."));
      }
      const payload = (await response.json().catch(() => ({}))) as { activity?: unknown };
      setActionLog(parseAdminKanbanActionLog(payload.activity));
    } catch (error) {
      setActionLogError(
        error instanceof Error ? error.message : "Unable to load Ophestivus action log."
      );
    } finally {
      setIsActionLogLoading(false);
    }
  };

  const openActionLog = async () => {
    setIsActionLogOpen(true);
    await loadActionLog();
  };

  const refreshActionLogIfOpen = () => {
    if (isActionLogOpen) void loadActionLog();
  };

  const moveItem = async (itemId: string, status: AdminKanbanStatus) => {
    setActionItemId(itemId);
    setErrorMessage(null);
    try {
      const response = await fetchWithAuth(`/api/admin/kanban/items/${itemId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Unable to move kanban item."));
      }
      const updatedItem = await readItemPayload(response);
      if (updatedItem) replaceItem(updatedItem);
      refreshActionLogIfOpen();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to move kanban item.");
    } finally {
      setActionItemId(null);
    }
  };

  const archiveItem = async (itemId: string) => {
    setActionItemId(itemId);
    setErrorMessage(null);
    try {
      const response = await fetchWithAuth(`/api/admin/kanban/items/${itemId}/archive`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Unable to archive kanban item."));
      }
      setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
      refreshActionLogIfOpen();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to archive kanban item.");
    } finally {
      setActionItemId(null);
    }
  };

  const handleAddItem = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;

    setIsCreating(true);
    setErrorMessage(null);
    try {
      const response = await fetchWithAuth("/api/admin/kanban/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: normalizedTitle,
          details: details.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Unable to add kanban item."));
      }
      const createdItem = await readItemPayload(response);
      if (createdItem) {
        setItems((currentItems) => [createdItem, ...currentItems]);
      }
      refreshActionLogIfOpen();
      setTitle("");
      setDetails("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add kanban item.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDrop = (status: AdminKanbanStatus) => {
    if (!draggedItemId) return;
    void moveItem(draggedItemId, status);
    setDraggedItemId(null);
  };

  return (
    <section className={styles.boardSection} aria-labelledby="admin-kanban-title">
      <div className={styles.boardHeader}>
        <div className={styles.boardTitleBlock}>
          <p className={styles.boardEyebrow}>Task board</p>
          <h2 id="admin-kanban-title" className={styles.boardTitle}>
            Ophestivus
          </h2>
          <p className={styles.boardDescription}>
            Track operator to-do items from backlog through published. This board is shared across
            admins and stores an activity trail for each task.
          </p>
        </div>
        <div className={styles.boardHeaderActions}>
          <button
            type="button"
            className={styles.logButton}
            onClick={() => void openActionLog()}
            aria-haspopup="dialog"
          >
            <ClockCounterClockwise size={16} weight="bold" />
            Action log
          </button>
          <span className={styles.boardMeta}>{boardItemCountLabel}</span>
        </div>
      </div>

      {errorMessage ? <div className={styles.emptyState}>{errorMessage}</div> : null}

      <div className={styles.addForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Task</span>
          <input
            className={styles.input}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a to-do item"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Notes</span>
          <input
            className={styles.input}
            type="text"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Owner, ticket, or release context"
          />
        </label>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => void handleAddItem()}
          disabled={!title.trim() || isCreating}
        >
          <Plus size={16} weight="bold" />
          {isCreating ? "Adding..." : "Add item"}
        </button>
      </div>

      <div className={styles.columns} aria-label="Admin task status columns">
        {ADMIN_KANBAN_COLUMNS.map((column, columnIndex) => {
          const columnItems = items.filter((item) => item.status === column.id);
          const previousColumn = ADMIN_KANBAN_COLUMNS[columnIndex - 1] ?? null;
          const nextColumn = ADMIN_KANBAN_COLUMNS[columnIndex + 1] ?? null;

          return (
            <section
              key={column.id}
              className={`${styles.column} ${draggedItemId ? styles.columnDragging : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(column.id)}
              aria-label={`${column.label} tasks`}
            >
              <div className={styles.columnHeader}>
                <div className={styles.columnTitleRow}>
                  <h3 className={styles.columnTitle}>{column.label}</h3>
                  <span className={styles.columnCount}>{itemCountsByStatus[column.id]}</span>
                </div>
                <p className={styles.columnHelper}>{column.helper}</p>
              </div>

              <div className={styles.itemList}>
                {isLoading ? (
                  <div className={styles.emptyState}>Loading tasks</div>
                ) : columnItems.length === 0 ? (
                  <div className={styles.emptyState}>Drop tasks here</div>
                ) : (
                  columnItems.map((item) => (
                    <article
                      key={item.id}
                      className={styles.itemCard}
                      draggable
                      onDragStart={() => setDraggedItemId(item.id)}
                      onDragEnd={() => setDraggedItemId(null)}
                    >
                      <div className={styles.itemTopRow}>
                        <span className={styles.dragHandle} aria-hidden="true">
                          <DotsSixVertical size={18} weight="bold" />
                        </span>
                        <div className={styles.itemContent}>
                          <h4 className={styles.itemTitle}>{item.title}</h4>
                          {item.details ? (
                            <p className={styles.itemDetails}>{item.details}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.deleteButton}`}
                          onClick={() => void archiveItem(item.id)}
                          disabled={actionItemId === item.id}
                          aria-label={`Archive ${item.title}`}
                          title={`Archive ${item.title}`}
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </div>

                      <div className={styles.itemActions}>
                        <span className={styles.itemMeta}>
                          Updated {formatItemDate(item.updatedAt)}
                        </span>
                        <div className={styles.moveActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => {
                              if (previousColumn) void moveItem(item.id, previousColumn.id);
                            }}
                            disabled={!previousColumn || actionItemId === item.id}
                            aria-label={`Move ${item.title} left`}
                            title={`Move ${item.title} left`}
                          >
                            <ArrowLeft size={15} weight="bold" />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => {
                              if (nextColumn) void moveItem(item.id, nextColumn.id);
                            }}
                            disabled={!nextColumn || actionItemId === item.id}
                            aria-label={`Move ${item.title} right`}
                            title={`Move ${item.title} right`}
                          >
                            <ArrowRight size={15} weight="bold" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {isActionLogOpen ? (
        <div className={styles.logOverlay} role="presentation">
          <div
            className={styles.logDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ophestivus-action-log-title"
          >
            <div className={styles.logHeader}>
              <div>
                <p className={styles.boardEyebrow}>Review trail</p>
                <h3 id="ophestivus-action-log-title" className={styles.logTitle}>
                  Ophestivus action log
                </h3>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setIsActionLogOpen(false)}
                aria-label="Close action log"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className={styles.logBody}>
              {isActionLogLoading ? (
                <div className={styles.emptyState}>Loading actions</div>
              ) : actionLogError ? (
                <div className={styles.emptyState}>{actionLogError}</div>
              ) : actionLog.length === 0 ? (
                <div className={styles.emptyState}>No actions recorded</div>
              ) : (
                <div className={styles.logList}>
                  {actionLog.map((entry) => {
                    const transitionLabel = formatTransitionLabel(entry);
                    return (
                      <article key={entry.id} className={styles.logEntry}>
                        <div className={styles.logEntryTop}>
                          <div className={styles.logEntryTitleBlock}>
                            <h4 className={styles.logEntryTitle}>{formatActionLabel(entry)}</h4>
                            <p className={styles.logEntryTask}>
                              {entry.itemTitle ?? entry.note ?? "Untitled task"}
                            </p>
                          </div>
                          <time className={styles.logEntryTime} dateTime={entry.createdAt}>
                            {formatActionDate(entry.createdAt)}
                          </time>
                        </div>
                        <div className={styles.logEntryMeta}>
                          <span>{entry.actorEmail ?? "Admin"}</span>
                          {transitionLabel ? <span>{transitionLabel}</span> : null}
                        </div>
                        {entry.note ? <p className={styles.logEntryNote}>{entry.note}</p> : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
