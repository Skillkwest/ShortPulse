import React from "react";
import { X } from "phosphor-react";
import type { PromptRow } from "../../logic/mediaLibraryModalModel";

type MediaLibraryPromptReferenceCardProps = {
  prompt: PromptRow;
  isSelected: boolean;
  onSelectPromptCard: (prompt: PromptRow) => void;
  onPromptDragStart?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onPromptDragEnd?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  showRemoveAction?: boolean;
  onRemovePromptFromFolder?: (prompt: PromptRow) => void;
  showDeleteAction?: boolean;
  onDeletePromptFromLibrary?: (prompt: PromptRow) => void;
  shellClassName?: string;
  cardClassName?: string;
  shellStyle?: React.CSSProperties;
};

export function MediaLibraryPromptReferenceCard({
  prompt,
  isSelected,
  onSelectPromptCard,
  onPromptDragStart,
  onPromptDragEnd,
  showRemoveAction = false,
  onRemovePromptFromFolder,
  showDeleteAction = false,
  onDeletePromptFromLibrary,
  shellClassName,
  cardClassName,
  shellStyle,
}: MediaLibraryPromptReferenceCardProps) {
  const shellClasses = [
    "media-library-panel-prompt-reference-shell",
    isSelected ? "is-active" : null,
    shellClassName ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  const cardClasses = [
    "reference-card",
    "has-text",
    "media-library-panel-prompt-reference-card",
    isSelected ? "is-active" : null,
    cardClassName ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClasses} style={shellStyle}>
      <button
        type="button"
        className={cardClasses}
        aria-pressed={isSelected}
        draggable={Boolean(onPromptDragStart)}
        onClick={() => onSelectPromptCard(prompt)}
        onDragStart={(event) => onPromptDragStart?.(event, prompt)}
        onDragEnd={(event) => onPromptDragEnd?.(event, prompt)}
      >
        <div className="media-library-panel-prompt-reference-frame">
          <div className="reference-card-text media-library-panel-prompt-reference-text">
            {prompt.prompt_text}
          </div>
        </div>
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
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
