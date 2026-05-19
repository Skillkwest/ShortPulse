/**
 * AI Studio stable text setter helpers.
 * Provides equality-guarded text state updaters so the root state hook can stay smaller and avoid redundant writes.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";

type UseAiStudioStableTextSettersParams = {
  expertCreateMode: "standard" | "pulse";
  setStandardPromptState: Dispatch<SetStateAction<string>>;
  setPulsePromptState: Dispatch<SetStateAction<string>>;
  setEditReferenceTextState: Dispatch<SetStateAction<string>>;
  setVideoReferenceTextState: Dispatch<SetStateAction<string>>;
  setMusicPromptDraftState: Dispatch<SetStateAction<string>>;
  setMusicLyricsDraftState: Dispatch<SetStateAction<string>>;
  setSoundEffectsPromptDraftState: Dispatch<SetStateAction<string>>;
  setVoiceDesignPromptDraftState: Dispatch<SetStateAction<string>>;
  setVoiceScriptDraftState: Dispatch<SetStateAction<string>>;
};

/**
 * Returns stable equality-guarded text setters for prompt and reference fields.
 */
export const useAiStudioStableTextSetters = ({
  expertCreateMode,
  setStandardPromptState,
  setPulsePromptState,
  setEditReferenceTextState,
  setVideoReferenceTextState,
  setMusicPromptDraftState,
  setMusicLyricsDraftState,
  setSoundEffectsPromptDraftState,
  setVoiceDesignPromptDraftState,
  setVoiceScriptDraftState,
}: UseAiStudioStableTextSettersParams) => {
  const setStandardCreatePrompt = useCallback(
    (value: string) => {
      setStandardPromptState((prev) => (prev === value ? prev : value));
    },
    [setStandardPromptState]
  );
  const setPulseCreatePrompt = useCallback(
    (value: string) => {
      setPulsePromptState((prev) => (prev === value ? prev : value));
    },
    [setPulsePromptState]
  );
  const setSharedPrompt = useCallback(
    (value: string) => {
      if (expertCreateMode === "pulse") {
        setPulseCreatePrompt(value);
        return;
      }
      setStandardCreatePrompt(value);
    },
    [expertCreateMode, setPulseCreatePrompt, setStandardCreatePrompt]
  );
  const setEditReferenceText = useCallback(
    (value: string) => {
      setEditReferenceTextState((prev) => (prev === value ? prev : value));
    },
    [setEditReferenceTextState]
  );
  const setVideoReferenceText = useCallback(
    (value: string) => {
      setVideoReferenceTextState((prev) => (prev === value ? prev : value));
    },
    [setVideoReferenceTextState]
  );
  const setMusicPromptDraft = useCallback(
    (value: string) => {
      setMusicPromptDraftState((prev) => (prev === value ? prev : value));
    },
    [setMusicPromptDraftState]
  );
  const setMusicLyricsDraft = useCallback(
    (value: string) => {
      setMusicLyricsDraftState((prev) => (prev === value ? prev : value));
    },
    [setMusicLyricsDraftState]
  );
  const setSoundEffectsPromptDraft = useCallback(
    (value: string) => {
      setSoundEffectsPromptDraftState((prev) => (prev === value ? prev : value));
    },
    [setSoundEffectsPromptDraftState]
  );
  const setVoiceDesignPromptDraft = useCallback(
    (value: string) => {
      setVoiceDesignPromptDraftState((prev) => (prev === value ? prev : value));
    },
    [setVoiceDesignPromptDraftState]
  );
  const setVoiceScriptDraft = useCallback(
    (value: string) => {
      setVoiceScriptDraftState((prev) => (prev === value ? prev : value));
    },
    [setVoiceScriptDraftState]
  );

  return {
    setSharedPrompt,
    setStandardCreatePrompt,
    setPulseCreatePrompt,
    setEditReferenceText,
    setVideoReferenceText,
    setMusicPromptDraft,
    setMusicLyricsDraft,
    setSoundEffectsPromptDraft,
    setVoiceDesignPromptDraft,
    setVoiceScriptDraft,
  };
};
