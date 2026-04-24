/**
 * Projects persistence helpers.
 * Owns server-authoritative create/read access for user-owned project rows.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";

const DEFAULT_PROJECT_TITLE = "Untitled project";
const PROJECT_TITLE_MAX_LENGTH = 120;
const DEFAULT_PROJECT_LIST_LIMIT = 6;
const MAX_PROJECT_LIST_LIMIT = 24;
const PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_SELECT_COLUMNS = "id, user_id, title, created_at, updated_at" as const;

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ProjectRecord = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

const toProjectRecord = (row: ProjectRow): ProjectRecord => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const sanitizeProjectTitle = (value: unknown): string => {
  if (typeof value !== "string") return DEFAULT_PROJECT_TITLE;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return DEFAULT_PROJECT_TITLE;
  return normalized.slice(0, PROJECT_TITLE_MAX_LENGTH);
};

export const parseProjectId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!PROJECT_ID_PATTERN.test(normalized)) return null;
  return normalized;
};

export const parseProjectListLimit = (value: unknown): number | null => {
  if (value == null || value === "") return DEFAULT_PROJECT_LIST_LIMIT;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > MAX_PROJECT_LIST_LIMIT) return null;
  return parsed;
};

export const createProjectForUser = async ({
  userId,
  title,
}: {
  userId: string;
  title?: unknown;
}): Promise<ProjectRecord> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: userId,
      title: sanitizeProjectTitle(title),
    })
    .select(PROJECT_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to create project");
  }
  if (!data) {
    throw new Error("Failed to create project");
  }
  return toProjectRecord(data as ProjectRow);
};

export const getProjectForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<ProjectRecord | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select(PROJECT_SELECT_COLUMNS)
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load project");
  }
  if (!data) return null;
  return toProjectRecord(data as ProjectRow);
};

export const listProjectsForUser = async ({
  userId,
  limit = DEFAULT_PROJECT_LIST_LIMIT,
}: {
  userId: string;
  limit?: number;
}): Promise<ProjectRecord[]> => {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), MAX_PROJECT_LIST_LIMIT));
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select(PROJECT_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(error.message || "Failed to list projects");
  }

  return (data ?? []).map((row) => toProjectRecord(row as ProjectRow));
};

export const updateProjectTitleForUser = async ({
  userId,
  projectId,
  title,
}: {
  userId: string;
  projectId: string;
  title?: unknown;
}): Promise<ProjectRecord | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({
      title: sanitizeProjectTitle(title),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select(PROJECT_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to update project");
  }
  if (!data) return null;
  return toProjectRecord(data as ProjectRow);
};
