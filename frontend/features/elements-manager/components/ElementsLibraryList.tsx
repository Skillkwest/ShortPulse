import React from "react";
import type { ElementLibraryItem } from "../types";
import { ElementsLibraryCard } from "./ElementsLibraryCard";

type ElementsLibraryListProps = {
  elements: readonly ElementLibraryItem[];
  selectedElementId: string | null;
  onCreateElement: () => void;
  onSelectElement: (elementId: string) => void;
  onRequestDeleteElement: (elementId: string) => void;
};

export function ElementsLibraryList({
  elements,
  selectedElementId,
  onCreateElement,
  onSelectElement,
  onRequestDeleteElement,
}: ElementsLibraryListProps) {
  return (
    <section className="elements-library-view" aria-label="Elements library">
      <div className="elements-library-head">
        <div>
          <h2 className="elements-library-title">Elements Library</h2>
          <p className="tiny subdued helper-text">
            Create reusable subjects, props, and scene elements for future Kling workflows.
          </p>
        </div>
        <button type="button" className="elements-library-create-btn" onClick={onCreateElement}>
          Create New Element
        </button>
      </div>
      {elements.length === 0 ? (
        <div className="elements-library-empty">
          <h3>No elements yet</h3>
          <p className="tiny subdued">
            Create your first reusable element to build a library for Kling scenes and prompt
            references.
          </p>
          <button type="button" className="elements-library-create-btn" onClick={onCreateElement}>
            Create New Element
          </button>
        </div>
      ) : (
        <div className="elements-library-grid" role="list" aria-label="Elements library tiles">
          {elements.map((item) => (
            <ElementsLibraryCard
              key={item.id}
              item={item}
              selected={selectedElementId === item.id}
              onSelect={() => onSelectElement(item.id)}
              onDelete={() => onRequestDeleteElement(item.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
