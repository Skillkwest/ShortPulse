/**
 * Voice changer source drop zone.
 * Provides the UI-only intake surface for one audio/video source clip in the Voices workflow.
 */
import React from "react";
import { CircleNotch, UploadSimple, X } from "phosphor-react";
import { extractInternalReferenceDragPayload } from "../utils/dragDrop";
import {
  buildVoiceSourceDropSnapshotTransfer,
  canAcceptTransfer,
  captureVoiceSourceDropSnapshot,
  createSourceFromTransfer,
  createVoiceChangerSourceFromFile,
  findFirstSupportedFile,
  hasVoiceSourceDropSnapshotInternalReferenceHints,
  type AcceptedVoiceSourceKind,
  type ResolveVoiceChangerInternalReferenceSource,
  type VoiceChangerSource,
} from "../logic/voiceChangerSourceIntake";
import type { VoiceChangerSourceMetadataPatch } from "../logic/voiceChangerSourceTypes";
import {
  formatVoiceRecordingDuration,
  useVoiceSourceRecorder,
} from "../hooks/useVoiceSourceRecorder";
import { VoiceChangerAudioSourcePreview } from "./VoiceChangerAudioSourcePreview";
import { AiStudioRecordPanelPrefab } from "./AiStudioRecordPanelPrefab";

const AUDIO_FILE_PICKER_ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.webm";
const AUDIO_VIDEO_FILE_PICKER_ACCEPT =
  "audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.mp4,.mov,.m4v,.webm";

export {
  createVoiceChangerSourceFromFile,
  createVoiceChangerSourceFromReference,
  releaseVoiceChangerSource,
  type ResolveVoiceChangerInternalReferenceSource,
  type VoiceChangerSource,
} from "../logic/voiceChangerSourceIntake";

type VoiceChangerSourceDropzoneProps = {
  source: VoiceChangerSource | null;
  onSourceChange: (nextSource: VoiceChangerSource | null) => void;
  onSourceMetadataChange?: (sourceId: string, patch: VoiceChangerSourceMetadataPatch) => void;
  resolveInternalReferenceSource?: ResolveVoiceChangerInternalReferenceSource;
  acceptedKinds?: AcceptedVoiceSourceKind[];
  copy?: Partial<VoiceSourceDropzoneCopy>;
};

type VoiceSourceDropzoneCopy = {
  inputAriaLabel: string;
  dropzoneAriaLabel: string;
  dropzoneCaptionId: string;
  recordPanelAriaLabel: string;
  recordTitle: string;
  recordHelper: string;
  recordButtonIdleAriaLabel: string;
  recordButtonRecordingAriaLabel: string;
  recordIdleCue: string;
  dropTitle: string;
  dropHelper: string;
  caption: string;
  unableReferenceError: string;
  readyTitle: string;
  uploadingAudioTitle: string;
  uploadingVideoTitle: string;
  uploadingAudioDetail: string;
  uploadingVideoDetail: string;
  extractingTitle: string;
  extractingDetail: string;
  failedTitle: string;
  failedFallbackDetail: string;
  extractedFromDetail: string;
};

const defaultVoiceChangerDropzoneCopy: VoiceSourceDropzoneCopy = {
  inputAriaLabel: "Voice changer source file input",
  dropzoneAriaLabel: "Voice changer source drop zone",
  dropzoneCaptionId: "voice-changer-dropzone-caption",
  recordPanelAriaLabel: "Record sample",
  recordTitle: "Record",
  recordHelper: "Record your voice to use as the source for the voice changer.",
  recordButtonIdleAriaLabel: "Record your voice sample",
  recordButtonRecordingAriaLabel: "Stop recording your voice sample",
  recordIdleCue: "Click to record",
  dropTitle: "Drop a source clip",
  dropHelper:
    "Drag one audio or video file from your computer or the Reference Grid. Click to browse.",
  caption: "Accepts MP3, WAV, M4A, AAC, FLAC, OGG, MP4, MOV, M4V, and WEBM.",
  unableReferenceError: "Unable to use this reference as source audio.",
  readyTitle: "Ready for conversion",
  uploadingAudioTitle: "Preparing voice sample",
  uploadingVideoTitle: "Preparing voice sample from video",
  uploadingAudioDetail: "Staging the source audio so it is ready for voice conversion.",
  uploadingVideoDetail: "Staging the video so we can extract a voice sample.",
  extractingTitle: "Extracting voice sample",
  extractingDetail: "Pulling the voice audio out of the staged video.",
  failedTitle: "Source processing failed",
  failedFallbackDetail: "Unable to prepare the selected source.",
  extractedFromDetail: "Extracted audio is ready for conversion.",
};

const resolveSourceStatusTitle = (
  source: VoiceChangerSource,
  copy: VoiceSourceDropzoneCopy
): string => {
  if (source.status === "uploading") {
    return source.kind === "video" ? copy.uploadingVideoTitle : copy.uploadingAudioTitle;
  }
  if (source.status === "extracting") return copy.extractingTitle;
  if (source.status === "failed") return copy.failedTitle;
  return copy.readyTitle;
};

const resolveSourceStatusDetail = (
  source: VoiceChangerSource,
  copy: VoiceSourceDropzoneCopy
): string | null => {
  if (source.status === "uploading") {
    return source.kind === "video" ? copy.uploadingVideoDetail : copy.uploadingAudioDetail;
  }
  if (source.status === "extracting") {
    return copy.extractingDetail;
  }
  if (source.status === "failed") {
    return source.errorMessage ?? copy.failedFallbackDetail;
  }
  if (source.extractedFrom) {
    return copy.extractedFromDetail;
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
  onSourceMetadataChange,
  resolveInternalReferenceSource,
  acceptedKinds = ["audio", "video"],
  copy: copyOverrides,
}: VoiceChangerSourceDropzoneProps) {
  const copy = React.useMemo(
    () => ({ ...defaultVoiceChangerDropzoneCopy, ...copyOverrides }),
    [copyOverrides]
  );
  const acceptsAudioOnly = acceptedKinds.length === 1 && acceptedKinds[0] === "audio";
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const dragDepthRef = React.useRef(0);
  const sourceSelectionRequestIdRef = React.useRef(0);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [sourceSelectionError, setSourceSelectionError] = React.useState<string | null>(null);
  const [sourceSelectionRecoveryHint, setSourceSelectionRecoveryHint] = React.useState<
    string | null
  >(null);

  const openFilePicker = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const commitSourceSelection = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      if (!nextSource) {
        setSourceSelectionError(null);
        setSourceSelectionRecoveryHint(null);
        onSourceChange(null);
        return;
      }
      if (!acceptedKinds.includes(nextSource.kind)) {
        setSourceSelectionError(copy.unableReferenceError);
        setSourceSelectionRecoveryHint(null);
        return;
      }
      setSourceSelectionError(null);
      setSourceSelectionRecoveryHint(null);
      onSourceChange(nextSource);
    },
    [acceptedKinds, copy.unableReferenceError, onSourceChange]
  );

  const handleSourceSelection = React.useCallback(
    (nextSource: VoiceChangerSource | null) => {
      sourceSelectionRequestIdRef.current += 1;
      commitSourceSelection(nextSource);
    },
    [commitSourceSelection]
  );

  React.useEffect(
    () => () => {
      sourceSelectionRequestIdRef.current += 1;
    },
    []
  );

  const handleBeforeRecord = React.useCallback(() => {
    sourceSelectionRequestIdRef.current += 1;
    setSourceSelectionError(null);
    setSourceSelectionRecoveryHint(null);
  }, []);

  const handleAudioDurationResolved = React.useCallback(
    (durationMs: number) => {
      if (
        !source ||
        source.kind !== "audio" ||
        source.status !== "ready" ||
        source.durationMs === durationMs
      ) {
        return;
      }
      onSourceMetadataChange?.(source.id, { durationMs });
    },
    [onSourceMetadataChange, source]
  );

  const {
    isRecording,
    isRequestingPermission,
    microphonePermissionState,
    recordingElapsedMs,
    recordingError,
    recordingRecoveryHint,
    permissionPreflightFeedback,
    handleRecordSampleClick,
  } = useVoiceSourceRecorder({
    idleCue: copy.recordIdleCue,
    onBeforeRecord: handleBeforeRecord,
    onRecordedSource: handleSourceSelection,
  });

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const supportedFile = findFirstSupportedFile(event.target.files, acceptedKinds);
      if (supportedFile) {
        handleSourceSelection(createVoiceChangerSourceFromFile(supportedFile));
      }
      event.target.value = "";
    },
    [acceptedKinds, handleSourceSelection]
  );

  const canResolveInternalReference = Boolean(resolveInternalReferenceSource);

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference, acceptedKinds)) {
        return;
      }
      dragDepthRef.current += 1;
      setIsDragActive(true);
    },
    [acceptedKinds, canResolveInternalReference]
  );

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference, acceptedKinds)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsDragActive(true);
    },
    [acceptedKinds, canResolveInternalReference]
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference, acceptedKinds)) {
        return;
      }
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragActive(false);
      }
    },
    [acceptedKinds, canResolveInternalReference]
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAcceptTransfer(event.dataTransfer, canResolveInternalReference, acceptedKinds)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragActive(false);
      const selectionRequestId = sourceSelectionRequestIdRef.current + 1;
      sourceSelectionRequestIdRef.current = selectionRequestId;

      const dropSnapshot = captureVoiceSourceDropSnapshot(event.dataTransfer);
      const transferSnapshot = buildVoiceSourceDropSnapshotTransfer(dropSnapshot);
      const internalPayload = extractInternalReferenceDragPayload(transferSnapshot);
      const hasInternalReferenceHints =
        hasVoiceSourceDropSnapshotInternalReferenceHints(dropSnapshot);
      const directSource = createSourceFromTransfer(transferSnapshot, acceptedKinds, {
        skipFiles: hasInternalReferenceHints,
      });

      if (!internalPayload || !resolveInternalReferenceSource) {
        if (directSource) {
          commitSourceSelection(directSource);
          return;
        }
        setSourceSelectionError(copy.unableReferenceError);
        setSourceSelectionRecoveryHint(null);
        return;
      }

      void (async () => {
        try {
          const resolvedSource = await resolveInternalReferenceSource(internalPayload);
          if (sourceSelectionRequestIdRef.current !== selectionRequestId) return;
          if (resolvedSource && acceptedKinds.includes(resolvedSource.kind)) {
            commitSourceSelection(resolvedSource);
            return;
          }
          if (directSource) {
            commitSourceSelection(directSource);
            return;
          }
          setSourceSelectionError(copy.unableReferenceError);
          setSourceSelectionRecoveryHint(null);
        } catch {
          if (sourceSelectionRequestIdRef.current !== selectionRequestId) return;
          if (directSource) {
            commitSourceSelection(directSource);
            return;
          }
          setSourceSelectionError(copy.unableReferenceError);
          setSourceSelectionRecoveryHint(null);
        }
      })();
    },
    [
      acceptedKinds,
      canResolveInternalReference,
      copy.unableReferenceError,
      commitSourceSelection,
      resolveInternalReferenceSource,
    ]
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

  const activeRecordingError = recordingError ?? sourceSelectionError;
  const activeRecoveryHint = recordingError ? recordingRecoveryHint : sourceSelectionRecoveryHint;

  return (
    <div className="voices-properties-voice-changer-dropzone-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptsAudioOnly ? AUDIO_FILE_PICKER_ACCEPT : AUDIO_VIDEO_FILE_PICKER_ACCEPT}
        className="voices-properties-voice-changer-file-input"
        onChange={handleInputChange}
        aria-label={copy.inputAriaLabel}
        aria-hidden="true"
        tabIndex={-1}
      />

      {source ? (
        <div
          className={`voices-properties-voice-changer-dropzone has-source ${
            isDragActive ? "is-drag-active" : ""
          }`.trim()}
          role="group"
          aria-label={copy.dropzoneAriaLabel}
          aria-describedby={copy.dropzoneCaptionId}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="voices-properties-voice-changer-dropzone-preview">
            {source.displayKind === "video" && source.posterUrl ? (
              // Posters can be local data URLs; Next Image cannot provide useful optimization here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="voices-properties-voice-changer-dropzone-video"
                src={source.posterUrl}
                alt={`${source.extractedFrom?.name ?? source.name} video poster`}
              />
            ) : source.displayKind === "video" ? (
              <div
                className="voices-properties-voice-changer-dropzone-video-placeholder"
                role="img"
                aria-label="Video source preview unavailable"
              >
                <span>Preview unavailable</span>
              </div>
            ) : source.kind === "audio" && source.sourceUrl ? (
              <div className="voices-properties-voice-changer-dropzone-audio-preview">
                <VoiceChangerAudioSourcePreview
                  key={source.id}
                  audioUrl={source.sourceUrl}
                  onDurationResolved={handleAudioDurationResolved}
                />
              </div>
            ) : (
              <div className="voices-properties-voice-changer-dropzone-audio-preview" />
            )}
            {shouldShowSourceLoadingPreview(source) ? (
              <div
                className="voices-properties-voice-changer-dropzone-loading-preview"
                role="status"
                aria-live="polite"
                aria-label={resolveSourceStatusTitle(source, copy)}
              >
                <span
                  className="voices-properties-voice-changer-dropzone-loading-spinner"
                  aria-hidden="true"
                >
                  <CircleNotch size={34} weight="bold" />
                </span>
              </div>
            ) : null}
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
                  {resolveSourceStatusTitle(source, copy)}
                </p>
              </div>
              {resolveSourceStatusDetail(source, copy) ? (
                <p
                  className={`voices-properties-voice-changer-dropzone-helper${
                    source.status === "failed" ? " is-error" : ""
                  }`}
                >
                  {resolveSourceStatusDetail(source, copy)}
                </p>
              ) : null}
              {source.displayKind === "video" ? (
                <div className="voices-properties-voice-changer-dropzone-source-identity">
                  <span className="voices-properties-voice-changer-dropzone-source-kind">
                    Video source
                  </span>
                  <span className="voices-properties-voice-changer-dropzone-source-name">
                    {source.extractedFrom?.name ?? source.name}
                  </span>
                </div>
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
                onClick={() => handleSourceSelection(null)}
              >
                <X size={14} weight="bold" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="voices-properties-voice-changer-intake-grid">
          <AiStudioRecordPanelPrefab
            panelAriaLabel={copy.recordPanelAriaLabel}
            title={copy.recordTitle}
            helper={copy.recordHelper}
            buttonIdleAriaLabel={copy.recordButtonIdleAriaLabel}
            buttonRecordingAriaLabel={copy.recordButtonRecordingAriaLabel}
            idleCue={copy.recordIdleCue}
            isRecording={isRecording}
            isBusy={isRequestingPermission}
            statusMessage={
              activeRecordingError ||
              (isRequestingPermission
                ? "Waiting for microphone permission..."
                : isRecording
                  ? `Recording ${formatVoiceRecordingDuration(recordingElapsedMs)}`
                  : (permissionPreflightFeedback?.message ?? null))
            }
            recoveryHint={
              activeRecordingError
                ? activeRecoveryHint
                : !isRecording && !isRequestingPermission
                  ? (permissionPreflightFeedback?.recoveryHint ?? null)
                  : null
            }
            isError={Boolean(activeRecordingError) || microphonePermissionState === "denied"}
            onClick={handleRecordSampleClick}
          />

          <div className="voices-properties-voice-changer-intake-divider" aria-hidden="true">
            OR
          </div>

          <div
            className={`voices-properties-voice-changer-dropzone is-empty ${
              isDragActive ? "is-drag-active" : ""
            }`.trim()}
            role="button"
            aria-label={copy.dropzoneAriaLabel}
            aria-describedby={copy.dropzoneCaptionId}
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
                <p className="voices-properties-voice-changer-dropzone-title">{copy.dropTitle}</p>
                <p className="voices-properties-voice-changer-dropzone-helper">{copy.dropHelper}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <p id={copy.dropzoneCaptionId} className="voices-properties-voice-changer-dropzone-caption">
        {copy.caption}
      </p>
    </div>
  );
}
