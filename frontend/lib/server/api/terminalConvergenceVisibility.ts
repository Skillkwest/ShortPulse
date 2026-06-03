/**
 * Shared visibility-state helpers for terminal convergence paths.
 * Keeps publication and reference-grid suppression decisions aligned.
 */

type VisibilityMetadataReader = {
  hiddenInReferenceGrid: boolean | null | undefined;
};

export type SuccessVisibilityState = {
  hiddenInReferenceGrid: boolean;
  publicationState: "published" | "suppressed";
  referenceGridVisible: boolean;
};

export type FailureVisibilityState = {
  hiddenInReferenceGrid: boolean;
  referenceGridVisible: boolean;
};

/**
 * Resolve success-path visibility from abandonment plus result displayability.
 */
export const resolveTerminalSuccessVisibilityState = ({
  metadata,
  abandoned,
  hasCanonicalOwnedMedia,
  hasDisplayableResultMedia,
}: {
  metadata: VisibilityMetadataReader;
  abandoned: boolean;
  hasCanonicalOwnedMedia: boolean;
  hasDisplayableResultMedia: boolean;
}): SuccessVisibilityState => {
  const hiddenInReferenceGrid = abandoned || Boolean(metadata.hiddenInReferenceGrid);
  const publicationState = hasCanonicalOwnedMedia && !abandoned ? "published" : "suppressed";
  const referenceGridVisible = !hiddenInReferenceGrid && hasDisplayableResultMedia;
  return {
    hiddenInReferenceGrid,
    publicationState,
    referenceGridVisible,
  };
};

/**
 * Resolve failure-path visibility from abandonment plus explicit hidden state.
 */
export const resolveTerminalFailureVisibilityState = ({
  metadata,
  abandoned,
}: {
  metadata: VisibilityMetadataReader;
  abandoned: boolean;
}): FailureVisibilityState => {
  const hiddenInReferenceGrid = abandoned || Boolean(metadata.hiddenInReferenceGrid);
  return {
    hiddenInReferenceGrid,
    referenceGridVisible: !hiddenInReferenceGrid,
  };
};
