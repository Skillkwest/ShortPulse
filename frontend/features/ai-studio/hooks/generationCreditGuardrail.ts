type RunGenerationCreditGuardrailParams = {
  requiredCredits: number | null | undefined;
  upfrontRunCredits: number | null | undefined;
  effectiveBalanceCredits: number | null;
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
  effectiveBalanceCredits,
  isGenerateDisabled,
  isCreditGuardrail,
  alwaysCheckCreditGuardrailWhenEnabled,
  ensureFreshCreditsForRun,
  resolveGuardrailBlockMessage,
  handleInsufficientCredits,
  handleGuardrailBlock,
}: RunGenerationCreditGuardrailParams): Promise<boolean> {
  let checkedFreshCredits = false;

  if (
    upfrontRunCredits != null &&
    effectiveBalanceCredits != null &&
    effectiveBalanceCredits < upfrontRunCredits
  ) {
    const hasFreshCredits = await ensureFreshCreditsForRun(upfrontRunCredits);
    checkedFreshCredits = true;
    if (!hasFreshCredits) {
      handleInsufficientCredits();
      return false;
    }
  }

  if (isGenerateDisabled) {
    if (isCreditGuardrail) {
      const hasFreshCredits = checkedFreshCredits
        ? true
        : await ensureFreshCreditsForRun(requiredCredits);
      if (!hasFreshCredits) {
        handleGuardrailBlock(resolveGuardrailBlockMessage());
        return false;
      }
      return true;
    }

    handleGuardrailBlock(resolveGuardrailBlockMessage());
    return false;
  }

  if (alwaysCheckCreditGuardrailWhenEnabled && isCreditGuardrail) {
    const hasFreshCredits = checkedFreshCredits
      ? true
      : await ensureFreshCreditsForRun(requiredCredits);
    if (!hasFreshCredits) {
      handleGuardrailBlock(resolveGuardrailBlockMessage());
      return false;
    }
  }

  return true;
}
