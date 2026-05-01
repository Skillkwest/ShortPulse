/**
 * Shared admin pricing catalog helpers for request normalization, Stripe validation, and offer id generation.
 */
import { stripeGet } from "./stripe";

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

export const normalizeIdentifier = (value: unknown): string =>
  normalizeRequiredText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

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

type StripeCatalogPrice = {
  id: string;
  active?: boolean;
  currency?: string | null;
  unit_amount?: number | null;
  recurring?: {
    interval?: string | null;
  } | null;
  metadata?: Record<string, string> | null;
  product?:
    | string
    | {
        id: string;
        metadata?: Record<string, string> | null;
      }
    | null;
};

type ValidateStripePriceForCatalogRowParams = {
  stripePriceId: string | null;
  expectedAmountCents: number;
  expectedInterval?: "month" | "year" | null;
  catalogType: "plan" | "storage_addon" | "credit_package";
  expectedMetadataIdKey: string;
  expectedMetadataIdValue: string;
};

export class CatalogStripePriceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogStripePriceValidationError";
  }
}

const readStripeMetadataValue = (price: StripeCatalogPrice, key: string): string | undefined => {
  const productMetadata = typeof price.product === "object" ? price.product?.metadata : null;
  return price.metadata?.[key] ?? productMetadata?.[key];
};

/**
 * Validates a Stripe Price before an admin catalog row can become active.
 * Metadata is enforced when ShortPulse catalog metadata is present so legacy prices can still be repaired.
 */
export const validateStripePriceForCatalogRow = async ({
  stripePriceId,
  expectedAmountCents,
  expectedInterval = null,
  catalogType,
  expectedMetadataIdKey,
  expectedMetadataIdValue,
}: ValidateStripePriceForCatalogRowParams): Promise<void> => {
  if (expectedAmountCents <= 0) return;
  if (!stripePriceId) {
    throw new CatalogStripePriceValidationError("Paid catalog rows require a Stripe price id.");
  }

  let price: StripeCatalogPrice;
  try {
    price = await stripeGet<StripeCatalogPrice>(`/prices/${stripePriceId}`, {
      "expand[]": "product",
    });
  } catch (error) {
    throw new CatalogStripePriceValidationError(
      error instanceof Error ? error.message : "Unable to verify Stripe price."
    );
  }

  if (price.active === false) {
    throw new CatalogStripePriceValidationError("Stripe price is inactive.");
  }
  if ((price.currency ?? "").toLowerCase() !== "usd") {
    throw new CatalogStripePriceValidationError("Stripe price must use USD.");
  }
  if (Number(price.unit_amount ?? -1) !== expectedAmountCents) {
    throw new CatalogStripePriceValidationError(
      "Stripe price amount does not match the catalog amount."
    );
  }

  const recurringInterval = price.recurring?.interval ?? null;
  if (expectedInterval) {
    if (recurringInterval !== expectedInterval) {
      throw new CatalogStripePriceValidationError(
        "Stripe price billing interval does not match the catalog interval."
      );
    }
  } else if (recurringInterval) {
    throw new CatalogStripePriceValidationError(
      "One-time catalog rows cannot use a recurring Stripe price."
    );
  }

  const metadataCatalogType = readStripeMetadataValue(price, "shortpulse_catalog_type");
  if (metadataCatalogType && metadataCatalogType !== catalogType) {
    throw new CatalogStripePriceValidationError(
      "Stripe price catalog metadata does not match this catalog row type."
    );
  }

  const metadataIdValue = readStripeMetadataValue(price, expectedMetadataIdKey);
  if (metadataIdValue && metadataIdValue !== expectedMetadataIdValue) {
    throw new CatalogStripePriceValidationError(
      "Stripe price target metadata does not match this catalog row."
    );
  }
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

export const buildCatalogOfferId = (
  baseId: string,
  offerName: string,
  billingInterval: "month" | "year" = "month"
): string => {
  return `${baseId}__${billingInterval}__${slugifyForOfferId(offerName)}__${Date.now().toString(36)}`;
};

export const buildCurrentCatalogOfferId = (
  baseId: string,
  billingInterval: "month" | "year" = "month"
): string => (billingInterval === "month" ? `${baseId}__current` : `${baseId}__year_current`);
