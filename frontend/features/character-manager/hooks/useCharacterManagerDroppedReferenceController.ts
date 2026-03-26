import { useCallback, useRef, useState } from "react";
import { reportAppError } from "../../../lib/appErrorReporter";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import {
  extractInternalReferenceDragPayload,
  type InternalReferenceDragPayload,
  type ReferenceDragSourceSurface,
} from "../../../lib/internalReferenceDragPayload";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import {
  resolveDroppedImageReference,
  type DroppedImageReference,
} from "../logic/characterDropPayload";
import type { CharacterSheetDropZoneKey } from "../types";

export type ResolvedCharacterDropReference = {
  mediaId: string;
  previewUrl?: string | null;
  storagePath?: string | null;
  outputId?: string | null;
  imageIndex?: number;
  sourceSurface?: ReferenceDragSourceSurface | null;
};

export type ResolveCharacterDropReference = (
  payload: InternalReferenceDragPayload
) => Promise<ResolvedCharacterDropReference | null>;

export type PendingCharacterDropTarget =
  | { target: "quickswap" }
  | { target: "character_sheet"; zoneKey: CharacterSheetDropZoneKey }
  | null;

type UseCharacterManagerDroppedReferenceControllerParams = {
  pageBusy: boolean;
  quickSwapMutating: boolean;
  clearAllMessages: () => void;
  appendQuickSwapFiles: (files: File[]) => Promise<boolean>;
  appendQuickSwapExistingMediaReference?: (
    mediaFileId: string,
    options?: { suppressError?: boolean }
  ) => Promise<boolean>;
  setCharacterSheetPresetFile: (zoneKey: CharacterSheetDropZoneKey, file: File) => Promise<unknown>;
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  hasQuickSwapMediaFileId: (mediaId: string) => boolean;
};

type UseCharacterManagerDroppedReferenceControllerResult = {
  pendingDropTarget: PendingCharacterDropTarget;
  isDropResolutionBusy: boolean;
  handleCharacterSheetReferenceDrop: (
    zoneKey: CharacterSheetDropZoneKey,
    transfer: DataTransfer
  ) => Promise<void>;
  handleQuickSwapReferenceDrop: (transfer: DataTransfer) => Promise<void>;
};

type DroppedStorageCandidate = {
  bucket: string;
  storagePath: string;
};

const MEDIA_BUCKET = "media_library";
const DROPPED_REFERENCE_TELEMETRY_SOURCE = "client.character_manager.drop_reference";
const SUPABASE_STORAGE_OBJECT_URL_PATTERN =
  /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/i;

const sanitizeFilenameSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const parseDroppedStorageCandidateFromUrl = (url: string): DroppedStorageCandidate | null => {
  try {
    const parsedUrl = new URL(url);
    const pathMatch = parsedUrl.pathname.match(SUPABASE_STORAGE_OBJECT_URL_PATTERN);
    if (!pathMatch) return null;
    const bucket = (pathMatch[1] ?? "").trim();
    const storagePath = decodeURIComponent(pathMatch[2] ?? "")
      .replace(/^\/+/, "")
      .trim();
    if (!bucket || !storagePath) return null;
    return {
      bucket,
      storagePath,
    };
  } catch {
    return null;
  }
};

const dedupeDroppedStorageCandidates = (
  candidates: DroppedStorageCandidate[]
): DroppedStorageCandidate[] => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.bucket}:${candidate.storagePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveDroppedStorageCandidates = async (
  reference: DroppedImageReference
): Promise<DroppedStorageCandidate[]> => {
  const candidates: DroppedStorageCandidate[] = [];
  const explicitStoragePath = reference.storagePath?.trim() ?? "";
  if (explicitStoragePath) {
    candidates.push({
      bucket: MEDIA_BUCKET,
      storagePath: explicitStoragePath,
    });
  }
  const urlCandidate = parseDroppedStorageCandidateFromUrl(reference.url);
  if (urlCandidate) {
    candidates.push(urlCandidate);
  }

  if (reference.mediaFileId) {
    try {
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase
        .from("media_files")
        .select("storage_path")
        .eq("id", reference.mediaFileId)
        .maybeSingle();
      if (!error) {
        const mediaRow = data as { storage_path: string | null } | null;
        const storagePath = (mediaRow?.storage_path ?? "").trim();
        if (storagePath) {
          candidates.unshift({
            bucket: MEDIA_BUCKET,
            storagePath,
          });
        }
      }
    } catch {
      // Fallback-only lookup: ignore metadata-query failures and rely on URL-based download.
    }
  }

  return dedupeDroppedStorageCandidates(candidates);
};

const downloadDroppedReferenceBlob = async (
  reference: DroppedImageReference
): Promise<{ blob: Blob; resolvedStoragePath: string | null }> => {
  let directFetchError: Error | null = null;
  try {
    const response = await fetch(reference.url);
    if (response.ok) {
      return {
        blob: await response.blob(),
        resolvedStoragePath: null,
      };
    }
    directFetchError = new Error(`Failed to read dropped image (${response.status}).`);
  } catch (nextError) {
    directFetchError =
      nextError instanceof Error ? nextError : new Error("Failed to read dropped image.");
  }

  const storageCandidates = await resolveDroppedStorageCandidates(reference);
  if (storageCandidates.length) {
    let downloadError: Error | null = null;
    const supabase = ensureSupabaseClient();
    for (const candidate of storageCandidates) {
      const { data, error } = await supabase.storage
        .from(candidate.bucket)
        .download(candidate.storagePath);
      if (error || !data) {
        downloadError = error ?? new Error("Failed to download dropped image.");
        continue;
      }
      return {
        blob: data,
        resolvedStoragePath: candidate.storagePath,
      };
    }
    if (downloadError) {
      throw downloadError;
    }
  }

  throw directFetchError ?? new Error("Failed to read dropped image.");
};

const toDroppedReferenceFile = async (reference: DroppedImageReference): Promise<File> => {
  const { blob, resolvedStoragePath } = await downloadDroppedReferenceBlob(reference);
  const resolvedMimeType = (blob.type || reference.mimeType || "").toLowerCase() || "image/jpeg";
  if (!resolvedMimeType.startsWith("image/")) {
    throw new Error("Dropped media is not an image.");
  }
  const extension = (() => {
    switch (resolvedMimeType) {
      case "image/jpeg":
        return "jpg";
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
      case "image/gif":
        return "gif";
      case "image/svg+xml":
        return "svg";
      case "image/avif":
        return "avif";
      case "image/bmp":
        return "bmp";
      case "image/heic":
        return "heic";
      case "image/heif":
        return "heif";
      default:
        return "jpg";
    }
  })();

  const parsedName = (() => {
    const storagePathSegment = resolvedStoragePath?.split("/").pop() ?? "";
    const cleanedStoragePathSegment = sanitizeFilenameSegment(storagePathSegment);
    if (cleanedStoragePathSegment) {
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(cleanedStoragePathSegment);
      return hasExtension ? cleanedStoragePathSegment : `${cleanedStoragePathSegment}.${extension}`;
    }
    try {
      const pathSegment = new URL(reference.url).pathname.split("/").pop() ?? "";
      const cleaned = sanitizeFilenameSegment(pathSegment);
      if (!cleaned) return null;
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(cleaned);
      return hasExtension ? cleaned : `${cleaned}.${extension}`;
    } catch {
      return null;
    }
  })();
  const fallbackName = `reference-drop-${Date.now()}.${extension}`;

  return new File([blob], parsedName ?? fallbackName, {
    type: resolvedMimeType,
  });
};

export const useCharacterManagerDroppedReferenceController = ({
  pageBusy,
  quickSwapMutating,
  clearAllMessages,
  appendQuickSwapFiles,
  appendQuickSwapExistingMediaReference,
  setCharacterSheetPresetFile,
  resolveCharacterDropReference,
  hasQuickSwapMediaFileId,
}: UseCharacterManagerDroppedReferenceControllerParams): UseCharacterManagerDroppedReferenceControllerResult => {
  const [pendingDropTarget, setPendingDropTarget] = useState<PendingCharacterDropTarget>(null);
  const mediaReferenceCacheRef = useRef(
    new Map<string, { storagePath: string; previewUrl: string | null }>()
  );
  const isDropResolutionBusy = pendingDropTarget !== null;

  const resolveMediaReferenceById = useCallback(async (mediaId: string) => {
    const normalizedMediaId = mediaId.trim();
    if (!normalizedMediaId) return null;
    const cached = mediaReferenceCacheRef.current.get(normalizedMediaId) ?? null;
    if (cached) return cached;
    try {
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase
        .from("media_files")
        .select("storage_path")
        .eq("id", normalizedMediaId)
        .maybeSingle();
      if (error) return null;
      const storagePath = (
        (data as { storage_path?: string | null } | null)?.storage_path ?? ""
      ).trim();
      if (!storagePath) return null;
      const signedUrl = await getSignedMediaUrl({
        bucket: MEDIA_BUCKET,
        storagePath,
        expiresInSeconds: 3600,
      });
      const resolved = { storagePath, previewUrl: signedUrl ?? null };
      mediaReferenceCacheRef.current.set(normalizedMediaId, resolved);
      return resolved;
    } catch {
      return null;
    }
  }, []);

  const logCharacterDropBreadcrumb = useCallback(
    (
      message:
        | "character_drop_attempt"
        | "character_drop_resolved"
        | "character_drop_rejected"
        | "character_drop_failed_autosave",
      data: Record<string, unknown>
    ) => {
      addBreadcrumb({
        type: "ui",
        level: message === "character_drop_rejected" ? "warn" : "info",
        message,
        data,
      });
    },
    []
  );

  const resolveInternalCharacterDrop = useCallback(
    async ({
      transfer,
      target,
      zoneKey,
    }: {
      transfer: DataTransfer;
      target: "quickswap" | "character_sheet";
      zoneKey?: CharacterSheetDropZoneKey;
    }): Promise<ResolvedCharacterDropReference | null> => {
      const payload = extractInternalReferenceDragPayload(transfer);
      if (!payload) return null;
      logCharacterDropBreadcrumb("character_drop_attempt", {
        target,
        zone_key: zoneKey ?? null,
        origin: payload.origin,
        source_surface: payload.sourceSurface ?? null,
        output_id: payload.outputId ?? null,
        image_index: payload.imageIndex,
      });
      if (!resolveCharacterDropReference) {
        logCharacterDropBreadcrumb("character_drop_rejected", {
          target,
          zone_key: zoneKey ?? null,
          reason: "resolver_unavailable",
          origin: payload.origin,
        });
        return null;
      }
      try {
        const resolved = await resolveCharacterDropReference(payload);
        const mediaId = resolved?.mediaId?.trim() ?? "";
        const previewUrl = resolved?.previewUrl?.trim() || payload.referenceUrl?.trim() || null;
        if (!mediaId && !previewUrl) {
          logCharacterDropBreadcrumb("character_drop_rejected", {
            target,
            zone_key: zoneKey ?? null,
            reason: "missing_media_id_and_preview_url",
            origin: payload.origin,
            output_id: payload.outputId ?? null,
            image_index: payload.imageIndex,
          });
          return null;
        }
        logCharacterDropBreadcrumb("character_drop_resolved", {
          target,
          zone_key: zoneKey ?? null,
          origin: payload.origin,
          source_surface: resolved?.sourceSurface ?? payload.sourceSurface ?? null,
          output_id: resolved?.outputId ?? payload.outputId ?? null,
          image_index: resolved?.imageIndex ?? payload.imageIndex,
          media_id: mediaId || null,
          resolved_via: mediaId ? "media_id" : "preview_url",
        });
        return {
          ...resolved,
          mediaId,
          previewUrl,
          storagePath: resolved?.storagePath?.trim() || null,
          outputId: resolved?.outputId ?? payload.outputId,
          imageIndex: resolved?.imageIndex ?? payload.imageIndex,
          sourceSurface: resolved?.sourceSurface ?? payload.sourceSurface ?? null,
        };
      } catch (error) {
        const reason =
          error instanceof Error && error.message.trim().length ? error.message : "resolver_failed";
        logCharacterDropBreadcrumb("character_drop_failed_autosave", {
          target,
          zone_key: zoneKey ?? null,
          origin: payload.origin,
          output_id: payload.outputId ?? null,
          image_index: payload.imageIndex,
          reason,
        });
        return null;
      }
    },
    [logCharacterDropBreadcrumb, resolveCharacterDropReference]
  );

  const ingestCharacterSheetDroppedReference = useCallback(
    async (zoneKey: CharacterSheetDropZoneKey, reference: DroppedImageReference) => {
      try {
        const file = await toDroppedReferenceFile(reference);
        await setCharacterSheetPresetFile(zoneKey, file);
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.message.trim().length
            ? error.message
            : "Failed to process dropped Character Sheet reference.";
        void reportAppError({
          source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
          scope: "app",
          severity: "low",
          message: "character_sheet_drop_reference_failed",
          metadata: {
            target: "character_sheet",
            drop_zone_key: zoneKey,
            reference_media_file_id: reference.mediaFileId,
            reason: errorMessage,
          },
        });
      }
    },
    [setCharacterSheetPresetFile]
  );

  const ingestQuickSwapDroppedReference = useCallback(
    async (reference: DroppedImageReference, options?: { suppressErrorTelemetry?: boolean }) => {
      try {
        if (pageBusy || quickSwapMutating) return false;
        const file = await toDroppedReferenceFile(reference);
        clearAllMessages();
        const appended = await appendQuickSwapFiles([file]);
        if (!appended) {
          throw new Error("Failed to append dropped media to QuickSwap deck.");
        }
        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.message.trim().length
            ? error.message
            : "Failed to process dropped QuickSwap reference.";
        if (!options?.suppressErrorTelemetry) {
          void reportAppError({
            source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
            scope: "app",
            severity: "low",
            message: "quickswap_drop_reference_failed",
            metadata: {
              target: "quickswap",
              reference_media_file_id: reference.mediaFileId,
              reason: errorMessage,
            },
          });
        }
        return false;
      }
    },
    [appendQuickSwapFiles, clearAllMessages, pageBusy, quickSwapMutating]
  );

  const handleCharacterSheetReferenceDrop = useCallback(
    async (zoneKey: CharacterSheetDropZoneKey, transfer: DataTransfer) => {
      const internalReference = extractInternalReferenceDragPayload(transfer);
      if (internalReference && resolveCharacterDropReference) {
        setPendingDropTarget({
          target: "character_sheet",
          zoneKey,
        });
        try {
          const resolvedReference = await resolveInternalCharacterDrop({
            transfer,
            target: "character_sheet",
            zoneKey,
          });
          if (!resolvedReference) {
            return;
          }
          const resolvedMediaId = resolvedReference.mediaId.trim();
          let previewUrl = resolvedReference.previewUrl?.trim() || null;
          if (!previewUrl && resolvedMediaId) {
            const mediaReference = await resolveMediaReferenceById(resolvedMediaId);
            previewUrl = mediaReference?.previewUrl?.trim() || null;
          }
          if (!previewUrl) {
            void reportAppError({
              source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
              scope: "app",
              severity: "low",
              message: "character_sheet_drop_reference_missing_preview_url",
              metadata: {
                target: "character_sheet",
                drop_zone_key: zoneKey,
                output_id: resolvedReference.outputId ?? null,
                image_index: resolvedReference.imageIndex ?? null,
                media_id: resolvedMediaId || null,
              },
            });
            logCharacterDropBreadcrumb("character_drop_rejected", {
              target: "character_sheet",
              zone_key: zoneKey,
              reason: "missing_preview_url",
              output_id: resolvedReference.outputId ?? null,
              image_index: resolvedReference.imageIndex ?? null,
              media_id: resolvedMediaId || null,
            });
            return;
          }
          await ingestCharacterSheetDroppedReference(zoneKey, {
            url: previewUrl,
            mimeType: null,
            mediaFileId: resolvedMediaId || null,
            storagePath: resolvedReference.storagePath ?? null,
          });
          return;
        } finally {
          setPendingDropTarget((current) =>
            current?.target === "character_sheet" && current.zoneKey === zoneKey ? null : current
          );
        }
      }

      const droppedReference = resolveDroppedImageReference(transfer);
      if (!droppedReference) {
        void reportAppError({
          source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
          scope: "app",
          severity: "low",
          message: "character_sheet_drop_reference_blocked_by_trust_policy",
          metadata: {
            target: "character_sheet",
            drop_zone_key: zoneKey,
            transfer_types: Array.from(transfer.types ?? []),
          },
        });
        return;
      }
      await ingestCharacterSheetDroppedReference(zoneKey, droppedReference);
    },
    [
      ingestCharacterSheetDroppedReference,
      logCharacterDropBreadcrumb,
      resolveCharacterDropReference,
      resolveInternalCharacterDrop,
      resolveMediaReferenceById,
    ]
  );

  const handleQuickSwapReferenceDrop = useCallback(
    async (transfer: DataTransfer) => {
      const internalReference = extractInternalReferenceDragPayload(transfer);
      if (internalReference && resolveCharacterDropReference) {
        setPendingDropTarget({ target: "quickswap" });
        try {
          const resolvedReference = await resolveInternalCharacterDrop({
            transfer,
            target: "quickswap",
          });
          if (!resolvedReference) return;
          const mediaId = resolvedReference.mediaId.trim();
          if (hasQuickSwapMediaFileId(mediaId)) return;
          if (mediaId && appendQuickSwapExistingMediaReference) {
            clearAllMessages();
            const attached = await appendQuickSwapExistingMediaReference(mediaId, {
              suppressError: true,
            });
            if (attached) return;
          }
          let previewUrl = resolvedReference.previewUrl?.trim() || null;
          if (!previewUrl && mediaId) {
            const mediaReference = await resolveMediaReferenceById(mediaId);
            previewUrl = mediaReference?.previewUrl?.trim() || null;
          }
          if (!previewUrl) {
            void reportAppError({
              source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
              scope: "app",
              severity: "low",
              message: "quickswap_drop_reference_missing_preview_url",
              metadata: {
                target: "quickswap",
                media_id: mediaId || null,
                output_id: resolvedReference.outputId ?? null,
                image_index: resolvedReference.imageIndex ?? null,
              },
            });
            logCharacterDropBreadcrumb("character_drop_rejected", {
              target: "quickswap",
              reason: "missing_preview_url",
              media_id: mediaId || null,
              output_id: resolvedReference.outputId ?? null,
              image_index: resolvedReference.imageIndex ?? null,
            });
            return;
          }
          const uploaded = await ingestQuickSwapDroppedReference(
            {
              url: previewUrl,
              mimeType: null,
              mediaFileId: mediaId || null,
              storagePath: resolvedReference.storagePath ?? null,
            },
            {
              suppressErrorTelemetry: true,
            }
          );
          if (uploaded) return;
          void reportAppError({
            source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
            scope: "app",
            severity: "low",
            message: "quickswap_drop_reference_failed_after_internal_resolve",
            metadata: {
              target: "quickswap",
              media_id: mediaId || null,
              output_id: resolvedReference.outputId ?? null,
              image_index: resolvedReference.imageIndex ?? null,
              reason: "quickswap_upload_failed",
            },
          });
          logCharacterDropBreadcrumb("character_drop_rejected", {
            target: "quickswap",
            reason: "quickswap_upload_failed",
            media_id: mediaId || null,
            output_id: resolvedReference.outputId ?? null,
            image_index: resolvedReference.imageIndex ?? null,
          });
          return;
        } finally {
          setPendingDropTarget((current) => (current?.target === "quickswap" ? null : current));
        }
      }

      const droppedReference = resolveDroppedImageReference(transfer);
      if (!droppedReference) {
        void reportAppError({
          source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
          scope: "app",
          severity: "low",
          message: "quickswap_drop_reference_blocked_by_trust_policy",
          metadata: {
            target: "quickswap",
            transfer_types: Array.from(transfer.types ?? []),
          },
        });
        return;
      }
      await ingestQuickSwapDroppedReference(droppedReference);
    },
    [
      appendQuickSwapExistingMediaReference,
      hasQuickSwapMediaFileId,
      ingestQuickSwapDroppedReference,
      logCharacterDropBreadcrumb,
      clearAllMessages,
      resolveCharacterDropReference,
      resolveInternalCharacterDrop,
      resolveMediaReferenceById,
    ]
  );

  return {
    pendingDropTarget,
    isDropResolutionBusy,
    handleCharacterSheetReferenceDrop,
    handleQuickSwapReferenceDrop,
  };
};
