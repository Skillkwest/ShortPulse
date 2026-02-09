/**
 * Token estimation helpers for text prompt refinement.
 * Roughly maps characters to tokens so we can pre-compute credit costs client-side.
 */
export const estimatePromptTokens = (prompt: string) => {
  const charCount = prompt?.length ?? 0;
  const inputTokens = Math.max(1, Math.ceil(charCount / 4));
  const outputTokens = Math.max(200, Math.ceil(inputTokens * 1.2));
  return { inputTokens, outputTokens };
};

export const estimateDescribeTokens = (outputText?: string) => {
  const outputTokens = outputText?.length ? Math.max(80, Math.ceil(outputText.length / 4)) : 240;
  // Assume a small vision prompt budget for system/user scaffolding.
  const inputTokens = 200;
  return { inputTokens, outputTokens };
};
