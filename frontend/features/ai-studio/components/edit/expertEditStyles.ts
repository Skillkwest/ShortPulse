/**
 * Built-in AI Studio style catalog used by the shipped Styles panel defaults.
 */
export type ExpertEditStyleTile = {
  id: string;
  style?: string;
  title: string;
  referenceImageName?: string;
  stylePrompt?: string;
  previewUrl: string | null;
  placeholder: boolean;
};

const PRIMARY_STYLE_TILES: readonly ExpertEditStyleTile[] = [
  {
    id: "photorealistic",
    title: "Photorealistic",
    stylePrompt:
      "photorealistic image, true-to-life skin texture and materials, natural color response, balanced dynamic range, crisp focus, realistic lighting and shadow falloff",
    previewUrl: "/Styles/Photoreal.png",
    placeholder: false,
  },
  {
    id: "cinematic",
    title: "Cinematic",
    stylePrompt:
      "cinematic editorial photography, dramatic moody lighting, rich contrast, controlled color grade, shallow depth of field, polished high-end production finish",
    previewUrl: "/Styles/Cinematic.png",
    placeholder: false,
  },
  {
    id: "cell-phone-snapshot",
    title: "Cell phone snapshot",
    stylePrompt:
      "casual smartphone photo, natural available light, candid framing, everyday realism, slightly imperfect composition, authentic handheld snapshot feel",
    previewUrl: "/Styles/Cell Phone Snap Shot.jpeg",
    placeholder: false,
  },
  {
    id: "anime",
    title: "Anime",
    stylePrompt:
      "anime style, clean linework, expressive character design, soft cel shading, stylized color palette, polished 2D illustration finish",
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
