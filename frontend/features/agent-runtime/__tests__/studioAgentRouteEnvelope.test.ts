import { describe, expect, it } from "vitest";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
} from "../studioAgentRouteEnvelope";

describe("studioAgentRouteEnvelope", () => {
  it("prefers header trace id over request body trace id", () => {
    const traceId = resolveStudioAgentTraceId({
      headers: { "x-shortpulse-request-id": "header-123" },
      body: { traceId: "body-456" },
    } as never);

    expect(traceId).toBe("header-123");
  });

  it("defaults feature flag to enabled when server/public flags are unset", () => {
    expect(
      isStudioAgentFeatureEnabled({
        serverFlag: undefined,
        publicFlag: undefined,
      })
    ).toBe(true);
  });

  it("returns invalid session key when clientSessionKey is missing", () => {
    const result = parseStudioAgentRequestEnvelope({
      req: {
        body: {
          messages: [{ role: "user", content: "enhance this prompt" }],
        },
      } as never,
      userId: "user-missing-session",
      traceId: "trace-missing-session",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.payload.code).toBe("INVALID_SESSION_KEY");
    expect(result.payload.traceId).toBe("trace-missing-session");
  });

  it("parses directOpenAiBypass from the request body", () => {
    const result = parseStudioAgentRequestEnvelope({
      req: {
        body: {
          clientSessionKey: "session-123",
          messages: [{ role: "user", content: "hello" }],
          directOpenAiBypass: true,
        },
      } as never,
      userId: "user-1",
      traceId: "trace-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.directOpenAiBypass).toBe(true);
  });

  it("sanitizes pulse runtime metadata from the request context", () => {
    const result = parseStudioAgentRequestEnvelope({
      req: {
        body: {
          clientSessionKey: "session-pulse",
          messages: [{ role: "user", content: "hello" }],
          context: {
            pulse: {
              presetId: " pulse_story ",
              label: " Story Builder ",
              instructions: " Keep the structure easy to follow. ",
              source: "custom",
              workflowSession: {
                presetId: " pulse_story ",
                status: "awaiting_input",
                currentStepIndex: 2,
                currentStepLabel: "Action",
                currentStepPrompt: "Step 2 — Action",
                collectedInputs: ["Upload your image"],
                lastArtifact: null,
              },
            },
          },
        },
      } as never,
      userId: "user-pulse",
      traceId: "trace-pulse",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.context.pulse).toEqual({
      presetId: "pulse_story",
      label: "Story Builder",
      description: null,
      instructions: "Keep the structure easy to follow.",
      runtimeMode: "prompt_editor",
      activationMode: "activate_only",
      starterAssistantMessage: null,
      outputMode: "apply_prompt",
      memoryPolicy: "session",
      workflowStageHints: null,
      source: "custom",
      workflowSession: {
        presetId: "pulse_story",
        status: "awaiting_input",
        currentStepIndex: 2,
        currentStepLabel: "Action",
        currentStepPrompt: "Step 2 — Action",
        collectedInputs: ["Upload your image"],
        lastArtifact: null,
        finalArtifactSource: null,
      },
    });
  });
});
