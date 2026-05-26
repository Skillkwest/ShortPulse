/**
 * Page-scoped state controller for the AI Studio Canvas workspace.
 * Composes shared scene state with per-viewport camera + interaction controllers.
 */
import { useCallback, useMemo, useState } from "react";
import { useCanvasSharedSceneState } from "./canvasSceneState";
import type {
  PrepareCanvasMediaLibraryDrop,
  PrepareResolvedInternalCanvasDrop,
  ResolveCanvasDroppedMediaReference,
  ResolveCanvasDropFiles,
  ResolveCanvasDropReference,
} from "./canvasTypes";
import { CANVAS_DEFAULT_CAMERA } from "./canvasGeometry";
import type {
  AiStudioDualCanvasWorkspaceState,
  CanvasPropertiesPanelProps,
  CanvasWorkspaceInstanceId,
  CanvasWorkspaceSessionState,
} from "./canvasWorkspaceContracts";
import { useCanvasViewportInstanceState } from "./useCanvasViewportInstanceState";
import { useCanvasSpacePanTracker } from "./useCanvasSpacePanTracker";

export type {
  AiStudioDualCanvasWorkspaceState,
  CanvasPropertiesPanelProps,
  CanvasWorkspaceInstanceId,
} from "./canvasWorkspaceContracts";

/**
 * Returns the Canvas workspace state and handlers used by the primary properties panel renderer.
 */
export const useAiStudioCanvasWorkspaceState = ({
  resolveCanvasDropReference,
  prepareResolvedInternalCanvasDrop,
  prepareCanvasMediaLibraryDrop,
  resolveCanvasDroppedMediaReference,
  resolveCanvasDropFiles,
  onPinTextReference,
  onItemLimitReached,
}: {
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  prepareResolvedInternalCanvasDrop?: PrepareResolvedInternalCanvasDrop;
  prepareCanvasMediaLibraryDrop?: PrepareCanvasMediaLibraryDrop;
  resolveCanvasDroppedMediaReference?: ResolveCanvasDroppedMediaReference;
  resolveCanvasDropFiles?: ResolveCanvasDropFiles;
  onPinTextReference?: (text: string) => void;
  onItemLimitReached?: () => void;
} = {}): CanvasPropertiesPanelProps => {
  const sharedScene = useCanvasSharedSceneState({ onItemLimitReached });
  const isSpacePanActiveRef = useCanvasSpacePanTracker();
  const [draftOwnerInstanceId, setDraftOwnerInstanceId] =
    useState<CanvasWorkspaceInstanceId | null>(null);
  const [textEditOwnerInstanceId, setTextEditOwnerInstanceId] =
    useState<CanvasWorkspaceInstanceId | null>(null);
  const [mainCamera, setMainCamera] = useState(CANVAS_DEFAULT_CAMERA);

  return useCanvasViewportInstanceState({
    instanceId: "main",
    sharedScene,
    resolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDroppedMediaReference,
    resolveCanvasDropFiles,
    onPinTextReference,
    isSpacePanActiveRef,
    draftOwnerInstanceId,
    textEditOwnerInstanceId,
    setDraftOwnerInstanceId,
    setTextEditOwnerInstanceId,
    cameraState: {
      camera: mainCamera,
      setCamera: setMainCamera,
    },
  });
};

/**
 * Returns two Canvas panel contracts that share scene state while keeping viewport cameras isolated.
 */
export const useAiStudioDualCanvasWorkspaceState = ({
  resolveCanvasDropReference,
  prepareResolvedInternalCanvasDrop,
  prepareCanvasMediaLibraryDrop,
  resolveCanvasDroppedMediaReference,
  resolveCanvasDropFiles,
  onPinTextReference,
  onItemLimitReached,
}: {
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  prepareResolvedInternalCanvasDrop?: PrepareResolvedInternalCanvasDrop;
  prepareCanvasMediaLibraryDrop?: PrepareCanvasMediaLibraryDrop;
  resolveCanvasDroppedMediaReference?: ResolveCanvasDroppedMediaReference;
  resolveCanvasDropFiles?: ResolveCanvasDropFiles;
  onPinTextReference?: (text: string) => void;
  onItemLimitReached?: () => void;
} = {}): AiStudioDualCanvasWorkspaceState => {
  const sharedScene = useCanvasSharedSceneState({ onItemLimitReached });
  const isSpacePanActiveRef = useCanvasSpacePanTracker();
  const [draftOwnerInstanceId, setDraftOwnerInstanceId] =
    useState<CanvasWorkspaceInstanceId | null>(null);
  const [textEditOwnerInstanceId, setTextEditOwnerInstanceId] =
    useState<CanvasWorkspaceInstanceId | null>(null);
  const [mainCamera, setMainCamera] = useState(CANVAS_DEFAULT_CAMERA);
  const [railCamera, setRailCamera] = useState(CANVAS_DEFAULT_CAMERA);
  const { items, draftTextEntry, textEditSession, clearPendingItems, replaceSessionSceneState } =
    sharedScene;

  const mainCanvasProps = useCanvasViewportInstanceState({
    instanceId: "main",
    sharedScene,
    resolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDroppedMediaReference,
    resolveCanvasDropFiles,
    onPinTextReference,
    isSpacePanActiveRef,
    draftOwnerInstanceId,
    textEditOwnerInstanceId,
    setDraftOwnerInstanceId,
    setTextEditOwnerInstanceId,
    cameraState: {
      camera: mainCamera,
      setCamera: setMainCamera,
    },
  });

  const railCanvasProps = useCanvasViewportInstanceState({
    instanceId: "rail",
    sharedScene,
    resolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDroppedMediaReference,
    resolveCanvasDropFiles,
    onPinTextReference,
    isSpacePanActiveRef,
    draftOwnerInstanceId,
    textEditOwnerInstanceId,
    setDraftOwnerInstanceId,
    setTextEditOwnerInstanceId,
    cameraState: {
      camera: railCamera,
      setCamera: setRailCamera,
    },
  });

  const sessionState = useMemo<CanvasWorkspaceSessionState>(
    () => ({
      items,
      draftTextEntry,
      textEditSession,
      draftOwnerInstanceId,
      textEditOwnerInstanceId,
      mainCamera,
      railCamera,
    }),
    [
      draftOwnerInstanceId,
      mainCamera,
      railCamera,
      draftTextEntry,
      items,
      textEditSession,
      textEditOwnerInstanceId,
    ]
  );

  const hydrateSessionState = useCallback(
    (state: CanvasWorkspaceSessionState | null) => {
      if (!state) {
        replaceSessionSceneState({
          items: [],
          draftTextEntry: null,
          textEditSession: null,
        });
        clearPendingItems();
        setDraftOwnerInstanceId(null);
        setTextEditOwnerInstanceId(null);
        setMainCamera(CANVAS_DEFAULT_CAMERA);
        setRailCamera(CANVAS_DEFAULT_CAMERA);
        return;
      }

      replaceSessionSceneState({
        items: state.items,
        draftTextEntry: state.draftTextEntry,
        textEditSession: state.textEditSession,
      });
      setDraftOwnerInstanceId(state.draftOwnerInstanceId);
      setTextEditOwnerInstanceId(state.textEditOwnerInstanceId);
      setMainCamera(state.mainCamera);
      setRailCamera(state.railCamera);
    },
    [clearPendingItems, replaceSessionSceneState]
  );

  return useMemo(
    () => ({
      mainCanvasProps,
      railCanvasProps,
      sessionState,
      hydrateSessionState,
    }),
    [hydrateSessionState, mainCanvasProps, railCanvasProps, sessionState]
  );
};
