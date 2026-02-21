import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeStudioAgentV2Turn } from "../studioAgentV2Turn";

const runThinkerFormatterTurnMock = vi.fn();
const isExplicitEditRequestMock = vi.fn();
const preservesContextMock = vi.fn();
const shouldRetryExplicitNoOpMock = vi.fn();

vi.mock("../../ai-agent/logic/studioAgentThinkerFormatter", () => ({
  runThinkerFormatterTurn: (...args: unknown[]) => runThinkerFormatterTurnMock(...args),
}));

vi.mock("../../ai-agent/logic/studioAgentCanonical", () => ({
  isExplicitEditRequest: (...args: unknown[]) => isExplicitEditRequestMock(...args),
  preservesContext: (...args: unknown[]) => preservesContextMock(...args),
  shouldRetryExplicitNoOp: (...args: unknown[]) => shouldRetryExplicitNoOpMock(...args),
}));

describe("executeStudioAgentV2Turn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isExplicitEditRequestMock.mockReturnValue(false);
    preservesContextMock.mockReturnValue(true);
    shouldRetryExplicitNoOpMock.mockReturnValue(false);
  });

  it("returns upstream failure when thinker/formatter turn fails", async () => {
    runThinkerFormatterTurnMock.mockResolvedValue({
      ok: false,
      stage: "thinker",
      status: 502,
      detail: "upstream unavailable",
    });
    const markStage = vi.fn();

    const result = await executeStudioAgentV2Turn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      thinkerModel: "gpt-thinker",
      formatterModel: "gpt-formatter",
      thinkerPrompt: "thinker prompt",
      formatterPrompt: "formatter prompt",
      timeoutMs: 20000,
      orchestration: {
        flow: "TEXT_ONLY",
        textInput: "draft prompt",
        imageReferenceIds: [],
      },
      context: {},
      messages: [{ role: "user", content: "make this better" }],
      selectedReferences: [],
      visionSummaryMap: new Map(),
      effectiveCanonical: "base canonical",
      markStage,
    });

    expect(result).toEqual({
      ok: false,
      stage: "thinker",
      status: 502,
      detail: "upstream unavailable",
    });
    expect(markStage).toHaveBeenCalledWith("v2_turn", expect.any(Number));
  });

  it("enforces drift guard by restoring canonical prompt when context is not preserved", async () => {
    preservesContextMock.mockReturnValue(false);
    runThinkerFormatterTurnMock.mockResolvedValue({
      ok: true,
      result: {
        parsed: {
          message: "rewritten prompt",
          actions: {
            applyPrompt: "rewritten prompt",
          },
        },
        nextCanonical: "unrelated rewrite",
        semanticStatus: "ready",
        usage: {},
      },
    });
    const markStage = vi.fn();

    const result = await executeStudioAgentV2Turn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      thinkerModel: "gpt-thinker",
      formatterModel: "gpt-formatter",
      thinkerPrompt: "thinker prompt",
      formatterPrompt: "formatter prompt",
      timeoutMs: 20000,
      orchestration: {
        flow: "TEXT_ONLY",
        textInput: "draft prompt",
        imageReferenceIds: [],
      },
      context: {},
      messages: [{ role: "user", content: "enhance this" }],
      selectedReferences: [],
      visionSummaryMap: new Map(),
      effectiveCanonical: "keep canonical intact",
      markStage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.nextCanonical).toBe("keep canonical intact");
    expect(result.result.parsed.actions?.applyPrompt).toBe("keep canonical intact");
  });

  it("retries explicit no-op responses and marks retry stage", async () => {
    shouldRetryExplicitNoOpMock.mockReturnValue(true);
    runThinkerFormatterTurnMock
      .mockResolvedValueOnce({
        ok: true,
        result: {
          parsed: {
            message: "initial response",
            actions: {
              applyPrompt: "initial response",
            },
          },
          nextCanonical: "initial response",
          semanticStatus: "ready",
          usage: {},
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        result: {
          parsed: {
            message: "retry response",
            actions: {
              applyPrompt: "retry response",
            },
          },
          nextCanonical: "retry response",
          semanticStatus: "ready",
          usage: {
            inputTokens: 10,
            outputTokens: 8,
          },
        },
      });
    const markStage = vi.fn();

    const result = await executeStudioAgentV2Turn({
      apiKey: "key",
      openAiUrl: "https://example.test/v1/chat/completions",
      thinkerModel: "gpt-thinker",
      formatterModel: "gpt-formatter",
      thinkerPrompt: "thinker prompt",
      formatterPrompt: "formatter prompt",
      timeoutMs: 20000,
      orchestration: {
        flow: "TEXT_ONLY",
        textInput: "draft prompt",
        imageReferenceIds: [],
      },
      context: {},
      messages: [{ role: "user", content: "apply this edit" }],
      selectedReferences: [],
      visionSummaryMap: new Map(),
      effectiveCanonical: "base canonical",
      markStage,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.retryUsed).toBe(true);
    expect(result.result.parsed.actions?.applyPrompt).toBe("retry response");
    expect(markStage).toHaveBeenCalledWith("v2_turn", expect.any(Number));
    expect(markStage).toHaveBeenCalledWith("v2_retry_turn", expect.any(Number));
    expect(runThinkerFormatterTurnMock).toHaveBeenCalledTimes(2);
  });
});
