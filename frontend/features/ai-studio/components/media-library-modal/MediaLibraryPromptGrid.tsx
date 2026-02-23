import React from "react";
import { CheckCircle } from "phosphor-react";
import { formatDate, type PromptRow } from "../../logic/mediaLibraryModalModel";

type MediaLibraryPromptGridProps = {
  prompts: PromptRow[];
  sortedPrompts: PromptRow[];
  selectedIds: Set<string>;
  onSelectPromptCard: (prompt: PromptRow) => void;
};

export function MediaLibraryPromptGrid({
  prompts,
  sortedPrompts,
  selectedIds,
  onSelectPromptCard,
}: MediaLibraryPromptGridProps) {
  return (
    <div className="prompt-grid media-library-prompt-grid">
      {prompts.length === 0 ? (
        <p className="tiny subdued">No saved prompts yet.</p>
      ) : (
        sortedPrompts.map((prompt) => {
          const isSelected = selectedIds.has(prompt.id);
          return (
            <button
              key={prompt.id}
              type="button"
              className={`prompt-card media-library-prompt-card${isSelected ? " is-selected" : ""}`}
              aria-pressed={isSelected}
              onClick={() => onSelectPromptCard(prompt)}
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
          );
        })
      )}
    </div>
  );
}
