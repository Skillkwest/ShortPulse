/**
 * Canonical AI Studio built-in Styles catalog domain.
 * Admin writes these definitions globally; user preference storage may only hide them.
 */
export const BUILT_IN_STYLE_SCHEMA_VERSION = 1;
export const BUILT_IN_STYLE_ID_MAX_LENGTH = 160;

export type BuiltInStyleDefinition = {
  styleId: string;
  title: string;
  stylePrompt: string;
  previewImageUrl: string;
  referenceImageName?: string | null;
  schemaVersion: number;
};

const BUILT_IN_STYLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const trimBuiltInStyleIdToBudget = (value: string, maxLength = BUILT_IN_STYLE_ID_MAX_LENGTH) =>
  value.slice(0, maxLength).replace(/-+$/g, "");

export const normalizeBuiltInStyleId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > BUILT_IN_STYLE_ID_MAX_LENGTH) return null;
  return BUILT_IN_STYLE_ID_PATTERN.test(normalized) ? normalized : null;
};

const normalizeStoredBuiltInStyleId = (value: unknown): string | null => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized || normalized.length > BUILT_IN_STYLE_ID_MAX_LENGTH) return null;
  return normalized;
};

export const createBuiltInStyleIdFromTitle = (
  title: string,
  fallbackStyleId = "built-in-style"
): string => {
  const fallback = normalizeBuiltInStyleId(fallbackStyleId) ?? "built-in-style";
  const slug = trimBuiltInStyleIdToBudget(
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
  return normalizeBuiltInStyleId(slug) ?? fallback;
};

export const resolveUniqueBuiltInStyleId = ({
  preferredStyleId,
  title,
  fallbackStyleId = "built-in-style",
  usedStyleIds,
}: {
  preferredStyleId?: unknown;
  title: string;
  fallbackStyleId?: string;
  usedStyleIds: ReadonlySet<string>;
}): string => {
  const fallback = normalizeBuiltInStyleId(fallbackStyleId) ?? "built-in-style";
  const baseStyleId =
    normalizeBuiltInStyleId(preferredStyleId) ?? createBuiltInStyleIdFromTitle(title, fallback);
  if (!usedStyleIds.has(baseStyleId)) return baseStyleId;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidateBase = trimBuiltInStyleIdToBudget(
      baseStyleId,
      BUILT_IN_STYLE_ID_MAX_LENGTH - suffixText.length
    );
    const candidate = normalizeBuiltInStyleId(`${candidateBase || fallback}${suffixText}`);
    if (candidate && !usedStyleIds.has(candidate)) return candidate;
  }

  const uniqueFallback = `${trimBuiltInStyleIdToBudget(
    fallback,
    BUILT_IN_STYLE_ID_MAX_LENGTH - 9
  )}-${Date.now().toString(36)}`;
  return trimBuiltInStyleIdToBudget(uniqueFallback);
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
  const styleId = normalizeStoredBuiltInStyleId((value as { styleId?: unknown }).styleId);
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
