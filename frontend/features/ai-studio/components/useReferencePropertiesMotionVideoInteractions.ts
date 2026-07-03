/**
 * Motion Control video-slot interactions for AI Studio reference properties.
 * Keeps Motion-specific drop and staging behavior out of the shared image hook facade.
 */
import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import { captureAiStudioDropSnapshot } from "../logic/aiStudioDropSnapshot";
import {
  resolveMotionReferenceVideoDropSource,
  resolveMotionReferenceVideoDropSourceFromPayload,
} from "../logic/motionReferenceVideoDropSource";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import { isVideoDragTransfer, isVideoFile } from "../utils/dragDrop";

type UseReferencePropertiesMotionVideoInteractionsArgs = {
  enabled: boolean;
  onMotionVideoChange?: (url: string | null) => void;
  onStageMotionVideoSelection?: (input: {
    videoFile?: File | null;
    videoUrl?: string | null;
  }) => Promise<void>;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveMotionVideoUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceVideoDropSource?: ResolveInternalReferenceDrop;
};

/**
 * Returns refs, state, and handlers for the Motion Control motion-video slot.
 */
export const useReferencePropertiesMotionVideoInteractions = ({
  enabled,
  onMotionVideoChange,
  onStageMotionVideoSelection,
  resolvePreviewUrlById,
  resolveMotionVideoUrlById,
  resolveInternalReferenceVideoDropSource,
}: UseReferencePropertiesMotionVideoInteractionsArgs) => {
  const motionVideoInputRef = useRef<HTMLInputElement | null>(null);
  const [motionVideoDragActive, setMotionVideoDragActive] = useState(false);

  const commitMotionVideoUrl = useCallback(
    (url: string | null) => {
      onMotionVideoChange?.(url);
    },
    [onMotionVideoChange]
  );

  const acceptMotionVideoCanvasTearOutPayload = useCallback(
    async (payload: AgentComposerDirectDropPayload) => {
      if (!enabled) return;
      if (payload.kind !== "video") return;
      setMotionVideoDragActive(false);
      const resolvedSource = await resolveMotionReferenceVideoDropSourceFromPayload({
        payload,
        resolveInternalReferenceVideoDropSource,
        resolveMotionVideoUrlById,
        resolvePreviewUrlById,
      });
      if (!resolvedSource || resolvedSource.kind !== "url") return;
      if (onStageMotionVideoSelection) {
        await onStageMotionVideoSelection({ videoUrl: resolvedSource.videoUrl });
        return;
      }
      commitMotionVideoUrl(resolvedSource.videoUrl);
    },
    [
      commitMotionVideoUrl,
      enabled,
      onStageMotionVideoSelection,
      resolveInternalReferenceVideoDropSource,
      resolveMotionVideoUrlById,
      resolvePreviewUrlById,
    ]
  );

  const allowVideoDrag = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!enabled) return false;
      if (isVideoDragTransfer(event.dataTransfer)) {
        event.preventDefault();
        return true;
      }
      return false;
    },
    [enabled]
  );

  const handleMotionVideoDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      setMotionVideoDragActive(false);
      const snapshot = captureAiStudioDropSnapshot(event.dataTransfer);

      const resolvedSource = await resolveMotionReferenceVideoDropSource({
        snapshot,
        resolveInternalReferenceVideoDropSource,
        resolveMotionVideoUrlById,
        resolvePreviewUrlById,
      });
      if (!resolvedSource) return;

      if (resolvedSource.kind === "file") {
        await onStageMotionVideoSelection?.({ videoFile: resolvedSource.videoFile });
        return;
      }

      if (onStageMotionVideoSelection) {
        await onStageMotionVideoSelection({ videoUrl: resolvedSource.videoUrl });
        return;
      }

      commitMotionVideoUrl(resolvedSource.videoUrl);
    },
    [
      commitMotionVideoUrl,
      enabled,
      onStageMotionVideoSelection,
      resolveInternalReferenceVideoDropSource,
      resolveMotionVideoUrlById,
      resolvePreviewUrlById,
    ]
  );

  const handleMotionVideoSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!enabled) return;
      const file = event.target.files?.[0];
      if (isVideoFile(file)) {
        await onStageMotionVideoSelection?.({ videoFile: file });
      }
      event.target.value = "";
    },
    [enabled, onStageMotionVideoSelection]
  );

  return {
    motionVideoInputRef,
    motionVideoDragActive,
    setMotionVideoDragActive,
    acceptMotionVideoCanvasTearOutPayload,
    allowVideoDrag,
    handleMotionVideoDrop,
    handleMotionVideoSelection,
  };
};
