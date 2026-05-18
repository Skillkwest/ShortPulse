import React from "react";

type PresetDragSource = "surface" | "panel";

type PresetDragPayload<PresetId extends string> = {
  presetId: PresetId;
  source: PresetDragSource;
};

type UsePresetDragDropRuntimeParams<PresetId extends string> = {
  resolvePayload: (
    transfer: DataTransfer | null | undefined,
    activePayload: PresetDragPayload<PresetId> | null
  ) => PresetDragPayload<PresetId> | null;
  writeDragTransfer: (
    transfer: DataTransfer,
    payload: PresetDragPayload<PresetId>,
    label: string
  ) => void;
  setOpaqueDragImage: (transfer: DataTransfer, sourceElement: HTMLElement) => (() => void) | null;
  resolveSurfacePresetLabel: (presetId: PresetId) => string;
  resolvePanelPresetLabel: (presetId: PresetId) => string;
  addPresetToPanel: (presetId: PresetId | null | undefined) => void | Promise<unknown>;
  removePresetFromPanel: (presetId: PresetId | null | undefined) => void | Promise<unknown>;
};

export const usePresetDragDropRuntime = <PresetId extends string>({
  resolvePayload,
  writeDragTransfer,
  setOpaqueDragImage,
  resolveSurfacePresetLabel,
  resolvePanelPresetLabel,
  addPresetToPanel,
  removePresetFromPanel,
}: UsePresetDragDropRuntimeParams<PresetId>) => {
  const fireAndForget = React.useCallback((operation: void | Promise<unknown>) => {
    void Promise.resolve(operation).catch(() => undefined);
  }, []);
  const activePresetDragPayloadRef = React.useRef<PresetDragPayload<PresetId> | null>(null);
  const presetDragPreviewCleanupRef = React.useRef<(() => void) | null>(null);
  const [isPresetPanelDropActive, setIsPresetPanelDropActive] = React.useState(false);
  const [isPresetsSurfaceDropActive, setIsPresetsSurfaceDropActive] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (presetDragPreviewCleanupRef.current) {
        presetDragPreviewCleanupRef.current();
        presetDragPreviewCleanupRef.current = null;
      }
    };
  }, []);

  const beginPresetDragSession = React.useCallback(
    (
      event: React.DragEvent<HTMLButtonElement>,
      payload: PresetDragPayload<PresetId>,
      label: string
    ) => {
      event.stopPropagation();
      activePresetDragPayloadRef.current = payload;
      event.dataTransfer.effectAllowed = "move";
      writeDragTransfer(event.dataTransfer, payload, label);
      if (presetDragPreviewCleanupRef.current) {
        presetDragPreviewCleanupRef.current();
        presetDragPreviewCleanupRef.current = null;
      }
      presetDragPreviewCleanupRef.current = setOpaqueDragImage(
        event.dataTransfer,
        event.currentTarget
      );
      if (!presetDragPreviewCleanupRef.current) return;
      window.setTimeout(() => {
        if (presetDragPreviewCleanupRef.current) {
          presetDragPreviewCleanupRef.current();
          presetDragPreviewCleanupRef.current = null;
        }
      }, 0);
    },
    [setOpaqueDragImage, writeDragTransfer]
  );

  const handleSurfacePresetDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, presetId: PresetId) => {
      beginPresetDragSession(
        event,
        { presetId, source: "surface" },
        resolveSurfacePresetLabel(presetId)
      );
    },
    [beginPresetDragSession, resolveSurfacePresetLabel]
  );

  const handlePanelPresetDragStart = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>, presetId: PresetId) => {
      beginPresetDragSession(
        event,
        { presetId, source: "panel" },
        resolvePanelPresetLabel(presetId)
      );
    },
    [beginPresetDragSession, resolvePanelPresetLabel]
  );

  const handlePresetDragEnd = React.useCallback(() => {
    setIsPresetPanelDropActive(false);
    setIsPresetsSurfaceDropActive(false);
    activePresetDragPayloadRef.current = null;
    if (presetDragPreviewCleanupRef.current) {
      presetDragPreviewCleanupRef.current();
      presetDragPreviewCleanupRef.current = null;
    }
  }, []);

  const resetPresetDropState = React.useCallback(() => {
    setIsPresetPanelDropActive(false);
    setIsPresetsSurfaceDropActive(false);
  }, []);

  const handlePresetPanelDragOver = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const payload = resolvePayload(event.dataTransfer, activePresetDragPayloadRef.current);
      if (!payload || payload.source !== "surface") return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setIsPresetPanelDropActive(true);
    },
    [resolvePayload]
  );

  const handlePresetPanelDragLeave = React.useCallback(() => {
    setIsPresetPanelDropActive(false);
  }, []);

  const handlePresetPanelDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const payload = resolvePayload(event.dataTransfer, activePresetDragPayloadRef.current);
      if (!payload || payload.source !== "surface") return;
      event.preventDefault();
      event.stopPropagation();
      setIsPresetPanelDropActive(false);
      fireAndForget(addPresetToPanel(payload.presetId));
    },
    [addPresetToPanel, fireAndForget, resolvePayload]
  );

  const handlePresetsSurfaceDragOver = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const payload = resolvePayload(event.dataTransfer, activePresetDragPayloadRef.current);
      if (!payload || payload.source !== "panel") return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setIsPresetsSurfaceDropActive(true);
    },
    [resolvePayload]
  );

  const handlePresetsSurfaceDragLeave = React.useCallback(() => {
    setIsPresetsSurfaceDropActive(false);
  }, []);

  const handlePresetsSurfaceDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const payload = resolvePayload(event.dataTransfer, activePresetDragPayloadRef.current);
      if (!payload || payload.source !== "panel") return;
      event.preventDefault();
      event.stopPropagation();
      setIsPresetsSurfaceDropActive(false);
      fireAndForget(removePresetFromPanel(payload.presetId));
    },
    [fireAndForget, removePresetFromPanel, resolvePayload]
  );

  return {
    isPresetPanelDropActive,
    isPresetsSurfaceDropActive,
    resetPresetDropState,
    handleSurfacePresetDragStart,
    handlePanelPresetDragStart,
    handlePresetDragEnd,
    handlePresetPanelDragOver,
    handlePresetPanelDragLeave,
    handlePresetPanelDrop,
    handlePresetsSurfaceDragOver,
    handlePresetsSurfaceDragLeave,
    handlePresetsSurfaceDrop,
  };
};
