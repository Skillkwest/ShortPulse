/**
 * Seedance element-slot interactions for AI Studio reference properties.
 * Handles direct image/video/audio slot ingress while reusing the shared image-drop authority.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import { captureAiStudioDropSnapshot } from "../logic/aiStudioDropSnapshot";
import {
  resolveLipSyncAudioDropSource,
  resolveLipSyncAudioDropSourceFromPayload,
} from "../logic/lipSyncAudioDropSource";
import {
  resolveMotionReferenceVideoDropSource,
  resolveMotionReferenceVideoDropSourceFromPayload,
} from "../logic/motionReferenceVideoDropSource";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import { registerInternalMediaRefForUrl } from "../logic/referenceInputInternalMediaRegistry";
import {
  isAudioDragTransfer,
  isAudioFile,
  isImageDragTransfer,
  isImageFile,
  isVideoDragTransfer,
  isVideoFile,
} from "../utils/dragDrop";
import {
  createUploadedImageInternalMediaRef,
  resolveCanvasTearOutReferenceImageSnapshot,
  type ReferenceImageDropSnapshot,
} from "./referencePropertiesTypes";
import {
  stageProviderImageSelection,
  stageSeedanceAudioSelection,
  stageSeedanceVideoSelection,
} from "./referencePropertiesMediaStaging";

type SeedanceSlotValue = {
  kind: "image" | "video" | "audio";
  url: string;
  name?: string | null;
  durationMs?: number | null;
};

type AcceptImageDropSnapshot = (
  snapshot: ReferenceImageDropSnapshot,
  setter: (url: string | null) => void,
  setLoading: (value: boolean) => void,
  options?: {
    stageForProviderAccess?: boolean;
    setDisplayPreview?: (
      sourceUrl: string | null,
      displayUrl: string | null,
      ownsObjectUrl?: boolean
    ) => void;
  }
) => Promise<void>;

type HandleImageDrop = (
  setter: (url: string | null) => void,
  setLoading: (value: boolean) => void,
  options?: {
    stageForProviderAccess?: boolean;
    setDisplayPreview?: (
      sourceUrl: string | null,
      displayUrl: string | null,
      ownsObjectUrl?: boolean
    ) => void;
  }
) => (event: DragEvent<HTMLDivElement>) => Promise<void>;

type UseReferencePropertiesSeedanceInteractionsArgs = {
  enabled: boolean;
  slotCount: number;
  onSeedanceElementMediaSlotChange?: (slotIndex: number, value: SeedanceSlotValue | null) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveMotionVideoUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceVideoDropSource?: ResolveInternalReferenceDrop;
  acceptImageDropSnapshot: AcceptImageDropSnapshot;
  handleImageDrop: HandleImageDrop;
};

const reconcileBooleanListLength = (values: boolean[], length: number): boolean[] =>
  Array.from({ length }, (_, index) => values[index] ?? false);

/**
 * Returns refs, state, and handlers for Seedance image/video/audio element slots.
 */
export const useReferencePropertiesSeedanceInteractions = ({
  enabled,
  slotCount,
  onSeedanceElementMediaSlotChange,
  resolvePreviewUrlById,
  resolveMotionVideoUrlById,
  resolveInternalReferenceVideoDropSource,
  acceptImageDropSnapshot,
  handleImageDrop,
}: UseReferencePropertiesSeedanceInteractionsArgs) => {
  const seedanceElementImageInputRefsRef = useRef<Array<{ current: HTMLInputElement | null }>>([]);
  while (seedanceElementImageInputRefsRef.current.length < slotCount) {
    seedanceElementImageInputRefsRef.current.push({ current: null });
  }
  const seedanceElementImageInputRefs = seedanceElementImageInputRefsRef.current.slice(
    0,
    slotCount
  );
  const [seedanceElementImageDragActive, setSeedanceElementImageDragActive] = useState<boolean[]>(
    []
  );
  const [seedanceElementImageLoading, setSeedanceElementImageLoading] = useState<boolean[]>([]);

  useEffect(() => {
    setSeedanceElementImageDragActive((prev) => reconcileBooleanListLength(prev, slotCount));
    setSeedanceElementImageLoading((prev) => reconcileBooleanListLength(prev, slotCount));
  }, [slotCount]);

  const setSeedanceElementImageDragActiveAt = (index: number, value: boolean) => {
    setSeedanceElementImageDragActive((prev) =>
      reconcileBooleanListLength(prev, slotCount).map((item, idx) => (idx === index ? value : item))
    );
  };

  const setSeedanceElementImageLoadingAt = (index: number, value: boolean) => {
    setSeedanceElementImageLoading((prev) =>
      reconcileBooleanListLength(prev, slotCount).map((item, idx) => (idx === index ? value : item))
    );
  };

  const acceptSeedanceElementMediaCanvasTearOutPayload = (
    index: number,
    payload: AgentComposerDirectDropPayload
  ) => {
    if (!enabled) return;
    setSeedanceElementImageDragActiveAt(index, false);
    if (!onSeedanceElementMediaSlotChange) return;
    if (payload.kind === "image") {
      const snapshot = resolveCanvasTearOutReferenceImageSnapshot(payload);
      if (!snapshot) return;
      void acceptImageDropSnapshot(
        snapshot,
        (url) => onSeedanceElementMediaSlotChange(index, url ? { kind: "image", url } : null),
        (value) => setSeedanceElementImageLoadingAt(index, value),
        { stageForProviderAccess: true }
      );
      return;
    }
    if (payload.kind === "audio") {
      setSeedanceElementImageLoadingAt(index, true);
      void (async () => {
        try {
          const resolvedAudioSource = await resolveLipSyncAudioDropSourceFromPayload({
            payload,
            resolvePreviewUrlById,
          });
          const stagedAudio =
            resolvedAudioSource?.kind === "durable"
              ? await stageSeedanceAudioSelection({
                  audioUrl: resolvedAudioSource.url,
                  storagePath: resolvedAudioSource.storagePath,
                  name: resolvedAudioSource.title,
                })
              : null;
          if (!stagedAudio) return;
          onSeedanceElementMediaSlotChange(index, {
            kind: "audio",
            url: stagedAudio.url,
            name: stagedAudio.name,
          });
        } catch (error) {
          console.error("AI Studio Seedance audio reference staging failed:", error);
        } finally {
          setSeedanceElementImageLoadingAt(index, false);
        }
      })();
      return;
    }
    if (payload.kind !== "video") return;
    setSeedanceElementImageLoadingAt(index, true);
    void (async () => {
      try {
        const resolvedSource = await resolveMotionReferenceVideoDropSourceFromPayload({
          payload,
          resolveInternalReferenceVideoDropSource,
          resolveMotionVideoUrlById,
          resolvePreviewUrlById,
        });
        if (!resolvedSource) return;
        const stagedVideo =
          resolvedSource.kind === "file"
            ? await stageSeedanceVideoSelection({ videoFile: resolvedSource.videoFile })
            : await stageSeedanceVideoSelection({
                videoUrl: resolvedSource.videoUrl,
                storagePath: resolvedSource.storagePath,
                durationMs: resolvedSource.durationMs,
              });
        if (!stagedVideo) return;
        onSeedanceElementMediaSlotChange(index, {
          kind: "video",
          url: stagedVideo.url,
          name: stagedVideo.name,
          durationMs: stagedVideo.durationMs,
        });
      } catch (error) {
        console.error("AI Studio Seedance video reference staging failed:", error);
      } finally {
        setSeedanceElementImageLoadingAt(index, false);
      }
    })();
  };

  const handleSeedanceElementMediaFileSelection =
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      if (!enabled) return;
      const file = event.target.files?.[0];
      if (!file) return;
      const isImage = isImageFile(file);
      const isVideo = isVideoFile(file);
      const isAudio = isAudioFile(file);
      const fileName = file.name;
      if (!isImage && !isVideo && !isAudio) {
        event.target.value = "";
        return;
      }
      setSeedanceElementImageLoadingAt(index, true);
      void (async () => {
        try {
          if (isImage) {
            const stagedImage = await stageProviderImageSelection({ imageFile: file });
            if (!stagedImage) return;
            registerInternalMediaRefForUrl(
              stagedImage.url,
              createUploadedImageInternalMediaRef(stagedImage)
            );
            onSeedanceElementMediaSlotChange?.(index, {
              kind: "image",
              url: stagedImage.url,
              name: fileName,
            });
            return;
          }
          if (isAudio) {
            const stagedAudio = await stageSeedanceAudioSelection({ audioFile: file });
            if (!stagedAudio) return;
            onSeedanceElementMediaSlotChange?.(index, {
              kind: "audio",
              url: stagedAudio.url,
              name: stagedAudio.name ?? fileName,
            });
            return;
          }
          const stagedVideo = await stageSeedanceVideoSelection({ videoFile: file });
          if (!stagedVideo) return;
          onSeedanceElementMediaSlotChange?.(index, {
            kind: "video",
            url: stagedVideo.url,
            name: stagedVideo.name ?? fileName,
            durationMs: stagedVideo.durationMs,
          });
        } catch (error) {
          console.error("AI Studio Seedance media reference staging failed:", error);
        } finally {
          setSeedanceElementImageLoadingAt(index, false);
        }
      })();
      event.target.value = "";
    };

  const handleSeedanceElementMediaDrop = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    if (!enabled) return;
    setSeedanceElementImageDragActiveAt(index, false);
    if (!onSeedanceElementMediaSlotChange) return;
    if (isImageDragTransfer(event.dataTransfer)) {
      return handleImageDrop(
        (url) => onSeedanceElementMediaSlotChange(index, url ? { kind: "image", url } : null),
        (value) => setSeedanceElementImageLoadingAt(index, value),
        { stageForProviderAccess: true }
      )(event);
    }
    if (!isVideoDragTransfer(event.dataTransfer) && !isAudioDragTransfer(event.dataTransfer))
      return;
    event.preventDefault();
    event.stopPropagation();
    const snapshot = captureAiStudioDropSnapshot(event.dataTransfer);
    setSeedanceElementImageLoadingAt(index, true);
    void (async () => {
      try {
        const resolvedSource = await resolveMotionReferenceVideoDropSource({
          snapshot,
          resolveInternalReferenceVideoDropSource,
          resolveMotionVideoUrlById,
          resolvePreviewUrlById,
        });
        if (resolvedSource) {
          const stagedVideo =
            resolvedSource.kind === "file"
              ? await stageSeedanceVideoSelection({ videoFile: resolvedSource.videoFile })
              : await stageSeedanceVideoSelection({
                  videoUrl: resolvedSource.videoUrl,
                  storagePath: resolvedSource.storagePath,
                  durationMs: resolvedSource.durationMs,
                });
          if (stagedVideo) {
            onSeedanceElementMediaSlotChange(index, {
              kind: "video",
              url: stagedVideo.url,
              name: stagedVideo.name,
              durationMs: stagedVideo.durationMs,
            });
            return;
          }
        }
        const resolvedAudioSource = await resolveLipSyncAudioDropSource({
          snapshot,
          resolvePreviewUrlById,
        });
        const stagedAudio =
          resolvedAudioSource?.kind === "file"
            ? await stageSeedanceAudioSelection({ audioFile: resolvedAudioSource.audioFile })
            : resolvedAudioSource?.kind === "durable"
              ? await stageSeedanceAudioSelection({
                  audioUrl: resolvedAudioSource.url,
                  storagePath: resolvedAudioSource.storagePath,
                  name: resolvedAudioSource.title,
                })
              : null;
        if (!stagedAudio) return;
        onSeedanceElementMediaSlotChange(index, {
          kind: "audio",
          url: stagedAudio.url,
          name: stagedAudio.name,
        });
      } catch (error) {
        console.error("AI Studio Seedance media reference drop failed:", error);
      } finally {
        setSeedanceElementImageLoadingAt(index, false);
      }
    })();
  };

  const allowMediaDrag = (event: DragEvent<HTMLDivElement>) => {
    if (
      isImageDragTransfer(event.dataTransfer) ||
      isVideoDragTransfer(event.dataTransfer) ||
      isAudioDragTransfer(event.dataTransfer)
    ) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handleSeedanceElementMediaDragEnter =
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (allowMediaDrag(event)) {
        setSeedanceElementImageDragActiveAt(index, true);
      }
    };

  const handleSeedanceElementMediaDragOver =
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (allowMediaDrag(event)) {
        setSeedanceElementImageDragActiveAt(index, true);
      }
    };

  const handleSeedanceElementMediaDragLeave = (index: number) => () => {
    if (!enabled) return;
    setSeedanceElementImageDragActiveAt(index, false);
  };

  return {
    seedanceElementImageInputRefs,
    seedanceElementImageDragActive,
    seedanceElementImageLoading,
    setSeedanceElementImageDragActiveAt,
    handleSeedanceElementMediaFileSelection,
    handleSeedanceElementMediaDrop,
    handleSeedanceElementMediaDragEnter,
    handleSeedanceElementMediaDragOver,
    handleSeedanceElementMediaDragLeave,
    acceptSeedanceElementMediaCanvasTearOutPayload,
  };
};
