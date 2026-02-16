import { beforeEach, describe, expect, it, vi } from "vitest";
import studioAgentHandler from "../../pages/api/ai/studio-agent";

const requireApiUserMock = vi.fn();
const runThinkerFormatterTurnMock = vi.fn();
const readAgentConversationCanonicalPromptMock = vi.fn();
const upsertAgentConversationCanonicalPromptMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../features/ai-agent/logic/studioAgentThinkerFormatter", () => ({
  runThinkerFormatterTurn: (...args: unknown[]) => runThinkerFormatterTurnMock(...args),
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

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe("POST /api/ai/studio-agent runtime hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.STUDIO_AGENT_ENABLED = "true";
    process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED = "false";
    process.env.STUDIO_AGENT_SERVER_VISION_ENABLED = "false";
    process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED = "true";
    process.env.STUDIO_AGENT_TIMEOUT_MS = String(20000);
    process.env.NEXT_PUBLIC_AGENT_V2 = "false";

    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    readAgentConversationCanonicalPromptMock.mockResolvedValue(null);
    upsertAgentConversationCanonicalPromptMock.mockResolvedValue("saved prompt");
    runThinkerFormatterTurnMock.mockResolvedValue({
      ok: true,
      result: {
        parsed: {
          message: "Enhanced prompt output",
          actions: {
            applyPrompt: "Enhanced prompt output",
            referenceCard: { title: "Prompt", prompt: "Enhanced prompt output" },
          },
        },
        nextCanonical: "Enhanced prompt output",
        semanticStatus: "ready",
        usage: {},
      },
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("uses orchestration path for MIXED turns even when NEXT_PUBLIC_AGENT_V2=false", async () => {
    const req = {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "keep composition, add rain and fog" }],
        context: {
          references: [
            {
              id: "img-1",
              kind: "image",
              caption: "night city street",
              promptSnippet: null,
            },
          ],
          selectedReferenceIds: ["img-1"],
          activePrompt: "cinematic city portrait",
        },
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(runThinkerFormatterTurnMock).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.objectContaining({ applyPrompt: "Enhanced prompt output" }),
      })
    );
  });

  it("falls back to default timeout when STUDIO_AGENT_TIMEOUT_MS is invalid", async () => {
    process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED = "false";
    process.env.STUDIO_AGENT_TIMEOUT_MS = "not-a-number";

    const req = {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "enhance this prompt" }],
        context: {},
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(runThinkerFormatterTurnMock).toHaveBeenCalledTimes(1);
    expect(runThinkerFormatterTurnMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ timeoutMs: 20000 })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does not synthesize applyPrompt on refusal and preserves canonical prompt", async () => {
    process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED = "true";
    process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED = "false";
    readAgentConversationCanonicalPromptMock.mockResolvedValue("existing canonical prompt");
    runThinkerFormatterTurnMock.mockResolvedValue({
      ok: true,
      result: {
        parsed: {
          message: "I cannot help with that request.",
          actions: undefined,
        },
        nextCanonical: null,
        semanticStatus: "refuse",
        usage: {},
      },
    });

    const req = {
      method: "POST",
      body: {
        conversationId: "conv-1",
        messages: [{ role: "user", content: "do something disallowed" }],
        context: {},
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "I cannot help with that request.",
        actions: undefined,
        canonicalPrompt: "existing canonical prompt",
      })
    );
    expect(readAgentConversationCanonicalPromptMock).toHaveBeenCalledWith({
      userId: "user-1",
      conversationId: "conv-1",
    });
    expect(upsertAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
  });

  it("uses single-call fast path for TEXT_ONLY when fast path is enabled", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message: "fast path prompt",
                actions: { apply_prompt: "fast path prompt" },
              }),
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      }),
    });

    const req = {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "a serene mountain sunrise" }],
        context: {},
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.objectContaining({ applyPrompt: "fast path prompt" }),
      })
    );
  });

  it("strips meta recap tails from fast-path apply_prompt output", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message:
                  "An ancient Mayan temple in dense jungle with sunlit stone carvings. Summary: expanded the setting and attire details.",
                actions: {
                  apply_prompt:
                    "An ancient Mayan temple in dense jungle with sunlit stone carvings. The prompt now includes a woman in traditional attire.",
                },
              }),
            },
          },
        ],
        usage: { prompt_tokens: 18, completion_tokens: 12 },
      }),
    });

    const req = {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "ancient mayan temple in jungle" }],
        context: {},
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "An ancient Mayan temple in dense jungle with sunlit stone carvings.",
        actions: expect.objectContaining({
          applyPrompt: "An ancient Mayan temple in dense jungle with sunlit stone carvings.",
        }),
      })
    );
  });

  it("falls back to user input when upstream returns only meta-summary text", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message: "Summary: transformed the prompt with richer descriptive detail.",
                actions: {
                  apply_prompt:
                    "The prompt now includes additional details and stronger composition cues.",
                },
              }),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 9 },
      }),
    });

    const req = {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "ancient mayan temple in jungle" }],
        context: {},
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "ancient mayan temple in jungle",
        actions: expect.objectContaining({
          applyPrompt: "ancient mayan temple in jungle",
        }),
      })
    );
  });
});
