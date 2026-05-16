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
  void requiredCredits;
  void upfrontRunCredits;
  void availableBalanceCredits;
  void alwaysCheckCreditGuardrailWhenEnabled;
  void ensureFreshCreditsForRun;
  void handleInsufficientCredits;

  if (isGenerateDisabled) {
    if (isCreditGuardrail) {
      return true;
    }

    handleGuardrailBlock(resolveGuardrailBlockMessage());
    return false;
  }

  return true;
}
