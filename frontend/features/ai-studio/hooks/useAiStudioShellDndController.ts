import { useCallback, useEffect, useRef, useState } from "react";

export type ShellDropMode = "none" | "text" | "media";

export type ShellDropPayload =
  | { kind: "none" }
  | { kind: "internal" }
  | { kind: "files"; files: FileList }
  | { kind: "media"; reference: { url: string; mimeType?: string | null } }
  | { kind: "text"; text: string };

type UseAiStudioShellDndControllerParams = {
  shellRef: React.RefObject<HTMLElement | null>;
  rightColumnRef: React.RefObject<HTMLElement | null>;
  resolveDropMode: (transfer: DataTransfer | null | undefined) => ShellDropMode;
  resolveDropPayload: (transfer: DataTransfer) => ShellDropPayload;
  onDropFiles: (files: FileList) => void;
  onDropMediaReference?: (reference: { url: string; mimeType?: string | null }) => void;
  onDropTextReference?: (text: string) => void;
  useRafBackpressure?: boolean;
};

type DragEventHandler = (event: React.DragEvent<HTMLElement>) => void;

/**
 * Manages AI shell right-column drag/drop state with optional RAF backpressure.
 * Keeps noisy dragover updates out of the primary page render path.
 */
export const useAiStudioShellDndController = ({
  shellRef,
  rightColumnRef,
  resolveDropMode,
  resolveDropPayload,
  onDropFiles,
  onDropMediaReference,
  onDropTextReference,
  useRafBackpressure = true,
}: UseAiStudioShellDndControllerParams) => {
  const dragDepthRef = useRef(0);
  const dropModeRef = useRef<ShellDropMode>("none");
  const rafIdRef = useRef<number | null>(null);
  const pendingModeRef = useRef<ShellDropMode | null>(null);
  const [dropMode, setDropMode] = useState<ShellDropMode>("none");

  const flushPendingMode = useCallback(() => {
    rafIdRef.current = null;
    const nextMode = pendingModeRef.current;
    pendingModeRef.current = null;
    if (!nextMode || dropModeRef.current === nextMode) return;
    dropModeRef.current = nextMode;
    setDropMode(nextMode);
  }, []);

  const applyDropMode = useCallback(
    (nextMode: ShellDropMode) => {
      if (!useRafBackpressure) {
        if (dropModeRef.current === nextMode) return;
        dropModeRef.current = nextMode;
        setDropMode(nextMode);
        return;
      }
      pendingModeRef.current = nextMode;
      if (rafIdRef.current != null) return;
      rafIdRef.current = window.requestAnimationFrame(flushPendingMode);
    },
    [flushPendingMode, useRafBackpressure]
  );

  const clearDropState = useCallback(() => {
    dragDepthRef.current = 0;
    pendingModeRef.current = null;
    if (rafIdRef.current != null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    dropModeRef.current = "none";
    setDropMode("none");
  }, []);

  const handleDragEnterCapture: DragEventHandler = useCallback(
    (event) => {
      const nextMode = resolveDropMode(event.dataTransfer);
      if (nextMode === "none") return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      dragDepthRef.current += 1;
      applyDropMode(nextMode);
    },
    [applyDropMode, resolveDropMode]
  );

  const handleDragOverCapture: DragEventHandler = useCallback(
    (event) => {
      const nextMode = resolveDropMode(event.dataTransfer);
      if (nextMode === "none") return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      applyDropMode(nextMode);
    },
    [applyDropMode, resolveDropMode]
  );

  const handleDragLeaveCapture: DragEventHandler = useCallback(
    (event) => {
      if (dropModeRef.current === "none") return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        applyDropMode("none");
      }
    },
    [applyDropMode]
  );

  const handleDropCapture: DragEventHandler = useCallback(
    (event) => {
      const payload = resolveDropPayload(event.dataTransfer);
      if (payload.kind === "none" || payload.kind === "internal") {
        clearDropState();
        return;
      }
      if (payload.kind === "files") {
        event.preventDefault();
        event.stopPropagation();
        onDropFiles(payload.files);
        clearDropState();
        return;
      }
      if (payload.kind === "media" && onDropMediaReference) {
        event.preventDefault();
        event.stopPropagation();
        onDropMediaReference(payload.reference);
        clearDropState();
        return;
      }
      if (payload.kind === "text" && onDropTextReference) {
        event.preventDefault();
        event.stopPropagation();
        onDropTextReference(payload.text);
        clearDropState();
        return;
      }
      clearDropState();
    },
    [clearDropState, onDropFiles, onDropMediaReference, onDropTextReference, resolveDropPayload]
  );

  const shouldHandleShellRightColumnFallback = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const rightColumnNode = rightColumnRef.current;
      const shellNode = shellRef.current;
      if (!rightColumnNode || !shellNode) return false;
      if (event.target instanceof Node && rightColumnNode.contains(event.target)) return false;
      const shellRect = shellNode.getBoundingClientRect();
      const rightRect = rightColumnNode.getBoundingClientRect();
      const { clientX, clientY } = event;
      return (
        clientX >= rightRect.left &&
        clientX <= rightRect.right &&
        clientY >= shellRect.top &&
        clientY <= shellRect.bottom
      );
    },
    [rightColumnRef, shellRef]
  );

  const handleShellDragOverCapture: DragEventHandler = useCallback(
    (event) => {
      if (!shouldHandleShellRightColumnFallback(event)) return;
      handleDragOverCapture(event);
    },
    [handleDragOverCapture, shouldHandleShellRightColumnFallback]
  );

  const handleShellDropCapture: DragEventHandler = useCallback(
    (event) => {
      if (!shouldHandleShellRightColumnFallback(event)) return;
      handleDropCapture(event);
    },
    [handleDropCapture, shouldHandleShellRightColumnFallback]
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleDocumentDragTermination = () => {
      clearDropState();
    };
    document.addEventListener("dragend", handleDocumentDragTermination);
    document.addEventListener("drop", handleDocumentDragTermination);
    return () => {
      document.removeEventListener("dragend", handleDocumentDragTermination);
      document.removeEventListener("drop", handleDocumentDragTermination);
    };
  }, [clearDropState]);

  useEffect(
    () => () => {
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    },
    []
  );

  return {
    dropMode,
    clearDropState,
    handleDragEnterCapture,
    handleDragOverCapture,
    handleDragLeaveCapture,
    handleDropCapture,
    handleShellDragOverCapture,
    handleShellDropCapture,
  };
};
