import React from "react";

type CharacterProfileLoadingSkeletonProps = {
  surface: "page" | "panel";
};

/**
 * Dedicated loading prefab for the Character Profile view.
 * Keeps loading-state layout isolated from the live Character library and profile workspace.
 */
export function CharacterProfileLoadingSkeleton({ surface }: CharacterProfileLoadingSkeletonProps) {
  return (
    <div className="character-profile-loading-prefab" role="status" aria-live="polite">
      <span className="character-create-loading-spinner" aria-hidden="true" />
      <p className="character-create-loading-title">Loading character profile...</p>
      <p className="tiny subdued character-create-loading-copy">
        Pulling your character sheet and references into view.
      </p>

      <div
        className={`character-profile-loading-prefab-workspace ${
          surface === "panel" ? "is-embedded" : ""
        }`}
      >
        <section
          className="character-profile-loading-prefab-card character-profile-loading-prefab-card--library"
          data-layout-region="library"
          aria-hidden="true"
        >
          <div className="character-profile-loading-prefab-heading">
            <span className="character-create-loading-line character-create-loading-line--title" />
            <span className="character-create-loading-line character-create-loading-line--subtitle" />
          </div>

          <div className="character-profile-loading-prefab-library-list">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={`character-profile-loading-library-item-${index + 1}`}
                className="character-profile-loading-prefab-library-item"
              >
                <span className="character-profile-loading-prefab-library-item-avatar" />
                <div className="character-profile-loading-prefab-library-item-copy">
                  <span className="character-create-loading-line character-create-loading-line--subtitle" />
                  <span className="character-create-loading-line character-create-loading-line--title" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="character-profile-loading-prefab-card character-profile-loading-prefab-card--sheet"
          data-layout-region="sheet"
          aria-hidden="true"
        >
          <div className="character-profile-loading-prefab-heading">
            <span className="character-create-loading-line character-create-loading-line--title" />
            <span className="character-create-loading-line character-create-loading-line--subtitle" />
          </div>

          <div className="character-profile-loading-prefab-profile-row">
            <span className="character-create-loading-profile-avatar" />
            <span className="character-create-loading-profile-name" />
          </div>

          <div className="character-profile-loading-prefab-tab-row">
            <span className="character-create-loading-tab" />
            <span className="character-create-loading-tab" />
            <span className="character-create-loading-tab character-create-loading-tab--short" />
          </div>

          <span className="character-create-loading-description" />

          <div className="character-profile-loading-prefab-references-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <span
                key={`character-profile-loading-reference-${index + 1}`}
                className="character-create-loading-reference"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
