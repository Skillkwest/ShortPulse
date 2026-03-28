/**
 * Resolves whether the active output may be used as a preview/reference source.
 * Keeps preview/detail surfaces aligned with canonical output authority.
 */
import { resolveReferenceCardUrls } from "./referenceGridMedia";
import type { StudioOutput } from "../types";

/**
 * Returns the active output preview URL only when the output is intentionally
 * available to preview surfaces. Hidden outputs bypass grid-ready gating.
 */
export const resolveActiveOutputPreviewUrl = ({
  activeOutput,
  referenceGridReadyOutputIds,
}: {
  activeOutput: StudioOutput | null;
  referenceGridReadyOutputIds: ReadonlySet<string>;
}): string | null => {
  if (!activeOutput) return null;

  const isPreviewAllowed =
    activeOutput.hiddenInReferenceGrid === true || referenceGridReadyOutputIds.has(activeOutput.id);
  if (!isPreviewAllowed) return null;

  const resolved = resolveReferenceCardUrls(
    {
      previewStoragePath: activeOutput.previewStoragePath,
      fullStoragePath: activeOutput.fullStoragePath,
      previewUrl: activeOutput.previewUrl,
      resultUrls: activeOutput.resultUrls,
      mediaSource: activeOutput.mediaSource,
      generationId: activeOutput.generationId,
      savedMediaIds: activeOutput.savedMediaIds,
      mode: activeOutput.mode,
    },
    {
      strictPreviewLadder: true,
      adaptivePreviewQuality: false,
      surface: "detail-modal",
    }
  );

  return resolved.previewUrl ?? null;
};
