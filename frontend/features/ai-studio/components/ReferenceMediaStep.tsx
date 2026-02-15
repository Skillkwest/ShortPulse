/**
 * Reference media step for image/video dropzones and mode selection.
 */
import React from "react";
import { ArrowFatLinesRight, Plus, Selection, UploadSimple, VideoCamera } from "phosphor-react";
import { ReferenceStepHeaderActionButton } from "./ReferenceStepHeaderActionButton";

type VideoReferenceMode = "standard" | "keyframes" | "kling3" | "motion";

type ReferenceMediaStepProps = {
  referenceOrder: number;
  referenceBadge: string;
  collapsedReference: boolean;
  onExpandReference: () => void;
  onToggleReference: () => void;
  beginnerMode: boolean;
  isVideoVariant: boolean;
  referenceStepTitle: string;
  referenceStepSubtitle: string;
  activeVideoMode: VideoReferenceMode;
  onVideoReferenceModeChange?: (value: VideoReferenceMode) => void;
  isMotionMode: boolean;
  isKling3Mode: boolean;
  isStandardMode: boolean;
  isKeyframesMode: boolean;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  motionVideoUrl: string | null;
  primaryDragActive: boolean;
  extraDragActive: boolean[];
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
  canSwapFrames: boolean;
  handleSwapFrames: () => void;
  primaryInputRef: React.MutableRefObject<HTMLInputElement | null>;
  extraOneInputRef: React.MutableRefObject<HTMLInputElement | null>;
  extraTwoInputRef: React.MutableRefObject<HTMLInputElement | null>;
  extraThreeInputRef: React.MutableRefObject<HTMLInputElement | null>;
  motionVideoInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onMotionVideoChange?: (url: string | null) => void;
  handleFileSelection: (
    setter: (url: string | null) => void
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleMotionVideoSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

/**
 * Renders media reference controls and file inputs.
 */
export const ReferenceMediaStep: React.FC<ReferenceMediaStepProps> = ({
  referenceOrder,
  referenceBadge,
  collapsedReference,
  onExpandReference,
  onToggleReference,
  beginnerMode,
  isVideoVariant,
  referenceStepTitle,
  referenceStepSubtitle,
  activeVideoMode,
  onVideoReferenceModeChange,
  isMotionMode,
  isKling3Mode,
  isStandardMode,
  isKeyframesMode,
  referenceImageUrl,
  extraImageUrls,
  motionVideoUrl,
  primaryDragActive,
  extraDragActive,
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
  canSwapFrames,
  handleSwapFrames,
  primaryInputRef,
  extraOneInputRef,
  extraTwoInputRef,
  extraThreeInputRef,
  motionVideoInputRef,
  onPrimaryImageChange,
  onExtraImageChange,
  onMotionVideoChange,
  handleFileSelection,
  handleMotionVideoSelection,
}) => {
  return (
    <>
      <div className="reference-dropzone-block image-block" style={{ order: referenceOrder }}>
        <div
          className={`reference-step-card ${collapsedReference ? "is-collapsed" : ""} ${isVideoVariant ? "is-video-refs" : "is-image-refs"}`}
          onClick={onExpandReference}
        >
          <div className="reference-step-header">
            {beginnerMode && <span className="step-badge mini">{referenceBadge}</span>}
            <div className="reference-step-copy">
              <p className="step-title">{referenceStepTitle}</p>
              <span className="step-subtitle tiny helper-text">{referenceStepSubtitle}</span>
            </div>
            {!beginnerMode ? (
              <div className="reference-drop-header-actions">
                <ReferenceStepHeaderActionButton
                  label="Open reference options"
                  isCollapsed={collapsedReference}
                  onClick={onToggleReference}
                />
              </div>
            ) : null}
          </div>
          {!collapsedReference ? (
            <>
              {isVideoVariant ? (
                <div
                  className="reference-mode-toggle-row prompt-mode-toggle-row full-width"
                  role="tablist"
                  aria-label="Video reference mode"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeVideoMode === "standard"}
                    className={`mode-toggle-btn ${activeVideoMode === "standard" ? "is-active" : ""}`}
                    onClick={() => onVideoReferenceModeChange?.("standard")}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeVideoMode === "keyframes"}
                    className={`mode-toggle-btn ${activeVideoMode === "keyframes" ? "is-active" : ""}`}
                    onClick={() => onVideoReferenceModeChange?.("keyframes")}
                  >
                    First/Last Frame
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeVideoMode === "motion"}
                    className={`mode-toggle-btn ${activeVideoMode === "motion" ? "is-active" : ""}`}
                    onClick={() => onVideoReferenceModeChange?.("motion")}
                  >
                    Motion Control
                  </button>
                </div>
              ) : null}
              {isMotionMode ? (
                <div className="drop-image-row motion-drop-row">
                  <div className="primary-drop">
                    <div
                      className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${primaryDragActive ? "is-dragging" : ""}`}
                      onDrop={handlePrimaryDrop}
                      onDragEnter={handlePrimaryDragEnter}
                      onDragOver={handlePrimaryDragOver}
                      onDragLeave={handlePrimaryDragLeave}
                      onClick={() => primaryInputRef.current?.click()}
                      style={
                        referenceImageUrl
                          ? { backgroundImage: `url(${referenceImageUrl})` }
                          : undefined
                      }
                    >
                      <span className="dropzone-tag">Character image</span>
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
                          <Plus size={22} weight="regular" />
                          <p className="reference-drop-title">Add your character</p>
                          <p className="reference-drop-subtitle helper-text">
                            Image with visible face and body
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="primary-drop">
                    <div
                      className={`reference-dropzone video-dropzone ${motionVideoUrl ? "has-preview" : ""} ${motionVideoDragActive ? "is-dragging" : ""}`}
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
                      <span className="dropzone-tag">Motion video</span>
                      {motionVideoUrl ? (
                        <>
                          <video
                            className="reference-dropzone-video"
                            src={motionVideoUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                          />
                          <button
                            type="button"
                            className="dropzone-clear"
                            onClick={(event) => {
                              event.stopPropagation();
                              onMotionVideoChange?.(null);
                            }}
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <div className="reference-drop-content video-drop-content">
                          <VideoCamera size={22} weight="regular" />
                          <p className="reference-drop-title">Add motion to copy</p>
                          <p className="reference-drop-subtitle helper-text">
                            Video duration: 3–30 seconds
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : isKling3Mode ? (
                <div className="drop-image-row kling-drop-row">
                  <div className="primary-drop">
                    <div
                      className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${primaryDragActive ? "is-dragging" : ""}`}
                      onDrop={handlePrimaryDrop}
                      onDragEnter={handlePrimaryDragEnter}
                      onDragOver={handlePrimaryDragOver}
                      onDragLeave={handlePrimaryDragLeave}
                      onClick={() => primaryInputRef.current?.click()}
                      style={
                        referenceImageUrl
                          ? { backgroundImage: `url(${referenceImageUrl})` }
                          : undefined
                      }
                    >
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
                        <UploadSimple size={22} weight="regular" />
                        <p className="reference-drop-title helper-text">Upload a starting frame</p>
                      </div>
                    </div>
                  </div>
                  <div className="primary-drop">
                    <div
                      className={`reference-dropzone ${extraImageUrls[0] ? "has-preview" : ""} ${extraDragActive[0] ? "is-dragging" : ""}`}
                      onDrop={handleExtraDrop(0)}
                      onDragEnter={handleExtraDragEnter(0)}
                      onDragOver={handleExtraDragOver(0)}
                      onDragLeave={handleExtraDragLeave(0)}
                      onClick={() => extraOneInputRef.current?.click()}
                      style={
                        extraImageUrls[0]
                          ? { backgroundImage: `url(${extraImageUrls[0]})` }
                          : undefined
                      }
                    >
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
                        <UploadSimple size={22} weight="regular" />
                        <p className="reference-drop-title helper-text">Upload an end frame</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="drop-image-row">
                  <div className="primary-drop">
                    <div
                      className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${primaryDragActive ? "is-dragging" : ""}`}
                      onDrop={handlePrimaryDrop}
                      onDragEnter={handlePrimaryDragEnter}
                      onDragOver={handlePrimaryDragOver}
                      onDragLeave={handlePrimaryDragLeave}
                      onClick={() => primaryInputRef.current?.click()}
                      style={
                        referenceImageUrl
                          ? { backgroundImage: `url(${referenceImageUrl})` }
                          : undefined
                      }
                    >
                      {isVideoVariant ? (
                        <span className="dropzone-tag">
                          {isStandardMode ? "Reference image" : "First frame"}
                        </span>
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
                        <UploadSimple size={22} weight="regular" />
                        <p className="reference-drop-title helper-text">Click to upload an image</p>
                      </div>
                    </div>
                  </div>
                  {isVideoVariant && isKeyframesMode ? (
                    <>
                      <button
                        type="button"
                        className="reference-swap-control"
                        onClick={handleSwapFrames}
                        disabled={!canSwapFrames}
                        aria-label="Swap first and last frame references"
                      >
                        <ArrowFatLinesRight size={24} weight="regular" aria-hidden />
                      </button>
                      <div className="primary-drop">
                        <div
                          className={`reference-dropzone ${extraImageUrls[0] ? "has-preview" : ""} ${extraDragActive[0] ? "is-dragging" : ""}`}
                          onDrop={handleExtraDrop(0)}
                          onDragEnter={handleExtraDragEnter(0)}
                          onDragOver={handleExtraDragOver(0)}
                          onDragLeave={handleExtraDragLeave(0)}
                          onClick={() => extraOneInputRef.current?.click()}
                          style={
                            extraImageUrls[0]
                              ? { backgroundImage: `url(${extraImageUrls[0]})` }
                              : undefined
                          }
                        >
                          <span className="dropzone-tag">Last frame</span>
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
                              <UploadSimple size={22} weight="regular" />
                              <p className="reference-drop-title helper-text">
                                Click to upload an image
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : !isVideoVariant ? (
                    <>
                      <div className="reference-drop-divider" aria-hidden="true">
                        <Selection size={22} weight="regular" />
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
                              style={
                                previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined
                              }
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
                                <Plus size={22} weight="regular" />
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
          ) : null}
        </div>
      </div>
      <input
        ref={primaryInputRef}
        type="file"
        accept="image/*"
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
        accept="video/*"
        style={{ display: "none" }}
        onChange={handleMotionVideoSelection}
      />
    </>
  );
};
