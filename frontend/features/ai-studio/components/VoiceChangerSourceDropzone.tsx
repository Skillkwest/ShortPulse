/**
 * Voice changer source drop zone.
 * Provides the UI-only intake surface for one audio/video source clip in the Voices workflow.
 */
import React from "react";
import { FileAudio, FilmSlate, UploadSimple, X } from "phosphor-react";
import {
  extractInternalReferenceDragPayload,
  normalizeReferenceTransferUrlCandidate,
} from "../utils/dragDrop";

const AUDIO_EXTENSION_PATTERN = /\.(?:mp3|wav|m4a|aac|flac|ogg|oga)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|mov|m4v|webm)(?:$|[?#])/i;
const FILE_PICKER_ACCEPT =
  "audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.mp4,.mov,.m4v,.webm";

export type VoiceChangerSourceKind = "audio" | "video";
export type VoiceChangerSourceOrigin = "local" | "reference-grid" | "url";

export type VoiceChangerSource = {
  id: string;
  kind: VoiceChangerSourceKind;
  origin: VoiceChangerSourceOrigin;
  name: string;
  mimeType: string | null;
  previewUrl: string | null;
  sourceUrl: string | null;
  objectUrl: string | null;
  sizeLabel: string | null;
};

type VoiceChangerSourceDropzoneProps = {
  source: VoiceChangerSource | null;
  onSourceChange: (nextSource: VoiceChangerSource | null) => void;
};

const buildSourceId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value)} B`;
};

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
  if (VIDEO_EXTENSION_PATTERN.test(normalized)) return "video";
  if (AUDIO_EXTENSION_PATTERN.test(normalized)) return "audio";
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

const createSourceFromFile = (file: File): VoiceChangerSource | null => {
  const kind = inferSourceKindFromFile(file);
  if (!kind) return null;
  const previewUrl = kind === "video" ? URL.createObjectURL(file) : null;
  return {
    id: buildSourceId("voice-changer-file"),
    kind,
    origin: "local",
    name: file.name.trim() || `uploaded-${kind}`,
    mimeType: file.type.trim() || null,
    previewUrl,
    sourceUrl: previewUrl,
    objectUrl: previewUrl,
    sizeLabel: formatBytes(file.size),
  };
};

const findFirstSupportedFile = (files: FileList | File[] | null | undefined): File | null => {
  if (!files) return null;
  return Array.from(files).find((file) => inferSourceKindFromFile(file) !== null) ?? null;
};

const createSourceFromUrl = ({
  url,
  origin,
  fallbackName,
}: {
  url: string;
  origin: VoiceChangerSourceOrigin;
  fallbackName: string;
}): VoiceChangerSource | null => {
  const normalizedUrl = normalizeReferenceTransferUrlCandidate(url, { unwrapNextImage: false });
  const kind = inferSourceKindFromUrl(normalizedUrl);
  if (!normalizedUrl || !kind) return null;
  const filename = getUrlFilename(normalizedUrl);
  return {
    id: buildSourceId("voice-changer-url"),
    kind,
    origin,
    name: filename ?? fallbackName,
    mimeType: inferMimeTypeFromUrl(normalizedUrl),
    previewUrl: kind === "video" ? normalizedUrl : null,
    sourceUrl: normalizedUrl,
    objectUrl: null,
    sizeLabel: null,
  };
};

const createSourceFromTransfer = (transfer: DataTransfer): VoiceChangerSource | null => {
  const supportedFile = findFirstSupportedFile(transfer.files);
  if (supportedFile) {
    return createSourceFromFile(supportedFile);
  }

  const internalPayload = extractInternalReferenceDragPayload(transfer);
  if (internalPayload) {
    const internalUrl =
      normalizeReferenceTransferUrlCandidate(internalPayload.referenceRenderUrl, {
        unwrapNextImage: false,
      }) ??
      normalizeReferenceTransferUrlCandidate(internalPayload.referenceUrl, {
        unwrapNextImage: false,
      });
    if (internalUrl) {
      return createSourceFromUrl({
        url: internalUrl,
        origin: "reference-grid",
        fallbackName: "Reference Grid source",
      });
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

const canAcceptTransfer = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  if (findFirstSupportedFile(transfer.files)) return true;
  return Boolean(createSourceFromTransfer(transfer));
};

const resolveSourceOriginLabel = (origin: VoiceChangerSourceOrigin): string => {
  if (origin === "reference-grid") return "Reference Grid";
  if (origin === "local") return "From your computer";
  return "Linked media";
};

/**
 * Revokes any owned local object URL for a selected voice changer source.
 */
export const releaseVoiceChangerSource = (source: VoiceChangerSource | null): void => {
  if (!source?.objectUrl) return;
  URL.revokeObjectURL(source.objectUrl);
};

/**
 * Renders the voice changer source intake surface for one audio/video file.
 */
export function VoiceChangerSourceDropzone({
  source,
  onSourceChange,
}: VoiceChangerSourceDropzoneProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const dragDepthRef = React.useRef(0);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const openFilePicker = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSourceSelection = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      if (!nextSource) return;
      onSourceChange(nextSource);
    },
    [onSourceChange]
  );

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const supportedFile = findFirstSupportedFile(event.target.files);
      if (supportedFile) {
        handleSourceSelection(createSourceFromFile(supportedFile));
      }
      event.target.value = "";
    },
    [handleSourceSelection]
  );

  const handleDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptTransfer(event.dataTransfer)) return;
    dragDepthRef.current += 1;
    setIsDragActive(true);
  }, []);

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  }, []);

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptTransfer(event.dataTransfer)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragActive(false);
      handleSourceSelection(createSourceFromTransfer(event.dataTransfer));
    },
    [handleSourceSelection]
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

      <div
        className={`voices-properties-voice-changer-dropzone ${
          source ? "has-source" : "is-empty"
        } ${isDragActive ? "is-drag-active" : ""}`.trim()}
        role={source ? "group" : "button"}
        aria-label="Voice changer source drop zone"
        aria-describedby="voice-changer-dropzone-caption"
        tabIndex={source ? -1 : 0}
        onClick={() => {
          if (!source) openFilePicker();
        }}
        onKeyDown={handleEmptyZoneKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {source ? (
          <>
            <div className="voices-properties-voice-changer-dropzone-preview">
              {source.kind === "video" && source.previewUrl ? (
                <>
                  <video
                    className="voices-properties-voice-changer-dropzone-video"
                    src={source.previewUrl}
                    playsInline
                    muted
                    preload="metadata"
                  />
                  <span className="voices-properties-voice-changer-dropzone-preview-badge">
                    Video source
                  </span>
                </>
              ) : (
                <div
                  className="voices-properties-voice-changer-dropzone-audio-preview"
                  aria-hidden="true"
                >
                  <div className="voices-properties-voice-changer-dropzone-audio-icon">
                    <FileAudio size={28} weight="duotone" />
                  </div>
                  <div className="voices-properties-voice-changer-dropzone-audio-bars">
                    {[20, 34, 26, 40, 18, 32, 24, 44, 28, 36, 22, 38].map((height, index) => (
                      <span
                        key={`voice-changer-audio-bar-${index}`}
                        style={
                          {
                            "--voice-changer-audio-bar-height": `${height}px`,
                          } as React.CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <span className="voices-properties-voice-changer-dropzone-preview-badge">
                    Audio source
                  </span>
                </div>
              )}
            </div>

            <div className="voices-properties-voice-changer-dropzone-meta">
              <div className="voices-properties-voice-changer-dropzone-copy">
                <div className="voices-properties-voice-changer-dropzone-chip-row">
                  <span className="voices-properties-voice-changer-dropzone-chip">
                    {source.kind === "video" ? (
                      <FilmSlate size={14} weight="fill" />
                    ) : (
                      <FileAudio size={14} weight="fill" />
                    )}
                    <span>{source.kind === "video" ? "Video" : "Audio"}</span>
                  </span>
                  <span className="voices-properties-voice-changer-dropzone-subtle-chip">
                    {resolveSourceOriginLabel(source.origin)}
                  </span>
                </div>
                <p className="voices-properties-voice-changer-dropzone-title">{source.name}</p>
                <p className="voices-properties-voice-changer-dropzone-helper">
                  {source.sizeLabel
                    ? `${source.sizeLabel} ready for conversion.`
                    : "Ready for conversion preview. Drop a new source to replace it."}
                </p>
              </div>

              <div className="voices-properties-voice-changer-dropzone-actions">
                <button
                  type="button"
                  className="voices-properties-voice-changer-dropzone-action"
                  onClick={openFilePicker}
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
          </>
        ) : (
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
        )}
      </div>

      <p
        id="voice-changer-dropzone-caption"
        className="voices-properties-voice-changer-dropzone-caption"
      >
        Accepts MP3, WAV, M4A, AAC, FLAC, OGG, MP4, MOV, M4V, and WEBM.
      </p>
    </div>
  );
}
