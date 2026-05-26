import { useCallback, useRef, useState } from "react";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";

type UseAiStudioCharacterPanelUploadBridgeResult = {
  addCharacterReferences: (files: FileList | File[]) => void;
  pendingCharacterUploadRequest: CharacterPanelUploadRequest | null;
  clearPendingCharacterUploadRequest: (requestId: number) => void;
};

/**
 * Bridges AI Studio character-tool file drops into the embedded Character Manager.
 */
export const useAiStudioCharacterPanelUploadBridge =
  (): UseAiStudioCharacterPanelUploadBridgeResult => {
    const [pendingCharacterUploadRequest, setPendingCharacterUploadRequest] =
      useState<CharacterPanelUploadRequest | null>(null);
    const nextRequestIdRef = useRef(0);

    const addCharacterReferences = useCallback((files: FileList | File[]) => {
      const nextFiles = Array.from(files).filter((file): file is File => file instanceof File);
      if (!nextFiles.length) return;

      nextRequestIdRef.current += 1;
      setPendingCharacterUploadRequest({
        requestId: nextRequestIdRef.current,
        files: nextFiles,
      });
    }, []);

    const clearPendingCharacterUploadRequest = useCallback((requestId: number) => {
      setPendingCharacterUploadRequest((current) => {
        if (!current || current.requestId !== requestId) return current;
        return null;
      });
    }, []);

    return {
      addCharacterReferences,
      pendingCharacterUploadRequest,
      clearPendingCharacterUploadRequest,
    };
  };
