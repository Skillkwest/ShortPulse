export type ExpertEditStyleTile = {
  id: string;
  title: string;
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

const STYLE_TILE_TOTAL = 16;

export const EXPERT_EDIT_STYLE_CATALOG: readonly ExpertEditStyleTile[] = [
  ...PRIMARY_STYLE_TILES,
  ...Array.from(
    { length: Math.max(0, STYLE_TILE_TOTAL - PRIMARY_STYLE_TILES.length) },
    (_, index): ExpertEditStyleTile => ({
      id: `style-placeholder-${index + 1}`,
      title: `Placeholder ${index + 1}`,
      previewUrl: null,
      placeholder: true,
    })
  ),
];

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
