/**
 * Style profile helpers for Styles Library metadata.
 * Derives optional structured descriptor buckets from a flat style-prompt string.
 */
import type {
  StylesLibraryStyleExtractionFlow,
  StylesLibraryStyleExtractionMeta,
  StylesLibraryStyleExtractionOutcome,
  StylesLibraryStyleProfile,
} from "../types";

const LIGHTING_KEYWORDS = [
  "lighting",
  "light",
  "contrast",
  "rim",
  "backlit",
  "glow",
  "bloom",
  "exposure",
];

const LENS_DEPTH_KEYWORDS = [
  "depth",
  "bokeh",
  "aperture",
  "lens",
  "telephoto",
  "wide angle",
  "focus",
  "focal",
];

const COLOR_KEYWORDS = [
  "color",
  "colour",
  "palette",
  "saturation",
  "tonal",
  "grade",
  "grading",
  "hue",
  "vibrance",
  "muted",
];

const RENDERING_KEYWORDS = [
  "photography",
  "editorial",
  "illustration",
  "anime",
  "3d",
  "render",
  "painterly",
  "cel",
  "graphic",
  "cinematic",
  "style",
];

const TEXTURE_KEYWORDS = [
  "texture",
  "grain",
  "smooth",
  "polished",
  "matte",
  "gloss",
  "softness",
  "sharp",
  "crisp",
  "finish",
];

const MEDIUM_KEYWORDS: Array<{ keyword: string; medium: string }> = [
  { keyword: "photography", medium: "photography" },
  { keyword: "photo", medium: "photography" },
  { keyword: "illustration", medium: "digital illustration" },
  { keyword: "anime", medium: "anime" },
  { keyword: "manga", medium: "anime" },
  { keyword: "3d", medium: "3d render" },
  { keyword: "render", medium: "3d render" },
  { keyword: "painting", medium: "painting" },
  { keyword: "painterly", medium: "painting" },
  { keyword: "concept art", medium: "concept art" },
];

const normalizeDescriptorList = (value: string): string[] => {
  const descriptors = value
    .split(",")
    .map((part) => part.trim().replace(/\s{2,}/g, " "))
    .filter(Boolean)
    .slice(0, 32);
  return Array.from(new Set(descriptors));
};

const pickByKeywords = (descriptors: readonly string[], keywords: readonly string[]): string[] => {
  return descriptors.filter((descriptor) => {
    const normalized = descriptor.toLowerCase();
    return keywords.some((keyword) => normalized.includes(keyword));
  });
};

const buildGeneralDescriptors = (
  descriptors: readonly string[],
  assigned: ReadonlySet<string>
): string[] => {
  return descriptors.filter((descriptor) => !assigned.has(descriptor));
};

const resolveMedium = (descriptors: readonly string[]): string | null => {
  for (const descriptor of descriptors) {
    const normalized = descriptor.toLowerCase();
    const matched = MEDIUM_KEYWORDS.find((candidate) => normalized.includes(candidate.keyword));
    if (matched) return matched.medium;
  }
  return null;
};

/**
 * Builds a structured style profile from a comma-separated style prompt.
 */
export const buildStyleProfileFromPrompt = (
  stylePrompt: string
): StylesLibraryStyleProfile | undefined => {
  const descriptors = normalizeDescriptorList(stylePrompt);
  if (descriptors.length === 0) return undefined;

  const lightingDescriptors = pickByKeywords(descriptors, LIGHTING_KEYWORDS);
  const lensDepthDescriptors = pickByKeywords(descriptors, LENS_DEPTH_KEYWORDS);
  const colorDescriptors = pickByKeywords(descriptors, COLOR_KEYWORDS);
  const renderingDescriptors = pickByKeywords(descriptors, RENDERING_KEYWORDS);
  const textureDescriptors = pickByKeywords(descriptors, TEXTURE_KEYWORDS);

  const assigned = new Set<string>([
    ...lightingDescriptors,
    ...lensDepthDescriptors,
    ...colorDescriptors,
    ...renderingDescriptors,
    ...textureDescriptors,
  ]);

  return {
    version: 1,
    medium: resolveMedium(descriptors),
    lightingDescriptors,
    lensDepthDescriptors,
    colorDescriptors,
    renderingDescriptors,
    textureDescriptors,
    generalDescriptors: buildGeneralDescriptors(descriptors, assigned),
  };
};

/**
 * Builds extraction metadata for persisted style details.
 */
export const buildStyleExtractionMeta = ({
  outcome,
  flow,
  sourceUrlKind,
  extractedAtIso,
}: {
  outcome: StylesLibraryStyleExtractionOutcome;
  flow: StylesLibraryStyleExtractionFlow;
  sourceUrlKind: "data" | "url" | "unknown";
  extractedAtIso?: string;
}): StylesLibraryStyleExtractionMeta => ({
  version: 1,
  outcome,
  flow,
  extractedAtIso: extractedAtIso ?? new Date().toISOString(),
  sourceUrlKind,
  extractor: "openai_prompt_style_extract",
});
