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
import { ReferenceStepHeaderActionButton } from "./ReferenceStepHeaderActionButton";

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
  topContent?: React.ReactNode;
  inlineAside?: React.ReactNode;
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
  topContent,
  inlineAside,
}) => {
  const showHeader = !isVideoVariant;
  const isCollapsed = showHeader ? collapsedReference : false;
  const shouldShowPrimaryOptionalPill = isVideoVariant && isStandardMode && !referenceImageUrl;
  const shouldShowLastFrameOptionalPill = isVideoVariant && isStandardMode && !extraImageUrls[0];
  const mediaContent = (
    <>
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
                referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined
              }
            >
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
              <span className="dropzone-tag">Motion</span>
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
                  <VideoCamera size={24} weight="regular" />
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
                referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined
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
                <UploadSimple size={24} weight="regular" />
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
                extraImageUrls[0] ? { backgroundImage: `url(${extraImageUrls[0]})` } : undefined
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
              className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${primaryDragActive ? "is-dragging" : ""}`}
              onDrop={handlePrimaryDrop}
              onDragEnter={handlePrimaryDragEnter}
              onDragOver={handlePrimaryDragOver}
              onDragLeave={handlePrimaryDragLeave}
              onClick={() => primaryInputRef.current?.click()}
              style={
                referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined
              }
            >
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
                  className={`reference-dropzone ${extraImageUrls[0] ? "has-preview" : ""} ${extraDragActive[0] ? "is-dragging" : ""}`}
                  onDrop={handleExtraDrop(0)}
                  onDragEnter={handleExtraDragEnter(0)}
                  onDragOver={handleExtraDragOver(0)}
                  onDragLeave={handleExtraDragLeave(0)}
                  onClick={() => extraOneInputRef.current?.click()}
                  style={
                    extraImageUrls[0] ? { backgroundImage: `url(${extraImageUrls[0]})` } : undefined
                  }
                >
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
