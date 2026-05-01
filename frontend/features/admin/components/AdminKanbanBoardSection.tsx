/**
 * Ophestivus board section.
 * Provides the shared operator task board on the admin Ophestivus page.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, DotsSixVertical, Plus, Trash } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  ADMIN_KANBAN_COLUMNS,
  type AdminKanbanItem,
  type AdminKanbanStatus,
  parseAdminKanbanItems,
} from "../data/adminKanbanBoard";
import styles from "../../../styles/adminKanban.module.css";

const formatItemDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

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
        <span className={styles.boardMeta}>{boardItemCountLabel}</span>
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
    </section>
  );
}
