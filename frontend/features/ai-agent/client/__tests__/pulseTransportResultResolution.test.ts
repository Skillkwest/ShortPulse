/**
 * Pulse transport result resolution tests.
 * Verifies completed Pulse text artifacts remain exact for display and drag/drop.
 */
import { resolvePulseCreateAgentTransportSuccess } from "../pulseTransportResultResolution";

describe("resolvePulseCreateAgentTransportSuccess", () => {
  it("uses the exact completed chat reply artifact for display and dragging", () => {
    const result = resolvePulseCreateAgentTransportSuccess({
      message: "Done. Your Pulse output is ready.",
      actions: {
        applyPrompt: "A sanitized fallback prompt, aspect ratio 1:1",
      },
      workflowSession: {
        presetId: "video-prompt-magic",
        status: "completed",
        currentStepIndex: 4,
        currentStepLabel: "Final prompt",
        currentStepPrompt: null,
        collectedInputs: ["first frame", "uneasy"],
        lastArtifact: "  Cinematic 16:9 final prompt.\nSummary: keep this exact line.  ",
        finalArtifactSource: "chat_reply",
      },
    });

    expect(result.assistantContent).toBe(
      "Cinematic 16:9 final prompt.\nSummary: keep this exact line."
    );
    expect(result.assistantOutputPrompt).toBe(
      "Cinematic 16:9 final prompt.\nSummary: keep this exact line."
    );
  });

  it("uses the active workflow step prompt when the kickoff message is empty", () => {
    const result = resolvePulseCreateAgentTransportSuccess({
      message: "   ",
      actions: undefined,
      workflowSession: {
        presetId: "image",
        status: "awaiting_input",
        currentStepIndex: 1,
        currentStepLabel: "Image Gate",
        currentStepPrompt: "Upload your image to get the process started TEST",
        collectedInputs: [],
        lastArtifact: null,
        finalArtifactSource: null,
      },
    });

    expect(result.assistantContent).toBe("Upload your image to get the process started TEST");
    expect(result.assistantOutputPrompt).toBeNull();
  });
});
