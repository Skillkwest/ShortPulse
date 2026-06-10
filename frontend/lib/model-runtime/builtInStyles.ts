/**
 * Canonical AI Studio built-in Styles catalog domain.
 * Admin writes these definitions globally; user preference storage may only hide them.
 */
export const BUILT_IN_STYLE_SCHEMA_VERSION = 1;

export type BuiltInStyleDefinition = {
  styleId: string;
  title: string;
  stylePrompt: string;
  previewImageUrl: string;
  referenceImageName?: string | null;
  schemaVersion: number;
};

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const createBuiltInStyleDefinition = ({
  styleId,
  title,
  stylePrompt,
  previewImageUrl,
  referenceImageName = null,
}: {
  styleId: string;
  title: string;
  stylePrompt: string;
  previewImageUrl: string;
  referenceImageName?: string | null;
}): BuiltInStyleDefinition => ({
  styleId,
  title,
  stylePrompt,
  previewImageUrl,
  referenceImageName,
  schemaVersion: BUILT_IN_STYLE_SCHEMA_VERSION,
});

export const SEEDED_BUILT_IN_STYLE_DEFINITIONS = [
  createBuiltInStyleDefinition({
    styleId: "photorealistic",
    title: "Photorealistic",
    stylePrompt:
      "photorealistic image, true-to-life skin texture and materials, natural color response, balanced dynamic range, crisp focus, realistic lighting and shadow falloff",
    previewImageUrl: "/Styles/Photoreal.png",
  }),
  createBuiltInStyleDefinition({
    styleId: "cinematic",
    title: "Cinematic",
    stylePrompt:
      "cinematic editorial photography, dramatic moody lighting, rich contrast, controlled color grade, shallow depth of field, polished high-end production finish",
    previewImageUrl: "/Styles/Cinematic.png",
  }),
  createBuiltInStyleDefinition({
    styleId: "cell-phone-snapshot",
    title: "Cell phone snapshot",
    stylePrompt:
      "casual smartphone photo, natural available light, candid framing, everyday realism, slightly imperfect composition, authentic handheld snapshot feel",
    previewImageUrl: "/Styles/Cell Phone Snap Shot.jpeg",
  }),
  createBuiltInStyleDefinition({
    styleId: "anime",
    title: "Anime",
    stylePrompt:
      "anime style, clean linework, expressive character design, soft cel shading, stylized color palette, polished 2D illustration finish",
    previewImageUrl: "/Styles/Anime.png",
  }),
] as const satisfies readonly BuiltInStyleDefinition[];

const normalizeBuiltInStyleDefinitionRecord = (value: unknown): BuiltInStyleDefinition | null => {
  if (!value || typeof value !== "object") return null;
  const styleId = normalizeNonEmptyString((value as { styleId?: unknown }).styleId);
  const title = normalizeNonEmptyString((value as { title?: unknown }).title);
  const stylePrompt = normalizeNonEmptyString((value as { stylePrompt?: unknown }).stylePrompt);
  const previewImageUrl = normalizeNonEmptyString(
    (value as { previewImageUrl?: unknown }).previewImageUrl
  );
  const referenceImageName = normalizeNonEmptyString(
    (value as { referenceImageName?: unknown }).referenceImageName
  );
  if (!styleId || !title || !stylePrompt || !previewImageUrl) return null;
  return createBuiltInStyleDefinition({
    styleId,
    title,
    stylePrompt,
    previewImageUrl,
    referenceImageName,
  });
};

export const normalizeBuiltInStyleDefinitions = (value: unknown): BuiltInStyleDefinition[] => {
  if (!Array.isArray(value)) return [];
  const seenStyleIds = new Set<string>();
  const normalized: BuiltInStyleDefinition[] = [];
  value.forEach((entry) => {
    const normalizedEntry = normalizeBuiltInStyleDefinitionRecord(entry);
    if (!normalizedEntry || seenStyleIds.has(normalizedEntry.styleId)) return;
    seenStyleIds.add(normalizedEntry.styleId);
    normalized.push(normalizedEntry);
  });
  return normalized;
};

export const resolveBuiltInStyleDefinitions = (
  styleDefinitions?: readonly BuiltInStyleDefinition[] | null
): BuiltInStyleDefinition[] =>
  Array.isArray(styleDefinitions)
    ? normalizeBuiltInStyleDefinitions(styleDefinitions)
    : [...SEEDED_BUILT_IN_STYLE_DEFINITIONS];
