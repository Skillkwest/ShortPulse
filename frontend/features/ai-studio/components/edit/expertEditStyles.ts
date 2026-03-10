import type { StylesLibraryStyleExtractionMeta, StylesLibraryStyleProfile } from "../../types";

export type ExpertEditStyleTile = {
  id: string;
  style?: string;
  title: string;
  referenceImageName?: string;
  stylePrompt?: string;
  styleProfile?: StylesLibraryStyleProfile;
  extractionMeta?: StylesLibraryStyleExtractionMeta;
  previewUrl: string | null;
  placeholder: boolean;
};

const PRIMARY_STYLE_TILES: readonly ExpertEditStyleTile[] = [
  {
    id: "photorealistic",
    title: "Photorealistic",
    previewUrl: "/Styles/Photoreal.png",
    placeholder: false,
  },
  {
    id: "cinematic",
    title: "Cinematic",
    previewUrl: "/Styles/Cinematic.png",
    placeholder: false,
  },
  {
    id: "cell-phone-snapshot",
    title: "Cell phone snapshot",
    previewUrl: "/Styles/Cell Phone Snap Shot.jpeg",
    placeholder: false,
  },
  {
    id: "anime",
    title: "Anime",
    previewUrl: "/Styles/Anime.png",
    placeholder: false,
  },
];

export const EXPERT_EDIT_STYLE_CATALOG: readonly ExpertEditStyleTile[] = [...PRIMARY_STYLE_TILES];

export const resolveStylePreviewBackgroundImage = (previewUrl: string | null) => {
  const resolvedPreviewUrl = previewUrl?.trim() ?? "";
  if (!resolvedPreviewUrl) return undefined;
  return `url("${encodeURI(resolvedPreviewUrl)}")`;
};

export const resolveExpertEditStyleById = (styleId: string | null): ExpertEditStyleTile | null => {
  if (!styleId) return null;
  return (
    EXPERT_EDIT_STYLE_CATALOG.find((style) => !style.placeholder && style.id === styleId) ?? null
  );
};
