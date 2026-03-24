/**
 * AI Studio local reference durability hook.
 * Converts local-only reference previews into private storage-backed URLs for session restore safety.
 */
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import type { StudioOutput } from "../types";
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
  previewUrl: string;
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
  return false;
};

const resolveCandidateSignature = (output: StudioOutput): string => {
  const previewUrl = output.previewUrl?.trim() ?? "";
  return [
    output.mode,
    previewUrl,
    output.previewStoragePath ?? "",
    output.fullStoragePath ?? "",
  ].join("|");
};

const toLocalReferenceCandidate = (output: StudioOutput): LocalReferenceCandidate | null => {
  if (!output?.id) return null;
  if (output.mode !== "image" && output.mode !== "video") return null;
  if (!isLocalPreviewUrl(output.previewUrl)) return null;
  if (
    asCanonicalStoragePath(output.previewStoragePath) ||
    asCanonicalStoragePath(output.fullStoragePath)
  ) {
    return null;
  }
  const previewUrl = output.previewUrl?.trim();
  if (!previewUrl) return null;
  return {
    id: output.id,
    mode: output.mode,
    previewUrl,
    signature: resolveCandidateSignature(output),
  };
};

const patchOutputIfUnchanged = ({
  rows,
  outputId,
  expectedSignature,
  path,
  signedUrl,
}: {
  rows: StudioOutput[];
  outputId: string;
  expectedSignature: string;
  path: string;
  signedUrl: string;
}): { rows: StudioOutput[]; changed: boolean } => {
  let changed = false;
  const patched = rows.map((row) => {
    if (row.id !== outputId) return row;
    if (resolveCandidateSignature(row) !== expectedSignature) return row;
    const canonicalPath = asCanonicalStoragePath(path);
    if (!canonicalPath) return row;
    if (
      row.previewUrl === signedUrl &&
      asCanonicalStoragePath(row.previewStoragePath) === canonicalPath &&
      asCanonicalStoragePath(row.fullStoragePath) === canonicalPath
    ) {
      return row;
    }
    changed = true;
    return {
      ...row,
      previewUrl: signedUrl,
      previewStoragePath: canonicalPath,
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
  const failedSignatureByIdRef = useRef<Map<string, string>>(new Map());
  const drainingRef = useRef(false);

  const processCandidate = useCallback(
    async (candidateId: string) => {
      const candidate = candidateByIdRef.current.get(candidateId);
      if (!candidate) return;

      const completedSignature = completedSignatureByIdRef.current.get(candidate.id);
      if (completedSignature === candidate.signature) return;
      const failedSignature = failedSignatureByIdRef.current.get(candidate.id);
      if (failedSignature === candidate.signature) return;
      if (inFlightRef.current.has(candidate.id)) return;

      inFlightRef.current.add(candidate.id);
      try {
        let uploaded: { url: string; path: string } | null = null;
        if (candidate.mode === "video") {
          uploaded = await uploadVideoAssetToStorage(candidate.previewUrl);
        } else {
          uploaded = await uploadImageAssetToStorage(candidate.previewUrl);
        }

        const canonicalPath = asCanonicalStoragePath(uploaded.path);
        const signedUrl = uploaded.url?.trim();
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
            }).rows
        );

        completedSignatureByIdRef.current.set(candidate.id, candidate.signature);
        failedSignatureByIdRef.current.delete(candidate.id);
      } catch (error) {
        failedSignatureByIdRef.current.set(candidate.id, candidate.signature);
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
      failedSignatureByIdRef.current.delete(id);
    });

    nextCandidateById.forEach((candidate) => {
      if (inFlightRef.current.has(candidate.id)) return;
      const completedSignature = completedSignatureByIdRef.current.get(candidate.id);
      if (completedSignature === candidate.signature) return;
      const failedSignature = failedSignatureByIdRef.current.get(candidate.id);
      if (failedSignature === candidate.signature) return;
      if (pendingSetRef.current.has(candidate.id)) return;
      pendingSetRef.current.add(candidate.id);
      pendingQueueRef.current.push(candidate.id);
    });

    void drainPendingQueue();
  }, [archivedOutputs, drainPendingQueue, outputs]);
};
