/**
 * Page-safe Voice Changer source controller.
 * Owns the async upload/extract lifecycle so the active source can survive panel unmounts.
 */
import React from "react";
import type { VoiceChangerSource } from "../components/VoiceChangerSourceDropzone";
import { releaseVoiceChangerSource } from "../components/VoiceChangerSourceDropzone";
import {
  extractVoiceChangerVideoSource,
  resolveVoiceChangerMediaDurationMs,
  resolveVoiceChangerSourceStoragePath,
  resolveVoiceChangerVideoAspect,
  signVoiceChangerStoragePath,
  uploadVoiceChangerSourceFile,
} from "../utils/voiceChangerSourceAsset";

const AUDIO_FILENAME_PATTERN = /\.(?:aac|flac|m4a|mp3|ogg|oga|wav|webm)(?:$|[?#])/i;
const VIDEO_FILENAME_PATTERN = /\.(?:m4v|mov|mp4|webm)(?:$|[?#])/i;

const resolveVoiceChangerStagedKind = ({
  fallbackKind,
  mimeType,
  name,
}: {
  fallbackKind: "audio" | "video";
  mimeType: string | null;
  name: string;
}): "audio" | "video" => {
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";
  if (normalizedMimeType.startsWith("audio/")) return "audio";
  if (normalizedMimeType.startsWith("video/")) return "video";
  if (AUDIO_FILENAME_PATTERN.test(name)) return "audio";
  if (VIDEO_FILENAME_PATTERN.test(name)) return "video";
  return fallbackKind;
};

const resolveErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};

/**
 * Keeps one active Voice Changer source alive for the current page session.
 */
export const useVoiceChangerSourceController = () => {
  const [voiceChangerSource, setVoiceChangerSource] = React.useState<VoiceChangerSource | null>(
    null
  );
  const previousVoiceChangerSourceRef = React.useRef<VoiceChangerSource | null>(null);
  const voiceChangerSourceRequestIdRef = React.useRef(0);

  const handleVoiceChangerSourceChange = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      const requestId = voiceChangerSourceRequestIdRef.current + 1;
      voiceChangerSourceRequestIdRef.current = requestId;

      if (!nextSource) {
        setVoiceChangerSource(null);
        return;
      }

      const initialStatus =
        nextSource.kind === "video"
          ? nextSource.file
            ? "uploading"
            : "extracting"
          : nextSource.file
            ? "uploading"
            : "ready";
      const initialSource: VoiceChangerSource = {
        ...nextSource,
        status: initialStatus,
        storagePath:
          nextSource.storagePath ?? resolveVoiceChangerSourceStoragePath(nextSource.sourceUrl),
        durationMs: nextSource.durationMs,
        errorMessage: null,
        extractedFrom: null,
      };

      setVoiceChangerSource(initialSource);

      void (async () => {
        let stagedStoragePath = initialSource.storagePath;
        let stagedSourceUrl = initialSource.sourceUrl;
        let stagedMimeType = initialSource.mimeType;
        let stagedName = initialSource.name;
        const stagedAspect = initialSource.aspect;
        let stagedDurationMs = initialSource.durationMs;

        try {
          if (initialSource.file) {
            const uploaded = await uploadVoiceChangerSourceFile({
              file: initialSource.file,
              kind: initialSource.kind,
            });
            stagedStoragePath = uploaded.storagePath;
            stagedSourceUrl = uploaded.signedUrl ?? stagedSourceUrl;
            stagedMimeType = uploaded.mimeType;
            stagedName = uploaded.name;
          } else if (stagedStoragePath) {
            stagedSourceUrl = await signVoiceChangerStoragePath(stagedStoragePath);
          }

          if (voiceChangerSourceRequestIdRef.current !== requestId) return;

          const stagedKind = resolveVoiceChangerStagedKind({
            fallbackKind: initialSource.kind,
            mimeType: stagedMimeType,
            name: stagedName,
          });

          if (stagedKind === "audio") {
            if (!stagedSourceUrl) {
              throw new Error("Unable to resolve the staged audio source URL.");
            }

            stagedDurationMs =
              stagedDurationMs ??
              (await resolveVoiceChangerMediaDurationMs(stagedSourceUrl, "audio").catch(
                () => null
              ));

            setVoiceChangerSource({
              ...initialSource,
              kind: stagedKind,
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
            return;
          }

          setVoiceChangerSource((current) => {
            if (!current || voiceChangerSourceRequestIdRef.current !== requestId) return current;
            return {
              ...current,
              status: "extracting",
              aspect: stagedAspect,
              name: stagedName,
              mimeType: stagedMimeType,
              file: null,
              sourceUrl: stagedSourceUrl,
              storagePath: stagedStoragePath,
              errorMessage: null,
            };
          });

          const aspectResolutionPromise = (
            stagedAspect
              ? Promise.resolve(stagedAspect)
              : resolveVoiceChangerVideoAspect(initialSource.previewUrl ?? stagedSourceUrl)
          ).catch(() => null);
          const durationResolutionPromise = resolveVoiceChangerMediaDurationMs(
            initialSource.previewUrl ?? stagedSourceUrl,
            "video"
          ).catch(() => null);

          const extracted = await extractVoiceChangerVideoSource({
            sourceName: stagedName,
            sourceOrigin: initialSource.origin,
            sourceMimeType: stagedMimeType,
            sourceStoragePath: stagedStoragePath,
            sourceUrl: stagedSourceUrl,
          });

          if (voiceChangerSourceRequestIdRef.current !== requestId) return;

          setVoiceChangerSource({
            ...initialSource,
            kind: "audio",
            status: "ready",
            aspect: null,
            durationMs: await durationResolutionPromise,
            name: extracted.name,
            mimeType: extracted.mimeType,
            file: null,
            previewUrl: null,
            sourceUrl: extracted.signedUrl,
            objectUrl: null,
            storagePath: extracted.storagePath,
            errorMessage: null,
            extractedFrom: {
              kind: "video",
              name: stagedName,
              mimeType: stagedMimeType,
              previewUrl: initialSource.previewUrl ?? stagedSourceUrl,
              sourceUrl: stagedSourceUrl,
              storagePath: stagedStoragePath,
              aspect: stagedAspect,
              referenceOutputId: initialSource.referenceOutputId,
              referenceMediaId: initialSource.referenceMediaId,
            },
          });

          void aspectResolutionPromise.then((resolvedAspect) => {
            if (!resolvedAspect || voiceChangerSourceRequestIdRef.current !== requestId) return;
            setVoiceChangerSource((current) => {
              if (
                !current ||
                current.id !== initialSource.id ||
                current.status !== "ready" ||
                !current.extractedFrom
              ) {
                return current;
              }
              if (current.extractedFrom.aspect === resolvedAspect) {
                return current;
              }
              return {
                ...current,
                extractedFrom: {
                  ...current.extractedFrom,
                  aspect: resolvedAspect,
                },
              };
            });
          });
        } catch (error) {
          if (voiceChangerSourceRequestIdRef.current !== requestId) return;
          setVoiceChangerSource({
            ...initialSource,
            status: "failed",
            aspect: stagedAspect,
            file: null,
            sourceUrl: stagedSourceUrl,
            storagePath: stagedStoragePath,
            errorMessage: resolveErrorMessage(
              error,
              initialSource.kind === "video"
                ? "Unable to prepare the selected video."
                : "Unable to prepare the selected audio."
            ),
          });
        }
      })();
    },
    []
  );

  React.useEffect(() => {
    const previousSource = previousVoiceChangerSourceRef.current;
    if (previousSource?.objectUrl && previousSource.objectUrl !== voiceChangerSource?.objectUrl) {
      releaseVoiceChangerSource(previousSource);
    }
    previousVoiceChangerSourceRef.current = voiceChangerSource;
  }, [voiceChangerSource]);

  React.useEffect(() => {
    return () => {
      releaseVoiceChangerSource(previousVoiceChangerSourceRef.current);
      voiceChangerSourceRequestIdRef.current += 1;
    };
  }, []);

  return {
    voiceChangerSource,
    handleVoiceChangerSourceChange,
  };
};
