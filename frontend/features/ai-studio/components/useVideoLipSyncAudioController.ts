/**
 * Owns Lip Sync audio upload, drop, and playback controller state for Video properties.
 */
import React from "react";
import type { LipSyncAudioState } from "../types";
import { captureAiStudioDropSnapshot } from "../logic/aiStudioDropSnapshot";
import { resolveLipSyncAudioDropSource } from "../logic/lipSyncAudioDropSource";
import { uploadAudioBlobToStorage } from "../utils/audioUpload";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import {
  createEmptyLipSyncAudioState,
  createFailedLipSyncAudioState,
  createFailedNonDurableLipSyncAudioState,
  createLipSyncAudioStateFromDurableUrl,
  createReadyLipSyncAudioState,
  createUploadingLipSyncAudioState,
  getLipSyncAudioPlaybackUrl,
  resolveLipSyncAudioDurableSource,
} from "../logic/lipSyncAudioState";

const resolveDurableLipSyncDropAudioUrl = (
  payload: Extract<AgentComposerDirectDropPayload, { kind: "audio" }>
): { url: string | null; storagePath: string | null } => {
  const internalPayload = payload.internalPayload;
  return resolveLipSyncAudioDurableSource({
    urlCandidates: [
      internalPayload?.referenceUrl,
      internalPayload?.referenceRenderUrl,
      payload.audioUrl,
    ],
    storagePathCandidates: [
      internalPayload?.fullStoragePath,
      payload.audioStoragePath,
      internalPayload?.previewStoragePath,
    ],
  });
};

type UseVideoLipSyncAudioControllerArgs = {
  lipSyncAudio: LipSyncAudioState;
  onLipSyncAudioChange?: (value: LipSyncAudioState) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
};

/**
 * Returns the existing Lip Sync audio event handlers and refs without owning markup.
 */
export const useVideoLipSyncAudioController = ({
  lipSyncAudio,
  onLipSyncAudioChange,
  resolvePreviewUrlById,
}: UseVideoLipSyncAudioControllerArgs) => {
  const lipSyncAudioInputRef = React.useRef<HTMLInputElement | null>(null);
  const lipSyncAudioDropzoneRef = React.useRef<HTMLDivElement | null>(null);
  const [lipSyncAudioDragActive, setLipSyncAudioDragActive] = React.useState(false);
  const [lipSyncAudioCanvasTearOutActive, setLipSyncAudioCanvasTearOutActive] =
    React.useState(false);
  const lipSyncAudioUploadRevisionRef = React.useRef(0);
  const lipSyncAudioObjectUrlsRef = React.useRef<Set<string>>(new Set());

  const applyLipSyncAudio = React.useCallback(
    (value: LipSyncAudioState) => {
      onLipSyncAudioChange?.(value);
    },
    [onLipSyncAudioChange]
  );

  React.useEffect(
    () => () => {
      lipSyncAudioObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      lipSyncAudioObjectUrlsRef.current.clear();
    },
    []
  );

  const readLipSyncAudioDuration = React.useCallback((audioUrl: string): Promise<number | null> => {
    if (typeof Audio === "undefined") return Promise.resolve(null);
    return new Promise((resolve) => {
      const audio = new Audio();
      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
      };
      audio.onloadedmetadata = () => {
        const durationMs = Number.isFinite(audio.duration)
          ? Math.max(0, Math.round(audio.duration * 1000))
          : null;
        cleanup();
        resolve(durationMs);
      };
      audio.onerror = () => {
        cleanup();
        resolve(null);
      };
      audio.src = audioUrl.replace(/#.*$/, "");
    });
  }, []);

  const handleLipSyncAudioFile = React.useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const uploadRevision = lipSyncAudioUploadRevisionRef.current + 1;
      lipSyncAudioUploadRevisionRef.current = uploadRevision;
      const objectUrl = URL.createObjectURL(file);
      lipSyncAudioObjectUrlsRef.current.add(objectUrl);
      const previewUrl = objectUrl + "#audio=1";
      const durationMs = await readLipSyncAudioDuration(previewUrl);
      applyLipSyncAudio(
        createUploadingLipSyncAudioState({
          durationMs,
          previewUrl,
          title: file.name,
          mimeType: file.type || null,
          size: file.size,
        })
      );
      try {
        const uploaded = await uploadAudioBlobToStorage(file, {
          sourceName: file.name,
          mimeType: file.type,
        });
        if (lipSyncAudioUploadRevisionRef.current !== uploadRevision) return;
        applyLipSyncAudio(
          createReadyLipSyncAudioState({
            url: uploaded.url,
            title: file.name,
            durationMs,
            sourceKind: "local",
            storagePath: uploaded.path,
            previewUrl,
            mimeType: uploaded.mimeType ?? file.type ?? null,
            size: uploaded.size,
          })
        );
      } catch (error) {
        if (lipSyncAudioUploadRevisionRef.current !== uploadRevision) return;
        applyLipSyncAudio(
          createFailedLipSyncAudioState({
            durationMs,
            previewUrl,
            title: file.name,
            error:
              error instanceof Error
                ? error.message
                : "Voice audio upload failed. Re-add the audio file and try again.",
            mimeType: file.type || null,
            size: file.size,
          })
        );
      }
    },
    [applyLipSyncAudio, readLipSyncAudioDuration]
  );

  const handleLipSyncAudioSelection = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      void handleLipSyncAudioFile(event.target.files?.[0]);
      event.target.value = "";
    },
    [handleLipSyncAudioFile]
  );

  const handleLipSyncAudioDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setLipSyncAudioDragActive(false);
      const snapshot = captureAiStudioDropSnapshot(event.dataTransfer);
      const resolvedSource = await resolveLipSyncAudioDropSource({
        snapshot,
        resolvePreviewUrlById,
      });
      if (resolvedSource?.kind === "durable") {
        applyLipSyncAudio(
          createLipSyncAudioStateFromDurableUrl({
            url: resolvedSource.url,
            title: resolvedSource.title,
            durationMs: resolvedSource.durationMs,
            sourceKind: resolvedSource.sourceKind,
            storagePath: resolvedSource.storagePath,
          })
        );
        return;
      }
      if (resolvedSource?.kind === "file") {
        void handleLipSyncAudioFile(resolvedSource.audioFile);
        return;
      }
    },
    [applyLipSyncAudio, handleLipSyncAudioFile, resolvePreviewUrlById]
  );

  const canAcceptLipSyncAudioCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => payload.kind === "audio",
    []
  );

  const acceptLipSyncAudioCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (payload.kind !== "audio") return;
      setLipSyncAudioDragActive(false);
      const resolvedAudio = resolveDurableLipSyncDropAudioUrl(payload);
      applyLipSyncAudio(
        resolvedAudio.url || resolvedAudio.storagePath
          ? createLipSyncAudioStateFromDurableUrl({
              url: resolvedAudio.url,
              durationMs: payload.durationMs ?? null,
              sourceKind: "canvas",
              storagePath: resolvedAudio.storagePath,
            })
          : createFailedNonDurableLipSyncAudioState(payload.audioUrl)
      );
    },
    [applyLipSyncAudio]
  );

  const clearLipSyncAudio = React.useCallback(() => {
    lipSyncAudioUploadRevisionRef.current += 1;
    applyLipSyncAudio(createEmptyLipSyncAudioState());
  }, [applyLipSyncAudio]);

  return {
    lipSyncAudioInputRef,
    lipSyncAudioDropzoneRef,
    lipSyncAudioDragActive,
    setLipSyncAudioDragActive,
    lipSyncAudioCanvasTearOutActive,
    setLipSyncAudioCanvasTearOutActive,
    handleLipSyncAudioSelection,
    handleLipSyncAudioDrop,
    canAcceptLipSyncAudioCanvasTearOutPayload,
    acceptLipSyncAudioCanvasTearOutPayload,
    clearLipSyncAudio,
    lipSyncAudioPlaybackUrl: getLipSyncAudioPlaybackUrl(lipSyncAudio),
  };
};
