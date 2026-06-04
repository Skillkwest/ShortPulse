/**
 * Shared Canvas workspace contracts consumed across orchestration and render layers.
 */
import type {
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  RefObject,
  WheelEvent,
} from "react";
import type {
  CanvasDraftTextEntry,
  CanvasPendingSceneItem,
  CanvasTextEditSession,
} from "./canvasSceneState";
import type { CanvasCamera, CanvasResizeHandle, CanvasSceneItem } from "./canvasTypes";

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

export type CanvasPropertiesPanelProps = {
  instanceId?: CanvasWorkspaceInstanceId;
  camera: CanvasCamera;
  items: CanvasSceneItem[];
  pendingItems: CanvasPendingSceneItem[];
  itemDragPreview?: CanvasItemDragPreview | null;
  marqueeSelectionBox?: CanvasMarqueeSelectionBox | null;
  viewportRef: RefObject<HTMLDivElement>;
  isDropActive: boolean;
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
  onViewportWheel: (event: WheelEvent<HTMLDivElement>) => void;
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
  onDraftTextKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onDraftTextBlur: () => void;
  onTextItemEditChange: (value: string) => void;
  onTextItemEditKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextItemEditBlur: () => void;
};

export type AiStudioDualCanvasWorkspaceState = {
  mainCanvasProps: CanvasPropertiesPanelProps;
  railCanvasProps: CanvasPropertiesPanelProps;
  sessionState: CanvasWorkspaceSessionState;
  hydrateSessionState: (state: CanvasWorkspaceSessionState | null) => void;
};
