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
import type { CanvasPendingSceneItem } from "./canvasSceneState";
import type { CanvasCamera, CanvasSceneItem } from "./canvasTypes";

export type CanvasWorkspaceInstanceId = "main" | "rail";

export type CanvasPropertiesPanelProps = {
  instanceId?: CanvasWorkspaceInstanceId;
  camera: CanvasCamera;
  items: CanvasSceneItem[];
  pendingItems: CanvasPendingSceneItem[];
  viewportRef: RefObject<HTMLDivElement>;
  isDropActive: boolean;
  draftTextEntry: { x: number; y: number; value: string } | null;
  editingTextItemId: string | null;
  editingTextValue: string;
  onViewportKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onViewportDoubleClick: (event: MouseEvent<HTMLDivElement>) => void;
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
};
