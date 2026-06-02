/**
 * Standard route eval cases.
 * Exercises the compact Standard runtime eval catalog against the live Standard route contract.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import standardStudioAgentHandler from "../../pages/api/ai/studio-agent-standard";
import { STANDARD_RUNTIME_EVAL_CASES } from "../support/standardModeEvalCases";

const requireApiUserMock = vi.fn();
const resolveRequiredRuntimeAgentPromptMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/runtimeAgentPromptControlPlane", () => ({
  resolveRequiredRuntimeAgentPrompt: (...args: unknown[]) =>
    resolveRequiredRuntimeAgentPromptMock(...args),
  RequiredRuntimeAgentPromptMissingError: class RequiredRuntimeAgentPromptMissingError extends Error {
    constructor(promptId: string) {
      super(`Runtime agent prompt ${promptId} is missing from the control plane.`);
      this.name = "RequiredRuntimeAgentPromptMissingError";
    }
  },
  RequiredRuntimeAgentPromptUnavailableError: class RequiredRuntimeAgentPromptUnavailableError extends Error {
    constructor(promptId: string) {
      super(`Runtime agent prompt ${promptId} requires a live control-plane connection.`);
      this.name = "RequiredRuntimeAgentPromptUnavailableError";
    }
  },
}));

const createMockResponse = () => {
  const headers = new Map<string, string>();
  const res: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    getHeader: ReturnType<typeof vi.fn>;
  } = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    getHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.setHeader.mockImplementation((name: string, value: string) => {
    headers.set(name.toLowerCase(), value);
    return res;
  });
  res.getHeader.mockImplementation((name: string) => headers.get(name.toLowerCase()));
  return res;
};

const createBaseRequestBody = () => ({
  clientSessionKey: "standard-eval-session",
  clientSessionNamespace: "ai-studio:standard-eval-session::standard",
  messages: [{ role: "user", content: "Help me refine this direction." }],
  context: {},
});

const extractSystemMessageFromFetchMock = (): string => {
  const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
    | { body?: string }
    | undefined;
  const requestBody = JSON.parse(String(requestInit?.body ?? "{}")) as {
    messages?: Array<{ role?: string; content?: string }>;
  };
  return requestBody.messages?.find((message) => message.role === "system")?.content ?? "";
};

describe("Standard route eval cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.STUDIO_AGENT_ENABLED = "true";
    process.env.STUDIO_AGENT_SERVER_VISION_ENABLED = "false";
    process.env.STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED = "true";
    process.env.STUDIO_AGENT_SAFETY_DEBUG = "false";
    process.env.STUDIO_AGENT_TIMEOUT_MS = String(20000);

    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    resolveRequiredRuntimeAgentPromptMock.mockResolvedValue({
      promptId: "STUDIO_AGENT_SYSTEM",
      promptBody: "Standard control-plane instructions.",
      updatedAt: "2026-05-05T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Standard eval response",
              },
            },
          ],
        }),
      })
    );
  });

  it("keeps the runtime eval catalog unique and covers multiple Standard reply shapes", () => {
    expect(STANDARD_RUNTIME_EVAL_CASES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(STANDARD_RUNTIME_EVAL_CASES.map((testCase) => testCase.id)).size).toBe(
      STANDARD_RUNTIME_EVAL_CASES.length
    );
    expect(
      STANDARD_RUNTIME_EVAL_CASES.some((testCase) => testCase.context.modeHint === "chat")
    ).toBe(true);
    expect(
      STANDARD_RUNTIME_EVAL_CASES.some((testCase) => testCase.context.modeHint === "describe")
    ).toBe(true);
    expect(
      STANDARD_RUNTIME_EVAL_CASES.some(
        (testCase) => testCase.context.focusedSource === "agent-output"
      )
    ).toBe(true);
  });

  for (const testCase of STANDARD_RUNTIME_EVAL_CASES) {
    it(`${testCase.id}: ${testCase.goal}`, async () => {
      const req = {
        method: "POST",
        body: {
          ...createBaseRequestBody(),
          messages: testCase.messages,
          context: testCase.context,
        },
      };
      const res = createMockResponse();

      await standardStudioAgentHandler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(fetch).toHaveBeenCalledTimes(1);
      const systemMessage = extractSystemMessageFromFetchMock();
      expect(systemMessage).toContain("Standard control-plane instructions.");
      for (const snippet of testCase.expectedSystemPromptSnippets) {
        expect(systemMessage).toContain(snippet);
      }
    });
  }
});
