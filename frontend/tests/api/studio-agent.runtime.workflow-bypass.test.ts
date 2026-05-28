import { beforeEach, describe, expect, it, vi } from "vitest";
import pulseStudioAgentHandler from "../../pages/api/ai/studio-agent-pulse";

const requireApiUserMock = vi.fn();
const resolveRuntimeSafetyProfileMock = vi.fn();
const resolveRuntimeCreatePulseBuiltInCatalogMock = vi.fn();
const readAgentConversationCanonicalPromptMock = vi.fn();
const upsertAgentConversationCanonicalPromptMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/agentSafetyPolicyControlPlane", () => ({
  resolveRuntimeSafetyProfile: (...args: unknown[]) => resolveRuntimeSafetyProfileMock(...args),
}));

vi.mock("../../lib/server/api/createPulseBuiltInControlPlane", () => ({
  isAuthoritativeCreatePulseBuiltInCatalogResolution: (resolution: {
    source?: string;
    degraded?: boolean;
  }) => resolution.source === "control_plane" && resolution.degraded !== true,
  resolveRuntimeCreatePulseBuiltInCatalog: (...args: unknown[]) =>
    resolveRuntimeCreatePulseBuiltInCatalogMock(...args),
}));

vi.mock("../../lib/server/api/agentConversationState", async () => {
  const actual = await vi.importActual("../../lib/server/api/agentConversationState");
  return {
    ...(actual as object),
    readAgentConversationCanonicalPrompt: (...args: unknown[]) =>
      readAgentConversationCanonicalPromptMock(...args),
    upsertAgentConversationCanonicalPrompt: (...args: unknown[]) =>
      upsertAgentConversationCanonicalPromptMock(...args),
  };
});

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

const createPulseRequest = () => ({
  method: "POST",
  body: {
    clientSessionKey: "pulse-bypass-retired",
    clientSessionNamespace:
      "ai-studio:pulse-bypass-retired::pulse:story_builder:pulse-session-test",
    messages: [{ role: "user", content: "Start the workflow." }],
    context: {
      pulse: {
        presetId: "story_builder",
        label: "DFY Story Builder",
        instructions: "Guide the user toward a story-circle scene prompt.",
        pulseKind: "guided_workflow",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        memoryPolicy: "session",
        source: "builtin",
      },
    },
  },
});

describe("Pulse route mode isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.STUDIO_AGENT_ENABLED = "true";
    process.env.STUDIO_AGENT_SERVER_VISION_ENABLED = "false";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    resolveRuntimeSafetyProfileMock.mockResolvedValue({
      profileId: "prod_safe_v1",
      policyVersion: 1,
      source: "env",
    });
    resolveRuntimeCreatePulseBuiltInCatalogMock.mockResolvedValue({
      builtInDefinitions: [
        {
          presetId: "story_builder",
          label: "DFY Story Builder",
          description: "Guided story-circle workflow for scene plans and final image prompts.",
          starterAssistantMessage: "**Step 1 — Upload your characters.**",
          workflowStageHints: ["Upload Characters", "Plot Seed", "Runtime"],
          artifactTarget: "image_prompt",
          systemInstructions: "SERVER STORY BUILDER INSTRUCTIONS",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          outputMode: "chat_reply",
          memoryPolicy: "session",
          pulseKind: "guided_workflow",
        },
      ],
      source: "control_plane",
      updatedAt: "2026-05-05T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
    });
    readAgentConversationCanonicalPromptMock.mockResolvedValue(null);
    upsertAgentConversationCanonicalPromptMock.mockResolvedValue("saved prompt");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "needs_input",
                  message: "What story should we build first?",
                  actions: null,
                }),
              },
            },
          ],
        }),
      })
    );
  });

  it("sends Pulse workflow instructions", async () => {
    const req = createPulseRequest();
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const payload = requestInit?.body
      ? (JSON.parse(requestInit.body) as { messages?: Array<{ content?: string }> })
      : null;
    const serializedMessages = JSON.stringify(payload?.messages ?? []);
    expect(serializedMessages).toContain("ACTIVE PULSE PROFILE");
    expect(serializedMessages).not.toContain(
      "You are a professional prompt writer for image generation."
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "What story should we build first?",
        workflowSession: expect.objectContaining({
          presetId: "story_builder",
        }),
      })
    );
  });
});
