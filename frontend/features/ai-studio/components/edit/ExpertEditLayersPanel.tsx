import React from "react";
import { StackSimple, TrashSimple, X } from "phosphor-react";

import {
  editLayerUtilityActions,
  FLATTEN_IMAGE_ACTION_ID,
  REMOVE_BACKGROUND_ACTION_ID,
} from "./expertEditPanelViewContract";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";

type ExpertEditLayersPanelProps = {
  scope: "main" | "modal";
  placement?: "stage" | "sidebar";
  layers: ExpertEditLayer[];
  editingLayerIndex: number | null;
  editingLayerValue: string;
  draggingLayerIndex: number | null;
  dragOverLayerIndex: number | null;
  resolvedSelectedLayerIndex: number;
  statusToastMessage: string | null;
  statusToastTone: "info" | "warning";
  isStatusToastFading: boolean;
  isLayerLimitStatusToast: boolean;
  isGenerateDisabled: boolean;
  selectedLayerImageUrl: string | null;
  isRemoveBackgroundPending: boolean;
  populatedLayerCount: number;
  isFlattenPending: boolean;
  setEditingLayerValue: (value: string) => void;
  onCommitLayerRename: (index: number) => void;
  onClearLayerEditing: () => void;
  onBeginLayerRename: (index: number, value: string) => void;
  onLayerDragStart: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onLayerDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onLayerDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onLayerDragEnd: () => void;
  onSelectLayer: (index: number) => void;
  onDeleteLayer: (index: number) => void;
  onFlatten: () => void;
  onRemoveBackground: () => void;
  onCloseModal?: () => void;
  modalLayersRef?: React.Ref<HTMLDivElement>;
};

type ExpertEditLayerUtilityActionsProps = {
  isGenerateDisabled: boolean;
  selectedLayerImageUrl: string | null;
  isRemoveBackgroundPending: boolean;
  populatedLayerCount: number;
  isFlattenPending: boolean;
  onFlatten: () => void;
  onRemoveBackground: () => void;
  className?: string | null;
  ariaLabel?: string;
};

export function ExpertEditLayerUtilityActions({
  isGenerateDisabled,
  selectedLayerImageUrl,
  isRemoveBackgroundPending,
  populatedLayerCount,
  isFlattenPending,
  onFlatten,
  onRemoveBackground,
  className = "edit-expert-layers-actions",
  ariaLabel = "Layer utility actions",
}: ExpertEditLayerUtilityActionsProps) {
  const actionButtons = editLayerUtilityActions.map((action) => {
    const Icon = action.icon;
    const actionCreditCost = action.creditCost;
    const isFlattenAction = action.id === FLATTEN_IMAGE_ACTION_ID;
    const isFlattenActionPending = isFlattenAction && isFlattenPending;
    const isActionDisabled = Boolean(
      (action.id === REMOVE_BACKGROUND_ACTION_ID &&
        (isGenerateDisabled || !selectedLayerImageUrl || isRemoveBackgroundPending)) ||
      (isFlattenAction && (populatedLayerCount <= 0 || isFlattenPending))
    );

    return (
      <button
        key={action.id}
        type="button"
        className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
        aria-label={isFlattenActionPending ? "Flattening layers" : action.label}
        aria-busy={isFlattenActionPending || undefined}
        disabled={isActionDisabled}
        onClick={
          isFlattenAction
            ? onFlatten
            : action.id === REMOVE_BACKGROUND_ACTION_ID
              ? onRemoveBackground
              : undefined
        }
      >
        <span className="edit-expert-preset-action-btn-icon" aria-hidden="true">
          {isFlattenActionPending ? (
            <span className="edit-expert-preset-action-btn-spinner" />
          ) : (
            <Icon size={20} weight="regular" />
          )}
        </span>
        <span className="edit-expert-preset-action-btn-copy">
          <span>{isFlattenActionPending ? "Flattening..." : action.label}</span>
        </span>
        {actionCreditCost != null ? (
          <span className="edit-expert-preset-action-btn-cost-column" aria-hidden="true">
            <span className="edit-expert-preset-action-btn-cost">
              <span className="model-chip-icon">✦</span>
              <span className="model-chip-credits">{actionCreditCost}</span>
            </span>
          </span>
        ) : null}
      </button>
    );
  });

  if (className == null) {
    return <>{actionButtons}</>;
  }

  return (
    <div className={className} aria-label={ariaLabel}>
      {actionButtons}
    </div>
  );
}

export function ExpertEditLayersPanel({
  scope,
  placement = "stage",
  layers,
  editingLayerIndex,
  editingLayerValue,
  draggingLayerIndex,
  dragOverLayerIndex,
  resolvedSelectedLayerIndex,
  statusToastMessage,
  statusToastTone,
  isStatusToastFading,
  isLayerLimitStatusToast,
  isGenerateDisabled,
  selectedLayerImageUrl,
  isRemoveBackgroundPending,
  populatedLayerCount,
  isFlattenPending,
  setEditingLayerValue,
  onCommitLayerRename,
  onClearLayerEditing,
  onBeginLayerRename,
  onLayerDragStart,
  onLayerDragOver,
  onLayerDrop,
  onLayerDragEnd,
  onSelectLayer,
  onDeleteLayer,
  onFlatten,
  onRemoveBackground,
  onCloseModal,
  modalLayersRef,
}: ExpertEditLayersPanelProps) {
  const isModalScope = scope === "modal";

  const layersToolbarBody = (
    <>
      <div
        className={`edit-expert-layers-toolbar-card ${
          isModalScope ? "" : "edit-expert-layers-toolbar-card--inline"
        }`.trim()}
      >
        {!isModalScope ? (
          <div className="edit-expert-layers-toolbar-title-card edit-expert-layers-toolbar-title-card--embedded">
            <p className="edit-expert-layers-toolbar-title">Layers</p>
            <span className="edit-expert-layers-toolbar-title-icon" aria-hidden="true">
              <StackSimple size={14} weight="regular" />
            </span>
          </div>
        ) : null}
        <div className="edit-expert-layers-toolbar-list">
          {layers.map((layer, index) =>
            editingLayerIndex === index ? (
              <input
                key={layer.id}
                type="text"
                className="edit-expert-layer-input"
                value={editingLayerValue}
                autoFocus
                aria-label={`Rename ${layer.name}`}
                onChange={(event) => setEditingLayerValue(event.target.value)}
                onBlur={() => onCommitLayerRename(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCommitLayerRename(index);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onClearLayerEditing();
                  }
                }}
              />
            ) : (
              <div
                key={layer.id}
                className={`edit-expert-layer-row ${
                  draggingLayerIndex === index ? "is-dragging" : ""
                } ${dragOverLayerIndex === index ? "is-drop-target" : ""}`.trim()}
                draggable={editingLayerIndex !== index}
                onDragStart={(event) => onLayerDragStart(event, index)}
                onDragOver={(event) => onLayerDragOver(event, index)}
                onDrop={(event) => onLayerDrop(event, index)}
                onDragEnd={onLayerDragEnd}
              >
                <button
                  type="button"
                  className={`edit-expert-preset-btn edit-expert-layer-btn ${
                    resolvedSelectedLayerIndex === index ? "is-selected" : ""
                  }`}
                  onClick={() => onSelectLayer(index)}
                  onDoubleClick={() => onBeginLayerRename(index, layer.name)}
                >
                  <span className="edit-expert-layer-label">{layer.name}</span>
                </button>
                <button
                  type="button"
                  className="edit-expert-layer-delete-btn"
                  aria-label={`Delete ${layer.name}`}
                  onClick={() => onDeleteLayer(index)}
                >
                  <TrashSimple size={12} weight="regular" />
                </button>
              </div>
            )
          )}
        </div>
      </div>
      {isModalScope ? (
        <ExpertEditLayerUtilityActions
          isGenerateDisabled={isGenerateDisabled}
          selectedLayerImageUrl={selectedLayerImageUrl}
          isRemoveBackgroundPending={isRemoveBackgroundPending}
          populatedLayerCount={populatedLayerCount}
          isFlattenPending={isFlattenPending}
          onFlatten={onFlatten}
          onRemoveBackground={onRemoveBackground}
        />
      ) : null}
      {statusToastMessage && isLayerLimitStatusToast ? (
        <div
          className={`edit-expert-stage-status-toast edit-expert-stage-status-toast--layers ${
            statusToastTone === "warning" ? "is-warning" : "is-info"
          } ${isStatusToastFading ? "is-fading" : ""}`.trim()}
          role="status"
          aria-live="polite"
        >
          {statusToastMessage}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      ref={isModalScope ? modalLayersRef : undefined}
      className={`edit-expert-layers-toolbar ${
        isModalScope
          ? "edit-expert-layers-toolbar--modal"
          : placement === "sidebar"
            ? "edit-expert-layers-toolbar--sidebar"
            : "edit-expert-layers-toolbar--inline"
      }`.trim()}
      aria-label={isModalScope ? "Expanded canvas layers toolbar" : "Edit layers toolbar"}
    >
      {isModalScope ? (
        <>
          <div className="edit-expert-layers-toolbar-header-row">
            <div className="edit-expert-layers-toolbar-title-card">
              <p className="edit-expert-layers-toolbar-title">Layers</p>
            </div>
            <button
              type="button"
              className="edit-expert-markup-modal-close-btn"
              aria-label="Close expanded markup canvas"
              onClick={onCloseModal}
            >
              <X size={14} weight="bold" />
            </button>
          </div>
          {layersToolbarBody}
        </>
      ) : (
        <>{layersToolbarBody}</>
      )}
    </div>
  );
}
