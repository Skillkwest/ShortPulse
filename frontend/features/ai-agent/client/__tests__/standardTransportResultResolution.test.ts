/**
 * Standard transport result resolution tests.
 * Verifies Standard prompt-success replies remain explicit drag/save sources.
 */
import { resolveStandardCreateAgentTransportSuccess } from "../standardTransportResultResolution";

describe("resolveStandardCreateAgentTransportSuccess", () => {
  it("keeps Standard prompt-success replies reusable as output prompts", () => {
    const result = resolveStandardCreateAgentTransportSuccess({
      message: "Here is a polished portrait prompt.",
      actions: {
        applyPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
      },
      outcome_class: "success_prompt",
      reason_code: "SUCCESS_PROMPT",
    });

    expect(result.assistantContent).toBe("Here is a polished portrait prompt.");
    expect(result.assistantOutputPrompt).toBe(
      "Cinematic portrait of a woman in golden-hour forest light."
    );
  });

  it("falls back to the prompt artifact text when Standard omits message content", () => {
    const result = resolveStandardCreateAgentTransportSuccess({
      message: "",
      actions: {
        applyPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
      },
      outcome_class: "success_prompt",
      reason_code: "SUCCESS_PROMPT",
    });

    expect(result.assistantContent).toBe(
      "Cinematic portrait of a woman in golden-hour forest light."
    );
    expect(result.assistantOutputPrompt).toBe(
      "Cinematic portrait of a woman in golden-hour forest light."
    );
  });

  it("keeps legacy Standard prompt replies reusable when outcome_class is missing", () => {
    const result = resolveStandardCreateAgentTransportSuccess({
      message: "Here is a polished portrait prompt.",
      actions: {
        applyPrompt: "Cinematic portrait of a woman in golden-hour forest light.",
      },
      reason_code: "SUCCESS_PROMPT",
    });

    expect(result.assistantContent).toBe("Here is a polished portrait prompt.");
    expect(result.assistantOutputPrompt).toBe(
      "Cinematic portrait of a woman in golden-hour forest light."
    );
  });

  it("keeps Standard message-success replies as plain assistant chat", () => {
    const result = resolveStandardCreateAgentTransportSuccess({
      message: "Hello. How can I help?",
      actions: undefined,
      outcome_class: "success_message",
      reason_code: "SUCCESS_MESSAGE",
    });

    expect(result.assistantContent).toBe("Hello. How can I help?");
    expect(result.assistantOutputPrompt).toBeNull();
  });
});
