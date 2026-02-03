/**
 * Pulse Enhance properties panel.
 * Presents upscale mode toggles, reference dropzone, and generate action for image/video enhancement.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ImageSquare, Sparkle, UploadSimple, VideoCamera } from "phosphor-react";
import { GreyMediaLibraryButton } from "./GreyMediaLibraryButton";
import { extractDragDropPayload, isImageDragTransfer } from "../utils/dragDrop";

type EnhanceMode = "image" | "video";

type EnhancePropertiesPanelProps = {
  onGenerate?: (mode: EnhanceMode) => void;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  onOpenMediaLibrary?: () => void;
  onTriggerFileSelect?: () => void;
  beginnerMode?: boolean;
};

export function EnhancePropertiesPanel({
  onGenerate = () => {},
  costCredits = null,
  isGenerateDisabled = false,
  resolvePreviewUrlById,
  onOpenMediaLibrary,
  onTriggerFileSelect,
  beginnerMode = false,
}: EnhancePropertiesPanelProps) {
  const [mode, setMode] = useState<EnhanceMode>("image");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ownsPreviewUrl, setOwnsPreviewUrl] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && ownsPreviewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, ownsPreviewUrl]);

  const setPreview = (url: string, label?: string, owned?: boolean) => {
    setPreviewUrl(url);
    setFileLabel(label ?? "Reference");
    setOwnsPreviewUrl(Boolean(owned));
  };

  const handleFiles = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if ((mode === "image" && !isImage) || (mode === "video" && !isVideo)) return;
    if (previewUrl && ownsPreviewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setPreview(nextUrl, file.name, true);
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const { imageUrl, fromFile, referenceId } = extractDragDropPayload(event.dataTransfer);

    // Prefer stable preview stored in state (mirrors regen flow)
    let nextUrl = (referenceId && resolvePreviewUrlById ? resolvePreviewUrlById(referenceId) : null) ?? imageUrl;
    if (!nextUrl) return;

    const isBlobUrl = nextUrl.startsWith("blob:");
    const canAcceptBlob = fromFile || Boolean(referenceId);
    if (isBlobUrl && !canAcceptBlob) return;
    if (mode === "video") return;

    if (isBlobUrl) {
      fetch(nextUrl)
        .then((resp) => resp.blob())
        .then((blob) => {
          if (previewUrl && ownsPreviewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
          }
          const cloned = URL.createObjectURL(blob);
          setPreview(cloned, referenceId ?? imageUrl ?? "Reference", true);
        })
        .catch(() => setPreview(nextUrl, referenceId ?? imageUrl ?? "Reference"));
      return;
    }

    setPreview(nextUrl, referenceId ?? imageUrl ?? "Reference", false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    handleImageDrop(event);
  };

  const canAcceptDrag = (transfer: DataTransfer) => {
    if (transfer.files?.length) return true;
    return isImageDragTransfer(transfer);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptDrag(event.dataTransfer)) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleGenerate = () => {
    onGenerate(mode);
  };

  const resetSelection = useCallback(() => {
    if (previewUrl && ownsPreviewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFileLabel(null);
    setOwnsPreviewUrl(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [previewUrl, ownsPreviewUrl]);

  const isVideoMode = mode === "video";

  useEffect(() => {
    resetSelection();
    setIsDragging(false);
  }, [mode, resetSelection]);

  return (
    <div className="tool-properties enhance-panel">
      <div className="tool-header">
        <p className="eyebrow">Pulse · Enhance</p>
        <p className="subdued tiny helper-text">Upscale images or videos with guided steps.</p>
      </div>

      <div className="step-card">
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">1</span>}
          <div className="step-header-copy">
            <p className="step-title">Choose what to upscale</p>
            <span className="step-subtitle tiny helper-text">Select the content type before adding a reference.</span>
          </div>
        </div>
        <div className="enhance-mode-row" role="group" aria-label="Select upscale type">
          <button
            type="button"
            className={`ghost-btn small mode-toggle-btn ${!isVideoMode ? "is-active" : ""}`}
            onClick={() => setMode("image")}
            aria-pressed={!isVideoMode}
          >
            <ImageSquare size={16} weight="regular" /> Upscale Image
          </button>
          <button
            type="button"
            className={`ghost-btn small mode-toggle-btn ${isVideoMode ? "is-active" : ""}`}
            onClick={() => setMode("video")}
            aria-pressed={isVideoMode}
          >
            <VideoCamera size={16} weight="regular" /> Upscale Video
          </button>
        </div>
      </div>

      <div className="step-card">
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">2</span>}
          <div className="step-header-copy">
            <p className="step-title">Add your reference</p>
            <span className="step-subtitle tiny helper-text">
              Drop a {isVideoMode ? "video" : "single image"} or upload from your device.
            </span>
          </div>
        </div>
        <div className="drop-image-row">
          <div className="primary-drop">
            <div
              className={`reference-dropzone enhance-dropzone ${previewUrl ? "has-preview" : ""} ${isDragging ? "is-dragging" : ""}`}
              onDrop={handleDrop}
              onDragEnter={(e) => {
                if (canAcceptDrag(e.dataTransfer)) {
                  e.preventDefault();
                  setIsDragging(true);
                }
              }}
              onDragOver={(e) => {
                if (canAcceptDrag(e.dataTransfer)) {
                  e.preventDefault();
                  setIsDragging(true);
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onClick={() => inputRef.current?.click()}
              style={!isVideoMode && previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
            >
              {previewUrl ? (
                <button
                  type="button"
                  className="dropzone-clear"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (previewUrl && ownsPreviewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    setFileLabel(null);
                    setOwnsPreviewUrl(false);
                  }}
                >
                  ×
                </button>
              ) : (
                <div className="reference-drop-content image-drop-content">
                  <UploadSimple size={22} weight="regular" />
                  <p className="reference-drop-title helper-text">Click or drop a high-res image</p>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={isVideoMode ? "video/*" : "image/*"}
              className="visually-hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
          </div>
          <div className="enhance-drop-actions">
            <button type="button" className="ghost-btn mini preview-media-btn" onClick={onTriggerFileSelect}>
              <UploadSimple size={14} weight="regular" />
              Add files
            </button>
            <GreyMediaLibraryButton onClick={onOpenMediaLibrary} />
          </div>
        </div>
        </div>

      <div className="step-card">
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">3</span>}
          <div className="step-header-copy">
            <p className="step-title">Generate upscale</p>
            <span className="step-subtitle tiny helper-text">
              We’ll apply Pulse enhancement and return the upscaled {isVideoMode ? "video" : "image"} preview.
            </span>
          </div>
        </div>
        <div className="ai-control-strip">
          <button
            type="button"
            className="primary-btn primary-btn-wide"
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
          >
            {isVideoMode ? <VideoCamera size={18} weight="fill" /> : <ImageSquare size={18} weight="fill" />}
            <span className="primary-btn-label">Generate</span>
            <span className="primary-btn-credits">
              {costCredits != null ? costCredits : "—"} <Sparkle size={18} weight="fill" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
