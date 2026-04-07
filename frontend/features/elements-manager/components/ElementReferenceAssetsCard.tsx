import React from "react";
import type { ElementDraft } from "../types";

type ElementReferenceAssetsCardProps = {
  draft: ElementDraft;
  onFieldChange: <K extends keyof ElementDraft>(field: K, value: ElementDraft[K]) => void;
};

const joinImageReferences = (references: string[]) => references.join("\n");

const buildImageSlotLabels = (references: string[]) =>
  references.slice(0, 4).map((_, index) => `Reference ${String(index + 1).padStart(2, "0")}`);

export function ElementReferenceAssetsCard({
  draft,
  onFieldChange,
}: ElementReferenceAssetsCardProps) {
  const imageSlotLabels = buildImageSlotLabels(draft.imageReferenceUrls.filter(Boolean));

  return (
    <section className="elements-profile-section elements-profile-section--references">
      <div className="elements-section-head">
        <div className="elements-section-title-row">
          <div className="elements-section-title-copy">
            <h3 className="elements-profile-section-title">Element References</h3>
          </div>
        </div>
      </div>
      {draft.assetType === "image" ? (
        <>
          <p className="elements-sheet-references-helper tiny subdued">
            Add 2 to 4 reference images for this element.
          </p>
          <div className="elements-reference-slot-grid">
            {Array.from({ length: 4 }, (_, index) => {
              const slotLabel =
                imageSlotLabels[index] ?? (index === 0 ? "Primary look" : `Alt angle ${index}`);
              const hasReference = Boolean(draft.imageReferenceUrls[index]);
              return (
                <article
                  key={slotLabel}
                  className={`elements-reference-slot-card ${hasReference ? "is-filled" : "is-empty"}`}
                >
                  <div className="elements-reference-slot-media" aria-hidden="true">
                    {hasReference ? (
                      <span className="elements-reference-slot-chip">{slotLabel}</span>
                    ) : (
                      <span className="elements-reference-slot-empty-copy tiny">
                        <span>Drop reference or click to upload</span>
                        <span className="elements-reference-slot-requirement">
                          {index < 2 ? "(Suggested)" : "(Optional)"}
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="elements-reference-slot-label">{slotLabel}</span>
                </article>
              );
            })}
          </div>
          <label className="elements-field">
            <span className="elements-field-label">Reference image URLs</span>
            <textarea
              className="elements-textarea"
              rows={4}
              value={joinImageReferences(draft.imageReferenceUrls)}
              onChange={(event) =>
                onFieldChange(
                  "imageReferenceUrls",
                  event.target.value
                    .split(/\n+/)
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                )
              }
            />
          </label>
        </>
      ) : (
        <>
          <p className="elements-sheet-references-helper tiny subdued">
            Add one reference video for this element.
          </p>
          <article
            className={`elements-reference-video-card ${
              draft.videoReferenceUrl.trim() ? "is-filled" : "is-empty"
            }`}
          >
            <div className="elements-reference-video-media" aria-hidden="true">
              {draft.videoReferenceUrl.trim() ? (
                <span className="elements-reference-slot-chip">Motion Reference</span>
              ) : (
                <span className="elements-reference-slot-empty-copy tiny">
                  <span>Drop reference video or click to upload</span>
                  <span className="elements-reference-slot-requirement">(Required)</span>
                </span>
              )}
            </div>
          </article>
          <label className="elements-field">
            <span className="elements-field-label">Reference video URL</span>
            <input
              className="elements-input"
              value={draft.videoReferenceUrl}
              onChange={(event) => onFieldChange("videoReferenceUrl", event.target.value)}
            />
          </label>
        </>
      )}
    </section>
  );
}
