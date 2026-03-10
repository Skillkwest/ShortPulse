/**
 * Server helpers for dashboard announcement persistence.
 * Provides input normalization plus active/read/publish/clear operations.
 */
import type { getSupabaseAdmin } from "./supabaseAdmin";

export const DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH = 120;
export const DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH = 500;

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type RawAnnouncement = {
  id?: unknown;
  title?: unknown;
  message?: unknown;
  published_at?: unknown;
  updated_at?: unknown;
};

export type DashboardAnnouncement = {
  id: string;
  title: string;
  message: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

export type DashboardAnnouncementInputValidation = {
  title: string;
  message: string;
  error: string | null;
};

const asNonEmptyTrimmed = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const toAnnouncement = (value: unknown): DashboardAnnouncement | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as RawAnnouncement;
  const id = typeof row.id === "string" ? row.id : "";
  const title = asNonEmptyTrimmed(row.title);
  const message = asNonEmptyTrimmed(row.message);
  if (!id || !title || !message) return null;
  return {
    id,
    title,
    message,
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
};

/**
 * Validates announcement payload fields and returns normalized values.
 */
export const normalizeDashboardAnnouncementInput = (
  titleRaw: unknown,
  messageRaw: unknown
): DashboardAnnouncementInputValidation => {
  const title = asNonEmptyTrimmed(titleRaw);
  const message = asNonEmptyTrimmed(messageRaw);

  if (!title) {
    return { title, message, error: "Title is required." };
  }
  if (!message) {
    return { title, message, error: "Message is required." };
  }
  if (title.length > DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH) {
    return {
      title,
      message,
      error: `Title must be ${DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (message.length > DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH) {
    return {
      title,
      message,
      error: `Message must be ${DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { title, message, error: null };
};

/**
 * Reads the currently active dashboard announcement, if one exists.
 */
export const readActiveDashboardAnnouncement = async (
  supabaseAdmin: SupabaseAdminClient
): Promise<DashboardAnnouncement | null> => {
  const { data, error } = await supabaseAdmin
    .from("dashboard_announcements")
    .select("id, title, message, published_at, updated_at")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load active dashboard announcement.");
  }

  return toAnnouncement(data);
};

/**
 * Publishes a new active announcement and deactivates any previously active record.
 */
export const publishDashboardAnnouncement = async (
  supabaseAdmin: SupabaseAdminClient,
  args: { title: string; message: string; actorUserId: string | null }
): Promise<DashboardAnnouncement> => {
  const { data, error } = await supabaseAdmin.rpc("publish_dashboard_announcement", {
    p_title: args.title,
    p_message: args.message,
    p_actor_user_id: args.actorUserId,
  });

  if (error) {
    throw new Error(error.message || "Failed to publish dashboard announcement.");
  }

  const row = Array.isArray(data) ? toAnnouncement(data[0]) : toAnnouncement(data);
  if (!row) {
    throw new Error("Published dashboard announcement payload is invalid.");
  }
  return row;
};

/**
 * Clears any active dashboard announcement.
 */
export const clearActiveDashboardAnnouncement = async (
  supabaseAdmin: SupabaseAdminClient,
  actorUserId: string | null
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("dashboard_announcements")
    .update({
      is_active: false,
      updated_by: actorUserId,
    })
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message || "Failed to clear active dashboard announcement.");
  }
};
