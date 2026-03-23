import { useCallback, useEffect, useRef, useState } from "react";

export type ShellDropMode = "none" | "text" | "media";

export type ShellDropPayload =
  | { kind: "none" }
  | { kind: "internal" }
  | { kind: "files"; files: FileList }
  | { kind: "media"; reference: { url: string; mimeType?: string | null } }
  | {
      kind: "libraryMedia";
      payload: {
        id: string;
        url: string;
        fileType: "image" | "video";
        originFolderId?: string | null;
        filename?: string | null;
        promptText?: string | null;
        source?: string | null;
        previewStoragePath?: string | null;
        fullStoragePath?: string | null;
        previewUrl?: string | null;
        fullUrl?: string | null;
      };
    }
  | {
      kind: "libraryPrompt";
      payload: {
        id: string;
        promptText: string;
        originFolderId?: string | null;
        title?: string | null;
      };
    }
  | { kind: "text"; text: string };

type UseAiStudioShellDndControllerParams = {
  shellRef: React.RefObject<HTMLElement | null>;
  rightColumnRef: React.RefObject<HTMLElement | null>;
  resolveDropMode: (transfer: DataTransfer | null | undefined) => ShellDropMode;
  resolveDropPayload: (transfer: DataTransfer) => ShellDropPayload;
  onDropFiles: (files: FileList) => void;
  onDropMediaReference?: (reference: { url: string; mimeType?: string | null }) => void;
  onDropLibraryMediaReference?: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video";
    originFolderId?: string | null;
    filename?: string | null;
    promptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    fullUrl?: string | null;
  }) => void;
  onDropLibraryPromptReference?: (payload: {
    id: string;
    promptText: string;
    originFolderId?: string | null;
    title?: string | null;
  }) => void;
  onDropTextReference?: (text: string) => void;
  useRafBackpressure?: boolean;
  shouldBypassCapture?: (
    event: React.DragEvent<HTMLElement>,
    context: { dropMode?: ShellDropMode; payload?: ShellDropPayload }
  ) => boolean;
};

type DragEventHandler = (event: React.DragEvent<HTMLElement>) => void;

type RightColumnFallbackBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

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
  onDropLibraryMediaReference,
  onDropLibraryPromptReference,
  onDropTextReference,
  useRafBackpressure = true,
  shouldBypassCapture,
}: UseAiStudioShellDndControllerParams) => {
  const dragDepthRef = useRef(0);
  const dropModeRef = useRef<ShellDropMode>("none");
  const rafIdRef = useRef<number | null>(null);
  const pendingModeRef = useRef<ShellDropMode | null>(null);
  const fallbackBoundsRef = useRef<RightColumnFallbackBounds | null>(null);
  const [dropMode, setDropMode] = useState<ShellDropMode>("none");

  const invalidateFallbackBounds = useCallback(() => {
    fallbackBoundsRef.current = null;
  }, []);

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
    invalidateFallbackBounds();
    if (rafIdRef.current != null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    dropModeRef.current = "none";
    setDropMode("none");
  }, [invalidateFallbackBounds]);

  const resolveFallbackBounds = useCallback((): RightColumnFallbackBounds | null => {
    if (fallbackBoundsRef.current) return fallbackBoundsRef.current;
    const rightColumnNode = rightColumnRef.current;
    const shellNode = shellRef.current;
    if (!rightColumnNode || !shellNode) return null;
    const shellRect = shellNode.getBoundingClientRect();
    const rightRect = rightColumnNode.getBoundingClientRect();
    const nextBounds = {
      left: rightRect.left,
      right: rightRect.right,
      top: shellRect.top,
      bottom: shellRect.bottom,
    };
    fallbackBoundsRef.current = nextBounds;
    return nextBounds;
  }, [rightColumnRef, shellRef]);

  const handleDragEnterCapture: DragEventHandler = useCallback(
    (event) => {
      const nextMode = resolveDropMode(event.dataTransfer);
      if (nextMode === "none") return;
      if (shouldBypassCapture?.(event, { dropMode: nextMode })) {
        dragDepthRef.current = 0;
        applyDropMode("none");
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      dragDepthRef.current += 1;
      applyDropMode(nextMode);
    },
    [applyDropMode, resolveDropMode, shouldBypassCapture]
  );

  const handleDragOverCapture: DragEventHandler = useCallback(
    (event) => {
      const nextMode = resolveDropMode(event.dataTransfer);
      if (nextMode === "none") return;
      if (shouldBypassCapture?.(event, { dropMode: nextMode })) {
        dragDepthRef.current = 0;
        applyDropMode("none");
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      applyDropMode(nextMode);
    },
    [applyDropMode, resolveDropMode, shouldBypassCapture]
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
      if (shouldBypassCapture?.(event, { payload })) {
        clearDropState();
        return;
      }
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
      if (payload.kind === "libraryMedia" && onDropLibraryMediaReference) {
        event.preventDefault();
        event.stopPropagation();
        onDropLibraryMediaReference(payload.payload);
        clearDropState();
        return;
      }
      if (payload.kind === "libraryPrompt" && onDropLibraryPromptReference) {
        event.preventDefault();
        event.stopPropagation();
        onDropLibraryPromptReference(payload.payload);
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
    [
      clearDropState,
      onDropFiles,
      onDropMediaReference,
      onDropLibraryMediaReference,
      onDropLibraryPromptReference,
      onDropTextReference,
      resolveDropPayload,
      shouldBypassCapture,
    ]
  );

  const shouldHandleShellRightColumnFallback = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const rightColumnNode = rightColumnRef.current;
      if (!rightColumnNode) return false;
      if (event.target instanceof Node && rightColumnNode.contains(event.target)) return false;
      const fallbackBounds = resolveFallbackBounds();
      if (!fallbackBounds) return false;
      const { clientX, clientY } = event;
      return (
        clientX >= fallbackBounds.left &&
        clientX <= fallbackBounds.right &&
        clientY >= fallbackBounds.top &&
        clientY <= fallbackBounds.bottom
      );
    },
    [resolveFallbackBounds, rightColumnRef]
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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleViewportChange = () => {
      invalidateFallbackBounds();
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [invalidateFallbackBounds]);

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
