import React, { type MutableRefObject } from "react";
import { CheckCircle, TrashSimple, X } from "phosphor-react";
import { useMediaMasonryVirtualization } from "../../../media-library/hooks/useMediaMasonryVirtualization";
import { MEDIA_LIBRARY_VIRTUALIZATION_ENABLED } from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import { formatDate, type PromptRow } from "../../logic/mediaLibraryModalModel";
import { MediaLibraryPromptReferenceCard } from "./MediaLibraryPromptReferenceCard";

const PROMPT_REFERENCE_CARD_ASPECT_RATIO = 4 / 5;

type MediaLibraryPromptGridProps = {
  prompts: PromptRow[];
  sortedPrompts: PromptRow[];
  selectedIds: Set<string>;
  onSelectPromptCard: (prompt: PromptRow) => void;
  onPromptDoubleClick?: (prompt: PromptRow) => void;
  onPromptDragStart?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onPromptDragEnd?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  showRemoveAction?: boolean;
  onRemovePromptFromFolder?: (prompt: PromptRow) => void;
  showDeleteAction?: boolean;
  onDeletePromptFromLibrary?: (prompt: PromptRow) => void;
  variant?: "default" | "reference-card";
  scrollContainerRef?: MutableRefObject<HTMLElement | null>;
};

type MediaLibraryPromptReferenceGridProps = Omit<MediaLibraryPromptGridProps, "variant">;

function MediaLibraryPromptReferenceGrid({
  prompts,
  sortedPrompts,
  selectedIds,
  onSelectPromptCard,
  onPromptDoubleClick,
  onPromptDragStart,
  onPromptDragEnd,
  showRemoveAction = false,
  onRemovePromptFromFolder,
  showDeleteAction = false,
  onDeletePromptFromLibrary,
  scrollContainerRef,
}: MediaLibraryPromptReferenceGridProps) {
  const {
    containerRef: virtualContainerRef,
    isVirtualized,
    totalHeight: virtualTotalHeight,
    renderItems: virtualRenderItems,
  } = useMediaMasonryVirtualization({
    items: sortedPrompts,
    getItemId: (prompt) => prompt.id,
    getAspectRatio: () => PROMPT_REFERENCE_CARD_ASPECT_RATIO,
    enabled: MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
    scrollContainerRef,
    targetColumnWidth: 188,
    maxColumnCount: 5,
    gap: 8,
    overscanPx: 920,
    minItemsToVirtualize: 1,
    layoutMode: "chronological-grid",
  });
  const gridStyle = isVirtualized
    ? ({
        height: `${virtualTotalHeight}px`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      ref={virtualContainerRef}
      className={`prompt-grid media-library-prompt-grid media-library-prompt-grid--reference-cards${
        isVirtualized ? " media-library-modal-grid-virtualized" : ""
      }`}
      style={gridStyle}
    >
      {prompts.length === 0 ? (
        <p className="tiny subdued">No saved prompts yet.</p>
      ) : (
        virtualRenderItems.map((renderItem) => {
          const prompt = renderItem.item;
          const isSelected = selectedIds.has(prompt.id);
          return (
            <div key={renderItem.id} style={renderItem.style}>
              <MediaLibraryPromptReferenceCard
                prompt={prompt}
                isSelected={isSelected}
                onSelectPromptCard={onSelectPromptCard}
                onPromptDoubleClick={onPromptDoubleClick}
                onPromptDragStart={onPromptDragStart}
                onPromptDragEnd={onPromptDragEnd}
                showRemoveAction={showRemoveAction}
                onRemovePromptFromFolder={onRemovePromptFromFolder}
                showDeleteAction={showDeleteAction}
                onDeletePromptFromLibrary={onDeletePromptFromLibrary}
                shellStyle={renderItem.style ? { height: "100%" } : undefined}
              />
            </div>
          );
        })
      )}
    </div>
  );
}

export function MediaLibraryPromptGrid({
  prompts,
  sortedPrompts,
  selectedIds,
  onSelectPromptCard,
  onPromptDoubleClick,
  onPromptDragStart,
  onPromptDragEnd,
  showRemoveAction = false,
  onRemovePromptFromFolder,
  showDeleteAction = false,
  onDeletePromptFromLibrary,
  variant = "default",
  scrollContainerRef,
}: MediaLibraryPromptGridProps) {
  if (variant === "reference-card") {
    return (
      <MediaLibraryPromptReferenceGrid
        prompts={prompts}
        sortedPrompts={sortedPrompts}
        selectedIds={selectedIds}
        onSelectPromptCard={onSelectPromptCard}
        onPromptDoubleClick={onPromptDoubleClick}
        onPromptDragStart={onPromptDragStart}
        onPromptDragEnd={onPromptDragEnd}
        showRemoveAction={showRemoveAction}
        onRemovePromptFromFolder={onRemovePromptFromFolder}
        showDeleteAction={showDeleteAction}
        onDeletePromptFromLibrary={onDeletePromptFromLibrary}
        scrollContainerRef={scrollContainerRef}
      />
    );
  }

  return (
    <div className="prompt-grid media-library-prompt-grid">
      {prompts.length === 0 ? (
        <p className="tiny subdued">No saved prompts yet.</p>
      ) : (
        sortedPrompts.map((prompt) => {
          const isSelected = selectedIds.has(prompt.id);
          const promptLabel = prompt.title?.trim() || "Saved prompt";
          const promptCardLabel = `${isSelected ? "Deselect" : "Select"} prompt ${promptLabel}`;
          return (
            <div
              key={prompt.id}
              className={`media-library-panel-prompt-reference-shell${isSelected ? " is-active" : ""}`}
            >
              <button
                type="button"
                className={`prompt-card media-library-prompt-card${isSelected ? " is-selected" : ""}`}
                aria-label={promptCardLabel}
                aria-pressed={isSelected}
                draggable={Boolean(onPromptDragStart)}
                onClick={() => onSelectPromptCard(prompt)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPromptDoubleClick?.(prompt);
                }}
                onDragStart={(event) => onPromptDragStart?.(event, prompt)}
                onDragEnd={(event) => onPromptDragEnd?.(event, prompt)}
              >
                {isSelected ? (
                  <span className="media-library-select-indicator" aria-hidden>
                    <CheckCircle size={16} weight="fill" />
                  </span>
                ) : null}
                <div className="prompt-card-header">
                  <div>
                    <p className="metric-label">{prompt.title || "Saved prompt"}</p>
                    <p className="metric-value tiny">{formatDate(prompt.created_at)}</p>
                  </div>
                  <span className="pill tiny">Prompt</span>
                </div>
                <p className="prompt-card-body">{prompt.prompt_text}</p>
              </button>
              {showRemoveAction && onRemovePromptFromFolder ? (
                <div className="media-library-panel-card-actions" aria-label="Folder actions">
                  <button
                    type="button"
                    className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
                    aria-label={`Remove ${prompt.title || "prompt"} from this folder`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemovePromptFromFolder(prompt);
                    }}
                  >
                    <X size={16} weight="bold" aria-hidden />
                  </button>
                </div>
              ) : null}
              {showDeleteAction && onDeletePromptFromLibrary ? (
                <div className="media-library-panel-card-actions" aria-label="Library actions">
                  <button
                    type="button"
                    className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
                    aria-label={`Delete ${prompt.title || "prompt"} from library`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDeletePromptFromLibrary(prompt);
                    }}
                  >
                    <TrashSimple size={16} weight="bold" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
