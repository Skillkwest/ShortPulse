/**
 * Reference input and selection state hook for AI Studio.
 * Owns per-tool reference assets, modal wiring, and selection UI state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelModalContext } from "../components/ModelModal";
import {
  INTERNAL_MEDIA_REF_BUCKET,
  resolveInternalMediaRefStoragePath,
  type InternalMediaRef,
} from "../../../lib/media/internalMediaRefs";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import type { ToolId } from "../types";
import {
  deleteUploadedMotionVideoByPath,
  needsMotionReferenceVideoProviderNormalization,
  retireCommittedMotionVideoByUrl,
  needsVideoUpload,
  prepareMotionReferenceVideoUrl,
  uploadVideoAssetToStorage,
  uploadVideoFileToStorage,
} from "../utils/videoUpload";
import {
  isCreateModeAuthoritySwitch,
  isPulseCreateAuthorityKey,
  normalizeSelectedToolForAuthorityKey,
} from "../logic/pulseToolInvariant";
import { resolveInternalMediaRefsForUrls } from "../logic/referenceInputInternalMediaRegistry";
import type { SharedMediaDetailSelectionTarget } from "../components/detail-modal/detailModalPlatformTypes";
import {
  createEmptyExpertEditSecondaryImageUrls,
  normalizeExpertEditSecondaryImageUrls,
} from "../logic/expertEditReferenceSlots";
import { loadVideoPreviewMetadata } from "../logic/videoPreviewMetadata";
import { resolveMotionReferenceVideoDurationError } from "../logic/motionReferenceVideoDuration";

type UseAiStudioReferenceSelectionStateParams = {
  activeOutputPreviewUrl: string | null;
  authorityKey?: string;
};

type ReferenceSelectionAuthorityState = {
  selectedTool: ToolId | null;
  showCreateTools: boolean;
  imageReferenceImageUrl: string | null;
  imageExtraImageUrls: (string | null)[];
  imageReferenceImageInternalMediaRefs: Array<InternalMediaRef | null>;
  videoReferenceImageUrl: string | null;
  videoExtraImageUrls: [string | null, string | null, string | null];
  videoReferenceImageInternalMediaRefs: Array<InternalMediaRef | null>;
  motionReferenceVideoUrl: string | null;
  useReferenceImageIndicator: boolean;
  detailOutputId: string | null;
  detailSelectionTarget: SharedMediaDetailSelectionTarget | null;
};

type MotionReferenceUploadUiState = {
  pending: boolean;
  error: string | null;
  requestId: number;
};

export type ReferenceSelectionAuthorityStateSeed = {
  selectedTool: ToolId | null;
  showCreateTools?: boolean;
  referenceImageUrl: string | null;
  extraImageUrls: readonly (string | null)[];
  referenceImageInternalMediaRefs?: Array<InternalMediaRef | null>;
  motionReferenceVideoUrl: string | null;
  useReferenceImageIndicator?: boolean;
  detailOutputId?: string | null;
  detailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
};

const createDetailSelectionTargetFromOutputId = (
  outputId: string | null | undefined
): SharedMediaDetailSelectionTarget | null => {
  const normalizedOutputId = outputId?.trim() ?? "";
  if (!normalizedOutputId) return null;
  return {
    kind: "studio-output",
    outputId: normalizedOutputId,
    surface: "reference-grid",
  };
};

const stripRuntimeDetailSelectionSnapshot = (
  target: SharedMediaDetailSelectionTarget | null | undefined
): SharedMediaDetailSelectionTarget | null => {
  if (!target) return null;
  if (target.kind === "slot-reference") return null;
  if (target.kind !== "studio-output") return target;
  return {
    kind: "studio-output",
    outputId: target.outputId,
    surface: target.surface,
  };
};

const createEmptyReferenceSelectionAuthorityState = (): ReferenceSelectionAuthorityState => ({
  selectedTool: "create",
  showCreateTools: false,
  imageReferenceImageUrl: null,
  imageExtraImageUrls: createEmptyExpertEditSecondaryImageUrls(),
  imageReferenceImageInternalMediaRefs: [],
  videoReferenceImageUrl: null,
  videoExtraImageUrls: [null, null, null],
  videoReferenceImageInternalMediaRefs: [],
  motionReferenceVideoUrl: null,
  useReferenceImageIndicator: false,
  detailOutputId: null,
  detailSelectionTarget: null,
});

const createEmptyMotionReferenceUploadUiState = (): MotionReferenceUploadUiState => ({
  pending: false,
  error: null,
  requestId: 0,
});

const MOTION_REFERENCE_DURATION_PROBE_TIMEOUT_MS = 5_000;

const normalizeVideoExtraImageUrls = (
  values: readonly (string | null)[]
): [string | null, string | null, string | null] => [
  values[0] ?? null,
  values[1] ?? null,
  values[2] ?? null,
];

const withMotionReferenceDurationProbeTimeout = async (
  videoUrl: string
): Promise<number | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), MOTION_REFERENCE_DURATION_PROBE_TIMEOUT_MS);
    });
    const preview = await Promise.race([
      loadVideoPreviewMetadata(videoUrl, {
        loadTimeoutMs: MOTION_REFERENCE_DURATION_PROBE_TIMEOUT_MS,
      }).then((metadata) => metadata.durationMs),
      timeoutPromise,
    ]);
    return preview;
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const readMotionReferenceDurationMs = async ({
  videoFile,
  videoUrl,
}: {
  videoFile?: File | null;
  videoUrl?: string | null;
}): Promise<number | null> => {
  let probeUrl = videoUrl?.trim() ?? "";
  let shouldRevokeProbeUrl = false;
  if (videoFile && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    probeUrl = URL.createObjectURL(videoFile);
    shouldRevokeProbeUrl = true;
  }
  if (!probeUrl) return null;
  try {
    return await withMotionReferenceDurationProbeTimeout(probeUrl);
  } finally {
    if (shouldRevokeProbeUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(probeUrl);
    }
  }
};

const assertMotionReferenceDuration = async (input: {
  videoFile?: File | null;
  videoUrl?: string | null;
}): Promise<void> => {
  const durationMs = await readMotionReferenceDurationMs(input);
  const durationError = resolveMotionReferenceVideoDurationError(durationMs);
  if (durationError) {
    throw new Error(durationError);
  }
};

const buildReferenceSelectionAuthorityStateFromSeed = ({
  selectedTool,
  showCreateTools = false,
  referenceImageUrl,
  extraImageUrls,
  referenceImageInternalMediaRefs,
  motionReferenceVideoUrl,
  useReferenceImageIndicator = false,
  detailOutputId = null,
  detailSelectionTarget,
}: ReferenceSelectionAuthorityStateSeed): ReferenceSelectionAuthorityState => {
  const isVideoReferenceTool = selectedTool === "video" || selectedTool === "kling";
  const resolvedInternalMediaRefs =
    referenceImageInternalMediaRefs ??
    resolveInternalMediaRefsForUrls(
      [referenceImageUrl, ...extraImageUrls],
      isVideoReferenceTool ? 4 : 11
    );
  const resolvedDetailSelectionTarget =
    stripRuntimeDetailSelectionSnapshot(detailSelectionTarget) ??
    createDetailSelectionTargetFromOutputId(detailOutputId);
  const resolvedDetailOutputId =
    resolvedDetailSelectionTarget?.kind === "studio-output"
      ? resolvedDetailSelectionTarget.outputId
      : null;
  return {
    selectedTool,
    showCreateTools,
    imageReferenceImageUrl: isVideoReferenceTool ? null : referenceImageUrl,
    imageExtraImageUrls: isVideoReferenceTool
      ? createEmptyExpertEditSecondaryImageUrls()
      : normalizeExpertEditSecondaryImageUrls(extraImageUrls),
    imageReferenceImageInternalMediaRefs: isVideoReferenceTool ? [] : resolvedInternalMediaRefs,
    videoReferenceImageUrl: isVideoReferenceTool ? referenceImageUrl : null,
    videoExtraImageUrls: isVideoReferenceTool
      ? normalizeVideoExtraImageUrls(extraImageUrls)
      : [null, null, null],
    videoReferenceImageInternalMediaRefs: isVideoReferenceTool ? resolvedInternalMediaRefs : [],
    motionReferenceVideoUrl,
    useReferenceImageIndicator,
    detailOutputId: resolvedDetailOutputId,
    detailSelectionTarget: resolvedDetailSelectionTarget,
  };
};

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
  const [imageExtraImageUrls, setImageExtraImageUrls] = useState<(string | null)[]>(
    createEmptyExpertEditSecondaryImageUrls
  );
  const [videoReferenceImageUrl, setVideoReferenceImageUrl] = useState<string | null>(null);
  const [videoExtraImageUrls, setVideoExtraImageUrls] = useState<
    [string | null, string | null, string | null]
  >([null, null, null]);
  const [motionReferenceVideoUrl, setMotionReferenceVideoUrlState] = useState<string | null>(null);
  const [motionReferenceVideoPending, setMotionReferenceVideoPending] = useState(false);
  const [motionReferenceVideoError, setMotionReferenceVideoError] = useState<string | null>(null);
  const [useReferenceImageIndicator, setUseReferenceImageIndicator] = useState<boolean>(false);
  const [detailSelectionTarget, setDetailSelectionTargetState] =
    useState<SharedMediaDetailSelectionTarget | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [modelModalAnchor, setModelModalAnchor] = useState<string | null>(null);
  const [modelModalContext, setModelModalContext] = useState<ModelModalContext | null>(null);
  const activeAuthorityKeyRef = useRef(authorityKey);
  const stateByAuthorityKeyRef = useRef<Record<string, ReferenceSelectionAuthorityState>>({});
  const motionReferenceUploadUiStateByAuthorityKeyRef = useRef<
    Record<string, MotionReferenceUploadUiState>
  >({});

  const getMotionReferenceUploadUiStateForAuthority = useCallback((targetAuthorityKey: string) => {
    return (
      motionReferenceUploadUiStateByAuthorityKeyRef.current[targetAuthorityKey] ??
      createEmptyMotionReferenceUploadUiState()
    );
  }, []);

  const setMotionReferenceUploadUiStateForAuthority = useCallback(
    (targetAuthorityKey: string, nextState: MotionReferenceUploadUiState) => {
      motionReferenceUploadUiStateByAuthorityKeyRef.current[targetAuthorityKey] = nextState;
      if (activeAuthorityKeyRef.current !== targetAuthorityKey) return;
      setMotionReferenceVideoPending(nextState.pending);
      setMotionReferenceVideoError(nextState.error);
    },
    []
  );

  const updateMotionReferenceUploadUiStateForAuthority = useCallback(
    (
      targetAuthorityKey: string,
      updater:
        | MotionReferenceUploadUiState
        | ((current: MotionReferenceUploadUiState) => MotionReferenceUploadUiState)
    ) => {
      const current = getMotionReferenceUploadUiStateForAuthority(targetAuthorityKey);
      const nextState = typeof updater === "function" ? updater(current) : updater;
      setMotionReferenceUploadUiStateForAuthority(targetAuthorityKey, nextState);
    },
    [getMotionReferenceUploadUiStateForAuthority, setMotionReferenceUploadUiStateForAuthority]
  );

  useEffect(() => {
    if (activeAuthorityKeyRef.current === authorityKey) return;
    const previousAuthorityKey = activeAuthorityKeyRef.current;
    const currentImageInternalMediaRefs = resolveInternalMediaRefsForUrls(
      [imageReferenceImageUrl, ...imageExtraImageUrls],
      11
    );
    const currentVideoInternalMediaRefs = resolveInternalMediaRefsForUrls(
      [videoReferenceImageUrl, ...videoExtraImageUrls],
      4
    );
    stateByAuthorityKeyRef.current[previousAuthorityKey] = {
      selectedTool: normalizeSelectedToolForAuthorityKey(previousAuthorityKey, selectedTool),
      showCreateTools,
      imageReferenceImageUrl,
      imageExtraImageUrls,
      imageReferenceImageInternalMediaRefs: currentImageInternalMediaRefs,
      videoReferenceImageUrl,
      videoExtraImageUrls,
      videoReferenceImageInternalMediaRefs: currentVideoInternalMediaRefs,
      motionReferenceVideoUrl,
      useReferenceImageIndicator,
      detailOutputId:
        detailSelectionTarget?.kind === "studio-output" ? detailSelectionTarget.outputId : null,
      detailSelectionTarget: stripRuntimeDetailSelectionSnapshot(detailSelectionTarget),
    };
    updateMotionReferenceUploadUiStateForAuthority(previousAuthorityKey, (current) => ({
      ...current,
      pending: motionReferenceVideoPending,
      error: motionReferenceVideoError,
    }));
    activeAuthorityKeyRef.current = authorityKey;
    const restoredState =
      stateByAuthorityKeyRef.current[authorityKey] ?? createEmptyReferenceSelectionAuthorityState();
    const restoredMotionReferenceUploadUiState =
      getMotionReferenceUploadUiStateForAuthority(authorityKey);
    const normalizedRestoredSelectedTool = normalizeSelectedToolForAuthorityKey(
      authorityKey,
      restoredState.selectedTool
    );
    const shouldPreserveCurrentTool =
      !isPulseCreateAuthorityKey(authorityKey) &&
      isCreateModeAuthoritySwitch(previousAuthorityKey, authorityKey) &&
      selectedTool != null &&
      selectedTool !== "create";
    setSelectedTool(shouldPreserveCurrentTool ? selectedTool : normalizedRestoredSelectedTool);
    setShowCreateTools(restoredState.showCreateTools);
    setImageReferenceImageUrlState(restoredState.imageReferenceImageUrl);
    setImageExtraImageUrls(
      normalizeExpertEditSecondaryImageUrls(restoredState.imageExtraImageUrls)
    );
    setVideoReferenceImageUrl(restoredState.videoReferenceImageUrl);
    setVideoExtraImageUrls(restoredState.videoExtraImageUrls);
    setMotionReferenceVideoUrlState(restoredState.motionReferenceVideoUrl);
    setMotionReferenceVideoPending(restoredMotionReferenceUploadUiState.pending);
    setMotionReferenceVideoError(restoredMotionReferenceUploadUiState.error);
    setUseReferenceImageIndicator(restoredState.useReferenceImageIndicator);
    setDetailSelectionTargetState(restoredState.detailSelectionTarget);
    setIsModelModalOpen(false);
    setModelModalAnchor(null);
    setModelModalContext(null);
  }, [
    authorityKey,
    detailSelectionTarget,
    imageExtraImageUrls,
    imageReferenceImageUrl,
    motionReferenceVideoError,
    motionReferenceVideoPending,
    motionReferenceVideoUrl,
    selectedTool,
    showCreateTools,
    getMotionReferenceUploadUiStateForAuthority,
    useReferenceImageIndicator,
    updateMotionReferenceUploadUiStateForAuthority,
    videoExtraImageUrls,
    videoReferenceImageUrl,
  ]);

  const isVideoReferenceTool = selectedTool === "video" || selectedTool === "kling";
  const detailOutputId =
    detailSelectionTarget?.kind === "studio-output" ? detailSelectionTarget.outputId : null;
  const referenceImageUrl = isVideoReferenceTool ? videoReferenceImageUrl : imageReferenceImageUrl;
  const extraImageUrls = isVideoReferenceTool ? videoExtraImageUrls : imageExtraImageUrls;

  const setDetailSelectionTarget = useCallback(
    (
      value:
        | SharedMediaDetailSelectionTarget
        | null
        | ((
            current: SharedMediaDetailSelectionTarget | null
          ) => SharedMediaDetailSelectionTarget | null)
    ) => {
      setDetailSelectionTargetState((current) =>
        typeof value === "function" ? value(current) : value
      );
    },
    []
  );

  const setDetailOutputId = useCallback((value: string | null) => {
    setDetailSelectionTargetState((current) => {
      const nextTarget = createDetailSelectionTargetFromOutputId(value);
      if (
        nextTarget &&
        nextTarget.kind === "studio-output" &&
        current?.kind === "studio-output" &&
        current.outputId === nextTarget.outputId
      ) {
        return current;
      }
      return nextTarget;
    });
  }, []);

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
      const next = normalizeExpertEditSecondaryImageUrls(prev);
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
    const previousMotionVideoUrl = motionReferenceVideoUrl;
    setImageReferenceImageUrlState(null);
    setImageExtraImageUrls(createEmptyExpertEditSecondaryImageUrls());
    setVideoReferenceImageUrl(null);
    setVideoExtraImageUrls([null, null, null]);
    setMotionReferenceVideoUrlState(null);
    updateMotionReferenceUploadUiStateForAuthority(activeAuthorityKeyRef.current, (current) => ({
      pending: false,
      error: null,
      requestId: current.requestId + 1,
    }));
    void retireCommittedMotionVideoByUrl(previousMotionVideoUrl);
  }, [motionReferenceVideoUrl, updateMotionReferenceUploadUiStateForAuthority]);

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

  const setAuthorityState = useCallback(
    (nextAuthorityKey: string, nextState: ReferenceSelectionAuthorityStateSeed) => {
      const resolvedState = buildReferenceSelectionAuthorityStateFromSeed(nextState);
      stateByAuthorityKeyRef.current[nextAuthorityKey] = resolvedState;
      if (activeAuthorityKeyRef.current !== nextAuthorityKey) return;
      setSelectedTool(resolvedState.selectedTool);
      setShowCreateTools(resolvedState.showCreateTools);
      setImageReferenceImageUrlState(resolvedState.imageReferenceImageUrl);
      setImageExtraImageUrls(
        normalizeExpertEditSecondaryImageUrls(resolvedState.imageExtraImageUrls)
      );
      setVideoReferenceImageUrl(resolvedState.videoReferenceImageUrl);
      setVideoExtraImageUrls(resolvedState.videoExtraImageUrls);
      setMotionReferenceVideoUrlState(resolvedState.motionReferenceVideoUrl);
      setUseReferenceImageIndicator(resolvedState.useReferenceImageIndicator);
      setDetailSelectionTargetState(resolvedState.detailSelectionTarget);
    },
    []
  );

  const getAuthorityState = useCallback(
    (targetAuthorityKey: string): ReferenceSelectionAuthorityStateSeed => {
      if (activeAuthorityKeyRef.current === targetAuthorityKey) {
        const activeReferenceInternalMediaRefs =
          selectedTool === "video" || selectedTool === "kling"
            ? resolveInternalMediaRefsForUrls([videoReferenceImageUrl, ...videoExtraImageUrls], 4)
            : resolveInternalMediaRefsForUrls([imageReferenceImageUrl, ...imageExtraImageUrls], 11);
        return {
          selectedTool: normalizeSelectedToolForAuthorityKey(targetAuthorityKey, selectedTool),
          showCreateTools,
          referenceImageUrl,
          extraImageUrls,
          referenceImageInternalMediaRefs: activeReferenceInternalMediaRefs,
          motionReferenceVideoUrl,
          useReferenceImageIndicator,
          detailOutputId,
          detailSelectionTarget: stripRuntimeDetailSelectionSnapshot(detailSelectionTarget),
        };
      }
      const restoredState =
        stateByAuthorityKeyRef.current[targetAuthorityKey] ??
        createEmptyReferenceSelectionAuthorityState();
      const normalizedSelectedTool = normalizeSelectedToolForAuthorityKey(
        targetAuthorityKey,
        restoredState.selectedTool
      );
      const restoredReferenceInputs =
        normalizedSelectedTool === "video" || normalizedSelectedTool === "kling"
          ? {
              referenceImageUrl: restoredState.videoReferenceImageUrl,
              extraImageUrls: restoredState.videoExtraImageUrls,
              referenceImageInternalMediaRefs: restoredState.videoReferenceImageInternalMediaRefs,
            }
          : {
              referenceImageUrl: restoredState.imageReferenceImageUrl,
              extraImageUrls: restoredState.imageExtraImageUrls,
              referenceImageInternalMediaRefs: restoredState.imageReferenceImageInternalMediaRefs,
            };
      return {
        selectedTool: normalizedSelectedTool,
        showCreateTools: restoredState.showCreateTools,
        referenceImageUrl: restoredReferenceInputs.referenceImageUrl,
        extraImageUrls: restoredReferenceInputs.extraImageUrls,
        referenceImageInternalMediaRefs: restoredReferenceInputs.referenceImageInternalMediaRefs,
        motionReferenceVideoUrl: restoredState.motionReferenceVideoUrl,
        useReferenceImageIndicator: restoredState.useReferenceImageIndicator,
        detailOutputId: restoredState.detailOutputId,
        detailSelectionTarget: restoredState.detailSelectionTarget,
      };
    },
    [
      detailSelectionTarget,
      detailOutputId,
      extraImageUrls,
      imageExtraImageUrls,
      imageReferenceImageUrl,
      motionReferenceVideoUrl,
      referenceImageUrl,
      selectedTool,
      showCreateTools,
      useReferenceImageIndicator,
      videoExtraImageUrls,
      videoReferenceImageUrl,
    ]
  );

  const resolveMotionVideoUploadErrorMessage = useCallback((error: unknown) => {
    return error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Unable to add this motion clip right now.";
  }, []);

  const clearMotionVideoSelection = useCallback(
    (targetAuthorityKey = activeAuthorityKeyRef.current) => {
      const previousMotionVideoUrl = getAuthorityState(targetAuthorityKey).motionReferenceVideoUrl;
      const nextAuthorityState = getAuthorityState(targetAuthorityKey);
      setAuthorityState(targetAuthorityKey, {
        ...nextAuthorityState,
        motionReferenceVideoUrl: null,
      });
      updateMotionReferenceUploadUiStateForAuthority(targetAuthorityKey, (current) => ({
        pending: false,
        error: null,
        requestId: current.requestId + 1,
      }));
      void retireCommittedMotionVideoByUrl(previousMotionVideoUrl);
    },
    [getAuthorityState, setAuthorityState, updateMotionReferenceUploadUiStateForAuthority]
  );

  const setMotionReferenceVideoUrl = useCallback(
    (value: string | ((current: string | null) => string | null) | null) => {
      const targetAuthorityKey = activeAuthorityKeyRef.current;
      const currentValue = getAuthorityState(targetAuthorityKey).motionReferenceVideoUrl;
      const nextValue = typeof value === "function" ? value(currentValue) : value;
      const nextAuthorityState = getAuthorityState(targetAuthorityKey);
      setAuthorityState(targetAuthorityKey, {
        ...nextAuthorityState,
        motionReferenceVideoUrl: nextValue,
      });
      updateMotionReferenceUploadUiStateForAuthority(targetAuthorityKey, (current) => ({
        pending: false,
        error: null,
        requestId: current.requestId + 1,
      }));
      if (currentValue && currentValue !== nextValue) {
        void retireCommittedMotionVideoByUrl(currentValue);
      }
    },
    [getAuthorityState, setAuthorityState, updateMotionReferenceUploadUiStateForAuthority]
  );

  useEffect(() => {
    const currentReferenceUrls = [referenceImageUrl, ...extraImageUrls] as const;
    const currentInternalRefs = resolveInternalMediaRefsForUrls(
      [...currentReferenceUrls],
      isVideoReferenceTool ? 4 : 11
    );
    const storagePaths = Array.from(
      new Set(
        currentInternalRefs
          .map((ref) => resolveInternalMediaRefStoragePath(ref))
          .filter((path): path is string => Boolean(path))
      )
    );
    const hasMotionVideoUrl = Boolean(motionReferenceVideoUrl?.trim());
    if (storagePaths.length === 0 && !hasMotionVideoUrl) return;

    let cancelled = false;

    void Promise.all([
      storagePaths.length > 0
        ? getSignedMediaUrlsBatch({
            bucket: INTERNAL_MEDIA_REF_BUCKET,
            storagePaths,
          })
        : Promise.resolve(new Map<string, string | null>()),
      hasMotionVideoUrl
        ? prepareMotionReferenceVideoUrl(motionReferenceVideoUrl)
        : Promise.resolve(null),
    ])
      .then(([signedByPath, refreshedMotionVideoUrl]) => {
        if (cancelled) return;

        const refreshedReferenceUrls = currentReferenceUrls.map((currentUrl, index) => {
          const storagePath = resolveInternalMediaRefStoragePath(
            currentInternalRefs[index] ?? null
          );
          if (!storagePath) return currentUrl;
          return signedByPath.get(storagePath) ?? currentUrl;
        });

        const nextReferenceImageUrl = refreshedReferenceUrls[0] ?? null;
        if (nextReferenceImageUrl !== referenceImageUrl) {
          setReferenceImageUrl(nextReferenceImageUrl);
        }
        refreshedReferenceUrls.slice(1).forEach((nextExtraImageUrl, index) => {
          if (nextExtraImageUrl !== extraImageUrls[index]) {
            setExtraImageUrl(index, nextExtraImageUrl ?? null);
          }
        });
        if (
          typeof refreshedMotionVideoUrl === "string" &&
          refreshedMotionVideoUrl !== motionReferenceVideoUrl
        ) {
          setMotionReferenceVideoUrlState(refreshedMotionVideoUrl);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    extraImageUrls,
    motionReferenceVideoUrl,
    referenceImageUrl,
    setExtraImageUrl,
    setReferenceImageUrl,
    isVideoReferenceTool,
  ]);

  const stageMotionVideoSelection = useCallback(
    async ({ videoFile, videoUrl }: { videoFile?: File | null; videoUrl?: string | null }) => {
      if (!videoFile && !videoUrl) return;
      const targetAuthorityKey = activeAuthorityKeyRef.current;
      const nextRequestId =
        getMotionReferenceUploadUiStateForAuthority(targetAuthorityKey).requestId + 1;
      setMotionReferenceUploadUiStateForAuthority(targetAuthorityKey, {
        pending: true,
        error: null,
        requestId: nextRequestId,
      });

      try {
        const normalizedVideoUrl = videoUrl?.trim() ?? "";
        await assertMotionReferenceDuration({ videoFile, videoUrl: normalizedVideoUrl || null });
        const shouldStageUrl =
          normalizedVideoUrl &&
          (needsVideoUpload(normalizedVideoUrl) ||
            needsMotionReferenceVideoProviderNormalization(normalizedVideoUrl));
        if (!videoFile && normalizedVideoUrl && !shouldStageUrl) {
          if (
            getMotionReferenceUploadUiStateForAuthority(targetAuthorityKey).requestId !==
            nextRequestId
          ) {
            return;
          }
          const nextAuthorityState = getAuthorityState(targetAuthorityKey);
          const previousMotionVideoUrl = nextAuthorityState.motionReferenceVideoUrl;
          setAuthorityState(targetAuthorityKey, {
            ...nextAuthorityState,
            motionReferenceVideoUrl: normalizedVideoUrl,
          });
          setMotionReferenceUploadUiStateForAuthority(targetAuthorityKey, {
            pending: false,
            error: null,
            requestId: nextRequestId,
          });
          if (previousMotionVideoUrl && previousMotionVideoUrl !== normalizedVideoUrl) {
            void retireCommittedMotionVideoByUrl(previousMotionVideoUrl);
          }
          return;
        }

        const uploaded = videoFile
          ? await uploadVideoFileToStorage(videoFile)
          : await uploadVideoAssetToStorage(normalizedVideoUrl);
        if (
          getMotionReferenceUploadUiStateForAuthority(targetAuthorityKey).requestId !==
          nextRequestId
        ) {
          await deleteUploadedMotionVideoByPath(uploaded.path);
          return;
        }
        const nextAuthorityState = getAuthorityState(targetAuthorityKey);
        const previousMotionVideoUrl = nextAuthorityState.motionReferenceVideoUrl;
        setAuthorityState(targetAuthorityKey, {
          ...nextAuthorityState,
          motionReferenceVideoUrl: uploaded.url,
        });
        setMotionReferenceUploadUiStateForAuthority(targetAuthorityKey, {
          pending: false,
          error: null,
          requestId: nextRequestId,
        });
        if (previousMotionVideoUrl && previousMotionVideoUrl !== uploaded.url) {
          void retireCommittedMotionVideoByUrl(previousMotionVideoUrl);
        }
      } catch (error) {
        if (
          getMotionReferenceUploadUiStateForAuthority(targetAuthorityKey).requestId !==
          nextRequestId
        ) {
          return;
        }
        setMotionReferenceUploadUiStateForAuthority(targetAuthorityKey, {
          pending: false,
          error: resolveMotionVideoUploadErrorMessage(error),
          requestId: nextRequestId,
        });
      }
    },
    [
      getAuthorityState,
      getMotionReferenceUploadUiStateForAuthority,
      resolveMotionVideoUploadErrorMessage,
      setAuthorityState,
      setMotionReferenceUploadUiStateForAuthority,
    ]
  );

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
    motionReferenceVideoPending,
    motionReferenceVideoError,
    setMotionReferenceVideoUrl,
    stageMotionVideoSelection,
    clearMotionVideoSelection,
    useReferenceImageIndicator,
    setUseReferenceImageIndicator,
    detailSelectionTarget,
    setDetailSelectionTarget,
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
    setAuthorityState,
    getAuthorityState,
  };
};
