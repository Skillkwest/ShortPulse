/**
 * AI Studio style tile helpers used by the shared Styles panel.
 */
import {
  resolveBuiltInStyleDefinitions,
  type BuiltInStyleDefinition,
} from "../../../../lib/model-runtime/builtInStyles";

export type ExpertEditStyleTile = {
  id: string;
  style?: string;
  title: string;
  referenceImageName?: string;
  stylePrompt?: string;
  previewUrl: string | null;
  placeholder: boolean;
  source?: "system" | "built_in" | "custom";
};

export const NONE_STYLE_ID = "__none_style__";
export const NONE_STYLE_TILE: ExpertEditStyleTile = {
  id: NONE_STYLE_ID,
  title: "None",
  style: "None",
  referenceImageName: "None",
  stylePrompt: "",
  previewUrl: null,
  placeholder: false,
  source: "system",
};

export const buildBuiltInStyleTile = (definition: BuiltInStyleDefinition): ExpertEditStyleTile => ({
  id: definition.styleId,
  style: definition.title,
  title: definition.title,
  referenceImageName: definition.referenceImageName?.trim() || definition.title,
  stylePrompt: definition.stylePrompt,
  previewUrl: definition.previewImageUrl,
  placeholder: false,
  source: "built_in",
});

export const buildBuiltInStyleTiles = (
  definitions?: readonly BuiltInStyleDefinition[] | null
): ExpertEditStyleTile[] => resolveBuiltInStyleDefinitions(definitions).map(buildBuiltInStyleTile);

export const EXPERT_EDIT_STYLE_CATALOG: readonly ExpertEditStyleTile[] = buildBuiltInStyleTiles();

export const prependNoneStyleTile = (
  styles: readonly ExpertEditStyleTile[]
): ExpertEditStyleTile[] => [NONE_STYLE_TILE, ...styles];

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
