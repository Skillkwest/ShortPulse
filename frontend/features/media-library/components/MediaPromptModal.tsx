/**
 * Saved-prompt modal view for Media Library.
 * Renders prompt edit/delete UI while delegating persistence behavior to injected handlers.
 */
import { CheckCircle } from "phosphor-react";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";

export type MediaPromptModalRow = {
  id: string;
};

export type MediaPromptModalProps<TRow extends MediaPromptModalRow> = {
  closePromptModal: () => void;
  deletePrompt: (row: TRow, options?: { fromPromptModal?: boolean }) => Promise<boolean>;
  focusedPrompt: TRow;
  handlePromptEditChange: (nextValue: string) => void;
  promptEditValue: string;
  promptModalError: string | null;
  promptSaveSuccess: boolean;
  savePromptEdits: () => Promise<void>;
  savingPromptEdit: boolean;
};

/**
 * Renders prompt editing modal UI for the focused saved prompt.
 * Inputs: focused prompt row plus edit/delete handlers and state.
 * Output: modal markup bound to provided callbacks.
 * Side effects: none.
 */
export function MediaPromptModal<TRow extends MediaPromptModalRow>({
  closePromptModal,
  deletePrompt,
  focusedPrompt,
  handlePromptEditChange,
  promptEditValue,
  promptModalError,
  promptSaveSuccess,
  savePromptEdits,
  savingPromptEdit,
}: MediaPromptModalProps<TRow>) {
  useVisibleErrorTelemetry({
    source: "client.media_library.prompt_modal_error",
    scope: "app",
    severity: "medium",
    message: promptModalError,
    metadata: {
      prompt_id: focusedPrompt.id,
    },
  });

  return (
    <div
      className="media-modal prompt-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-modal-title"
    >
      <div className="media-modal-backdrop" onClick={closePromptModal} />
      <div className="prompt-modal-content">
        <div className="prompt-modal-top-actions">
          <button
            className="btn-danger modal-pill-btn prompt-modal-delete-btn"
            type="button"
            onClick={() => {
              void deletePrompt(focusedPrompt, { fromPromptModal: true });
            }}
            disabled={savingPromptEdit}
          >
            Delete
          </button>
          <button
            className="btn-secondary close-btn modal-pill-btn modal-close-pill prompt-modal-close-btn"
            type="button"
            onClick={closePromptModal}
            aria-label="Close prompt editor"
            disabled={savingPromptEdit}
          >
            ×
          </button>
        </div>

        <label htmlFor="promptEditInput" id="prompt-modal-title" className="eyebrow">
          Saved prompt
        </label>
        <textarea
          id="promptEditInput"
          className="prompt-modal-textarea"
          value={promptEditValue}
          onChange={(event) => {
            handlePromptEditChange(event.target.value);
          }}
          placeholder="Edit your prompt..."
        />

        {promptModalError ? (
          <div className="auth-error" role="alert" aria-live="assertive">
            {promptModalError}
          </div>
        ) : null}

        <div className="prompt-modal-footer">
          {promptSaveSuccess ? (
            <div className="rename-toast prompt-modal-toast" role="status" aria-live="polite">
              <CheckCircle size={16} weight="bold" />
              <span>Saved</span>
            </div>
          ) : (
            <span aria-hidden />
          )}
          <button
            className="btn-primary prompt-modal-save-btn"
            type="button"
            onClick={() => {
              void savePromptEdits();
            }}
            disabled={savingPromptEdit || !promptEditValue.trim()}
          >
            {savingPromptEdit ? "Saving..." : "Save edits"}
          </button>
        </div>
      </div>
    </div>
  );
}
