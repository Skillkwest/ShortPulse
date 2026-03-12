/**
 * Styles-library internal reference drop resolver.
 * Resolves image URL candidates from durable output state and signed storage fallbacks.
 */
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import { getSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";
import type { StudioOutput } from "../../types";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";
import {
  normalizeReferenceTransferUrlCandidate,
  resolveReferenceTransferUrl,
} from "../../utils/dragDrop";
import type { ResolvedInternalStyleDrop } from "./intake";

type OutputSnapshot = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput | undefined>;
  archivedOutputById: Record<string, StudioOutput | undefined>;
};

type ResolveStyleInternalDropCandidatesArgs = {
  payload: InternalReferenceDragPayload;
  getOutputById: (outputId: string) => StudioOutput | null;
  getOutputSnapshot: () => OutputSnapshot;
  resolveSavedMediaIdFromOutput: (output: StudioOutput | null, imageIndex: number) => string | null;
  saveReferenceToLibrary: (outputId: string) => void;
  persistTimeoutMs: number;
  pollIntervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  resolveSignedStorageUrl?: (storagePath: string) => Promise<string | null>;
  resolveStoragePathFromMediaId?: (mediaId: string) => Promise<string | null>;
};

const defaultNow = (): number => Date.now();
const defaultSleep = async (ms: number): Promise<void> =>
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const defaultResolveSignedStorageUrl = async (storagePath: string): Promise<string | null> =>
  await getSignedMediaUrl({
    bucket: "media_library",
    storagePath,
    forceRefresh: true,
  });

const defaultResolveStoragePathFromMediaId = async (mediaId: string): Promise<string | null> => {
  const normalizedMediaId = mediaId.trim();
  if (!normalizedMediaId) return null;
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from("media_files")
    .select("storage_path")
    .eq("id", normalizedMediaId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  const storagePath = typeof data?.storage_path === "string" ? data.storage_path : null;
  return asCanonicalStoragePath(storagePath);
};

const resolvePayloadOutputId = ({
  payload,
  getOutputSnapshot,
}: {
  payload: InternalReferenceDragPayload;
  getOutputSnapshot: () => OutputSnapshot;
}): string => {
  const explicitOutputId = (payload.outputId ?? payload.referenceId ?? "").trim();
  if (explicitOutputId) return explicitOutputId;

  const droppedReferenceUrl = (payload.referenceUrl ?? "").trim();
  if (!droppedReferenceUrl) return "";
  const snapshot = getOutputSnapshot();
  const candidateIds = [...snapshot.outputOrder, ...snapshot.archivedOutputOrder];
  return (
    candidateIds.find((candidateId) => {
      const output = snapshot.outputById[candidateId] ?? snapshot.archivedOutputById[candidateId];
      if (!output) return false;
      if ((output.previewUrl ?? "").trim() === droppedReferenceUrl) return true;
      return (output.resultUrls ?? []).some((url) => (url ?? "").trim() === droppedReferenceUrl);
    }) ?? ""
  );
};

const pushImageCandidate = (next: string[], value: string | null | undefined) => {
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value?.trim() ?? "";
  if (!normalized) return;
  if (!next.includes(normalized)) {
    next.push(normalized);
  }
};

const resolveOutputStoragePath = (output: StudioOutput): string | null => {
  return (
    asCanonicalStoragePath(output.previewStoragePath) ??
    asCanonicalStoragePath(output.fullStoragePath)
  );
};

/**
 * Resolves style-drop candidates for internal reference-grid drags.
 * Adds signed storage URLs first when canonical storage paths are available.
 */
export const resolveStyleInternalDropCandidates = async ({
  payload,
  getOutputById,
  getOutputSnapshot,
  resolveSavedMediaIdFromOutput,
  saveReferenceToLibrary,
  persistTimeoutMs,
  pollIntervalMs,
  now = defaultNow,
  sleep = defaultSleep,
  resolveSignedStorageUrl = defaultResolveSignedStorageUrl,
  resolveStoragePathFromMediaId = defaultResolveStoragePathFromMediaId,
}: ResolveStyleInternalDropCandidatesArgs): Promise<ResolvedInternalStyleDrop | null> => {
  const imageIndex = Math.max(0, Math.floor(payload.imageIndex ?? 0));
  const resolvedOutputId = resolvePayloadOutputId({
    payload,
    getOutputSnapshot,
  });
  const initialOutput = resolvedOutputId ? getOutputById(resolvedOutputId) : null;
  const fallbackCandidates: string[] = [];
  pushImageCandidate(fallbackCandidates, payload.referenceUrl);
  if (!initialOutput || initialOutput.mode !== "image") {
    if (!fallbackCandidates.length) return null;
    return { imageUrlCandidates: fallbackCandidates, promptText: null };
  }

  let resolvedOutput = initialOutput;
  let resolvedMediaId =
    payload.mediaId?.trim() || resolveSavedMediaIdFromOutput(resolvedOutput, imageIndex);
  if (!resolvedMediaId) {
    try {
      saveReferenceToLibrary(resolvedOutputId);
      const startedAt = now();
      while (now() - startedAt < persistTimeoutMs) {
        const nextOutput = getOutputById(resolvedOutputId);
        if (!nextOutput || nextOutput.mode !== "image") break;
        resolvedOutput = nextOutput;
        resolvedMediaId = resolveSavedMediaIdFromOutput(nextOutput, imageIndex);
        if (resolvedMediaId) break;
        await sleep(pollIntervalMs);
      }
    } catch {
      // Continue with best-effort URL candidates from current output state.
    }
  }

  const candidates: string[] = [];
  let storagePath = resolveOutputStoragePath(resolvedOutput);
  if (!storagePath && resolvedMediaId) {
    storagePath = await resolveStoragePathFromMediaId(resolvedMediaId).catch(() => null);
  }
  if (storagePath) {
    const signedUrl = await resolveSignedStorageUrl(storagePath).catch(() => null);
    pushImageCandidate(candidates, signedUrl);
  }

  const indexedResultUrl = resolvedOutput.resultUrls?.[imageIndex] ?? null;
  pushImageCandidate(candidates, indexedResultUrl);
  pushImageCandidate(candidates, resolveReferenceTransferUrl(resolvedOutput, "image"));
  fallbackCandidates.forEach((candidate) => pushImageCandidate(candidates, candidate));
  if (!candidates.length) return null;

  return {
    imageUrlCandidates: candidates,
    promptText: resolvedOutput.prompt || resolvedOutput.previewText || null,
  };
};
