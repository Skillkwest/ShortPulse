/**
 * Shared admin pricing catalog helpers for request normalization and offer id generation.
 */

export const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

export const normalizeNullableText = (value: unknown): string | null => {
  const normalized = asSingleString(value).trim();
  return normalized ? normalized : null;
};

export const normalizeRequiredText = (value: unknown): string => asSingleString(value).trim();

export const parseInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
};

export const parseNonNegativeInteger = (value: unknown): number | null => {
  const parsed = parseInteger(value);
  return parsed != null && parsed >= 0 ? parsed : null;
};

export const parsePositiveInteger = (value: unknown): number | null => {
  const parsed = parseInteger(value);
  return parsed != null && parsed > 0 ? parsed : null;
};

export const requireStripePriceForPaidCatalogRow = ({
  priceCents,
  stripePriceId,
  isActive = true,
}: {
  priceCents: number;
  stripePriceId: string | null;
  isActive?: boolean;
}): boolean => {
  if (!isActive) return true;
  if (priceCents <= 0) return true;
  return Boolean(stripePriceId);
};

const slugifyForOfferId = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return normalized || "offer";
};

export const buildCatalogOfferId = (baseId: string, offerName: string): string => {
  return `${baseId}__${slugifyForOfferId(offerName)}__${Date.now().toString(36)}`;
};
