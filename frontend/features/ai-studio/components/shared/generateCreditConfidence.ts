/**
 * Builds consistent Generate button credit labels from displayed cost and current balance.
 * This keeps Sound panels aligned without changing billing or debit authority.
 */
export type GenerateCreditConfidenceInput = {
  actionLabel: string;
  estimatedCredits: number | null;
  balanceCredits: number | null;
  formatCredits: (value: number) => string;
};

export type GenerateCreditConfidence = {
  summary: string;
  title: string;
  status: "covered" | "short" | "unknown";
};

const normalizeCreditAmount = (value: number | null): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

const pluralizeCredits = (label: string): string =>
  `${label} ${label === "1" ? "credit" : "credits"}`;

export const resolveGenerateCreditConfidence = ({
  actionLabel,
  estimatedCredits,
  balanceCredits,
  formatCredits,
}: GenerateCreditConfidenceInput): GenerateCreditConfidence => {
  const normalizedCost = normalizeCreditAmount(estimatedCredits);
  const normalizedBalance = normalizeCreditAmount(balanceCredits);

  if (normalizedCost == null) {
    const balanceCopy =
      normalizedBalance == null
        ? "balance unavailable"
        : `balance ${pluralizeCredits(formatCredits(normalizedBalance))}`;
    const copy = `${actionLabel}, cost unavailable, ${balanceCopy}`;
    return {
      summary: "Cost unavailable",
      title: copy,
      status: "unknown",
    };
  }

  const costCopy = `costs ${pluralizeCredits(formatCredits(normalizedCost))}`;
  if (normalizedBalance == null) {
    const copy = `${actionLabel}, ${costCopy}, balance unavailable`;
    return {
      summary: "Balance unavailable",
      title: copy,
      status: "unknown",
    };
  }

  const balanceCopy = `balance ${pluralizeCredits(formatCredits(normalizedBalance))}`;
  if (normalizedBalance < normalizedCost) {
    const shortfallCopy = `short by ${pluralizeCredits(
      formatCredits(normalizedCost - normalizedBalance)
    )}`;
    const copy = `${actionLabel}, ${costCopy}, ${balanceCopy}, ${shortfallCopy}`;
    return {
      summary: `Needs ${pluralizeCredits(formatCredits(normalizedCost - normalizedBalance))} more`,
      title: copy,
      status: "short",
    };
  }

  const copy = `${actionLabel}, ${costCopy}, ${balanceCopy}`;
  return {
    summary: "Balance covers this run",
    title: copy,
    status: "covered",
  };
};
