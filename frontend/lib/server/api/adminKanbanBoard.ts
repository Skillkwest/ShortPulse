/**
 * Server-side admin kanban board persistence.
 * Centralizes validation, row normalization, and activity logging for admin-only board APIs.
 */
import type { getSupabaseAdmin } from "./supabaseAdmin";

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

const nextSortOrder = async (supabaseAdmin: SupabaseAdminClient): Promise<number> => {
  const { data, error } = await supabaseAdmin
    .from("admin_kanban_items")
    .select("sort_order")
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message || "Failed to resolve next kanban sort order.");
  }

  const firstRow = Array.isArray(data) ? (data[0] as { sort_order?: unknown } | undefined) : null;
  const currentMax = typeof firstRow?.sort_order === "number" ? firstRow.sort_order : 0;
  return currentMax + 1;
};

const recordActivity = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    itemId: string;
    action: AdminKanbanActivity["action"];
    fromStatus?: AdminKanbanStatus | null;
    toStatus?: AdminKanbanStatus | null;
    note?: string | null;
    actorUserId: string | null;
    actorEmail: string | null;
  }
): Promise<void> => {
  const { error } = await supabaseAdmin.from("admin_kanban_activity").insert({
    item_id: args.itemId,
    action: args.action,
    from_status: args.fromStatus ?? null,
    to_status: args.toStatus ?? null,
    note: args.note ?? null,
    actor_user_id: args.actorUserId,
    actor_email: args.actorEmail,
  });

  if (error) {
    throw new Error(error.message || "Failed to record kanban activity.");
  }
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
 * Creates a new backlog kanban item and records the creation activity.
 */
export const createAdminKanbanItem = async (
  supabaseAdmin: SupabaseAdminClient,
  args: { title: string; details: string; actorUserId: string | null; actorEmail: string | null }
): Promise<AdminKanbanItem> => {
  const sortOrder = await nextSortOrder(supabaseAdmin);
  const { data, error } = await supabaseAdmin
    .from("admin_kanban_items")
    .insert({
      title: args.title,
      details: args.details,
      status: "backlog",
      sort_order: sortOrder,
      created_by: args.actorUserId,
      updated_by: args.actorUserId,
    })
    .select(
      "id, title, details, status, sort_order, created_at, updated_at, created_by, updated_by"
    )
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create admin kanban item.");
  }

  const item = toItem(data);
  if (!item) {
    throw new Error("Created admin kanban item payload is invalid.");
  }

  await recordActivity(supabaseAdmin, {
    itemId: item.id,
    action: "created",
    toStatus: item.status,
    note: item.title,
    actorUserId: args.actorUserId,
    actorEmail: args.actorEmail,
  });
  return item;
};

/**
 * Reads one active kanban item.
 */
export const readAdminKanbanItem = async (
  supabaseAdmin: SupabaseAdminClient,
  itemId: string
): Promise<AdminKanbanItem | null> => {
  const { data, error } = await supabaseAdmin
    .from("admin_kanban_items")
    .select(
      "id, title, details, status, sort_order, created_at, updated_at, created_by, updated_by"
    )
    .eq("id", itemId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load admin kanban item.");
  }
  return toItem(data);
};

/**
 * Updates task text fields for one active kanban item.
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
  const { data, error } = await supabaseAdmin
    .from("admin_kanban_items")
    .update({
      title: args.title,
      details: args.details,
      updated_by: args.actorUserId,
    })
    .eq("id", args.itemId)
    .is("archived_at", null)
    .select(
      "id, title, details, status, sort_order, created_at, updated_at, created_by, updated_by"
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to update admin kanban item.");
  }

  const item = toItem(data);
  if (item) {
    await recordActivity(supabaseAdmin, {
      itemId: item.id,
      action: "updated",
      toStatus: item.status,
      note: item.title,
      actorUserId: args.actorUserId,
      actorEmail: args.actorEmail,
    });
  }
  return item;
};

/**
 * Moves one active kanban item between workflow statuses.
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
  const currentItem = await readAdminKanbanItem(supabaseAdmin, args.itemId);
  if (!currentItem) return null;

  if (currentItem.status === args.status) {
    return currentItem;
  }

  const { data, error } = await supabaseAdmin
    .from("admin_kanban_items")
    .update({
      status: args.status,
      updated_by: args.actorUserId,
    })
    .eq("id", args.itemId)
    .is("archived_at", null)
    .select(
      "id, title, details, status, sort_order, created_at, updated_at, created_by, updated_by"
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to move admin kanban item.");
  }

  const item = toItem(data);
  if (item) {
    await recordActivity(supabaseAdmin, {
      itemId: item.id,
      action: "moved",
      fromStatus: currentItem.status,
      toStatus: item.status,
      actorUserId: args.actorUserId,
      actorEmail: args.actorEmail,
    });
  }
  return item;
};

/**
 * Archives one active kanban item instead of deleting its audit history.
 */
export const archiveAdminKanbanItem = async (
  supabaseAdmin: SupabaseAdminClient,
  args: { itemId: string; actorUserId: string | null; actorEmail: string | null }
): Promise<boolean> => {
  const currentItem = await readAdminKanbanItem(supabaseAdmin, args.itemId);
  if (!currentItem) return false;

  const { error } = await supabaseAdmin
    .from("admin_kanban_items")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: args.actorUserId,
      updated_by: args.actorUserId,
    })
    .eq("id", args.itemId)
    .is("archived_at", null);

  if (error) {
    throw new Error(error.message || "Failed to archive admin kanban item.");
  }

  await recordActivity(supabaseAdmin, {
    itemId: args.itemId,
    action: "archived",
    fromStatus: currentItem.status,
    note: currentItem.title,
    actorUserId: args.actorUserId,
    actorEmail: args.actorEmail,
  });
  return true;
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
