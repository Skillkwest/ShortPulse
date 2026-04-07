import React from "react";
import type { ElementDraft } from "../types";

type ElementsReferenceDeckSectionProps = {
  draft: ElementDraft;
  onCreateReference?: () => void;
};

const buildDeckEntries = (draft: ElementDraft) => {
  if (draft.assetType === "video") {
    return draft.videoReferenceUrl.trim()
      ? [
          {
            id: "video-reference",
            label: "Motion Reference",
            meta: "Scene motion",
            accent: "video" as const,
          },
        ]
      : [];
  }

  return draft.imageReferenceUrls
    .filter(Boolean)
    .slice(0, 6)
    .map((_, index) => ({
      id: `image-reference-${index + 1}`,
      label: `Reference ${String(index + 1).padStart(2, "0")}`,
      meta: index === 0 ? "Primary look" : "Alt angle",
      accent: index % 2 === 0 ? ("magenta" as const) : ("violet" as const),
    }));
};

export function ElementsReferenceDeckSection({
  draft,
  onCreateReference,
}: ElementsReferenceDeckSectionProps) {
  const entries = buildDeckEntries(draft);
  const capacityLabel = draft.assetType === "video" ? "1 slot" : "6 slots";
  const helperCopy =
    draft.assetType === "video"
      ? "Collect motion or scene references for this element here."
      : "Collect alternate looks, angles, and supporting references for this element here.";

  return (
    <section className="elements-deck-section">
      <div className="elements-section-head">
        <div className="elements-section-title-row">
          <div className="elements-section-title-copy">
            <h3 className="elements-section-title">Element Deck</h3>
            <p className="tiny subdued elements-section-helper">{helperCopy}</p>
          </div>
        </div>
        <span className="elements-deck-capacity-chip">
          {entries.length}/{capacityLabel}
        </span>
      </div>

      <div className="elements-deck-grid" aria-label="Element deck references">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className={`elements-deck-card elements-deck-card--${entry.accent}`}
          >
            <div className="elements-deck-card-media" aria-hidden="true">
              <span className="elements-deck-card-title">{entry.label}</span>
              <span className="elements-deck-card-meta">{entry.meta}</span>
            </div>
          </article>
        ))}
        <button
          type="button"
          className="elements-deck-card elements-deck-card--add"
          onClick={onCreateReference}
        >
          <div className="elements-deck-card-media" aria-hidden="true">
            <span>+</span>
          </div>
          <span className="elements-deck-card-add-label">Add reference</span>
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="elements-deck-empty-copy tiny subdued">
          Build a reusable deck of supporting looks here. This mirrors the Character QuickSwap
          workflow, but stays scoped to element references only.
        </p>
      ) : null}
    </section>
  );
}
