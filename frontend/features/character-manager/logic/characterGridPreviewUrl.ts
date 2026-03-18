import { resolveAdaptiveMedia, resolveAdaptiveSourceKind } from "../../../lib/adaptive-media";

const DURABLE_VARIANT_PATH_SEGMENT = "/variants/";

const hasDurableVariantUrl = (value: string): boolean => {
  if (value.includes(DURABLE_VARIANT_PATH_SEGMENT)) return true;
  try {
    return new URL(value).pathname.includes(DURABLE_VARIANT_PATH_SEGMENT);
  } catch {
    return false;
  }
};

type ResolveCharacterGridPreviewUrlArgs = {
  url: string | null | undefined;
  adaptivePreviewEnabled: boolean;
  pressureLevel: 0 | 1 | 2;
  cardLongEdgePx: number;
  devicePixelRatio: number;
};

export const resolveCharacterGridPreviewUrl = ({
  url,
  adaptivePreviewEnabled,
  pressureLevel,
  cardLongEdgePx,
  devicePixelRatio,
}: ResolveCharacterGridPreviewUrlArgs): string | null => {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (!adaptivePreviewEnabled) return trimmed;
  if (hasDurableVariantUrl(trimmed)) return trimmed;

  const resolved = resolveAdaptiveMedia({
    surface: "character-grid",
    mediaKind: "image",
    source: resolveAdaptiveSourceKind(trimmed),
    urls: {
      previewUrl: trimmed,
      fullUrl: trimmed,
    },
    storage: {},
    pressureLevel,
    cardLongEdgePx,
    devicePixelRatio,
    strictPreviewLadder: true,
    adaptivePreviewQuality: true,
  });

  return resolved.previewUrl ?? trimmed;
};
