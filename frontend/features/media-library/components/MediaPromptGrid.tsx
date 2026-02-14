/**
 * Saved-prompt grid for Media Library.
 * Renders prompt cards with selection, open-modal, and delete actions.
 */
import { CheckCircle } from "phosphor-react";

type MediaPromptGridRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string;
  created_at: string;
};

type MediaPromptGridProps<TRow extends MediaPromptGridRow> = {
  deletePrompt: (row: TRow) => Promise<boolean>;
  formatDate: (value: string) => string;
  openPromptModal: (prompt: TRow) => void;
  prompts: TRow[];
  selectedIds: string[];
  togglePromptSelect: (promptId: string) => void;
};

/**
 * Renders saved-prompt cards with selection and CRUD interactions.
 * Inputs: prompt rows plus selection and modal/delete callbacks.
 * Output: prompt grid markup.
 * Side effects: none.
 */
export function MediaPromptGrid<TRow extends MediaPromptGridRow>({
  deletePrompt,
  formatDate,
  openPromptModal,
  prompts,
  selectedIds,
  togglePromptSelect,
}: MediaPromptGridProps<TRow>) {
  return (
    <div className="prompt-grid">
      {prompts.map((promptItem) => (
        <div
          className={`prompt-card ${selectedIds.includes(promptItem.id) ? "is-selected" : ""}`}
          key={promptItem.id}
          role="button"
          tabIndex={0}
          aria-pressed={selectedIds.includes(promptItem.id)}
          onClick={() => togglePromptSelect(promptItem.id)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            openPromptModal(promptItem);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              togglePromptSelect(promptItem.id);
            }
          }}
        >
          {selectedIds.includes(promptItem.id) ? (
            <span className="prompt-select-indicator" aria-hidden>
              <CheckCircle size={16} weight="fill" />
            </span>
          ) : null}
          <div className="prompt-card-header">
            <div>
              <p className="metric-label">{promptItem.title || "Saved prompt"}</p>
              <p className="metric-value tiny">{formatDate(promptItem.created_at)}</p>
            </div>
            <span className="pill tiny">{promptItem.mode}</span>
          </div>
          <p className="prompt-card-body">{promptItem.prompt_text}</p>
          <div className="prompt-card-footer">
            <button
              type="button"
              className="btn-secondary prompt-delete-btn"
              onClick={(event) => {
                event.stopPropagation();
                void deletePrompt(promptItem);
              }}
              aria-label={`Delete prompt: ${promptItem.title || "Saved prompt"}`}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
