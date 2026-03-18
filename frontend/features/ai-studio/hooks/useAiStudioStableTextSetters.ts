/**
 * AI Studio stable text setter helpers.
 * Provides equality-guarded text state updaters so the root state hook can stay smaller and avoid redundant writes.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";

type UseAiStudioStableTextSettersParams = {
  setPrompt: Dispatch<SetStateAction<string>>;
  setEditReferenceTextState: Dispatch<SetStateAction<string>>;
  setVideoReferenceTextState: Dispatch<SetStateAction<string>>;
};

/**
 * Returns stable equality-guarded text setters for prompt and reference fields.
 */
export const useAiStudioStableTextSetters = ({
  setPrompt,
  setEditReferenceTextState,
  setVideoReferenceTextState,
}: UseAiStudioStableTextSettersParams) => {
  const setSharedPrompt = useCallback(
    (value: string) => {
      setPrompt((prev) => (prev === value ? prev : value));
    },
    [setPrompt]
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

  return {
    setSharedPrompt,
    setEditReferenceText,
    setVideoReferenceText,
  };
};
