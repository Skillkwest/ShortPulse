/**
 * Admin kanban board constants and client payload helpers.
 * Keeps the operator task board status model centralized for UI and tests.
 */

export type AdminKanbanStatus = "backlog" | "in_progress" | "complete" | "published";

export type AdminKanbanItem = {
  id: string;
  title: string;
  details: string;
  status: AdminKanbanStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type AdminKanbanColumn = {
  id: AdminKanbanStatus;
  label: string;
  helper: string;
};

export const ADMIN_KANBAN_COLUMNS: AdminKanbanColumn[] = [
  {
    id: "backlog",
    label: "Backlog",
    helper: "Captured, not started",
  },
  {
    id: "in_progress",
    label: "In progress",
    helper: "Actively being handled",
  },
  {
    id: "complete",
    label: "Complete",
    helper: "Finished, waiting review",
  },
  {
    id: "published",
    label: "Published",
    helper: "Released or announced",
  },
];

/**
 * Parses admin board API payloads and drops malformed records.
 * Inputs: raw API payload.
 * Outputs: normalized kanban item list.
 * Side effects: none.
 */
export function parseAdminKanbanItems(value: unknown): AdminKanbanItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isAdminKanbanItem);
}

function isAdminKanbanItem(value: unknown): value is AdminKanbanItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AdminKanbanItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.details === "string" &&
    typeof item.sortOrder === "number" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    (typeof item.createdBy === "string" || item.createdBy === null) &&
    (typeof item.updatedBy === "string" || item.updatedBy === null) &&
    ADMIN_KANBAN_COLUMNS.some((column) => column.id === item.status)
  );
}
