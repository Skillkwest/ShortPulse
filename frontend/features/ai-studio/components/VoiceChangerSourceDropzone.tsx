/**
 * Voice changer source drop zone.
 * Provides the UI-only intake surface for one audio/video source clip in the Voices workflow.
 */
import React from "react";
import { CircleNotch, UploadSimple, X } from "phosphor-react";
import {
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
  normalizeReferenceTransferUrlCandidate,
  type InternalReferenceDragPayload,
} from "../utils/dragDrop";
import { isAudioUrl, isVideoUrl } from "../logic/stateParsers";
import { VoiceChangerAudioSourcePreview } from "./VoiceChangerAudioSourcePreview";

const AUDIO_EXTENSION_PATTERN = /\.(?:mp3|wav|m4a|aac|flac|ogg|oga)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|mov|m4v|webm)(?:$|[?#])/i;
const FILE_PICKER_ACCEPT =
  "audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.mp4,.mov,.m4v,.webm";
const REMOTE_FETCHABLE_URL_PROTOCOL_PATTERN = /^https?:$/i;

export type VoiceChangerSourceKind = "audio" | "video";
export type VoiceChangerSourceOrigin = "local" | "reference-grid" | "url";
export type VoiceChangerSourceStatus = "uploading" | "extracting" | "ready" | "failed";

export type VoiceChangerSource = {
  id: string;
  kind: VoiceChangerSourceKind;
  origin: VoiceChangerSourceOrigin;
  status: VoiceChangerSourceStatus;
  aspect: string | null;
  durationMs: number | null;
  name: string;
  mimeType: string | null;
  file: File | null;
  previewUrl: string | null;
  sourceUrl: string | null;
  objectUrl: string | null;
  storagePath: string | null;
  referenceOutputId: string | null;
  referenceMediaId: string | null;
  errorMessage: string | null;
  extractedFrom: {
    kind: "video";
    name: string;
    mimeType: string | null;
    previewUrl: string | null;
    sourceUrl: string | null;
    storagePath: string | null;
    aspect: string | null;
    referenceOutputId: string | null;
    referenceMediaId: string | null;
  } | null;
};

export type ResolveVoiceChangerInternalReferenceSource = (
  payload: InternalReferenceDragPayload
) => Promise<VoiceChangerSource | null> | VoiceChangerSource | null;

type VoiceChangerSourceDropzoneProps = {
  source: VoiceChangerSource | null;
  onSourceChange: (nextSource: VoiceChangerSource | null) => void;
  resolveInternalReferenceSource?: ResolveVoiceChangerInternalReferenceSource;
};

type BrowserMediaRecorder = typeof MediaRecorder;

const buildSourceId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getUrlFilename = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(
      value,
      typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
    );
    const filename = parsed.pathname.split("/").filter(Boolean).pop()?.trim() ?? "";
    return filename || null;
  } catch {
    const segments = value.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1] : null;
  }
};

const inferSourceKindFromUrl = (
  value: string | null | undefined
): VoiceChangerSourceKind | null => {
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  if (isAudioUrl(normalized)) return "audio";
  if (isVideoUrl(normalized)) return "video";
  return null;
};

const inferMimeTypeFromUrl = (value: string | null | undefined): string | null => {
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  if (/\.mp3(?:$|[?#])/i.test(normalized)) return "audio/mpeg";
  if (/\.wav(?:$|[?#])/i.test(normalized)) return "audio/wav";
  if (/\.m4a(?:$|[?#])/i.test(normalized)) return "audio/mp4";
  if (/\.aac(?:$|[?#])/i.test(normalized)) return "audio/aac";
  if (/\.flac(?:$|[?#])/i.test(normalized)) return "audio/flac";
  if (/\.(?:ogg|oga)(?:$|[?#])/i.test(normalized)) return "audio/ogg";
  if (/\.mp4(?:$|[?#])/i.test(normalized)) return "video/mp4";
  if (/\.mov(?:$|[?#])/i.test(normalized)) return "video/quicktime";
  if (/\.m4v(?:$|[?#])/i.test(normalized)) return "video/x-m4v";
  if (/\.webm(?:$|[?#])/i.test(normalized)) return "video/webm";
  return null;
};

const inferSourceKindFromFile = (file: File): VoiceChangerSourceKind | null => {
  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType.startsWith("audio/")) return "audio";
  if (normalizedType.startsWith("video/")) return "video";
  if (AUDIO_EXTENSION_PATTERN.test(file.name)) return "audio";
  if (VIDEO_EXTENSION_PATTERN.test(file.name)) return "video";
  return null;
};

export const createVoiceChangerSourceFromFile = (
  file: File,
  options?: {
    origin?: VoiceChangerSourceOrigin;
    referenceOutputId?: string | null;
    referenceMediaId?: string | null;
    durationMs?: number | null;
  }
): VoiceChangerSource | null => {
  const kind = inferSourceKindFromFile(file);
  if (!kind) return null;
  const objectUrl = URL.createObjectURL(file);
  return {
    id: buildSourceId("voice-changer-file"),
    kind,
    origin: options?.origin ?? "local",
    status: "ready",
    aspect: null,
    durationMs: options?.durationMs ?? null,
    name: file.name.trim() || `uploaded-${kind}`,
    mimeType: file.type.trim() || null,
    file,
    previewUrl: kind === "video" ? objectUrl : null,
    sourceUrl: objectUrl,
    objectUrl,
    storagePath: null,
    referenceOutputId: options?.referenceOutputId ?? null,
    referenceMediaId: options?.referenceMediaId ?? null,
    errorMessage: null,
    extractedFrom: null,
  };
};

const resolveRecordingMimeType = (MediaRecorderCtor: BrowserMediaRecorder): string => {
  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of preferredTypes) {
    if (
      typeof MediaRecorderCtor.isTypeSupported === "function" &&
      MediaRecorderCtor.isTypeSupported(type)
    ) {
      return type;
    }
  }
  return "";
};

const resolveRecordingExtension = (mimeType: string): string => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("mp4")) return "m4a";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  return "webm";
};

const formatRecordingDuration = (valueMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const findFirstSupportedFile = (files: FileList | File[] | null | undefined): File | null => {
  if (!files) return null;
  return Array.from(files).find((file) => inferSourceKindFromFile(file) !== null) ?? null;
};

const isLikelyNativeFileTransfer = (transfer: DataTransfer): boolean => {
  if (findFirstSupportedFile(transfer.files)) return true;

  const transferItems = Array.from(transfer.items ?? []);
  if (
    transferItems.some((item) => {
      if (item.kind !== "file") return false;
      const normalizedType = item.type.trim().toLowerCase();
      return (
        !normalizedType ||
        normalizedType.startsWith("audio/") ||
        normalizedType.startsWith("video/")
      );
    })
  ) {
    return true;
  }

  return Array.from(transfer.types ?? []).some(
    (type) => type === "Files" || type === "application/x-moz-file"
  );
};

export const createVoiceChangerSourceFromReference = ({
  kind,
  origin,
  name,
  mimeType,
  sourceUrl,
  previewUrl = null,
  storagePath = null,
  durationMs = null,
  aspect = null,
  referenceOutputId = null,
  referenceMediaId = null,
}: {
  kind: VoiceChangerSourceKind;
  origin: VoiceChangerSourceOrigin;
  name: string;
  mimeType?: string | null;
  sourceUrl?: string | null;
  previewUrl?: string | null;
  storagePath?: string | null;
  durationMs?: number | null;
  aspect?: string | null;
  referenceOutputId?: string | null;
  referenceMediaId?: string | null;
}): VoiceChangerSource | null => {
  const normalizedUrl = normalizeReferenceTransferUrlCandidate(sourceUrl, {
    unwrapNextImage: false,
  });
  if (normalizedUrl && /^(?:blob:|data:)/i.test(normalizedUrl)) return null;
  if (normalizedUrl) {
    try {
      const parsed = new URL(
        normalizedUrl,
        typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
      );
      if (!REMOTE_FETCHABLE_URL_PROTOCOL_PATTERN.test(parsed.protocol)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  const normalizedStoragePath = storagePath?.trim() || null;
  if (!normalizedUrl && !normalizedStoragePath) return null;
  const normalizedPreviewUrl =
    kind === "video"
      ? normalizeReferenceTransferUrlCandidate(previewUrl ?? normalizedUrl, {
          unwrapNextImage: false,
        })
      : null;
  return {
    id: buildSourceId("voice-changer-reference"),
    kind,
    origin,
    status: "ready",
    aspect,
    durationMs,
    name: name.trim() || `Reference Grid ${kind}`,
    mimeType: mimeType?.trim() || (normalizedUrl ? inferMimeTypeFromUrl(normalizedUrl) : null),
    file: null,
    previewUrl: normalizedPreviewUrl,
    sourceUrl: normalizedUrl,
    objectUrl: null,
    storagePath: normalizedStoragePath,
    referenceOutputId,
    referenceMediaId,
    errorMessage: null,
    extractedFrom: null,
  };
};

const createSourceFromUrl = ({
  url,
  origin,
  fallbackName,
  referenceOutputId = null,
  referenceMediaId = null,
}: {
  url: string;
  origin: VoiceChangerSourceOrigin;
  fallbackName: string;
  referenceOutputId?: string | null;
  referenceMediaId?: string | null;
}): VoiceChangerSource | null => {
  const normalizedUrl = normalizeReferenceTransferUrlCandidate(url, { unwrapNextImage: false });
  if (!normalizedUrl || /^(?:blob:|data:)/i.test(normalizedUrl)) return null;
  const kind = inferSourceKindFromUrl(normalizedUrl);
  if (!kind) return null;
  const filename = getUrlFilename(normalizedUrl);
  const source = createVoiceChangerSourceFromReference({
    kind,
    origin,
    name: filename ?? fallbackName,
    sourceUrl: normalizedUrl,
    referenceOutputId,
    referenceMediaId,
  });
  return source ? { ...source, id: buildSourceId("voice-changer-url") } : null;
};

const createSourceFromTransfer = (transfer: DataTransfer): VoiceChangerSource | null => {
  const supportedFile = findFirstSupportedFile(transfer.files);
  if (supportedFile) {
    return createVoiceChangerSourceFromFile(supportedFile);
  }

  const internalPayload = extractInternalReferenceDragPayload(transfer);
  if (internalPayload) {
    const internalCandidates = [
      internalPayload.referenceRenderUrl,
      internalPayload.referenceUrl,
    ].filter((candidate): candidate is string => typeof candidate === "string");
    for (const candidate of internalCandidates) {
      const source = createSourceFromUrl({
        url: candidate,
        origin: "reference-grid",
        fallbackName: "Reference Grid source",
        referenceOutputId: internalPayload.outputId,
        referenceMediaId: internalPayload.mediaId,
      });
      if (source) return source;
    }
    return null;
  }

  const urlCandidates = [
    transfer.getData("text/reference-render-url"),
    transfer.getData("text/reference-url"),
    transfer
      .getData("text/uri-list")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value && !value.startsWith("#")) ?? "",
    transfer.getData("text/plain"),
  ];
  for (const candidate of urlCandidates) {
    const source = createSourceFromUrl({
      url: candidate,
      origin: "url",
      fallbackName: "Linked media source",
    });
    if (source) return source;
  }

  return null;
};

const canAcceptTransfer = (
  transfer: DataTransfer | null | undefined,
  canResolveInternalReference = false
): boolean => {
  if (!transfer) return false;
  if (isLikelyNativeFileTransfer(transfer)) return true;
  if (canResolveInternalReference && hasInternalReferenceDragTypeHints(transfer)) return true;
  return Boolean(createSourceFromTransfer(transfer));
};

/**
 * Revokes any owned local object URL for a selected voice changer source.
 */
export const releaseVoiceChangerSource = (source: VoiceChangerSource | null): void => {
  if (!source?.objectUrl) return;
  URL.revokeObjectURL(source.objectUrl);
};

const resolveSourceStatusTitle = (source: VoiceChangerSource): string => {
  if (source.status === "uploading") {
    return source.kind === "video" ? "Preparing voice sample from video" : "Preparing voice sample";
  }
  if (source.status === "extracting") return "Extracting voice sample";
  if (source.status === "failed") return "Source processing failed";
  return "Ready for conversion";
};

const resolveSourceStatusDetail = (source: VoiceChangerSource): string | null => {
  if (source.status === "uploading") {
    return source.kind === "video"
      ? "Staging the video so we can extract a voice sample."
      : "Staging the source audio so it is ready for voice conversion.";
  }
  if (source.status === "extracting") {
    return "Pulling the voice audio out of the staged video.";
  }
  if (source.status === "failed") {
    return source.errorMessage ?? "Unable to prepare the selected source.";
  }
  if (source.extractedFrom) {
    return `Using extracted audio from ${source.extractedFrom.name}.`;
  }
  return null;
};

const shouldShowSourceStatusSpinner = (source: VoiceChangerSource): boolean =>
  source.status === "uploading" || source.status === "extracting";

const shouldShowSourceLoadingPreview = (source: VoiceChangerSource): boolean =>
  source.status === "uploading" || source.status === "extracting";

/**
 * Renders the voice changer source intake surface for one audio/video file.
 */
export function VoiceChangerSourceDropzone({
  source,
  onSourceChange,
  resolveInternalReferenceSource,
}: VoiceChangerSourceDropzoneProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const dragDepthRef = React.useRef(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recorderStreamRef = React.useRef<MediaStream | null>(null);
  const recordingChunksRef = React.useRef<BlobPart[]>([]);
  const recordingStartedAtRef = React.useRef<number | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = React.useState(0);
  const [recordingError, setRecordingError] = React.useState<string | null>(null);

  const openFilePicker = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSourceSelection = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      if (!nextSource) return;
      setRecordingError(null);
      onSourceChange(nextSource);
    },
    [onSourceChange]
  );

  const stopRecorderStream = React.useCallback(() => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current = null;
  }, []);

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const supportedFile = findFirstSupportedFile(event.target.files);
      if (supportedFile) {
        handleSourceSelection(createVoiceChangerSourceFromFile(supportedFile));
      }
      event.target.value = "";
    },
    [handleSourceSelection]
  );

  const canResolveInternalReference = Boolean(resolveInternalReferenceSource);

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference)) return;
      dragDepthRef.current += 1;
      setIsDragActive(true);
    },
    [canResolveInternalReference]
  );

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsDragActive(true);
    },
    [canResolveInternalReference]
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragActive(false);
      }
    },
    [canResolveInternalReference]
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragActive(false);

      const directSource = createSourceFromTransfer(event.dataTransfer);
      if (directSource) {
        handleSourceSelection(directSource);
        return;
      }

      const internalPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      if (!internalPayload || !resolveInternalReferenceSource) {
        setRecordingError("Unable to use this reference as source audio.");
        return;
      }

      void (async () => {
        try {
          const resolvedSource = await resolveInternalReferenceSource(internalPayload);
          if (!resolvedSource) {
            setRecordingError("Unable to use this reference as source audio.");
            return;
          }
          handleSourceSelection(resolvedSource);
        } catch {
          setRecordingError("Unable to use this reference as source audio.");
        }
      })();
    },
    [canResolveInternalReference, handleSourceSelection, resolveInternalReferenceSource]
  );

  const handleEmptyZoneKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (source) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openFilePicker();
    },
    [openFilePicker, source]
  );

  React.useEffect(() => {
    if (!isRecording) {
      setRecordingElapsedMs(0);
      return;
    }
    const timer = window.setInterval(() => {
      if (recordingStartedAtRef.current == null) return;
      setRecordingElapsedMs(Date.now() - recordingStartedAtRef.current);
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [isRecording]);

  React.useEffect(() => {
    return () => {
      recorderRef.current?.stop?.();
      recorderRef.current = null;
      stopRecorderStream();
    };
  }, [stopRecorderStream]);

  const handleRecordSampleClick = React.useCallback(async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingError("Recording is not supported in this browser.");
      return;
    }

    setRecordingError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      const mimeType = resolveRecordingMimeType(MediaRecorder);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError("Unable to record audio right now.");
        setIsRecording(false);
        recorderRef.current = null;
        recordingChunksRef.current = [];
        stopRecorderStream();
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const recordedBlob = new Blob(recordingChunksRef.current, { type: recordedMimeType });
        recordingChunksRef.current = [];
        recorderRef.current = null;
        setIsRecording(false);
        stopRecorderStream();

        if (!recordedBlob.size) {
          setRecordingError("No audio was captured.");
          return;
        }

        const extension = resolveRecordingExtension(recordedMimeType);
        const file = new File([recordedBlob], `voice-sample-${Date.now()}.${extension}`, {
          type: recordedMimeType,
        });
        handleSourceSelection(createVoiceChangerSourceFromFile(file));
      };

      recordingStartedAtRef.current = Date.now();
      setRecordingElapsedMs(0);
      setIsRecording(true);
      recorder.start();
    } catch (error) {
      stopRecorderStream();
      setIsRecording(false);
      setRecordingElapsedMs(0);
      setRecordingError(
        error instanceof Error && /permission|denied|notallowed/i.test(error.message)
          ? "Microphone access was denied."
          : "Unable to start recording."
      );
    }
  }, [handleSourceSelection, isRecording, stopRecorderStream]);

  return (
    <div className="voices-properties-voice-changer-dropzone-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_PICKER_ACCEPT}
        className="voices-properties-voice-changer-file-input"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {source ? (
        <div
          className={`voices-properties-voice-changer-dropzone has-source ${
            isDragActive ? "is-drag-active" : ""
          }`.trim()}
          role="group"
          aria-label="Voice changer source drop zone"
          aria-describedby="voice-changer-dropzone-caption"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="voices-properties-voice-changer-dropzone-preview">
            {shouldShowSourceLoadingPreview(source) ? (
              <div
                className="voices-properties-voice-changer-dropzone-loading-preview"
                role="status"
                aria-live="polite"
                aria-label={resolveSourceStatusTitle(source)}
              >
                <span
                  className="voices-properties-voice-changer-dropzone-loading-spinner"
                  aria-hidden="true"
                >
                  <CircleNotch size={34} weight="bold" />
                </span>
              </div>
            ) : source.kind === "video" && source.previewUrl ? (
              <video
                className="voices-properties-voice-changer-dropzone-video"
                src={source.previewUrl}
                playsInline
                muted
                preload="metadata"
              />
            ) : source.kind === "audio" && source.sourceUrl ? (
              <div className="voices-properties-voice-changer-dropzone-audio-preview">
                <VoiceChangerAudioSourcePreview key={source.id} audioUrl={source.sourceUrl} />
              </div>
            ) : (
              <div className="voices-properties-voice-changer-dropzone-audio-preview" />
            )}
          </div>

          <div className="voices-properties-voice-changer-dropzone-meta">
            <div className="voices-properties-voice-changer-dropzone-copy">
              <div className="voices-properties-voice-changer-dropzone-title-row">
                {shouldShowSourceStatusSpinner(source) ? (
                  <span
                    className="voices-properties-voice-changer-dropzone-spinner"
                    aria-hidden="true"
                  >
                    <CircleNotch size={16} weight="bold" />
                  </span>
                ) : null}
                <p className="voices-properties-voice-changer-dropzone-title">
                  {resolveSourceStatusTitle(source)}
                </p>
              </div>
              {resolveSourceStatusDetail(source) ? (
                <p
                  className={`voices-properties-voice-changer-dropzone-helper${
                    source.status === "failed" ? " is-error" : ""
                  }`}
                >
                  {resolveSourceStatusDetail(source)}
                </p>
              ) : null}
            </div>

            <div className="voices-properties-voice-changer-dropzone-actions">
              <button
                type="button"
                className="voices-properties-voice-changer-dropzone-action"
                onClick={openFilePicker}
                disabled={source.status === "uploading" || source.status === "extracting"}
              >
                Replace
              </button>
              <button
                type="button"
                className="voices-properties-voice-changer-dropzone-action is-secondary"
                onClick={() => onSourceChange(null)}
              >
                <X size={14} weight="bold" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="voices-properties-voice-changer-intake-grid">
          <div className="voices-properties-voice-changer-record-panel" aria-label="Record sample">
            <div className="voices-properties-voice-changer-record-panel-copy">
              <p className="voices-properties-voice-changer-record-title">Record</p>
              <p className="voices-properties-voice-changer-record-helper">
                Record your voice to use as the source for the voice changer.
              </p>
            </div>
            <div className="voices-properties-voice-changer-record-controls">
              <div className="voices-properties-voice-changer-record-button-wrap">
                <button
                  type="button"
                  className={`voices-properties-voice-changer-record-btn${
                    isRecording ? " is-recording" : ""
                  }`}
                  aria-label={
                    isRecording ? "Stop recording your voice sample" : "Record your voice sample"
                  }
                  aria-pressed={isRecording}
                  onClick={handleRecordSampleClick}
                >
                  <span
                    className="voices-properties-voice-changer-record-btn-core"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="voices-properties-voice-changer-record-footer">
                {recordingError || isRecording ? (
                  <p
                    className={`voices-properties-voice-changer-record-status-line${
                      recordingError ? " is-error" : ""
                    }`}
                    aria-live="polite"
                  >
                    {recordingError ?? `Recording ${formatRecordingDuration(recordingElapsedMs)}`}
                  </p>
                ) : (
                  <span className="voices-properties-voice-changer-record-idle-cue">
                    Click to record
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="voices-properties-voice-changer-intake-divider" aria-hidden="true">
            OR
          </div>

          <div
            className={`voices-properties-voice-changer-dropzone is-empty ${
              isDragActive ? "is-drag-active" : ""
            }`.trim()}
            role="button"
            aria-label="Voice changer source drop zone"
            aria-describedby="voice-changer-dropzone-caption"
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={handleEmptyZoneKeyDown}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="voices-properties-voice-changer-dropzone-empty-state">
              <div className="voices-properties-voice-changer-dropzone-empty-icon">
                <UploadSimple size={30} weight="bold" />
              </div>
              <div className="voices-properties-voice-changer-dropzone-empty-copy">
                <p className="voices-properties-voice-changer-dropzone-title">Drop a source clip</p>
                <p className="voices-properties-voice-changer-dropzone-helper">
                  Drag one audio or video file from your computer or the Reference Grid. Click to
                  browse.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <p
        id="voice-changer-dropzone-caption"
        className="voices-properties-voice-changer-dropzone-caption"
      >
        Accepts MP3, WAV, M4A, AAC, FLAC, OGG, MP4, MOV, M4V, and WEBM.
      </p>
    </div>
  );
}
