/**
 * Prompt-modal CRUD controller for Media Library.
 * Owns open/close, edit-save, and prompt delete behavior for saved prompt modals.
 */
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { deleteMediaPromptById } from "../logic/mediaLibraryDataEffects";

type PromptModalRow = {
  id: string;
  prompt_text: string;
  updated_at: string;
};

type UseMediaPromptModalCrudArgs<TRow extends PromptModalRow> = {
  getErrorMessage: (error: unknown, fallback: string) => string;
  logMediaEvent: (
    eventType: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  setPageError: Dispatch<SetStateAction<string | null>>;
  setPrompts: Dispatch<SetStateAction<TRow[]>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
};

/**
 * Creates modal state and handlers for focused prompt CRUD operations.
 * Inputs: prompt list/select state setters plus shared error/event callbacks.
 * Output: prompt modal state and actions for open/close, edit-save, and delete.
 * Side effects: executes Supabase prompt updates/deletes and emits media events.
 */
export const useMediaPromptModalCrud = <TRow extends PromptModalRow>({
  getErrorMessage,
  logMediaEvent,
  setPageError,
  setPrompts,
  setSelectedIds,
}: UseMediaPromptModalCrudArgs<TRow>) => {
  const [focusedPrompt, setFocusedPrompt] = useState<TRow | null>(null);
  const [promptEditValue, setPromptEditValue] = useState("");
  const [savingPromptEdit, setSavingPromptEdit] = useState(false);
  const [promptModalError, setPromptModalError] = useState<string | null>(null);
  const [promptSaveSuccess, setPromptSaveSuccess] = useState(false);

  const openPromptModal = useCallback((prompt: TRow) => {
    setFocusedPrompt(prompt);
    setPromptEditValue(prompt.prompt_text ?? "");
    setPromptModalError(null);
    setPromptSaveSuccess(false);
  }, []);

  const closePromptModal = useCallback(() => {
    if (savingPromptEdit) return;
    setFocusedPrompt(null);
    setPromptEditValue("");
    setPromptModalError(null);
    setPromptSaveSuccess(false);
  }, [savingPromptEdit]);

  const handlePromptEditChange = useCallback((nextValue: string) => {
    setPromptEditValue(nextValue);
    setPromptSaveSuccess(false);
  }, []);

  const deletePrompt = useCallback(
    async (
      row: TRow,
      options: {
        fromPromptModal?: boolean;
      } = {}
    ): Promise<boolean> => {
      setPageError(null);
      if (options.fromPromptModal) {
        setPromptModalError(null);
      }
      try {
        await deleteMediaPromptById(row.id);
        setPrompts((prev) => prev.filter((prompt) => prompt.id !== row.id));
        setSelectedIds((prev) => prev.filter((id) => id !== row.id));
        setFocusedPrompt((prev) => (prev && prev.id === row.id ? null : prev));
        void logMediaEvent("delete", "media_prompt", row.id);
        return true;
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Unable to delete prompt");
        if (options.fromPromptModal) {
          setPromptModalError(message);
        } else {
          setPageError(message);
        }
        return false;
      }
    },
    [getErrorMessage, logMediaEvent, setPageError, setPrompts, setSelectedIds]
  );

  const savePromptEdits = useCallback(async () => {
    if (!focusedPrompt || !promptEditValue.trim()) return;
    setSavingPromptEdit(true);
    setPromptModalError(null);
    setPromptSaveSuccess(false);
    try {
      const supabase = ensureSupabaseClient();
      const nextPromptText = promptEditValue;
      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from("media_prompts")
        .update({ prompt_text: nextPromptText })
        .eq("id", focusedPrompt.id);
      if (error) throw error;
      setPrompts((prev) =>
        prev.map((prompt) =>
          prompt.id === focusedPrompt.id
            ? {
                ...prompt,
                prompt_text: nextPromptText,
                updated_at: updatedAt,
              }
            : prompt
        )
      );
      setFocusedPrompt((prev) =>
        prev
          ? {
              ...prev,
              prompt_text: nextPromptText,
              updated_at: updatedAt,
            }
          : prev
      );
      setPromptSaveSuccess(true);
      window.setTimeout(() => {
        setPromptSaveSuccess(false);
      }, 1600);
      void logMediaEvent("edit", "media_prompt", focusedPrompt.id, {
        updated_fields: ["prompt_text"],
      });
    } catch (err: unknown) {
      setPromptModalError(getErrorMessage(err, "Unable to save prompt edits"));
    } finally {
      setSavingPromptEdit(false);
    }
  }, [focusedPrompt, getErrorMessage, logMediaEvent, promptEditValue, setPrompts]);

  return {
    closePromptModal,
    deletePrompt,
    focusedPrompt,
    handlePromptEditChange,
    openPromptModal,
    promptEditValue,
    promptModalError,
    promptSaveSuccess,
    savePromptEdits,
    savingPromptEdit,
  };
};
