/**
 * Reference-grid adaptive preview routing helper.
 * Encapsulates the canonical gate for whether adaptive preview behavior is active.
 */

/**
 * Returns whether adaptive preview routing should be active for reference-grid surfaces.
 */
export const isReferenceGridAdaptivePreviewRoutingEnabled = ({
  adaptivePreviewEnabled,
  adaptivePreviewQualityEnabled,
}: {
  adaptivePreviewEnabled: boolean;
  adaptivePreviewQualityEnabled: boolean;
}): boolean => adaptivePreviewEnabled && adaptivePreviewQualityEnabled;
