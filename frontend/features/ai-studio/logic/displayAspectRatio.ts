/**
 * Shared helpers for turning real media dimensions into stable user-facing aspect labels.
 */

const DISPLAY_ASPECT_TOKENS = [
  "1:1",
  "9:16",
  "4:5",
  "5:4",
  "16:9",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "21:9",
] as const;

const DEFAULT_ASPECT_MATCH_TOLERANCE = 0.03;

export const parseAspectToken = (value?: string | null): number | null => {
  if (!value || !value.includes(":")) return null;
  const [widthToken, heightToken] = value.split(":");
  const width = Number(widthToken);
  const height = Number(heightToken);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return width / height;
};

export const resolveClosestDisplayAspectToken = (
  ratio: number | null | undefined,
  options?: {
    tolerance?: number;
    allowedAspects?: readonly string[];
  }
): string | null => {
  if (!Number.isFinite(ratio) || (ratio ?? 0) <= 0) return null;
  const resolvedRatio = ratio as number;
  const tolerance = options?.tolerance ?? DEFAULT_ASPECT_MATCH_TOLERANCE;
  const aspectTokens = options?.allowedAspects?.length
    ? options.allowedAspects
    : DISPLAY_ASPECT_TOKENS;

  let bestMatch: { token: string; delta: number } | null = null;
  for (const token of aspectTokens) {
    const candidateRatio = parseAspectToken(token);
    if (!candidateRatio) continue;
    const relativeDelta = Math.abs(candidateRatio - resolvedRatio) / candidateRatio;
    if (relativeDelta > tolerance) continue;
    if (!bestMatch || relativeDelta < bestMatch.delta) {
      bestMatch = { token, delta: relativeDelta };
    }
  }

  return bestMatch?.token ?? null;
};

export const resolveClosestDisplayAspectTokenFromDimensions = (
  width: number | null | undefined,
  height: number | null | undefined,
  options?: {
    tolerance?: number;
    allowedAspects?: readonly string[];
  }
): string | null => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    (width ?? 0) <= 0 ||
    (height ?? 0) <= 0
  ) {
    return null;
  }
  return resolveClosestDisplayAspectToken((width as number) / (height as number), options);
};
