/**
 * Shared Canvas workspace contracts consumed across orchestration and render layers.
 */
import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  RefObject,
} from "react";
import type {
  CanvasDraftTextEntry,
  CanvasPendingSceneItem,
  CanvasTextEditSession,
} from "./canvasSceneState";
import type { CanvasCamera, CanvasResizeHandle, CanvasSceneItem } from "./canvasTypes";
import type { CanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import type { StudioOutput, WorkflowReloadMediaKindHint } from "../../types";

export type CanvasWorkspaceInstanceId = "main" | "rail";

export type CanvasWorkspaceSessionState = {
  items: CanvasSceneItem[];
  draftTextEntry: CanvasDraftTextEntry | null;
  textEditSession: CanvasTextEditSession | null;
  draftOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  textEditOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  mainCamera: CanvasCamera;
  railCamera: CanvasCamera;
};

export type CanvasMarqueeSelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasItemDragPreview = {
  activeItemId: string;
  itemIds: string[];
  deltaX: number;
  deltaY: number;
};

export type CanvasTearOutDragPreview = {
  activeItemId: string;
  itemIds: string[];
  clientX: number;
  clientY: number;
  phase: "candidate" | "active";
};

export type CanvasViewportWheelEvent = Pick<
  globalThis.WheelEvent,
  "clientX" | "clientY" | "deltaMode" | "deltaY" | "preventDefault" | "stopPropagation"
>;

export type CanvasPropertiesPanelLivePropsStore = {
  getSnapshot: () => CanvasPropertiesPanelProps;
  subscribe: (listener: () => void) => () => void;
};

export type CanvasMediaActions = {
  getOutputForCanvasItem: (item: CanvasSceneItem) => StudioOutput | null;
  onSelectOutput?: (id: string) => void;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onRerollOutput?: (output: StudioOutput) => void;
  onReloadWorkflowOutput?: (
    output: StudioOutput,
    options?: { mediaKindHint?: WorkflowReloadMediaKindHint | null }
  ) => void;
  onDeleteOutput?: (id: string) => void;
  isMediaStorageFull?: boolean;
};

export type CanvasPropertiesPanelProps = {
  livePropsStore?: CanvasPropertiesPanelLivePropsStore;
  instanceId?: CanvasWorkspaceInstanceId;
  camera: CanvasCamera;
  items: CanvasSceneItem[];
  pendingItems: CanvasPendingSceneItem[];
  itemDragPreview?: CanvasItemDragPreview | null;
  tearOutDragPreview?: CanvasTearOutDragPreview | null;
  marqueeSelectionBox?: CanvasMarqueeSelectionBox | null;
  viewportRef: RefObject<HTMLDivElement>;
  isDropActive: boolean;
  isDropResolving: boolean;
  draftTextEntry: { x: number; y: number; value: string } | null;
  isDraftTextEditable?: boolean;
  editingTextItemId: string | null;
  editingTextValue: string;
  isTextEditEditable?: boolean;
  onViewportKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onViewportDoubleClick: (event: MouseEvent<HTMLDivElement>) => void;
  onViewportClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onViewportPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onViewportPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onViewportPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onViewportPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onViewportDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDrop: (event: DragEvent<HTMLDivElement>) => void;
  onViewportWheel: (event: CanvasViewportWheelEvent) => void;
  onInteractionActiveChange?: (active: boolean) => void;
  onItemPointerDown: (id: string, event: PointerEvent<HTMLElement>) => void;
  onItemPointerMove: (id: string, event: PointerEvent<HTMLElement>) => void;
  onItemPointerUp: (id: string, event: PointerEvent<HTMLElement>) => void;
  onItemPointerCancel: (id: string, event: PointerEvent<HTMLElement>) => void;
  isTextResizeEnabled?: boolean;
  isTextResizeActive?: boolean;
  onTextResizeHandlePointerDown?: (
    id: string,
    handle: CanvasResizeHandle,
    event: PointerEvent<HTMLElement>
  ) => void;
  isItemDraggable?: boolean;
  onItemDragStart?: (id: string, event: DragEvent<HTMLElement>) => void;
  onItemDragEnd?: (id: string, event: DragEvent<HTMLElement>) => void;
  onItemContextMenu: (id: string, event: MouseEvent<HTMLElement>) => void;
  onItemDoubleClick: (id: string, event: MouseEvent<HTMLElement>) => void;
  onPinTextItem: (id: string) => void;
  onDraftTextChange: (value: string) => void;
  onDraftTextPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onDraftTextKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onDraftTextBlur: () => void;
  onTextItemEditChange: (value: string) => void;
  onTextItemEditKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextItemEditBlur: () => void;
  onCanvasMediaRenderError?: (item: CanvasSceneItem) => void;
  mediaActions?: CanvasMediaActions;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
};

export type AiStudioDualCanvasWorkspaceState = {
  mainCanvasProps: CanvasPropertiesPanelProps;
  railCanvasProps: CanvasPropertiesPanelProps;
  sessionState: CanvasWorkspaceSessionState;
  hydrateSessionState: (state: CanvasWorkspaceSessionState | null) => void;
};
