/**
 * Reference media step for image/video dropzones and mode selection.
 */
import React from "react";
import {
  ArrowFatRight,
  ImageSquare,
  Plus,
  Selection,
  UploadSimple,
  VideoCamera,
} from "phosphor-react";
import { AppMessage } from "../../../components/AppMessage";
import { loadVideoPreviewMetadata } from "../logic/videoPreviewMetadata";
import { MediaDurationBadge } from "./shared/MediaDurationBadge";
import { ReferenceStepHeaderActionButton } from "./ReferenceStepHeaderActionButton";
import type { CanvasTearOutComposerTargetRegistry } from "../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";

const MOTION_VIDEO_POSTER_CAPTURE_TIME_SECONDS = 3;

const useMotionVideoPreviewMetadata = (motionVideoUrl: string | null) => {
  const [preview, setPreview] = React.useState<{
    durationMs: number | null;
    posterUrl: string | null;
  }>({
    durationMs: null,
    posterUrl: null,
  });

  React.useEffect(() => {
    if (!motionVideoUrl) {
      setPreview({
        durationMs: null,
        posterUrl: null,
      });
      return;
    }

    let cancelled = false;
    setPreview({
      durationMs: null,
      posterUrl: null,
    });

    void loadVideoPreviewMetadata(motionVideoUrl, {
      posterCaptureTimeSeconds: MOTION_VIDEO_POSTER_CAPTURE_TIME_SECONDS,
    })
      .then((nextPreview) => {
        if (cancelled) return;
        setPreview(nextPreview);
      })
      .catch(() => {
        if (cancelled) return;
        setPreview({
          durationMs: null,
          posterUrl: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [motionVideoUrl]);

  return preview;
};

type ReferenceMediaStepProps = {
  referenceOrder: number;
  collapsedReference: boolean;
  onExpandReference: () => void;
  onToggleReference: () => void;
  isVideoVariant: boolean;
  referenceStepTitle: string;
  referenceStepSubtitle: string;
  isMotionMode: boolean;
  isKling3Mode: boolean;
  isStandardMode: boolean;
  isKeyframesMode: boolean;
  primaryImageRequired?: boolean;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  motionVideoUrl: string | null;
  primaryDragActive: boolean;
  extraDragActive: boolean[];
  primaryImageLoading?: boolean;
  extraImageLoading?: boolean[];
  motionVideoLoading?: boolean;
  motionVideoError?: string | null;
  motionVideoDragActive: boolean;
  setMotionVideoDragActive: (value: boolean) => void;
  handlePrimaryDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handlePrimaryDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  handlePrimaryDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handlePrimaryDragLeave: () => void;
  handleExtraDrop: (index: number) => (event: React.DragEvent<HTMLDivElement>) => void;
  handleExtraDragEnter: (index: number) => (event: React.DragEvent<HTMLDivElement>) => void;
  handleExtraDragOver: (index: number) => (event: React.DragEvent<HTMLDivElement>) => void;
  handleExtraDragLeave: (index: number) => () => void;
  allowVideoDrag: (event: React.DragEvent<HTMLDivElement>) => boolean;
  handleMotionVideoDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  primaryInputRef: React.MutableRefObject<HTMLInputElement | null>;
  extraOneInputRef: React.MutableRefObject<HTMLInputElement | null>;
  extraTwoInputRef: React.MutableRefObject<HTMLInputElement | null>;
  extraThreeInputRef: React.MutableRefObject<HTMLInputElement | null>;
  motionVideoInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onMotionVideoChange?: (url: string | null) => void;
  onClearMotionVideo?: () => void;
  handleFileSelection: (
    setter: (url: string | null) => void
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleMotionVideoSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  acceptPrimaryCanvasTearOutPayload?: (payload: AgentComposerDirectDropPayload) => void;
  acceptExtraCanvasTearOutPayload?: (
    index: number,
    payload: AgentComposerDirectDropPayload
  ) => void;
  acceptMotionVideoCanvasTearOutPayload?: (payload: AgentComposerDirectDropPayload) => void;
  topContent?: React.ReactNode;
  inlineAside?: React.ReactNode;
};

/**
 * Renders media reference controls and file inputs.
 */
export const ReferenceMediaStep: React.FC<ReferenceMediaStepProps> = ({
  referenceOrder,
  collapsedReference,
  onExpandReference,
  onToggleReference,
  isVideoVariant,
  referenceStepTitle,
  referenceStepSubtitle,
  isMotionMode,
  isKling3Mode,
  isStandardMode,
  isKeyframesMode,
  primaryImageRequired = false,
  referenceImageUrl,
  extraImageUrls,
  motionVideoUrl,
  primaryDragActive,
  extraDragActive,
  primaryImageLoading = false,
  extraImageLoading = [false, false, false],
  motionVideoLoading = false,
  motionVideoError = null,
  motionVideoDragActive,
  setMotionVideoDragActive,
  handlePrimaryDrop,
  handlePrimaryDragEnter,
  handlePrimaryDragOver,
  handlePrimaryDragLeave,
  handleExtraDrop,
  handleExtraDragEnter,
  handleExtraDragOver,
  handleExtraDragLeave,
  allowVideoDrag,
  handleMotionVideoDrop,
  primaryInputRef,
  extraOneInputRef,
  extraTwoInputRef,
  extraThreeInputRef,
  motionVideoInputRef,
  onPrimaryImageChange,
  onExtraImageChange,
  onMotionVideoChange,
  onClearMotionVideo,
  handleFileSelection,
  handleMotionVideoSelection,
  canvasTearOutTargetRegistry,
  acceptPrimaryCanvasTearOutPayload,
  acceptExtraCanvasTearOutPayload,
  acceptMotionVideoCanvasTearOutPayload,
  topContent,
  inlineAside,
}) => {
  const primaryDropzoneRef = React.useRef<HTMLDivElement | null>(null);
  const extraOneDropzoneRef = React.useRef<HTMLDivElement | null>(null);
  const motionVideoDropzoneRef = React.useRef<HTMLDivElement | null>(null);
  const [primaryCanvasTearOutActive, setPrimaryCanvasTearOutActive] = React.useState(false);
  const [extraCanvasTearOutActiveIndex, setExtraCanvasTearOutActiveIndex] = React.useState<
    number | null
  >(null);
  const [motionVideoCanvasTearOutActive, setMotionVideoCanvasTearOutActive] = React.useState(false);
  const motionVideoPreview = useMotionVideoPreviewMetadata(motionVideoUrl);
  const showHeader = !isVideoVariant;
  const isCollapsed = showHeader ? collapsedReference : false;
  const shouldShowPrimaryOptionalPill =
    isVideoVariant && isStandardMode && !primaryImageRequired && !referenceImageUrl;
  const shouldShowPrimaryRequiredPill =
    isVideoVariant && isStandardMode && primaryImageRequired && !referenceImageUrl;
  const shouldShowLastFrameOptionalPill = isVideoVariant && isStandardMode && !extraImageUrls[0];
  const effectivePrimaryDragActive = primaryDragActive || primaryCanvasTearOutActive;
  const effectiveExtraOneDragActive =
    Boolean(extraDragActive[0]) || extraCanvasTearOutActiveIndex === 0;
  const effectiveMotionVideoDragActive = motionVideoDragActive || motionVideoCanvasTearOutActive;
  const shouldRegisterExtraFrameCanvasTearOutTarget =
    isVideoVariant && !isMotionMode && (isKling3Mode || isStandardMode || isKeyframesMode);
  const canAcceptCanvasTearOutImagePayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => payload.kind === "image",
    []
  );
  const canAcceptCanvasTearOutVideoPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => payload.kind === "video",
    []
  );

  React.useEffect(() => {
    if (!isVideoVariant || !canvasTearOutTargetRegistry || !acceptPrimaryCanvasTearOutPayload) {
      return;
    }
    if (!primaryDropzoneRef.current) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "video-primary-reference-frame",
      element: primaryDropzoneRef.current,
      canAccept: canAcceptCanvasTearOutImagePayload,
      accept: acceptPrimaryCanvasTearOutPayload,
      setActive: setPrimaryCanvasTearOutActive,
    });
  }, [
    acceptPrimaryCanvasTearOutPayload,
    canAcceptCanvasTearOutImagePayload,
    canvasTearOutTargetRegistry,
    isVideoVariant,
  ]);

  React.useEffect(() => {
    if (
      !canvasTearOutTargetRegistry ||
      !acceptExtraCanvasTearOutPayload ||
      !shouldRegisterExtraFrameCanvasTearOutTarget
    ) {
      return;
    }
    if (!extraOneDropzoneRef.current) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "video-extra-reference-frame-0",
      element: extraOneDropzoneRef.current,
      canAccept: canAcceptCanvasTearOutImagePayload,
      accept: (payload) => acceptExtraCanvasTearOutPayload(0, payload),
      setActive: (active) =>
        setExtraCanvasTearOutActiveIndex((previous) =>
          active ? 0 : previous === 0 ? null : previous
        ),
    });
  }, [
    acceptExtraCanvasTearOutPayload,
    canAcceptCanvasTearOutImagePayload,
    canvasTearOutTargetRegistry,
    shouldRegisterExtraFrameCanvasTearOutTarget,
  ]);

  React.useEffect(() => {
    if (!isMotionMode || !canvasTearOutTargetRegistry || !acceptMotionVideoCanvasTearOutPayload) {
      return;
    }
    if (!motionVideoDropzoneRef.current) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "video-motion-control-video",
      element: motionVideoDropzoneRef.current,
      canAccept: canAcceptCanvasTearOutVideoPayload,
      accept: acceptMotionVideoCanvasTearOutPayload,
      setActive: setMotionVideoCanvasTearOutActive,
    });
  }, [
    acceptMotionVideoCanvasTearOutPayload,
    canAcceptCanvasTearOutVideoPayload,
    canvasTearOutTargetRegistry,
    isMotionMode,
  ]);

  const renderLoadingOverlay = () => (
    <div className="reference-dropzone-loading" aria-live="polite" aria-busy="true">
      <div className="reference-spinner" />
    </div>
  );
  const mediaContent = (
    <>
      {isMotionMode ? (
        <>
          <div className="drop-image-row motion-drop-row">
            <div className="primary-drop">
              <div
                ref={primaryDropzoneRef}
                className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${effectivePrimaryDragActive ? "is-dragging" : ""}`}
                onDrop={handlePrimaryDrop}
                onDragEnter={handlePrimaryDragEnter}
                onDragOver={handlePrimaryDragOver}
                onDragLeave={handlePrimaryDragLeave}
                onClick={() => primaryInputRef.current?.click()}
                style={
                  referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined
                }
              >
                {primaryImageLoading ? renderLoadingOverlay() : null}
                <span className="dropzone-tag">Character</span>
                {referenceImageUrl ? (
                  <button
                    type="button"
                    className="dropzone-clear"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPrimaryImageChange(null);
                    }}
                  >
                    ×
                  </button>
                ) : (
                  <div className="reference-drop-content image-drop-content">
                    <ImageSquare size={24} weight="regular" />
                    <p className="reference-drop-title helper-text">Upload a character image</p>
                  </div>
                )}
              </div>
            </div>

            <div className="primary-drop">
              <div
                ref={motionVideoDropzoneRef}
                className={`reference-dropzone video-dropzone ${motionVideoUrl ? "has-preview" : ""} ${effectiveMotionVideoDragActive ? "is-dragging" : ""}`}
                onDrop={handleMotionVideoDrop}
                onDragEnter={(event) => {
                  if (allowVideoDrag(event)) {
                    setMotionVideoDragActive(true);
                  }
                }}
                onDragOver={(event) => {
                  if (allowVideoDrag(event)) {
                    setMotionVideoDragActive(true);
                  }
                }}
                onDragLeave={() => setMotionVideoDragActive(false)}
                onClick={() => motionVideoInputRef.current?.click()}
              >
                {motionVideoLoading ? renderLoadingOverlay() : null}
                <span className="dropzone-tag">Motion</span>
                {motionVideoUrl ? (
                  <>
                    {motionVideoPreview.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="reference-dropzone-poster"
                        src={motionVideoPreview.posterUrl}
                        alt=""
                      />
                    ) : (
                      <div className="reference-dropzone-preview-fallback" aria-hidden="true">
                        <VideoCamera size={24} weight="regular" />
                      </div>
                    )}
                    <div className="reference-dropzone-preview-overlay" aria-hidden="true" />
                    <MediaDurationBadge
                      className="reference-card-media-duration"
                      durationMs={motionVideoPreview.durationMs}
                      mediaUrl={motionVideoPreview.durationMs == null ? motionVideoUrl : null}
                      mediaKind="video"
                    />
                    <button
                      type="button"
                      className="dropzone-clear"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (onClearMotionVideo) {
                          onClearMotionVideo();
                          return;
                        }
                        onMotionVideoChange?.(null);
                      }}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <div className="reference-drop-content video-drop-content">
                    <VideoCamera size={24} weight="regular" />
                    <p className="reference-drop-title helper-text">
                      Upload an MP4, MOV, or WEBM clip
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {motionVideoLoading ? (
            <p className="motion-drop-status tiny helper-text" role="status" aria-live="polite">
              Adding motion clip...
            </p>
          ) : motionVideoError ? (
            <AppMessage
              className="motion-drop-status motion-drop-status--error tiny helper-text"
              tone="error"
              mode="inline"
              message={motionVideoError}
            />
          ) : null}
        </>
      ) : isKling3Mode ? (
        <div className="drop-image-row kling-drop-row">
          <div className="primary-drop">
            <div
              ref={primaryDropzoneRef}
              className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${effectivePrimaryDragActive ? "is-dragging" : ""}`}
              onDrop={handlePrimaryDrop}
              onDragEnter={handlePrimaryDragEnter}
              onDragOver={handlePrimaryDragOver}
              onDragLeave={handlePrimaryDragLeave}
              onClick={() => primaryInputRef.current?.click()}
              style={
                referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined
              }
            >
              {primaryImageLoading ? renderLoadingOverlay() : null}
              <span className="dropzone-tag">Start frame</span>
              {referenceImageUrl ? (
                <button
                  type="button"
                  className="dropzone-clear"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPrimaryImageChange(null);
                  }}
                >
                  ×
                </button>
              ) : null}
              <div className="reference-drop-content image-drop-content">
                <UploadSimple size={24} weight="regular" />
                <p className="reference-drop-title helper-text">Upload a starting frame</p>
              </div>
            </div>
          </div>
          <div className="primary-drop">
            <div
              ref={extraOneDropzoneRef}
              className={`reference-dropzone ${extraImageUrls[0] ? "has-preview" : ""} ${effectiveExtraOneDragActive ? "is-dragging" : ""}`}
              onDrop={handleExtraDrop(0)}
              onDragEnter={handleExtraDragEnter(0)}
              onDragOver={handleExtraDragOver(0)}
              onDragLeave={handleExtraDragLeave(0)}
              onClick={() => extraOneInputRef.current?.click()}
              style={
                extraImageUrls[0] ? { backgroundImage: `url(${extraImageUrls[0]})` } : undefined
              }
            >
              {extraImageLoading[0] ? renderLoadingOverlay() : null}
              <span className="dropzone-tag subtle">End frame (optional)</span>
              {extraImageUrls[0] ? (
                <button
                  type="button"
                  className="dropzone-clear"
                  onClick={(event) => {
                    event.stopPropagation();
                    onExtraImageChange(0, null);
                  }}
                >
                  ×
                </button>
              ) : null}
              <div className="reference-drop-content image-drop-content">
                <UploadSimple size={24} weight="regular" />
                <p className="reference-drop-title helper-text">Upload an end frame</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="drop-image-row">
          <div className="primary-drop">
            <div
              ref={primaryDropzoneRef}
              className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${effectivePrimaryDragActive ? "is-dragging" : ""}`}
              onDrop={handlePrimaryDrop}
              onDragEnter={handlePrimaryDragEnter}
              onDragOver={handlePrimaryDragOver}
              onDragLeave={handlePrimaryDragLeave}
              onClick={() => primaryInputRef.current?.click()}
              style={
                referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined
              }
            >
              {primaryImageLoading ? renderLoadingOverlay() : null}
              {isVideoVariant ? (
                <span className="dropzone-tag">
                  {isStandardMode ? (
                    <>
                      <span>First frame</span>
                    </>
                  ) : (
                    "Reference image"
                  )}
                </span>
              ) : null}
              {shouldShowPrimaryRequiredPill ? (
                <span className="dropzone-tag-pill dropzone-tag-pill--bottom dropzone-tag-pill--required">
                  Required
                </span>
              ) : null}
              {shouldShowPrimaryOptionalPill ? (
                <span className="dropzone-tag-pill dropzone-tag-pill--bottom">Optional</span>
              ) : null}
              {referenceImageUrl ? (
                <button
                  type="button"
                  className="dropzone-clear"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPrimaryImageChange(null);
                  }}
                >
                  ×
                </button>
              ) : null}
              <div className="reference-drop-content image-drop-content">
                <Plus size={26} weight="regular" />
              </div>
            </div>
          </div>
          {isVideoVariant && (isKeyframesMode || isStandardMode) ? (
            <>
              {isKeyframesMode ? (
                <div className="reference-drop-divider" aria-hidden="true">
                  <ArrowFatRight size={26} weight="fill" />
                </div>
              ) : null}
              <div className="primary-drop">
                <div
                  ref={extraOneDropzoneRef}
                  className={`reference-dropzone ${extraImageUrls[0] ? "has-preview" : ""} ${effectiveExtraOneDragActive ? "is-dragging" : ""}`}
                  onDrop={handleExtraDrop(0)}
                  onDragEnter={handleExtraDragEnter(0)}
                  onDragOver={handleExtraDragOver(0)}
                  onDragLeave={handleExtraDragLeave(0)}
                  onClick={() => extraOneInputRef.current?.click()}
                  style={
                    extraImageUrls[0] ? { backgroundImage: `url(${extraImageUrls[0]})` } : undefined
                  }
                >
                  {extraImageLoading[0] ? renderLoadingOverlay() : null}
                  <span className="dropzone-tag">
                    <span>Last frame</span>
                  </span>
                  {shouldShowLastFrameOptionalPill ? (
                    <span className="dropzone-tag-pill dropzone-tag-pill--bottom">Optional</span>
                  ) : null}
                  {extraImageUrls[0] ? (
                    <button
                      type="button"
                      className="dropzone-clear"
                      onClick={(event) => {
                        event.stopPropagation();
                        onExtraImageChange(0, null);
                      }}
                    >
                      ×
                    </button>
                  ) : (
                    <div className="reference-drop-content image-drop-content">
                      <Plus size={26} weight="regular" />
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : !isVideoVariant ? (
            <>
              <div className="reference-drop-divider" aria-hidden="true">
                <Selection size={24} weight="regular" />
              </div>
              {[0, 1, 2].map((index) => {
                const previewUrl = extraImageUrls[index];
                const inputRef =
                  index === 0
                    ? extraOneInputRef
                    : index === 1
                      ? extraTwoInputRef
                      : extraThreeInputRef;
                return (
                  <div className="secondary-drop" key={`extra-drop-${index}`}>
                    <div
                      className={`reference-dropzone extra ${previewUrl ? "has-preview" : ""} ${extraDragActive[index] ? "is-dragging" : ""}`}
                      onDrop={handleExtraDrop(index)}
                      onDragEnter={handleExtraDragEnter(index)}
                      onDragOver={handleExtraDragOver(index)}
                      onDragLeave={handleExtraDragLeave(index)}
                      onClick={() => inputRef.current?.click()}
                      style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
                    >
                      {previewUrl ? (
                        <button
                          type="button"
                          className="dropzone-clear"
                          onClick={(event) => {
                            event.stopPropagation();
                            onExtraImageChange(index, null);
                          }}
                        >
                          ×
                        </button>
                      ) : (
                        <Plus size={24} weight="regular" />
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="reference-dropzone-block image-block" style={{ order: referenceOrder }}>
        <div
          className={`reference-step-card ${isCollapsed ? "is-collapsed" : ""} ${isVideoVariant ? "is-video-refs" : "is-image-refs"}`}
          onClick={showHeader ? onExpandReference : undefined}
        >
          {showHeader ? (
            <div className="reference-step-header">
              <div className="reference-step-copy">
                <p className="step-title">{referenceStepTitle}</p>
                <span className="step-subtitle tiny helper-text">{referenceStepSubtitle}</span>
              </div>
              <div className="reference-drop-header-actions">
                <ReferenceStepHeaderActionButton
                  label="Open reference options"
                  isCollapsed={collapsedReference}
                  onClick={onToggleReference}
                />
              </div>
            </div>
          ) : null}
          {!isCollapsed ? (
            isVideoVariant && inlineAside ? (
              <div className="video-reference-card-layout">
                <div className="video-reference-card-main">
                  {isVideoVariant && topContent ? (
                    <div className="video-reference-card-top-content">{topContent}</div>
                  ) : null}
                  {mediaContent}
                </div>
                <aside className="video-reference-card-aside">{inlineAside}</aside>
              </div>
            ) : (
              <>
                {isVideoVariant && topContent ? (
                  <div className="video-reference-card-top-content">{topContent}</div>
                ) : null}
                {mediaContent}
              </>
            )
          ) : null}
        </div>
      </div>
      <input
        ref={primaryInputRef}
        type="file"
        accept={isMotionMode ? "image/jpeg,image/png,.jpg,.jpeg,.png" : "image/*"}
        style={{ display: "none" }}
        onChange={handleFileSelection(onPrimaryImageChange)}
      />
      <input
        ref={extraOneInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(0, url))}
      />
      <input
        ref={extraTwoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(1, url))}
      />
      <input
        ref={extraThreeInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(2, url))}
      />
      <input
        ref={motionVideoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.m4v,.webm"
        style={{ display: "none" }}
        onChange={handleMotionVideoSelection}
      />
    </>
  );
};
