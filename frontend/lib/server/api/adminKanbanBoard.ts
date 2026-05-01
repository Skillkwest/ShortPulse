/**
 * Server-side admin kanban board persistence.
 * Centralizes validation, row normalization, and activity logging for admin-only board APIs.
 */
import type { getSupabaseAdmin } from "./supabaseAdmin";

export type AdminKanbanStatus = "backlog" | "in_progress" | "review" | "complete" | "published";

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

export type AdminKanbanActivity = {
  id: string;
  itemId: string;
  action: "created" | "updated" | "moved" | "archived";
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

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type RawAdminKanbanItem = {
  id?: unknown;
  title?: unknown;
  details?: unknown;
  status?: unknown;
  sort_order?: unknown;
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

const ADMIN_KANBAN_ACTIVITY_ACTIONS = ["created", "updated", "moved", "archived"] as const;

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export const isAdminKanbanStatus = (value: unknown): value is AdminKanbanStatus =>
  typeof value === "string" && ADMIN_KANBAN_STATUSES.includes(value as AdminKanbanStatus);

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
    .select(
      "id, title, details, status, sort_order, created_at, updated_at, created_by, updated_by"
    )
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
  args: { title: string; details: string; actorUserId: string | null; actorEmail: string | null }
): Promise<AdminKanbanItem> => {
  const item = await callKanbanMutationRpc(
    supabaseAdmin,
    "create_admin_kanban_item",
    {
      p_title: args.title,
      p_details: args.details,
      p_actor_user_id: args.actorUserId,
      p_actor_email: args.actorEmail,
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
    .select(
      "id, title, details, status, sort_order, created_at, updated_at, created_by, updated_by"
    )
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
