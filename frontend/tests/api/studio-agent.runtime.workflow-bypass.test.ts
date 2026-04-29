import { beforeEach, describe, expect, it, vi } from "vitest";
import pulseStudioAgentHandler from "../../pages/api/ai/studio-agent-pulse";

const requireApiUserMock = vi.fn();
const resolveRuntimeSafetyProfileMock = vi.fn();
const readAgentConversationCanonicalPromptMock = vi.fn();
const upsertAgentConversationCanonicalPromptMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/agentSafetyPolicyControlPlane", () => ({
  resolveRuntimeSafetyProfile: (...args: unknown[]) => resolveRuntimeSafetyProfileMock(...args),
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
    messages: [{ role: "user", content: "Start the workflow." }],
    context: {
      pulse: {
        presetId: "product_hero",
        label: "Product Hero",
        instructions: "Guide the user toward a premium product hero prompt.",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        memoryPolicy: "session",
        source: "builtin",
      },
    },
    directOpenAiBypass: true,
  },
});

describe("Pulse route direct-bypass retirement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.STUDIO_AGENT_ENABLED = "true";
    process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED = "false";
    process.env.STUDIO_AGENT_SERVER_VISION_ENABLED = "false";
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    process.env.STUDIO_AGENT_SINGLE_STAGE_ENABLED = "true";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    resolveRuntimeSafetyProfileMock.mockResolvedValue({
      profileId: "prod_safe_v1",
      policyVersion: 1,
      source: "env",
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
                  message: "What product should we feature first?",
                  actions: null,
                }),
              },
            },
          ],
        }),
      })
    );
  });

  it("ignores directOpenAiBypass on Pulse requests and sends Pulse workflow instructions", async () => {
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
        message: "What product should we feature first?",
        workflowSession: expect.objectContaining({
          presetId: "product_hero",
        }),
      })
    );
  });
});
