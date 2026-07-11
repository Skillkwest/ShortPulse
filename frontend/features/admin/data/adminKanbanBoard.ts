/**
 * Admin kanban board constants and client payload helpers.
 * Keeps the operator task board status model centralized for UI and tests.
 */

export type AdminKanbanStatus = "backlog" | "in_progress" | "review" | "complete" | "published";
export type AdminKanbanSourceType = "manual" | "admin_error" | "planning_backlog";

export type AdminKanbanItem = {
  id: string;
  title: string;
  details: string;
  status: AdminKanbanStatus;
  sortOrder: number;
  sourceType: AdminKanbanSourceType;
  sourceKey: string | null;
  sourcePath: string | null;
  sourceSection: string | null;
  sourceLine: number | null;
  sourceFingerprint: string | null;
  sourceSyncedAt: string | null;
  sourceMissingAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type AdminKanbanActivityAction = "created" | "updated" | "moved" | "archived" | "synced";

export type AdminKanbanActionLogEntry = {
  id: string;
  itemId: string;
  itemTitle: string | null;
  action: AdminKanbanActivityAction;
  fromStatus: AdminKanbanStatus | null;
  toStatus: AdminKanbanStatus | null;
  note: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type AdminKanbanColumn = {
  id: "planning_backlog" | "board_backlog" | AdminKanbanStatus;
  status: AdminKanbanStatus;
  label: string;
  helper: string;
  sourceType?: AdminKanbanSourceType;
  excludeSourceType?: AdminKanbanSourceType;
};

const ADMIN_KANBAN_SOURCE_TYPES: AdminKanbanSourceType[] = [
  "manual",
  "admin_error",
  "planning_backlog",
];

export const ADMIN_KANBAN_COLUMNS: AdminKanbanColumn[] = [
  {
    id: "planning_backlog",
    status: "backlog",
    label: "Backlog Document",
    helper: "Mirrored from docs/planning/backlog.md",
    sourceType: "planning_backlog",
  },
  {
    id: "board_backlog",
    status: "backlog",
    label: "Board Backlog",
    helper: "Manual or operational backlog",
    excludeSourceType: "planning_backlog",
  },
  {
    id: "in_progress",
    status: "in_progress",
    label: "In progress",
    helper: "Actively being handled",
  },
  {
    id: "review",
    status: "review",
    label: "Review",
    helper: "Ready for operator review",
  },
  {
    id: "complete",
    status: "complete",
    label: "Complete",
    helper: "Finished and approved",
  },
  {
    id: "published",
    status: "published",
    label: "Published",
    helper: "Released or announced",
  },
];

export const ADMIN_KANBAN_STATUS_LABELS: Record<AdminKanbanStatus, string> = {
  backlog: "Backlog",
  in_progress: "In progress",
  review: "Review",
  complete: "Complete",
  published: "Published",
};

export const ADMIN_KANBAN_STATUS_ORDER: AdminKanbanStatus[] = [
  "backlog",
  "in_progress",
  "review",
  "complete",
  "published",
];

/**
 * Parses admin board API payloads and drops malformed records.
 * Inputs: raw API payload.
 * Outputs: normalized kanban item list.
 * Side effects: none.
 */
export function parseAdminKanbanItems(value: unknown): AdminKanbanItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isAdminKanbanItem).map(normalizeAdminKanbanItem);
}

/**
 * Parses admin board action-log payloads and drops malformed records.
 * Inputs: raw API payload.
 * Outputs: normalized action-log entries.
 * Side effects: none.
 */
export function parseAdminKanbanActionLog(value: unknown): AdminKanbanActionLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isAdminKanbanActionLogEntry);
}

function isAdminKanbanItem(value: unknown): value is AdminKanbanItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AdminKanbanItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.details === "string" &&
    typeof item.sortOrder === "number" &&
    (ADMIN_KANBAN_SOURCE_TYPES.some((sourceType) => sourceType === item.sourceType) ||
      item.sourceType === undefined) &&
    (typeof item.sourceKey === "string" ||
      item.sourceKey === null ||
      item.sourceKey === undefined) &&
    (typeof item.sourcePath === "string" ||
      item.sourcePath === null ||
      item.sourcePath === undefined) &&
    (typeof item.sourceSection === "string" ||
      item.sourceSection === null ||
      item.sourceSection === undefined) &&
    (typeof item.sourceLine === "number" ||
      item.sourceLine === null ||
      item.sourceLine === undefined) &&
    (typeof item.sourceFingerprint === "string" ||
      item.sourceFingerprint === null ||
      item.sourceFingerprint === undefined) &&
    (typeof item.sourceSyncedAt === "string" ||
      item.sourceSyncedAt === null ||
      item.sourceSyncedAt === undefined) &&
    (typeof item.sourceMissingAt === "string" ||
      item.sourceMissingAt === null ||
      item.sourceMissingAt === undefined) &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    (typeof item.createdBy === "string" || item.createdBy === null) &&
    (typeof item.updatedBy === "string" || item.updatedBy === null) &&
    ADMIN_KANBAN_STATUS_ORDER.some((status) => status === item.status)
  );
}

function normalizeAdminKanbanItem(item: AdminKanbanItem): AdminKanbanItem {
  return {
    ...item,
    sourceType: item.sourceType ?? "manual",
    sourceKey: item.sourceKey ?? null,
    sourcePath: item.sourcePath ?? null,
    sourceSection: item.sourceSection ?? null,
    sourceLine: item.sourceLine ?? null,
    sourceFingerprint: item.sourceFingerprint ?? null,
    sourceSyncedAt: item.sourceSyncedAt ?? null,
    sourceMissingAt: item.sourceMissingAt ?? null,
  };
}

function isAdminKanbanActionLogEntry(value: unknown): value is AdminKanbanActionLogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<AdminKanbanActionLogEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.itemId === "string" &&
    (typeof entry.itemTitle === "string" || entry.itemTitle === null) &&
    (entry.action === "created" ||
      entry.action === "updated" ||
      entry.action === "moved" ||
      entry.action === "archived" ||
      entry.action === "synced") &&
    (ADMIN_KANBAN_STATUS_ORDER.some((status) => status === entry.fromStatus) ||
      entry.fromStatus === null) &&
    (ADMIN_KANBAN_STATUS_ORDER.some((status) => status === entry.toStatus) ||
      entry.toStatus === null) &&
    (typeof entry.note === "string" || entry.note === null) &&
    (typeof entry.actorUserId === "string" || entry.actorUserId === null) &&
    (typeof entry.actorEmail === "string" || entry.actorEmail === null) &&
    typeof entry.createdAt === "string"
  );
}
