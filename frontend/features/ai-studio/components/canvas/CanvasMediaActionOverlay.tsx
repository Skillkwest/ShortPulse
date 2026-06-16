/**
 * Selected-media action overlay for Canvas scene items.
 * Reuses Reference Grid output-action rules while keeping Canvas state media-agnostic.
 */
import React from "react";
import {
  ArrowClockwise,
  CheckCircle,
  DownloadSimple,
  FloppyDisk,
  FlowArrow,
  X,
} from "phosphor-react";
import { canRerollOutput } from "../../logic/generationReplay";
import {
  canReloadWorkflowOutput,
  inferWorkflowReloadMediaKindForOutput,
} from "../../logic/workflowReload";
import {
  canDownloadReferenceOutput,
  canSaveReferenceOutput,
} from "../../logic/referenceActionAvailability";
import type { StudioOutput, WorkflowReloadMediaKindHint } from "../../types";
import type { CanvasMediaActions } from "./canvasWorkspaceContracts";
import type { CanvasSceneItem } from "./canvasTypes";

const isCanvasMediaItem = (
  item: CanvasSceneItem
): item is Extract<CanvasSceneItem, { kind: "image" | "video" | "audio" }> =>
  item.kind === "image" || item.kind === "video" || item.kind === "audio";

const stopCanvasActionEvent = (
  event: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
) => {
  event.preventDefault();
  event.stopPropagation();
};

const resolveCanvasMediaKindHint = (item: CanvasSceneItem): WorkflowReloadMediaKindHint | null => {
  if (!isCanvasMediaItem(item)) return null;
  return item.kind;
};

const renderSaveChip = (output: StudioOutput) => {
  if (!output.saveState || output.saveState === "idle") return null;
  const label =
    output.saveState === "saving"
      ? "Saving..."
      : output.saveState === "saved"
        ? "Saved"
        : output.saveState === "blocked_storage"
          ? "Storage full"
          : "Save failed";
  if (output.saveState === "saved") {
    return (
      <div className="reference-save-chip is-saved" aria-label="Saved">
        <CheckCircle size={16} weight="fill" aria-hidden />
      </div>
    );
  }
  return (
    <div className={`reference-save-chip is-${output.saveState}`}>
      <span>{label}</span>
    </div>
  );
};

/**
 * Renders selected Canvas media actions backed by an existing `StudioOutput`.
 */
export function CanvasMediaActionOverlay({
  item,
  actions,
}: {
  item: CanvasSceneItem;
  actions?: CanvasMediaActions;
}) {
  if (!actions || !item.selected || !isCanvasMediaItem(item)) return null;
  const output = actions.getOutputForCanvasItem(item);
  if (!output) return null;

  const saveDisabled =
    actions.isMediaStorageFull || output.saveState === "saving" || output.saveState === "saved";
  const saveLabel = actions.isMediaStorageFull
    ? "Storage full"
    : output.saveState === "failed" || output.saveState === "blocked_storage"
      ? "Retry save"
      : "Save to media library";
  const shouldShowSaveAction = Boolean(
    actions.onSaveToLibrary && canSaveReferenceOutput(output) && output.saveState !== "saved"
  );
  const shouldShowDownloadAction = Boolean(
    actions.onDownload && canDownloadReferenceOutput(output)
  );
  const shouldShowDeleteAction = Boolean(actions.onDeleteOutput);
  const shouldShowRerollAction = Boolean(
    actions.onRerollOutput && item.kind === "image" && canRerollOutput(output)
  );
  const mediaKindHint = inferWorkflowReloadMediaKindForOutput(output, {
    mediaKindHint: resolveCanvasMediaKindHint(item),
  });
  const shouldShowWorkflowReloadAction = Boolean(
    actions.onReloadWorkflowOutput && canReloadWorkflowOutput(output, { mediaKindHint })
  );
  const saveIcon =
    output.saveState === "failed" ? (
      <ArrowClockwise size={16} weight="bold" aria-hidden />
    ) : (
      <FloppyDisk size={16} weight="bold" aria-hidden />
    );
  const shouldShowTopActions = Boolean(
    shouldShowSaveAction || shouldShowDownloadAction || shouldShowDeleteAction
  );
  const shouldShowReplayActions = Boolean(shouldShowRerollAction || shouldShowWorkflowReloadAction);

  return (
    <>
      {renderSaveChip(output)}
      {shouldShowTopActions ? (
        <div
          className="canvas-scene-item__media-action-row canvas-scene-item__media-action-row--top"
          aria-label="Canvas media actions"
          onPointerDown={stopCanvasActionEvent}
          onPointerUp={(event) => event.stopPropagation()}
          onDoubleClick={stopCanvasActionEvent}
        >
          {shouldShowSaveAction ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label={saveLabel}
              disabled={saveDisabled}
              onClick={(event) => {
                stopCanvasActionEvent(event);
                actions.onSelectOutput?.(output.id);
                actions.onSaveToLibrary?.(output);
              }}
            >
              {saveIcon}
            </button>
          ) : null}
          {shouldShowDownloadAction ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label="Download reference"
              onClick={(event) => {
                stopCanvasActionEvent(event);
                actions.onSelectOutput?.(output.id);
                actions.onDownload?.(output);
              }}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {shouldShowDeleteAction ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-action-btn--danger"
              aria-label="Remove reference from grid"
              onClick={(event) => {
                stopCanvasActionEvent(event);
                actions.onDeleteOutput?.(output.id);
              }}
            >
              <X size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      {shouldShowReplayActions ? (
        <div
          className="canvas-scene-item__media-action-row canvas-scene-item__media-action-row--bottom"
          aria-label="Canvas media replay actions"
          onPointerDown={stopCanvasActionEvent}
          onPointerUp={(event) => event.stopPropagation()}
          onDoubleClick={stopCanvasActionEvent}
        >
          {shouldShowRerollAction ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-reroll-btn"
              aria-label="Re-roll image"
              onClick={(event) => {
                stopCanvasActionEvent(event);
                actions.onSelectOutput?.(output.id);
                actions.onRerollOutput?.(output);
              }}
            >
              <ArrowClockwise size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {shouldShowWorkflowReloadAction ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-workflow-reload-btn"
              aria-label="Reload workflow"
              onClick={(event) => {
                stopCanvasActionEvent(event);
                actions.onSelectOutput?.(output.id);
                actions.onReloadWorkflowOutput?.(output, { mediaKindHint });
              }}
            >
              <FlowArrow size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
