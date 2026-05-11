import { useCallback, useRef, useState } from "react";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";

type UseAiStudioCharacterPanelUploadBridgeResult = {
  characterError: string | null;
  addCharacterReferences: (files: FileList | File[]) => void;
  clearCharacterError: () => void;
  pendingCharacterUploadRequest: CharacterPanelUploadRequest | null;
  clearPendingCharacterUploadRequest: (requestId: number) => void;
};

/**
 * Bridges AI Studio character-tool file drops into the embedded Character Manager.
 */
export const useAiStudioCharacterPanelUploadBridge =
  (): UseAiStudioCharacterPanelUploadBridgeResult => {
    const [characterError, setCharacterError] = useState<string | null>(null);
    const [pendingCharacterUploadRequest, setPendingCharacterUploadRequest] =
      useState<CharacterPanelUploadRequest | null>(null);
    const nextRequestIdRef = useRef(0);

    const addCharacterReferences = useCallback((files: FileList | File[]) => {
      const nextFiles = Array.from(files).filter((file): file is File => file instanceof File);
      if (!nextFiles.length) return;

      nextRequestIdRef.current += 1;
      setCharacterError(null);
      setPendingCharacterUploadRequest({
        requestId: nextRequestIdRef.current,
        files: nextFiles,
      });
    }, []);

    const clearCharacterError = useCallback(() => {
      setCharacterError(null);
    }, []);

    const clearPendingCharacterUploadRequest = useCallback((requestId: number) => {
      setPendingCharacterUploadRequest((current) => {
        if (!current || current.requestId !== requestId) return current;
        return null;
      });
    }, []);

    return {
      characterError,
      addCharacterReferences,
      clearCharacterError,
      pendingCharacterUploadRequest,
      clearPendingCharacterUploadRequest,
    };
  };
