type RunGenerationCreditGuardrailParams = {
  requiredCredits: number | null | undefined;
  upfrontRunCredits: number | null | undefined;
  availableBalanceCredits: number | null;
  isGenerateDisabled: boolean;
  isCreditGuardrail: boolean;
  alwaysCheckCreditGuardrailWhenEnabled: boolean;
  ensureFreshCreditsForRun: (requiredCredits: number | null | undefined) => Promise<boolean>;
  resolveGuardrailBlockMessage: () => string;
  handleInsufficientCredits: () => void;
  handleGuardrailBlock: (message: string) => void;
};

export async function runGenerationCreditGuardrail({
  requiredCredits,
  upfrontRunCredits,
  availableBalanceCredits,
  isGenerateDisabled,
  isCreditGuardrail,
  alwaysCheckCreditGuardrailWhenEnabled,
  ensureFreshCreditsForRun,
  resolveGuardrailBlockMessage,
  handleInsufficientCredits,
  handleGuardrailBlock,
}: RunGenerationCreditGuardrailParams): Promise<boolean> {
  const effectiveRequiredCredits = upfrontRunCredits ?? requiredCredits ?? null;

  if (isGenerateDisabled) {
    if (!isCreditGuardrail) {
      handleGuardrailBlock(resolveGuardrailBlockMessage());
      return false;
    }
  }

  if (effectiveRequiredCredits == null || effectiveRequiredCredits <= 0) {
    return true;
  }

  const shouldCheckCredits =
    isCreditGuardrail ||
    alwaysCheckCreditGuardrailWhenEnabled ||
    (availableBalanceCredits !== null && availableBalanceCredits < effectiveRequiredCredits);

  if (!shouldCheckCredits) {
    return true;
  }

  const hasCredits = await ensureFreshCreditsForRun(effectiveRequiredCredits);
  if (!hasCredits) {
    handleInsufficientCredits();
    return false;
  }

  return true;
}
