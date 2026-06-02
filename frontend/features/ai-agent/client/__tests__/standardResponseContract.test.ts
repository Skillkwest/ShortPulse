/**
 * Standard response contract tests.
 * Verifies reply text and prompt artifacts stay explicitly separated.
 */
import { resolveStandardCreateResponseContract } from "../standardResponseContract";

describe("resolveStandardCreateResponseContract", () => {
  it("keeps the visible reply separate from the reusable prompt artifact", () => {
    const result = resolveStandardCreateResponseContract({
      message: "Here is a polished portrait prompt.",
      actions: {
        applyPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
      },
      outcome_class: "success_prompt",
      reason_code: "SUCCESS_PROMPT",
    });

    expect(result.assistantReply).toEqual({
      text: "Here is a polished portrait prompt.",
      source: "message",
    });
    expect(result.promptArtifact).toEqual({
      text: "Cinematic portrait of a woman in golden-hour forest light.",
      source: "apply_prompt",
    });
    expect(result.assistantContent).toBe("Here is a polished portrait prompt.");
    expect(result.assistantOutputPrompt).toBe(
      "Cinematic portrait of a woman in golden-hour forest light."
    );
  });

  it("falls back to the prompt artifact when the visible reply is omitted", () => {
    const result = resolveStandardCreateResponseContract({
      message: "   ",
      actions: {
        applyPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
      },
      outcome_class: "success_prompt",
      reason_code: "SUCCESS_PROMPT",
    });

    expect(result.assistantReply).toEqual({
      text: "Cinematic portrait of a woman in golden-hour forest light.",
      source: "prompt_artifact_fallback",
    });
    expect(result.promptArtifact).toEqual({
      text: "Cinematic portrait of a woman in golden-hour forest light.",
      source: "apply_prompt",
    });
  });

  it("keeps non-prompt Standard replies from exposing an accidental prompt artifact", () => {
    const result = resolveStandardCreateResponseContract({
      message: "Hello. How can I help?",
      actions: {
        applyPrompt: "This should stay hidden as a prompt artifact.",
      },
      outcome_class: "success_message",
      reason_code: "SUCCESS_MESSAGE",
    });

    expect(result.assistantReply).toEqual({
      text: "Hello. How can I help?",
      source: "message",
    });
    expect(result.promptArtifact).toBeNull();
    expect(result.assistantOutputPrompt).toBeNull();
  });

  it("does not synthesize a prompt artifact from the reply text when applyPrompt is missing", () => {
    const result = resolveStandardCreateResponseContract({
      message: "Here is a conversational answer without a reusable prompt.",
      outcome_class: "success_prompt",
      reason_code: "SUCCESS_PROMPT",
    });

    expect(result.assistantReply).toEqual({
      text: "Here is a conversational answer without a reusable prompt.",
      source: "message",
    });
    expect(result.promptArtifact).toBeNull();
    expect(result.assistantOutputPrompt).toBeNull();
  });
});
