/**
 * AI Studio credit display helpers.
 * Owns the header credit fraction label and visual fill coin math.
 */
import type { CSSProperties } from "react";

const normalizeCreditCount = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
};

const formatCreditCount = (value: number | null): string =>
  value == null ? "—" : value.toLocaleString();

const resolveCreditFillRatio = ({
  remainingCredits,
  totalCredits,
  loading,
}: {
  remainingCredits: number | null | undefined;
  totalCredits: number | null | undefined;
  loading: boolean;
}): number | null => {
  if (loading) return null;
  const remaining = normalizeCreditCount(remainingCredits);
  const total = normalizeCreditCount(totalCredits);
  if (remaining == null || total == null || total <= 0) return null;
  return Math.min(1, remaining / total);
};

/**
 * Formats the header credit value as remaining over total.
 */
export const formatCreditFractionLabel = ({
  remainingCredits,
  totalCredits,
  loading,
}: {
  remainingCredits: number | null | undefined;
  totalCredits: number | null | undefined;
  loading: boolean;
}): string => {
  if (loading) return "…";
  return `${formatCreditCount(normalizeCreditCount(remainingCredits))} / ${formatCreditCount(
    normalizeCreditCount(totalCredits)
  )}`;
};

/**
 * Renders the header credit fill coin.
 */
export const CreditFillCoin = ({
  remainingCredits,
  totalCredits,
  loading,
}: {
  remainingCredits: number | null | undefined;
  totalCredits: number | null | undefined;
  loading: boolean;
}) => {
  const fillRatio = resolveCreditFillRatio({
    remainingCredits,
    totalCredits,
    loading,
  });
  const style =
    fillRatio == null
      ? undefined
      : ({
          "--credit-spent-degrees": `${Math.round((1 - fillRatio) * 36000) / 100}deg`,
        } as CSSProperties);

  return (
    <span
      aria-hidden="true"
      className="credit-coin"
      data-fill-state={fillRatio == null ? "unknown" : "ready"}
      data-testid="credit-fill-coin"
      style={style}
    >
      <span className="credit-coin-fill" />
    </span>
  );
};
