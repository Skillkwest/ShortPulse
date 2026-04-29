import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type UpsertGenerationPublicationInput = {
  generationId: string;
  generationOutputId: string;
  userId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
  generationAttemptId?: string | null;
  publicationState?: "pending" | "published" | "archived" | "suppressed";
  reusable?: boolean;
  visibleInAiStudio?: boolean;
  visibleInReferenceGrid?: boolean;
  ownedMediaFileId?: string | null;
  previewUrl?: string | null;
  fullUrl?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  metadata?: JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const upsertGenerationPublication = async ({
  generationId,
  generationOutputId,
  userId,
  supabaseAdmin,
  generationAttemptId,
  publicationState = "pending",
  reusable = true,
  visibleInAiStudio = true,
  visibleInReferenceGrid = true,
  ownedMediaFileId,
  previewUrl,
  fullUrl,
  previewStoragePath,
  fullStoragePath,
  publishedAt,
  archivedAt,
  archiveReason,
  metadata = {},
}: UpsertGenerationPublicationInput): Promise<void> => {
  const payload: Record<string, unknown> = {
    generation_id: generationId,
    generation_output_id: generationOutputId,
    user_id: userId,
    publication_state: publicationState,
    reusable,
    visible_in_ai_studio: visibleInAiStudio,
    visible_in_reference_grid: visibleInReferenceGrid,
    metadata,
    updated_at: new Date().toISOString(),
  };

  const normalizedAttemptId = asString(generationAttemptId);
  if (normalizedAttemptId) payload.generation_attempt_id = normalizedAttemptId;
  const normalizedOwnedMediaId = asString(ownedMediaFileId);
  if (normalizedOwnedMediaId) payload.owned_media_file_id = normalizedOwnedMediaId;
  const normalizedPreviewUrl = asString(previewUrl);
  if (normalizedPreviewUrl) payload.preview_url = normalizedPreviewUrl;
  const normalizedFullUrl = asString(fullUrl);
  if (normalizedFullUrl) payload.full_url = normalizedFullUrl;
  const normalizedPreviewStoragePath = asString(previewStoragePath);
  if (normalizedPreviewStoragePath) payload.preview_storage_path = normalizedPreviewStoragePath;
  const normalizedFullStoragePath = asString(fullStoragePath);
  if (normalizedFullStoragePath) payload.full_storage_path = normalizedFullStoragePath;
  const normalizedPublishedAt = asString(publishedAt);
  if (normalizedPublishedAt) payload.published_at = normalizedPublishedAt;
  const normalizedArchivedAt = asString(archivedAt);
  if (normalizedArchivedAt) payload.archived_at = normalizedArchivedAt;
  const normalizedArchiveReason = asString(archiveReason);
  if (normalizedArchiveReason) payload.archive_reason = normalizedArchiveReason;

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const { error } = await adminClient.from("generation_publications").upsert(payload, {
    onConflict: "generation_output_id",
  });
  if (error) throw error;
};
