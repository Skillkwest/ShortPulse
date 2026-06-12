/**
 * Dashboard tutorial payload normalization.
 * Keeps API response parsing shared between public and authenticated dashboard surfaces.
 */
import type { DashboardTutorial } from "../components/DashboardTutorialGrid";

/**
 * Normalizes one dashboard tutorial-shaped payload from API/static data.
 */
export const asDashboardTutorial = (value: unknown): DashboardTutorial | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const youtubeUrl = typeof row.youtubeUrl === "string" ? row.youtubeUrl.trim() : "";
  const thumbnailUrl = typeof row.thumbnailUrl === "string" ? row.thumbnailUrl.trim() : "";
  const thumbnailPosterUrl =
    typeof row.thumbnailPosterUrl === "string" ? row.thumbnailPosterUrl.trim() : null;
  const thumbnailMediaType =
    row.thumbnailMediaType === "video" || row.thumbnailMediaType === "image"
      ? row.thumbnailMediaType
      : "image";

  if (!id || !title || !youtubeUrl || !thumbnailUrl) return null;
  return {
    id,
    title,
    youtubeUrl,
    thumbnailUrl,
    thumbnailMediaType,
    thumbnailPosterUrl,
    thumbnailAlt: typeof row.thumbnailAlt === "string" ? row.thumbnailAlt.trim() : "",
    displayOrder: typeof row.displayOrder === "number" ? row.displayOrder : 0,
  };
};

/**
 * Normalizes an unknown dashboard tutorial collection.
 */
export const asDashboardTutorials = (value: unknown): DashboardTutorial[] =>
  Array.isArray(value)
    ? value
        .map(asDashboardTutorial)
        .filter((tutorial): tutorial is DashboardTutorial => tutorial !== null)
    : [];
