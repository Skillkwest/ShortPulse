/**
 * Reference input and selection state hook for AI Studio.
 * Owns per-tool reference assets, modal wiring, and selection UI state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelModalContext } from "../components/ModelModal";
import type { ToolId } from "../types";

type UseAiStudioReferenceSelectionStateParams = {
  activeOutputPreviewUrl: string | null;
  authorityKey?: string;
};

type ReferenceSelectionAuthorityState = {
  selectedTool: ToolId | null;
  showCreateTools: boolean;
  imageReferenceImageUrl: string | null;
  imageExtraImageUrls: [string | null, string | null, string | null];
  videoReferenceImageUrl: string | null;
  videoExtraImageUrls: [string | null, string | null, string | null];
  motionReferenceVideoUrl: string | null;
  useReferenceImageIndicator: boolean;
  detailOutputId: string | null;
};

const createEmptyReferenceSelectionAuthorityState = (): ReferenceSelectionAuthorityState => ({
  selectedTool: "create",
  showCreateTools: false,
  imageReferenceImageUrl: null,
  imageExtraImageUrls: [null, null, null],
  videoReferenceImageUrl: null,
  videoExtraImageUrls: [null, null, null],
  motionReferenceVideoUrl: null,
  useReferenceImageIndicator: false,
  detailOutputId: null,
});

/**
 * Returns reference and selection state helpers used by AI Studio orchestration.
 */
export const useAiStudioReferenceSelectionState = ({
  activeOutputPreviewUrl,
  authorityKey = "session:pending",
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
  const activeAuthorityKeyRef = useRef(authorityKey);
  const stateByAuthorityKeyRef = useRef<Record<string, ReferenceSelectionAuthorityState>>({});

  useEffect(() => {
    if (activeAuthorityKeyRef.current === authorityKey) return;
    stateByAuthorityKeyRef.current[activeAuthorityKeyRef.current] = {
      selectedTool,
      showCreateTools,
      imageReferenceImageUrl,
      imageExtraImageUrls,
      videoReferenceImageUrl,
      videoExtraImageUrls,
      motionReferenceVideoUrl,
      useReferenceImageIndicator,
      detailOutputId,
    };
    activeAuthorityKeyRef.current = authorityKey;
    const restoredState =
      stateByAuthorityKeyRef.current[authorityKey] ?? createEmptyReferenceSelectionAuthorityState();
    /* eslint-disable react-hooks/set-state-in-effect -- authority switches intentionally restore the reference-input lane for the newly active mode. */
    setSelectedTool(restoredState.selectedTool);
    setShowCreateTools(restoredState.showCreateTools);
    setImageReferenceImageUrlState(restoredState.imageReferenceImageUrl);
    setImageExtraImageUrls(restoredState.imageExtraImageUrls);
    setVideoReferenceImageUrl(restoredState.videoReferenceImageUrl);
    setVideoExtraImageUrls(restoredState.videoExtraImageUrls);
    setMotionReferenceVideoUrl(restoredState.motionReferenceVideoUrl);
    setUseReferenceImageIndicator(restoredState.useReferenceImageIndicator);
    setDetailOutputId(restoredState.detailOutputId);
    setIsModelModalOpen(false);
    setModelModalAnchor(null);
    setModelModalContext(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    authorityKey,
    detailOutputId,
    imageExtraImageUrls,
    imageReferenceImageUrl,
    motionReferenceVideoUrl,
    selectedTool,
    showCreateTools,
    useReferenceImageIndicator,
    videoExtraImageUrls,
    videoReferenceImageUrl,
  ]);

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
  const setVideoReferenceImageUrlForPanel = useCallback((url: string | null) => {
    setVideoReferenceImageUrl(url);
  }, []);

  const setImageExtraImageUrl = useCallback((index: number, url: string | null) => {
    setImageExtraImageUrls((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = url;
      return next;
    });
  }, []);

  const setVideoExtraImageUrl = useCallback((index: number, url: string | null) => {
    setVideoExtraImageUrls((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = url;
      return next;
    });
  }, []);

  const setExtraImageUrl = useCallback(
    (index: number, url: string | null) => {
      if (isVideoReferenceTool) {
        setVideoExtraImageUrl(index, url);
        return;
      }
      setImageExtraImageUrl(index, url);
    },
    [isVideoReferenceTool, setImageExtraImageUrl, setVideoExtraImageUrl]
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
    setVideoReferenceImageUrl: setVideoReferenceImageUrlForPanel,
    extraImageUrls,
    setExtraImageUrl,
    setImageExtraImageUrl,
    setVideoExtraImageUrl,
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
