import React from "react";
import type { ElementLibraryItem } from "../types";

type ElementsLibraryCardProps = {
  item: ElementLibraryItem;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

export function ElementsLibraryCard({
  item,
  selected,
  onSelect,
  onDelete,
}: ElementsLibraryCardProps) {
  return (
    <article className={`elements-library-card ${selected ? "is-selected" : ""}`} role="listitem">
      <button
        type="button"
        className="elements-library-card-select"
        aria-pressed={selected}
        aria-label={`Open element profile: ${item.name}`}
        onClick={onSelect}
      >
        <span className="elements-library-card-thumb" aria-hidden="true">
          {item.assetType === "image" ? "IMG" : "VID"}
        </span>
        <span className="elements-library-card-copy">
          <span className="elements-library-card-title">{item.name}</span>
          <span className="elements-library-card-meta">
            {item.assetType === "image" ? "Image element" : "Video element"}
          </span>
          {item.alias ? (
            <span className="elements-library-card-meta">alias: {item.alias}</span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        className="elements-library-card-delete"
        aria-label={`Delete element: ${item.name}`}
        onClick={onDelete}
      >
        ×
      </button>
    </article>
  );
}
