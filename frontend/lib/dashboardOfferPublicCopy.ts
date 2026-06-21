/**
 * Shared public-copy guard for dashboard offer cards.
 * Keeps placeholder or test copy out of launch-facing acquisition surfaces.
 */

const DASHBOARD_OFFER_PLACEHOLDER_COPY_PATTERN =
  /\b(?:lorem|ipsum|placeholder|test|testing|tsting|teseting)\b/i;

type DashboardOfferPublicCopyInput = {
  eyebrow?: string | null;
  title?: string | null;
};

/**
 * Returns true when dashboard offer header copy is safe enough for public display.
 */
export const hasLaunchReadyDashboardOfferHeaderCopy = (
  offer: DashboardOfferPublicCopyInput
): boolean => {
  const publicHeaderCopy = [offer.eyebrow, offer.title].filter(Boolean).join(" ");
  return !DASHBOARD_OFFER_PLACEHOLDER_COPY_PATTERN.test(publicHeaderCopy);
};
