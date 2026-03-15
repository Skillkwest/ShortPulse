/**
 * Reference input and selection state hook for AI Studio.
 * Owns per-tool reference assets, modal wiring, and selection UI state.
 */
import { useCallback, useState } from "react";
import type { ModelModalContext } from "../components/ModelModal";
import type { ToolId } from "../types";

type UseAiStudioReferenceSelectionStateParams = {
  activeOutputPreviewUrl: string | null;
};

/**
 * Returns reference and selection state helpers used by AI Studio orchestration.
 */
export const useAiStudioReferenceSelectionState = ({
  activeOutputPreviewUrl,
}: UseAiStudioReferenceSelectionStateParams) => {
  const [selectedTool, setSelectedTool] = useState<ToolId | null>("create");
  const [showCreateTools, setShowCreateTools] = useState<boolean>(false);
  const [imageReferenceImageUrl, setImageReferenceImageUrlState] = useState<string | null>(null);
  const [imageExtraImageUrls, setImageExtraImageUrls] = useState<
    [string | null, string | null, string | null]
  >([null, null, null]);
  const [videoReferenceImageUrl, setVideoReferenceImageUrl] = useState<string | null>(null);
  const [videoExtraImageUrls, setVideoExtraImageUrls] = useState<
    [string | null, string | null, string | null]
  >([null, null, null]);
  const [motionReferenceVideoUrl, setMotionReferenceVideoUrl] = useState<string | null>(null);
  const [useReferenceImageIndicator, setUseReferenceImageIndicator] = useState<boolean>(false);
  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [modelModalAnchor, setModelModalAnchor] = useState<string | null>(null);
  const [modelModalContext, setModelModalContext] = useState<ModelModalContext | null>(null);

  const isVideoReferenceTool = selectedTool === "video" || selectedTool === "kling";
  const referenceImageUrl = isVideoReferenceTool ? videoReferenceImageUrl : imageReferenceImageUrl;
  const extraImageUrls = isVideoReferenceTool ? videoExtraImageUrls : imageExtraImageUrls;

  const resolveReferenceInputsForTool = useCallback(
    (tool: ToolId | null) => {
      if (tool === "video" || tool === "kling") {
        return {
          referenceImageUrl: videoReferenceImageUrl,
          extraImageUrls: videoExtraImageUrls,
        };
      }
      return {
        referenceImageUrl: imageReferenceImageUrl,
        extraImageUrls: imageExtraImageUrls,
      };
    },
    [imageExtraImageUrls, imageReferenceImageUrl, videoExtraImageUrls, videoReferenceImageUrl]
  );

  const setReferenceImageUrl = useCallback(
    (url: string | null) => {
      if (isVideoReferenceTool) {
        setVideoReferenceImageUrl(url);
        return;
      }
      setImageReferenceImageUrlState(url);
    },
    [isVideoReferenceTool]
  );
  const setImageReferenceImageUrl = useCallback((url: string | null) => {
    setImageReferenceImageUrlState(url);
  }, []);

  const setExtraImageUrl = useCallback(
    (index: number, url: string | null) => {
      if (isVideoReferenceTool) {
        setVideoExtraImageUrls((prev) => {
          const next: [string | null, string | null, string | null] = [...prev];
          next[index] = url;
          return next;
        });
        return;
      }
      setImageExtraImageUrls((prev) => {
        const next: [string | null, string | null, string | null] = [...prev];
        next[index] = url;
        return next;
      });
    },
    [isVideoReferenceTool]
  );

  const clearReferenceImages = useCallback(() => {
    setImageReferenceImageUrlState(null);
    setImageExtraImageUrls([null, null, null]);
    setVideoReferenceImageUrl(null);
    setVideoExtraImageUrls([null, null, null]);
    setMotionReferenceVideoUrl(null);
  }, []);

  const toggleReferenceIndicator = useCallback(() => {
    if (!activeOutputPreviewUrl) return;
    setUseReferenceImageIndicator((prev) => !prev);
  }, [activeOutputPreviewUrl]);

  const openModelModal = useCallback(
    (anchorId: string, _target: HTMLElement, context: ModelModalContext | null = null) => {
      setModelModalAnchor(anchorId);
      setModelModalContext(context);
      setIsModelModalOpen(true);
    },
    []
  );

  const closeModelModal = useCallback(() => {
    setIsModelModalOpen(false);
    setModelModalAnchor(null);
    setModelModalContext(null);
  }, []);

  return {
    selectedTool,
    setSelectedTool,
    showCreateTools,
    setShowCreateTools,
    imageReferenceImageUrl,
    imageExtraImageUrls,
    videoReferenceImageUrl,
    videoExtraImageUrls,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    useReferenceImageIndicator,
    setUseReferenceImageIndicator,
    detailOutputId,
    setDetailOutputId,
    isVideoReferenceTool,
    referenceImageUrl,
    setReferenceImageUrl,
    setImageReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    clearReferenceImages,
    toggleReferenceIndicator,
    resolveReferenceInputsForTool,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    setIsModelModalOpen,
    setModelModalAnchor,
    openModelModal,
    closeModelModal,
  };
};
