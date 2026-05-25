/**
 * AI Studio local reference durability hook.
 * Converts local-only reference previews into private storage-backed URLs for session restore safety.
 */
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import {
  AI_STUDIO_DURABILITY_MAX_ATTEMPTS_PER_SIGNATURE,
  AI_STUDIO_DURABILITY_RETRY_DELAY_MS,
} from "../logic/persistenceRetryPolicy";
import type { StudioOutput } from "../types";
import { uploadAudioAssetToStorage } from "../utils/audioUpload";
import { uploadImageAssetToStorage } from "../utils/imageUpload";
import { uploadVideoAssetToStorage } from "../utils/videoUpload";

type UseAiStudioSessionReferenceDurabilityParams = {
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
};

type LocalReferenceCandidate = {
  id: string;
  mode: StudioOutput["mode"];
  uploadUrl: string;
  previewPosterUrl: string | null;
  signature: string;
};

const SUPPORTED_DATA_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
]);

const SUPPORTED_DATA_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const SUPPORTED_DATA_AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);

const resolveDataUrlMimeType = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized.startsWith("data:")) return null;
  const mimeType = normalized.slice("data:".length).split(";")[0]?.trim().toLowerCase() ?? "";
  return mimeType || null;
};

const isLocalPreviewUrl = (value: string | null | undefined): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith("blob:")) return true;
  const dataMimeType = resolveDataUrlMimeType(normalized);
  if (!dataMimeType) return false;
  if (dataMimeType.startsWith("image/")) {
    return SUPPORTED_DATA_IMAGE_MIME_TYPES.has(dataMimeType);
  }
  if (dataMimeType.startsWith("video/")) {
    return SUPPORTED_DATA_VIDEO_MIME_TYPES.has(dataMimeType);
  }
  if (dataMimeType.startsWith("audio/")) {
    return SUPPORTED_DATA_AUDIO_MIME_TYPES.has(dataMimeType);
  }
  return false;
};

const isLocalImagePreviewUrl = (value: string | null | undefined): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith("blob:")) return true;
  const dataMimeType = resolveDataUrlMimeType(normalized);
  return Boolean(
    dataMimeType?.startsWith("image/") && SUPPORTED_DATA_IMAGE_MIME_TYPES.has(dataMimeType)
  );
};

const resolveCandidateSignature = (output: StudioOutput): string => {
  const previewUrl = output.previewUrl?.trim() ?? "";
  const previewPosterUrl = output.previewPosterUrl?.trim() ?? "";
  return [
    output.mode,
    previewUrl,
    previewPosterUrl,
    output.previewPosterStoragePath ?? "",
    output.previewStoragePath ?? "",
    output.fullStoragePath ?? "",
  ].join("|");
};

const resolveAttemptKey = (candidate: LocalReferenceCandidate): string =>
  `${candidate.id}::${candidate.signature}`;

const resolveCandidateUploadUrl = (output: StudioOutput): string | null => {
  if (output.mode === "image") {
    const localObjectUrl = output.localObjectUrl?.trim() ?? "";
    if (localObjectUrl.startsWith("blob:")) return localObjectUrl;
  }
  const previewUrl = output.previewUrl?.trim() ?? "";
  return previewUrl || null;
};

const toLocalReferenceCandidate = (output: StudioOutput): LocalReferenceCandidate | null => {
  if (!output?.id) return null;
  if (output.mode !== "image" && output.mode !== "video" && output.mode !== "audio") return null;
  if (!isLocalPreviewUrl(output.previewUrl)) return null;
  if (
    asCanonicalStoragePath(output.previewStoragePath) ||
    asCanonicalStoragePath(output.fullStoragePath)
  ) {
    return null;
  }
  const uploadUrl = resolveCandidateUploadUrl(output);
  if (!uploadUrl) return null;
  const previewPosterUrl =
    output.mode === "video" &&
    !asCanonicalStoragePath(output.previewPosterStoragePath) &&
    isLocalImagePreviewUrl(output.previewPosterUrl)
      ? (output.previewPosterUrl?.trim() ?? null)
      : null;
  return {
    id: output.id,
    mode: output.mode,
    uploadUrl,
    previewPosterUrl,
    signature: resolveCandidateSignature(output),
  };
};

const patchOutputIfUnchanged = ({
  rows,
  outputId,
  expectedSignature,
  path,
  signedUrl,
  posterPath,
  signedPosterUrl,
}: {
  rows: StudioOutput[];
  outputId: string;
  expectedSignature: string;
  path: string;
  signedUrl: string;
  posterPath?: string | null;
  signedPosterUrl?: string | null;
}): { rows: StudioOutput[]; changed: boolean } => {
  let changed = false;
  const patched = rows.map((row) => {
    if (row.id !== outputId) return row;
    if (resolveCandidateSignature(row) !== expectedSignature) return row;
    const canonicalPath = asCanonicalStoragePath(path);
    if (!canonicalPath) return row;
    const canonicalPosterPath = row.mode === "video" ? asCanonicalStoragePath(posterPath) : null;
    const nextPreviewStoragePath = canonicalPosterPath ?? canonicalPath;
    if (
      row.previewUrl === signedUrl &&
      asCanonicalStoragePath(row.previewStoragePath) === nextPreviewStoragePath &&
      asCanonicalStoragePath(row.fullStoragePath) === canonicalPath &&
      asCanonicalStoragePath(row.previewPosterStoragePath) === canonicalPosterPath &&
      (row.mode !== "video" || (row.previewPosterUrl ?? null) === (signedPosterUrl ?? null))
    ) {
      return row;
    }
    changed = true;
    return {
      ...row,
      previewUrl: signedUrl,
      previewPosterUrl:
        row.mode === "video" ? (signedPosterUrl ?? row.previewPosterUrl ?? null) : null,
      previewPosterStoragePath: row.mode === "video" ? canonicalPosterPath : null,
      previewStoragePath: nextPreviewStoragePath,
      fullStoragePath: canonicalPath,
    };
  });
  return { rows: patched, changed };
};

/**
 * Ensures local-only reference rows are durably upload-backed for future session restoration.
 */
export const useAiStudioSessionReferenceDurability = ({
  outputs,
  archivedOutputs,
  setOutputsState,
  setArchivedOutputs,
}: UseAiStudioSessionReferenceDurabilityParams): void => {
  const candidateByIdRef = useRef<Map<string, LocalReferenceCandidate>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const pendingQueueRef = useRef<string[]>([]);
  const pendingSetRef = useRef<Set<string>>(new Set());
  const completedSignatureByIdRef = useRef<Map<string, string>>(new Map());
  const attemptCountBySignatureRef = useRef<Map<string, number>>(new Map());
  const retryTimeoutByAttemptKeyRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const drainingRef = useRef(false);
  const drainPendingQueueRef = useRef<() => Promise<void>>(async () => undefined);

  const processCandidate = useCallback(
    async (candidateId: string) => {
      const candidate = candidateByIdRef.current.get(candidateId);
      if (!candidate) return;

      const completedSignature = completedSignatureByIdRef.current.get(candidate.id);
      if (completedSignature === candidate.signature) return;
      const attemptKey = resolveAttemptKey(candidate);
      const attemptCount = attemptCountBySignatureRef.current.get(attemptKey) ?? 0;
      if (attemptCount >= AI_STUDIO_DURABILITY_MAX_ATTEMPTS_PER_SIGNATURE) return;
      if (inFlightRef.current.has(candidate.id)) return;

      inFlightRef.current.add(candidate.id);
      attemptCountBySignatureRef.current.set(attemptKey, attemptCount + 1);
      try {
        let uploaded: { url: string; path: string } | null = null;
        let uploadedPoster: { url: string; path: string } | null = null;
        if (candidate.mode === "video") {
          uploaded = await uploadVideoAssetToStorage(candidate.uploadUrl);
          if (candidate.previewPosterUrl) {
            try {
              uploadedPoster = await uploadImageAssetToStorage(candidate.previewPosterUrl);
            } catch (error) {
              addBreadcrumb({
                type: "ui",
                level: "warn",
                message: "ai_studio_session_reference_durability_poster_upload_failed",
                data: {
                  output_id: candidate.id,
                  error: error instanceof Error ? error.message : "unknown_error",
                },
              });
            }
          }
        } else if (candidate.mode === "audio") {
          uploaded = await uploadAudioAssetToStorage(candidate.uploadUrl);
        } else {
          uploaded = await uploadImageAssetToStorage(candidate.uploadUrl);
        }

        const canonicalPath = asCanonicalStoragePath(uploaded.path);
        const signedUrl = uploaded.url?.trim();
        const canonicalPosterPath = asCanonicalStoragePath(uploadedPoster?.path);
        const signedPosterUrl = uploadedPoster?.url?.trim() ?? null;
        if (!canonicalPath || !signedUrl) {
          throw new Error("Uploaded reference result did not include a valid signed delivery.");
        }

        setOutputsState(
          (rows) =>
            patchOutputIfUnchanged({
              rows,
              outputId: candidate.id,
              expectedSignature: candidate.signature,
              path: canonicalPath,
              signedUrl,
              posterPath: canonicalPosterPath,
              signedPosterUrl,
            }).rows
        );
        setArchivedOutputs(
          (rows) =>
            patchOutputIfUnchanged({
              rows,
              outputId: candidate.id,
              expectedSignature: candidate.signature,
              path: canonicalPath,
              signedUrl,
              posterPath: canonicalPosterPath,
              signedPosterUrl,
            }).rows
        );

        completedSignatureByIdRef.current.set(candidate.id, candidate.signature);
        attemptCountBySignatureRef.current.delete(attemptKey);
        const retryTimeout = retryTimeoutByAttemptKeyRef.current.get(attemptKey);
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeoutByAttemptKeyRef.current.delete(attemptKey);
        }
      } catch (error) {
        if (
          (attemptCountBySignatureRef.current.get(attemptKey) ?? 0) <
            AI_STUDIO_DURABILITY_MAX_ATTEMPTS_PER_SIGNATURE &&
          !retryTimeoutByAttemptKeyRef.current.has(attemptKey)
        ) {
          const retryTimeout = setTimeout(() => {
            retryTimeoutByAttemptKeyRef.current.delete(attemptKey);
            const activeCandidate = candidateByIdRef.current.get(candidate.id);
            if (!activeCandidate || activeCandidate.signature !== candidate.signature) return;
            if (inFlightRef.current.has(candidate.id) || pendingSetRef.current.has(candidate.id))
              return;
            if (
              (attemptCountBySignatureRef.current.get(attemptKey) ?? 0) >=
              AI_STUDIO_DURABILITY_MAX_ATTEMPTS_PER_SIGNATURE
            ) {
              return;
            }
            pendingSetRef.current.add(candidate.id);
            pendingQueueRef.current.push(candidate.id);
            void drainPendingQueueRef.current();
          }, AI_STUDIO_DURABILITY_RETRY_DELAY_MS);
          retryTimeoutByAttemptKeyRef.current.set(attemptKey, retryTimeout);
        }
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "ai_studio_session_reference_durability_upload_failed",
          data: {
            output_id: candidate.id,
            mode: candidate.mode,
            error: error instanceof Error ? error.message : "unknown_error",
          },
        });
      } finally {
        inFlightRef.current.delete(candidate.id);
      }
    },
    [setArchivedOutputs, setOutputsState]
  );

  const drainPendingQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (pendingQueueRef.current.length) {
        const nextId = pendingQueueRef.current.shift();
        if (!nextId) continue;
        pendingSetRef.current.delete(nextId);
        await processCandidate(nextId);
      }
    } finally {
      drainingRef.current = false;
    }
  }, [processCandidate]);
  drainPendingQueueRef.current = drainPendingQueue;

  useEffect(() => {
    const nextCandidateById = new Map<string, LocalReferenceCandidate>();
    [...outputs, ...archivedOutputs].forEach((output) => {
      const candidate = toLocalReferenceCandidate(output);
      if (!candidate) return;
      nextCandidateById.set(candidate.id, candidate);
    });
    candidateByIdRef.current = nextCandidateById;

    // Cleanup stale signatures for rows no longer eligible.
    [...completedSignatureByIdRef.current.keys()].forEach((id) => {
      if (nextCandidateById.has(id)) return;
      completedSignatureByIdRef.current.delete(id);
      [...attemptCountBySignatureRef.current.keys()].forEach((attemptKey) => {
        if (!attemptKey.startsWith(`${id}::`)) return;
        attemptCountBySignatureRef.current.delete(attemptKey);
        const retryTimeout = retryTimeoutByAttemptKeyRef.current.get(attemptKey);
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeoutByAttemptKeyRef.current.delete(attemptKey);
        }
      });
    });

    nextCandidateById.forEach((candidate) => {
      if (inFlightRef.current.has(candidate.id)) return;
      const completedSignature = completedSignatureByIdRef.current.get(candidate.id);
      if (completedSignature === candidate.signature) return;
      const attemptCount =
        attemptCountBySignatureRef.current.get(resolveAttemptKey(candidate)) ?? 0;
      if (attemptCount >= AI_STUDIO_DURABILITY_MAX_ATTEMPTS_PER_SIGNATURE) return;
      if (pendingSetRef.current.has(candidate.id)) return;
      pendingSetRef.current.add(candidate.id);
      pendingQueueRef.current.push(candidate.id);
    });

    void drainPendingQueue();
  }, [archivedOutputs, drainPendingQueue, outputs]);

  useEffect(
    () => () => {
      retryTimeoutByAttemptKeyRef.current.forEach((retryTimeout) => {
        clearTimeout(retryTimeout);
      });
      retryTimeoutByAttemptKeyRef.current.clear();
    },
    []
  );
};
