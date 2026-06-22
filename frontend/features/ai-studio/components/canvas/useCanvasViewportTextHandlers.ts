/**
 * Encapsulates text editing, selection deletion, and pin actions for a Canvas viewport.
 */
import { useCallback, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from "react";
import {
  deleteCanvasSceneItemById,
  selectCanvasSceneItem,
  type CanvasSharedSceneState,
} from "./canvasSceneState";
import type { CanvasSceneItem } from "./canvasTypes";

type UseCanvasViewportTextHandlersParams = {
  items: CanvasSceneItem[];
  draftTextEntry: { x: number; y: number; value: string } | null;
  textEditSession: { itemId: string; value: string } | null;
  onPinTextReference?: (text: string) => void;
  scene: Pick<
    CanvasSharedSceneState,
    | "setItems"
    | "setDraftTextEntry"
    | "setTextEditSession"
    | "clearDraftTextEntry"
    | "clearTextEditSession"
    | "deleteSelection"
    | "commitDraftTextEntry"
    | "commitTextItemEdit"
  >;
};

type CanvasTextHandlers = {
  onViewportKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onDraftTextChange: (value: string) => void;
  onDraftTextPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onDraftTextKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onItemDoubleClick: (id: string, event: MouseEvent<HTMLElement>) => void;
  onItemContextMenu: (id: string, event: MouseEvent<HTMLElement>) => void;
  onTextItemEditChange: (value: string) => void;
  onTextItemEditKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextItemEditBlur: () => void;
  onPinTextItem: (id: string) => void;
};

/**
 * Returns text-centric handlers that are shared by main and rail viewport instances.
 */
export const useCanvasViewportTextHandlers = ({
  items,
  draftTextEntry,
  textEditSession,
  onPinTextReference,
  scene,
}: UseCanvasViewportTextHandlersParams): CanvasTextHandlers => {
  const {
    setItems,
    setDraftTextEntry,
    setTextEditSession,
    clearDraftTextEntry,
    clearTextEditSession,
    deleteSelection,
    commitDraftTextEntry,
    commitTextItemEdit,
  } = scene;

  const onViewportKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (draftTextEntry || textEditSession) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      deleteSelection();
    },
    [deleteSelection, draftTextEntry, textEditSession]
  );

  const onDraftTextChange = useCallback(
    (value: string) => {
      setDraftTextEntry((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              value,
            }
          : currentDraft
      );
    },
    [setDraftTextEntry]
  );

  const onDraftTextPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = event.clipboardData.getData("text/plain");
      if (!pastedText.trim()) return;
      const input = event.currentTarget;
      const selectionStart = input.selectionStart ?? input.value.length;
      const selectionEnd = input.selectionEnd ?? selectionStart;
      const nextValue = `${input.value.slice(0, selectionStart)}${pastedText}${input.value.slice(
        selectionEnd
      )}`;
      event.preventDefault();
      commitDraftTextEntry(nextValue, draftTextEntry);
    },
    [commitDraftTextEntry, draftTextEntry]
  );

  const onDraftTextKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitDraftTextEntry();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearDraftTextEntry();
      }
    },
    [clearDraftTextEntry, commitDraftTextEntry]
  );

  const onItemDoubleClick = useCallback(
    (id: string, event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      const item = items.find((candidate) => candidate.id === id);
      if (!item || item.kind !== "text") return;
      clearDraftTextEntry();
      setItems((currentItems) => selectCanvasSceneItem(currentItems, id));
      setTextEditSession({
        itemId: id,
        value: item.text,
      });
    },
    [clearDraftTextEntry, items, setItems, setTextEditSession]
  );

  const onItemContextMenu = useCallback(
    (id: string, event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setItems((currentItems) => deleteCanvasSceneItemById(currentItems, id));
      setTextEditSession((currentSession) =>
        currentSession?.itemId === id ? null : currentSession
      );
    },
    [setItems, setTextEditSession]
  );

  const onTextItemEditChange = useCallback(
    (value: string) => {
      setTextEditSession((currentSession) =>
        currentSession
          ? {
              ...currentSession,
              value,
            }
          : currentSession
      );
    },
    [setTextEditSession]
  );

  const onTextItemEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        commitTextItemEdit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearTextEditSession();
      }
    },
    [clearTextEditSession, commitTextItemEdit]
  );

  const onTextItemEditBlur = useCallback(() => {
    commitTextItemEdit();
  }, [commitTextItemEdit]);

  const onPinTextItem = useCallback(
    (id: string) => {
      if (!onPinTextReference) return;
      const item = items.find((candidate) => candidate.id === id);
      if (!item || item.kind !== "text") return;
      if (!item.text.trim()) return;
      onPinTextReference(item.text);
    },
    [items, onPinTextReference]
  );

  return {
    onViewportKeyDown,
    onDraftTextChange,
    onDraftTextPaste,
    onDraftTextKeyDown,
    onItemDoubleClick,
    onItemContextMenu,
    onTextItemEditChange,
    onTextItemEditKeyDown,
    onTextItemEditBlur,
    onPinTextItem,
  };
};
