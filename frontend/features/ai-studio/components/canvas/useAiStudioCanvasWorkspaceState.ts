/**
 * Page-scoped state controller for the AI Studio Canvas workspace.
 * Composes shared scene state with per-viewport camera + interaction controllers.
 */
import { useMemo, useState } from "react";
import { useCanvasSharedSceneState } from "./canvasSceneState";
import type { ResolveCanvasDropReference } from "./canvasTypes";
import type {
  AiStudioDualCanvasWorkspaceState,
  CanvasPropertiesPanelProps,
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
  onPinTextReference,
}: {
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  onPinTextReference?: (text: string) => void;
} = {}): CanvasPropertiesPanelProps => {
  const sharedScene = useCanvasSharedSceneState();
  const isSpacePanActiveRef = useCanvasSpacePanTracker();
  const [draftOwnerInstanceId, setDraftOwnerInstanceId] = useState<"main" | "rail" | null>(null);
  const [textEditOwnerInstanceId, setTextEditOwnerInstanceId] = useState<"main" | "rail" | null>(
    null
  );

  return useCanvasViewportInstanceState({
    instanceId: "main",
    sharedScene,
    resolveCanvasDropReference,
    onPinTextReference,
    isSpacePanActiveRef,
    draftOwnerInstanceId,
    textEditOwnerInstanceId,
    setDraftOwnerInstanceId,
    setTextEditOwnerInstanceId,
  });
};

/**
 * Returns two Canvas panel contracts that share scene state while keeping viewport cameras isolated.
 */
export const useAiStudioDualCanvasWorkspaceState = ({
  resolveCanvasDropReference,
  onPinTextReference,
}: {
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  onPinTextReference?: (text: string) => void;
} = {}): AiStudioDualCanvasWorkspaceState => {
  const sharedScene = useCanvasSharedSceneState();
  const isSpacePanActiveRef = useCanvasSpacePanTracker();
  const [draftOwnerInstanceId, setDraftOwnerInstanceId] = useState<"main" | "rail" | null>(null);
  const [textEditOwnerInstanceId, setTextEditOwnerInstanceId] = useState<"main" | "rail" | null>(
    null
  );

  const mainCanvasProps = useCanvasViewportInstanceState({
    instanceId: "main",
    sharedScene,
    resolveCanvasDropReference,
    onPinTextReference,
    isSpacePanActiveRef,
    draftOwnerInstanceId,
    textEditOwnerInstanceId,
    setDraftOwnerInstanceId,
    setTextEditOwnerInstanceId,
  });

  const railCanvasProps = useCanvasViewportInstanceState({
    instanceId: "rail",
    sharedScene,
    resolveCanvasDropReference,
    onPinTextReference,
    isSpacePanActiveRef,
    draftOwnerInstanceId,
    textEditOwnerInstanceId,
    setDraftOwnerInstanceId,
    setTextEditOwnerInstanceId,
  });

  return useMemo(
    () => ({
      mainCanvasProps,
      railCanvasProps,
    }),
    [mainCanvasProps, railCanvasProps]
  );
};
