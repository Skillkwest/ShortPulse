/**
 * Server-side admin kanban board persistence.
 * Centralizes validation, row normalization, and activity logging for admin-only board APIs.
 */
import type { getSupabaseAdmin } from "./supabaseAdmin";

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

export type AdminKanbanActivity = {
  id: string;
  itemId: string;
  action: "created" | "updated" | "moved" | "archived" | "synced";
  fromStatus: AdminKanbanStatus | null;
  toStatus: AdminKanbanStatus | null;
  note: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type AdminKanbanActionLogEntry = AdminKanbanActivity & {
  itemTitle: string | null;
};

export type AdminKanbanItemInputValidation = {
  title: string;
  details: string;
  error: string | null;
};

export type AdminKanbanPlanningBacklogSyncItem = {
  sourceKey: string;
  title: string;
  details: string;
  sourcePath: string;
  sourceSection: string;
  sourceLine: number;
  sourceFingerprint: string;
};

export type AdminKanbanPlanningBacklogSyncSummary = {
  dryRun: boolean;
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  skippedArchived: number;
  markedMissing: number;
};

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type RawAdminKanbanItem = {
  id?: unknown;
  title?: unknown;
  details?: unknown;
  status?: unknown;
  sort_order?: unknown;
  source_type?: unknown;
  source_key?: unknown;
  source_path?: unknown;
  source_section?: unknown;
  source_line?: unknown;
  source_fingerprint?: unknown;
  source_synced_at?: unknown;
  source_missing_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  created_by?: unknown;
  updated_by?: unknown;
};

type RawAdminKanbanActivity = {
  id?: unknown;
  item_id?: unknown;
  action?: unknown;
  from_status?: unknown;
  to_status?: unknown;
  note?: unknown;
  actor_user_id?: unknown;
  actor_email?: unknown;
  created_at?: unknown;
};

export const ADMIN_KANBAN_TITLE_MAX_LENGTH = 140;
export const ADMIN_KANBAN_DETAILS_MAX_LENGTH = 1000;

const ADMIN_KANBAN_STATUSES: AdminKanbanStatus[] = [
  "backlog",
  "in_progress",
  "review",
  "complete",
  "published",
];

const ADMIN_KANBAN_SOURCE_TYPES: AdminKanbanSourceType[] = [
  "manual",
  "admin_error",
  "planning_backlog",
];

const ADMIN_KANBAN_ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "moved",
  "archived",
  "synced",
] as const;

const ADMIN_KANBAN_ITEM_SELECT =
  "id, title, details, status, sort_order, source_type, source_key, source_path, source_section, source_line, source_fingerprint, source_synced_at, source_missing_at, created_at, updated_at, created_by, updated_by";

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export const isAdminKanbanStatus = (value: unknown): value is AdminKanbanStatus =>
  typeof value === "string" && ADMIN_KANBAN_STATUSES.includes(value as AdminKanbanStatus);

const isAdminKanbanSourceType = (value: unknown): value is AdminKanbanSourceType =>
  typeof value === "string" && ADMIN_KANBAN_SOURCE_TYPES.includes(value as AdminKanbanSourceType);

const toNullableString = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;

const toItem = (value: unknown): AdminKanbanItem | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as RawAdminKanbanItem;
  const id = toNullableString(row.id);
  const title = asTrimmedString(row.title);
  const status = isAdminKanbanStatus(row.status) ? row.status : null;
  const createdAt = toNullableString(row.created_at);
  const updatedAt = toNullableString(row.updated_at);
  if (!id || !title || !status || !createdAt || !updatedAt) return null;

  return {
    id,
    title,
    details: typeof row.details === "string" ? row.details : "",
    status,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    sourceType: isAdminKanbanSourceType(row.source_type) ? row.source_type : "manual",
    sourceKey: toNullableString(row.source_key),
    sourcePath: toNullableString(row.source_path),
    sourceSection: toNullableString(row.source_section),
    sourceLine: typeof row.source_line === "number" ? row.source_line : null,
    sourceFingerprint: toNullableString(row.source_fingerprint),
    sourceSyncedAt: toNullableString(row.source_synced_at),
    sourceMissingAt: toNullableString(row.source_missing_at),
    createdAt,
    updatedAt,
    createdBy: toNullableString(row.created_by),
    updatedBy: toNullableString(row.updated_by),
  };
};

const toActivity = (value: unknown): AdminKanbanActivity | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as RawAdminKanbanActivity;
  const id = toNullableString(row.id);
  const itemId = toNullableString(row.item_id);
  const action =
    typeof row.action === "string" &&
    ADMIN_KANBAN_ACTIVITY_ACTIONS.includes(row.action as AdminKanbanActivity["action"])
      ? (row.action as AdminKanbanActivity["action"])
      : null;
  const createdAt = toNullableString(row.created_at);
  if (!id || !itemId || !action || !createdAt) return null;

  return {
    id,
    itemId,
    action,
    fromStatus: isAdminKanbanStatus(row.from_status) ? row.from_status : null,
    toStatus: isAdminKanbanStatus(row.to_status) ? row.to_status : null,
    note: typeof row.note === "string" && row.note ? row.note : null,
    actorUserId: toNullableString(row.actor_user_id),
    actorEmail: toNullableString(row.actor_email),
    createdAt,
  };
};

const callKanbanMutationRpc = async (
  supabaseAdmin: SupabaseAdminClient,
  rpcName: string,
  args: Record<string, unknown>,
  fallbackError: string
): Promise<AdminKanbanItem | null> => {
  const { data, error } = await supabaseAdmin.rpc(rpcName, args);

  if (error) {
    throw new Error(error.message || fallbackError);
  }

  return toItem(data);
};

/**
 * Validates user-entered kanban task fields.
 */
export const normalizeAdminKanbanItemInput = (
  titleRaw: unknown,
  detailsRaw: unknown
): AdminKanbanItemInputValidation => {
  const title = asTrimmedString(titleRaw);
  const details = asTrimmedString(detailsRaw);

  if (!title) {
    return { title, details, error: "Task title is required." };
  }
  if (title.length > ADMIN_KANBAN_TITLE_MAX_LENGTH) {
    return {
      title,
      details,
      error: `Task title must be ${ADMIN_KANBAN_TITLE_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (details.length > ADMIN_KANBAN_DETAILS_MAX_LENGTH) {
    return {
      title,
      details,
      error: `Task notes must be ${ADMIN_KANBAN_DETAILS_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { title, details, error: null };
};

/**
 * Lists active shared admin kanban items.
 */
export const listAdminKanbanItems = async (
  supabaseAdmin: SupabaseAdminClient
): Promise<AdminKanbanItem[]> => {
  const { data, error } = await supabaseAdmin
    .from("admin_kanban_items")
    .select(ADMIN_KANBAN_ITEM_SELECT)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load admin kanban items.");
  }

  return (Array.isArray(data) ? data : [])
    .map(toItem)
    .filter((item): item is AdminKanbanItem => Boolean(item));
};

/**
 * Creates a new backlog kanban item through the atomic item/activity RPC.
 */
export const createAdminKanbanItem = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    title: string;
    details: string;
    actorUserId: string | null;
    actorEmail: string | null;
    sourceType?: AdminKanbanSourceType;
    sourceKey?: string | null;
    sourcePath?: string | null;
    sourceSection?: string | null;
    sourceLine?: number | null;
    sourceFingerprint?: string | null;
  }
): Promise<AdminKanbanItem> => {
  const item = await callKanbanMutationRpc(
    supabaseAdmin,
    "create_admin_kanban_item",
    {
      p_title: args.title,
      p_details: args.details,
      p_actor_user_id: args.actorUserId,
      p_actor_email: args.actorEmail,
      p_source_type: args.sourceType ?? "manual",
      p_source_key: args.sourceKey ?? null,
      p_source_path: args.sourcePath ?? null,
      p_source_section: args.sourceSection ?? null,
      p_source_line: args.sourceLine ?? null,
      p_source_fingerprint: args.sourceFingerprint ?? null,
    },
    "Failed to create admin kanban item."
  );
  if (!item) {
    throw new Error("Created admin kanban item payload is invalid.");
  }

  return item;
};

/**
 * Reads one kanban item. Archived rows are excluded unless explicitly requested.
 */
export const readAdminKanbanItem = async (
  supabaseAdmin: SupabaseAdminClient,
  itemId: string,
  options: { includeArchived?: boolean } = {}
): Promise<AdminKanbanItem | null> => {
  let query = supabaseAdmin
    .from("admin_kanban_items")
    .select(ADMIN_KANBAN_ITEM_SELECT)
    .eq("id", itemId);

  if (!options.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load admin kanban item.");
  }
  return toItem(data);
};

/**
 * Updates task text fields through the atomic item/activity RPC.
 */
export const updateAdminKanbanItem = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    itemId: string;
    title: string;
    details: string;
    actorUserId: string | null;
    actorEmail: string | null;
  }
): Promise<AdminKanbanItem | null> => {
  return callKanbanMutationRpc(
    supabaseAdmin,
    "update_admin_kanban_item",
    {
      p_item_id: args.itemId,
      p_title: args.title,
      p_details: args.details,
      p_actor_user_id: args.actorUserId,
      p_actor_email: args.actorEmail,
    },
    "Failed to update admin kanban item."
  );
};

/**
 * Moves one active kanban item through the atomic item/activity RPC.
 */
export const moveAdminKanbanItem = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    itemId: string;
    status: AdminKanbanStatus;
    actorUserId: string | null;
    actorEmail: string | null;
  }
): Promise<AdminKanbanItem | null> => {
  return callKanbanMutationRpc(
    supabaseAdmin,
    "move_admin_kanban_item",
    {
      p_item_id: args.itemId,
      p_status: args.status,
      p_actor_user_id: args.actorUserId,
      p_actor_email: args.actorEmail,
    },
    "Failed to move admin kanban item."
  );
};

/**
 * Archives one active kanban item through the atomic item/activity RPC.
 */
export const archiveAdminKanbanItem = async (
  supabaseAdmin: SupabaseAdminClient,
  args: { itemId: string; actorUserId: string | null; actorEmail: string | null }
): Promise<boolean> => {
  const item = await callKanbanMutationRpc(
    supabaseAdmin,
    "archive_admin_kanban_item",
    {
      p_item_id: args.itemId,
      p_actor_user_id: args.actorUserId,
      p_actor_email: args.actorEmail,
    },
    "Failed to archive admin kanban item."
  );
  return Boolean(item);
};

const toSyncSummary = (value: unknown): AdminKanbanPlanningBacklogSyncSummary => {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    dryRun: row.dryRun === true,
    received: typeof row.received === "number" ? row.received : 0,
    created: typeof row.created === "number" ? row.created : 0,
    updated: typeof row.updated === "number" ? row.updated : 0,
    unchanged: typeof row.unchanged === "number" ? row.unchanged : 0,
    skippedArchived: typeof row.skippedArchived === "number" ? row.skippedArchived : 0,
    markedMissing: typeof row.markedMissing === "number" ? row.markedMissing : 0,
  };
};

/**
 * Syncs planning backlog items through the atomic service-role sync RPC.
 */
export const syncAdminKanbanPlanningBacklogItems = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    items: AdminKanbanPlanningBacklogSyncItem[];
    actorUserId: string | null;
    actorEmail: string | null;
    dryRun?: boolean;
  }
): Promise<AdminKanbanPlanningBacklogSyncSummary> => {
  const { data, error } = await supabaseAdmin.rpc("sync_admin_kanban_planning_backlog_items", {
    p_items: args.items,
    p_actor_user_id: args.actorUserId,
    p_actor_email: args.actorEmail,
    p_dry_run: args.dryRun ?? true,
  });

  if (error) {
    throw new Error(error.message || "Failed to sync planning backlog items.");
  }

  return toSyncSummary(data);
};

/**
 * Lists activity for one kanban item.
 */
export const listAdminKanbanActivity = async (
  supabaseAdmin: SupabaseAdminClient,
  itemId: string
): Promise<AdminKanbanActivity[]> => {
  const { data, error } = await supabaseAdmin
    .from("admin_kanban_activity")
    .select(
      "id, item_id, action, from_status, to_status, note, actor_user_id, actor_email, created_at"
    )
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load admin kanban activity.");
  }

  return (Array.isArray(data) ? data : [])
    .map(toActivity)
    .filter((activity): activity is AdminKanbanActivity => Boolean(activity));
};

/**
 * Lists recent activity across the shared board for admin review.
 */
export const listAdminKanbanActionLog = async (
  supabaseAdmin: SupabaseAdminClient,
  limit = 100
): Promise<AdminKanbanActionLogEntry[]> => {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const { data, error } = await supabaseAdmin
    .from("admin_kanban_activity")
    .select(
      "id, item_id, action, from_status, to_status, note, actor_user_id, actor_email, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(boundedLimit);

  if (error) {
    throw new Error(error.message || "Failed to load admin kanban action log.");
  }

  const activity = (Array.isArray(data) ? data : [])
    .map(toActivity)
    .filter((entry): entry is AdminKanbanActivity => Boolean(entry));
  const itemIds = [...new Set(activity.map((entry) => entry.itemId))];
  if (itemIds.length === 0) return [];

  const { data: itemRows, error: itemError } = await supabaseAdmin
    .from("admin_kanban_items")
    .select("id, title")
    .in("id", itemIds);

  if (itemError) {
    throw new Error(itemError.message || "Failed to load admin kanban action log item titles.");
  }

  const titleByItemId = new Map<string, string>();
  for (const row of Array.isArray(itemRows) ? itemRows : []) {
    if (!row || typeof row !== "object") continue;
    const item = row as { id?: unknown; title?: unknown };
    if (typeof item.id === "string" && typeof item.title === "string") {
      titleByItemId.set(item.id, item.title);
    }
  }

  return activity.map((entry) => ({
    ...entry,
    itemTitle: titleByItemId.get(entry.itemId) ?? null,
  }));
};
