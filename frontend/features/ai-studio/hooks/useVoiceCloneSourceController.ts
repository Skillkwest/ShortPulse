/**
 * Voice clone source controller.
 * Owns audio-only clone sample staging, signing, duration probing, and local
 * object URL cleanup for the Create Voice clone workflow.
 */
import React from "react";
import {
  releaseVoiceChangerSource,
  type VoiceChangerSource,
} from "../logic/voiceChangerSourceIntake";
import {
  resolveVoiceChangerMediaDurationMs,
  resolveVoiceChangerSourceStoragePath,
  signVoiceSourceStoragePath,
  uploadVoiceCloneSourceFile,
} from "../utils/voiceChangerSourceAsset";

const cloneVoicePrepareFallbackMessage = "Unable to prepare the selected voice sample.";

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return cloneVoicePrepareFallbackMessage;
};

/**
 * Returns state and handlers for staging a clone-voice audio source.
 */
export const useVoiceCloneSourceController = () => {
  const [cloneVoiceSource, setCloneVoiceSource] = React.useState<VoiceChangerSource | null>(null);
  const [cloneVoiceError, setCloneVoiceError] = React.useState<string | null>(null);
  const previousCloneVoiceSourceRef = React.useRef<VoiceChangerSource | null>(null);
  const cloneVoiceSourceRequestIdRef = React.useRef(0);

  const resetCloneVoiceSource = React.useCallback(() => {
    releaseVoiceChangerSource(previousCloneVoiceSourceRef.current);
    previousCloneVoiceSourceRef.current = null;
    cloneVoiceSourceRequestIdRef.current += 1;
    setCloneVoiceSource(null);
    setCloneVoiceError(null);
  }, []);

  const handleCloneVoiceSourceChange = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      const requestId = cloneVoiceSourceRequestIdRef.current + 1;
      cloneVoiceSourceRequestIdRef.current = requestId;
      setCloneVoiceError(null);

      if (!nextSource) {
        setCloneVoiceSource(null);
        return;
      }

      if (nextSource.kind !== "audio") {
        setCloneVoiceSource({
          ...nextSource,
          status: "failed",
          errorMessage: "Clone Voice accepts audio samples only.",
        });
        return;
      }

      const initialStatus = nextSource.file ? "uploading" : "ready";
      const initialSource: VoiceChangerSource = {
        ...nextSource,
        status: initialStatus,
        storagePath:
          nextSource.storagePath ?? resolveVoiceChangerSourceStoragePath(nextSource.sourceUrl),
        errorMessage: null,
        extractedFrom: null,
      };

      setCloneVoiceSource(initialSource);

      void (async () => {
        let stagedStoragePath = initialSource.storagePath;
        let stagedSourceUrl = initialSource.sourceUrl;
        let stagedMimeType = initialSource.mimeType;
        let stagedName = initialSource.name;
        let stagedDurationMs = initialSource.durationMs;

        try {
          if (initialSource.file) {
            const uploaded = await uploadVoiceCloneSourceFile({ file: initialSource.file });
            stagedStoragePath = uploaded.storagePath;
            stagedSourceUrl = uploaded.signedUrl ?? stagedSourceUrl;
            stagedMimeType = uploaded.mimeType;
            stagedName = uploaded.name;
          } else if (stagedStoragePath) {
            stagedSourceUrl = await signVoiceSourceStoragePath(stagedStoragePath);
          }

          if (cloneVoiceSourceRequestIdRef.current !== requestId) return;
          if (!stagedSourceUrl || !stagedStoragePath) {
            throw new Error("Unable to resolve the staged voice sample.");
          }

          stagedDurationMs =
            stagedDurationMs ??
            (await resolveVoiceChangerMediaDurationMs(stagedSourceUrl, "audio").catch(() => null));

          setCloneVoiceSource({
            ...initialSource,
            kind: "audio",
            status: "ready",
            aspect: null,
            durationMs: stagedDurationMs,
            name: stagedName,
            mimeType: stagedMimeType,
            file: null,
            previewUrl: null,
            sourceUrl: stagedSourceUrl,
            objectUrl: initialSource.objectUrl,
            storagePath: stagedStoragePath,
            errorMessage: null,
            extractedFrom: null,
          });
        } catch (error) {
          if (cloneVoiceSourceRequestIdRef.current !== requestId) return;
          setCloneVoiceSource({
            ...initialSource,
            status: "failed",
            file: null,
            sourceUrl: stagedSourceUrl,
            storagePath: stagedStoragePath,
            errorMessage: resolveErrorMessage(error),
          });
        }
      })();
    },
    []
  );

  React.useEffect(() => {
    const previousSource = previousCloneVoiceSourceRef.current;
    if (previousSource?.objectUrl && previousSource.objectUrl !== cloneVoiceSource?.objectUrl) {
      releaseVoiceChangerSource(previousSource);
    }
    previousCloneVoiceSourceRef.current = cloneVoiceSource;
  }, [cloneVoiceSource]);

  React.useEffect(() => {
    return () => {
      releaseVoiceChangerSource(previousCloneVoiceSourceRef.current);
      cloneVoiceSourceRequestIdRef.current += 1;
    };
  }, []);

  return {
    cloneVoiceSource,
    cloneVoiceError,
    setCloneVoiceError,
    resetCloneVoiceSource,
    handleCloneVoiceSourceChange,
  };
};
