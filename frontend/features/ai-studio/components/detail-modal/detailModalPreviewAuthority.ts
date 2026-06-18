/**
 * Shared detail-modal preview authority helpers.
 * Centralizes candidate preview selection and canonical full-quality resolution.
 */
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import { getSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";
import { isSupabaseRenderImageUrl } from "../../../../lib/mediaPreviewTrustPolicy";
import { ensureSupabaseQueryClient } from "../../../../lib/supabaseClient";
import { resolveStudioOutputMediaDisplayAuthority } from "../../logic/referenceGridMedia";
import { resolveReferenceDownloadTarget } from "../../logic/referenceDownload";
import type { StudioOutput } from "../../types";

export type DetailPreviewSelectionState = {
  outputId: string;
  currentUrl: string | null;
  rejectedUrls: string[];
};

const isNextImageOptimizerUrl = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/_next/image")) return true;
  try {
    return new URL(trimmed).pathname.startsWith("/_next/image");
  } catch {
    return false;
  }
};

const isForbiddenDetailImageUrl = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return isSupabaseRenderImageUrl(trimmed);
};

export const isFullQualityDetailImageUrl = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return !isForbiddenDetailImageUrl(trimmed) && !isNextImageOptimizerUrl(trimmed);
};

export const buildUniquePreviewCandidates = (urls: Array<string | null | undefined>): string[] => {
  const uniqueUrls = new Set<string>();
  const directPreviewUrls: string[] = [];
  const optimizerPreviewUrls: string[] = [];
  urls.forEach((url) => {
    const trimmed = url?.trim();
    if (!trimmed) return;
    if (isForbiddenDetailImageUrl(trimmed)) return;
    if (uniqueUrls.has(trimmed)) return;
    uniqueUrls.add(trimmed);
    if (isNextImageOptimizerUrl(trimmed)) {
      optimizerPreviewUrls.push(trimmed);
      return;
    }
    directPreviewUrls.push(trimmed);
  });
  return [...directPreviewUrls, ...optimizerPreviewUrls];
};

export const resolveNextPreviewCandidateUrl = ({
  currentUrl,
  previewCandidates,
  rejectedUrls,
}: {
  currentUrl: string | null;
  previewCandidates: string[];
  rejectedUrls: string[];
}): string | null => {
  const rejectedUrlSet = new Set(rejectedUrls);
  return (
    previewCandidates.find((candidateUrl) => {
      if (candidateUrl === currentUrl) return false;
      return !rejectedUrlSet.has(candidateUrl);
    }) ?? null
  );
};

export const resolveDetailPreviewCandidates = (
  output: Pick<
    StudioOutput,
    | "previewStoragePath"
    | "fullStoragePath"
    | "mediaSource"
    | "generationId"
    | "savedMediaIds"
    | "mode"
    | "previewUrl"
    | "previewPosterUrl"
    | "previewPosterStoragePath"
    | "resultUrls"
    | "id"
    | "taskId"
    | "taskState"
  >
): string[] => {
  const resolvedDetailMedia = resolveStudioOutputMediaDisplayAuthority(
    {
      id: output.id,
      previewStoragePath: output.previewStoragePath,
      previewPosterStoragePath: output.previewPosterStoragePath,
      fullStoragePath: output.fullStoragePath,
      mediaSource: output.mediaSource,
      generationId: output.generationId,
      taskId: output.taskId,
      taskState: output.taskState,
      savedMediaIds: output.savedMediaIds,
      mode: output.mode,
      previewUrl: output.previewUrl,
      previewPosterUrl: output.previewPosterUrl,
      resultUrls: output.resultUrls,
    },
    {
      strictPreviewLadder: true,
      adaptivePreviewQuality: false,
      surface: "detail-modal",
    }
  );
  const preferredDetailMediaUrl =
    output.mode === "video" || output.mode === "audio"
      ? resolvedDetailMedia.playableMediaUrl
      : (resolvedDetailMedia.fullMediaUrl ?? resolvedDetailMedia.cardDisplayUrl);
  const legacyPreviewUrl =
    output.mode === "video" || output.mode === "audio" ? null : output.previewUrl;
  return buildUniquePreviewCandidates([
    preferredDetailMediaUrl,
    resolvedDetailMedia.thumbnailPreviewUrl ?? null,
    legacyPreviewUrl,
    ...(output.resultUrls ?? []),
  ]);
};

export const createPreviewSelectionState = (
  outputId: string,
  previewCandidates: string[],
  rejectedUrls: string[] = []
): DetailPreviewSelectionState => ({
  outputId,
  currentUrl: resolveNextPreviewCandidateUrl({
    currentUrl: null,
    previewCandidates,
    rejectedUrls,
  }),
  rejectedUrls,
});

export const shouldResolveCanonicalDetailAuthority = (
  output: Pick<
    StudioOutput,
    | "previewStoragePath"
    | "fullStoragePath"
    | "savedMediaIds"
    | "generationId"
    | "taskId"
    | "mediaSource"
  >
): boolean => {
  if (asCanonicalStoragePath(output.previewStoragePath)) return true;
  if (asCanonicalStoragePath(output.fullStoragePath)) return true;
  if (Array.isArray(output.savedMediaIds) && output.savedMediaIds.some((value) => value?.trim())) {
    return true;
  }
  if (output.mediaSource === "generated") return true;
  return Boolean(output.generationId?.trim() || output.taskId?.trim());
};

export const resolveCanonicalDetailAuthorityUrl = async (
  output: Pick<
    StudioOutput,
    | "savedMediaIds"
    | "generationId"
    | "taskId"
    | "mediaSource"
    | "previewStoragePath"
    | "fullStoragePath"
    | "previewUrl"
    | "resultUrls"
  >,
  options: { forceRefresh?: boolean; projectId?: string | null } = {}
): Promise<string | null> => {
  if (!shouldResolveCanonicalDetailAuthority(output)) return null;
  try {
    const supabase = ensureSupabaseQueryClient();
    const resolvedTarget = await resolveReferenceDownloadTarget({
      output,
      supabase,
      projectId: options.projectId,
    });
    const storagePath = resolvedTarget.fileRecord?.storagePath?.trim() ?? "";
    if (!storagePath) return null;
    const signedUrl = await getSignedMediaUrl({
      bucket: "media_library",
      storagePath,
      previewProfile: "none",
      ...(options.forceRefresh === true ? { forceRefresh: true } : {}),
    });
    return isFullQualityDetailImageUrl(signedUrl) ? signedUrl : null;
  } catch {
    return null;
  }
};
