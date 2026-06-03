/**
 * Projects persistence helpers.
 * Owns server-authoritative create/read access for user-owned project rows.
 */
import { filterTrustedMediaDirectPreviewUrls } from "../mediaPreviewTrustPolicy";
import { isUserScopedMediaStoragePath } from "../mediaStoragePath";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

const DEFAULT_PROJECT_TITLE = "Untitled project";
const PROJECT_TITLE_MAX_LENGTH = 120;
const DEFAULT_PROJECT_LIST_LIMIT = 6;
const MAX_PROJECT_LIST_LIMIT = 24;
const PROJECT_LIST_ALL = "all";
const MEDIA_BUCKET = "media_library";
const PROJECT_PREVIEW_SIGNED_URL_TTL_SECONDS = 3600;
const PROJECT_PREVIEW_IMAGE_LIMIT = 4;
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

type ProjectWorkspacePreviewRow = {
  project_id: string;
  snapshot: Record<string, unknown> | null;
};

type ProjectOutputDisplayPreviewRow = {
  project_id: string;
  output_id: string;
  mode?: string | null;
  task_state?: string | null;
  preview_url_fallback?: string | null;
  result_urls_fallback?: unknown;
  preview_storage_path?: string | null;
  full_storage_path?: string | null;
  hidden_in_reference_grid?: boolean | null;
};

type SnapshotOutputPreviewRecord = {
  id: string;
  mode?: string;
  taskState?: string;
  previewUrl?: string;
  resultUrls?: string[];
  previewStoragePath?: string;
  fullStoragePath?: string;
  hiddenInReferenceGrid?: boolean;
};

type ProjectPreviewCandidate = {
  storagePaths: string[];
  fallbackUrl: string | null;
};

export type ProjectRecord = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  previewImageUrls?: string[];
};

export type ProjectListLimit = number | typeof PROJECT_LIST_ALL;

const toProjectRecord = (row: ProjectRow): ProjectRecord => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : [];

const toDisplayOutputPreviewRecord = (
  value: ProjectOutputDisplayPreviewRow
): SnapshotOutputPreviewRecord | null => {
  const id = typeof value.output_id === "string" ? value.output_id.trim() : "";
  if (!id) return null;

  return {
    id,
    mode: typeof value.mode === "string" ? value.mode.trim() : undefined,
    taskState: typeof value.task_state === "string" ? value.task_state.trim() : undefined,
    previewUrl:
      typeof value.preview_url_fallback === "string"
        ? value.preview_url_fallback.trim()
        : undefined,
    resultUrls: asStringArray(value.result_urls_fallback),
    previewStoragePath:
      typeof value.preview_storage_path === "string"
        ? value.preview_storage_path.trim()
        : undefined,
    fullStoragePath:
      typeof value.full_storage_path === "string" ? value.full_storage_path.trim() : undefined,
    hiddenInReferenceGrid: value.hidden_in_reference_grid === true,
  };
};

const toSnapshotOutputPreviewRecord = (value: unknown): SnapshotOutputPreviewRecord | null => {
  const record = asRecord(value);
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;

  return {
    id,
    mode: typeof record.mode === "string" ? record.mode.trim() : undefined,
    taskState: typeof record.taskState === "string" ? record.taskState.trim() : undefined,
    previewUrl: typeof record.previewUrl === "string" ? record.previewUrl.trim() : undefined,
    resultUrls: asStringArray(record.resultUrls),
    previewStoragePath:
      typeof record.previewStoragePath === "string" ? record.previewStoragePath.trim() : undefined,
    fullStoragePath:
      typeof record.fullStoragePath === "string" ? record.fullStoragePath.trim() : undefined,
    hiddenInReferenceGrid: record.hiddenInReferenceGrid === true,
  };
};

const isFailedSnapshotOutputPreviewRecord = (output: SnapshotOutputPreviewRecord): boolean =>
  output.taskState === "fail";

const resolveSnapshotOutputImageCandidate = (
  output: SnapshotOutputPreviewRecord,
  userId?: string | null
): ProjectPreviewCandidate | null => {
  if (output.mode !== "image") return null;
  const storagePath =
    output.previewStoragePath && output.previewStoragePath.length > 0
      ? output.previewStoragePath
      : output.fullStoragePath && output.fullStoragePath.length > 0
        ? output.fullStoragePath
        : null;
  const fallbackUrlCandidates = [
    output.previewUrl && output.previewUrl.length > 0 ? output.previewUrl : null,
    ...(output.resultUrls ?? []),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const fallbackUrl = userId
    ? (filterTrustedMediaDirectPreviewUrls(fallbackUrlCandidates, {
        userId,
        requireUserScope: true,
      })[0] ?? null)
    : (fallbackUrlCandidates[0] ?? null);
  if (!storagePath && !fallbackUrl) return null;
  return {
    storagePaths: resolveProjectCardPreviewSigningStoragePaths(storagePath, userId),
    fallbackUrl,
  };
};

export const resolveProjectCardPreviewSigningStoragePaths = (
  storagePath: string | null | undefined,
  userId?: string | null
): string[] => {
  const normalized =
    typeof storagePath === "string" && storagePath.trim().length > 0 ? storagePath.trim() : null;
  if (!normalized) return [];
  const candidates = normalized.endsWith("/thumb_480")
    ? [normalized.replace(/\/thumb_480$/, "/thumb_240"), normalized]
    : [normalized];
  return Array.from(
    new Set(
      candidates.filter(
        (value) => value.length > 0 && (!userId || isUserScopedMediaStoragePath(value, userId))
      )
    )
  );
};

const collectUniqueImageCandidates = (
  outputs: SnapshotOutputPreviewRecord[],
  options?: { excludeHiddenInReferenceGrid?: boolean; limit?: number; userId?: string | null }
): ProjectPreviewCandidate[] => {
  const results: ProjectPreviewCandidate[] = [];
  const seen = new Set<string>();
  const limit = options?.limit ?? PROJECT_PREVIEW_IMAGE_LIMIT;

  for (const output of outputs) {
    if (options?.excludeHiddenInReferenceGrid && output.hiddenInReferenceGrid === true) {
      continue;
    }
    const candidate = resolveSnapshotOutputImageCandidate(output, options?.userId);
    const uniqueKey =
      candidate?.storagePaths[candidate.storagePaths.length - 1] ?? candidate?.fallbackUrl;
    if (!candidate || !uniqueKey || seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);
    results.push(candidate);
    if (results.length >= limit) break;
  }

  return results;
};

const resolveProjectPreviewImageCandidatesFromSnapshot = (
  snapshot: Record<string, unknown> | null | undefined,
  userId?: string | null
): ProjectPreviewCandidate[] => {
  const outputsRecord = asRecord(asRecord(snapshot).outputs);
  const activeOutputs = Array.isArray(outputsRecord.active)
    ? outputsRecord.active
        .map((value) => toSnapshotOutputPreviewRecord(value))
        .filter(
          (value): value is SnapshotOutputPreviewRecord =>
            value !== null && !isFailedSnapshotOutputPreviewRecord(value)
        )
    : [];
  const archivedOutputs = Array.isArray(outputsRecord.archived)
    ? outputsRecord.archived
        .map((value) => toSnapshotOutputPreviewRecord(value))
        .filter(
          (value): value is SnapshotOutputPreviewRecord =>
            value !== null && !isFailedSnapshotOutputPreviewRecord(value)
        )
    : [];
  const allOutputs = [...activeOutputs, ...archivedOutputs];
  const outputsById = allOutputs.reduce<Record<string, SnapshotOutputPreviewRecord>>(
    (acc, output) => {
      acc[output.id] = output;
      return acc;
    },
    {}
  );
  const curatedReferenceIds = asStringArray(outputsRecord.curatedReferenceIds);

  const quickSlotPreviews = collectUniqueImageCandidates(
    curatedReferenceIds
      .map((id) => outputsById[id])
      .filter((output): output is SnapshotOutputPreviewRecord => Boolean(output)),
    { limit: PROJECT_PREVIEW_IMAGE_LIMIT, userId }
  );
  if (quickSlotPreviews.length > 0) {
    return quickSlotPreviews;
  }

  return collectUniqueImageCandidates(activeOutputs, {
    excludeHiddenInReferenceGrid: true,
    limit: PROJECT_PREVIEW_IMAGE_LIMIT,
    userId,
  });
};

const resolveProjectPreviewImageCandidatesFromDisplayRecords = ({
  snapshot,
  displayRows,
  userId,
}: {
  snapshot: Record<string, unknown> | null | undefined;
  displayRows: ProjectOutputDisplayPreviewRow[];
  userId?: string | null;
}): ProjectPreviewCandidate[] => {
  if (displayRows.length === 0) return [];
  const outputsRecord = asRecord(asRecord(snapshot).outputs);
  const displayOutputs = displayRows
    .map((row) => toDisplayOutputPreviewRecord(row))
    .filter(
      (value): value is SnapshotOutputPreviewRecord =>
        value !== null && !isFailedSnapshotOutputPreviewRecord(value)
    );
  const outputsById = displayOutputs.reduce<Record<string, SnapshotOutputPreviewRecord>>(
    (acc, output) => {
      acc[output.id] = output;
      return acc;
    },
    {}
  );
  const curatedReferenceIds = asStringArray(outputsRecord.curatedReferenceIds);
  const quickSlotPreviews = collectUniqueImageCandidates(
    curatedReferenceIds
      .map((id) => outputsById[id])
      .filter((output): output is SnapshotOutputPreviewRecord => Boolean(output)),
    { limit: PROJECT_PREVIEW_IMAGE_LIMIT, userId }
  );
  if (quickSlotPreviews.length > 0) {
    return quickSlotPreviews;
  }

  const activeOutputIds = Array.isArray(outputsRecord.active)
    ? outputsRecord.active
        .map((row) => {
          const id = asRecord(row).id;
          return typeof id === "string" ? id.trim() : "";
        })
        .filter((id) => id.length > 0)
    : [];
  const activeDisplayOutputs =
    activeOutputIds.length > 0
      ? activeOutputIds
          .map((id) => outputsById[id])
          .filter((output): output is SnapshotOutputPreviewRecord => Boolean(output))
      : displayOutputs;

  return collectUniqueImageCandidates(activeDisplayOutputs, {
    excludeHiddenInReferenceGrid: true,
    limit: PROJECT_PREVIEW_IMAGE_LIMIT,
    userId,
  });
};

export const resolveProjectPreviewImageUrlsFromSnapshot = (
  snapshot: Record<string, unknown> | null | undefined,
  userId?: string | null
): string[] =>
  resolveProjectPreviewImageCandidatesFromSnapshot(snapshot, userId)
    .map((candidate) => candidate.fallbackUrl)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

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

export const parseProjectListLimit = (value: unknown): ProjectListLimit | null => {
  if (value == null || value === "") return DEFAULT_PROJECT_LIST_LIMIT;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  if (raw.trim().toLowerCase() === PROJECT_LIST_ALL) return PROJECT_LIST_ALL;
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
  limit?: ProjectListLimit;
}): Promise<ProjectRecord[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("projects")
    .select(PROJECT_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (limit !== PROJECT_LIST_ALL) {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), MAX_PROJECT_LIST_LIMIT));
    query = query.limit(safeLimit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to list projects");
  }

  const projects = (data ?? []).map((row) => toProjectRecord(row as ProjectRow));
  if (projects.length === 0) {
    return projects;
  }

  const { data: workspaceRows, error: workspaceError } = await supabaseAdmin
    .from("project_workspace_states")
    .select("project_id, snapshot")
    .eq("user_id", userId)
    .in(
      "project_id",
      projects.map((project) => project.id)
    );

  if (workspaceError) {
    throw new Error(workspaceError.message || "Failed to list project previews");
  }

  const projectIds = projects.map((project) => project.id);
  const { data: displayRows, error: displayError } = await supabaseAdmin
    .from("project_output_display_items")
    .select(
      [
        "project_id",
        "output_id",
        "mode",
        "task_state",
        "preview_url_fallback",
        "result_urls_fallback",
        "preview_storage_path",
        "full_storage_path",
        "hidden_in_reference_grid",
      ].join(", ")
    )
    .eq("user_id", userId)
    .in("project_id", projectIds);

  const displayRowsByProjectId = new Map<string, ProjectOutputDisplayPreviewRow[]>();
  if (!displayError) {
    (Array.isArray(displayRows) ? displayRows : []).forEach((row) => {
      const displayRow = row as unknown as ProjectOutputDisplayPreviewRow;
      const rows = displayRowsByProjectId.get(displayRow.project_id) ?? [];
      rows.push(displayRow);
      displayRowsByProjectId.set(displayRow.project_id, rows);
    });
  }

  const previewUrlsByProjectId = new Map<string, string[]>();
  const previewCandidatesByProjectId = new Map<string, ProjectPreviewCandidate[]>();
  const storagePathsToSign = new Set<string>();

  (workspaceRows ?? []).forEach((row) => {
    const workspaceRow = row as ProjectWorkspacePreviewRow;
    const displayCandidates = resolveProjectPreviewImageCandidatesFromDisplayRecords({
      snapshot: workspaceRow.snapshot,
      displayRows: displayRowsByProjectId.get(workspaceRow.project_id) ?? [],
      userId,
    });
    const previewCandidates =
      displayCandidates.length > 0
        ? displayCandidates
        : resolveProjectPreviewImageCandidatesFromSnapshot(workspaceRow.snapshot, userId);
    previewCandidatesByProjectId.set(workspaceRow.project_id, previewCandidates);
    previewCandidates.forEach((candidate) => {
      candidate.storagePaths.forEach((path) => storagePathsToSign.add(path));
    });
  });

  const signedUrlByPath = new Map<string, string | null>();
  const pathsToSign = [...storagePathsToSign];
  if (pathsToSign.length > 0) {
    const storage = supabaseAdmin.storage.from(MEDIA_BUCKET);
    pathsToSign.forEach((path) => {
      signedUrlByPath.set(path, null);
    });
    await Promise.all(
      pathsToSign.map(async (path) => {
        const { data, error } = await storage.createSignedUrl(
          path,
          PROJECT_PREVIEW_SIGNED_URL_TTL_SECONDS
        );
        if (error) return;
        signedUrlByPath.set(
          path,
          typeof data?.signedUrl === "string" && data.signedUrl.trim().length > 0
            ? data.signedUrl
            : null
        );
      })
    );
  }

  previewCandidatesByProjectId.forEach((candidates, projectId) => {
    previewUrlsByProjectId.set(
      projectId,
      candidates
        .map((candidate) => {
          for (const path of candidate.storagePaths) {
            const signedUrl = signedUrlByPath.get(path);
            if (typeof signedUrl === "string" && signedUrl.length > 0) {
              return signedUrl;
            }
          }
          return candidate.fallbackUrl;
        })
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );
  });

  return projects.map((project) => ({
    ...project,
    previewImageUrls: previewUrlsByProjectId.get(project.id) ?? [],
  }));
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

export const deleteProjectForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<ProjectRecord | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)
    .select(PROJECT_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to delete project");
  }
  if (!data) return null;
  return toProjectRecord(data as ProjectRow);
};
