import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readStudioAgentCanonicalPrompt,
  writeStudioAgentCanonicalPrompt,
} from "../studioAgentCanonicalPersistence";

const readAgentConversationCanonicalPromptMock = vi.fn();
const upsertAgentConversationCanonicalPromptMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../../lib/server/api/agentConversationState", () => ({
  readAgentConversationCanonicalPrompt: (...args: unknown[]) =>
    readAgentConversationCanonicalPromptMock(...args),
  upsertAgentConversationCanonicalPrompt: (...args: unknown[]) =>
    upsertAgentConversationCanonicalPromptMock(...args),
}));

vi.mock("../../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

describe("studioAgentCanonicalPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips canonical read when persistence is disabled", async () => {
    const markStage = vi.fn();
    const result = await readStudioAgentCanonicalPrompt({
      req: {} as never,
      userId: "user-1",
      conversationId: "conv-1",
      canonicalDbEnabled: false,
      markStage,
      formatErrorMessage: (error) => String(error),
    });

    expect(result).toBeNull();
    expect(readAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
    expect(markStage).not.toHaveBeenCalled();
  });

  it("records canonical read stage and returns null on failures", async () => {
    const markStage = vi.fn();
    readAgentConversationCanonicalPromptMock.mockRejectedValue(new Error("db unavailable"));

    const result = await readStudioAgentCanonicalPrompt({
      req: {} as never,
      userId: "user-1",
      conversationId: "conv-1",
      canonicalDbEnabled: true,
      markStage,
      formatErrorMessage: () => "db unavailable",
    });

    expect(result).toBeNull();
    expect(markStage).toHaveBeenCalledTimes(1);
    expect(logApiRouteExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("writes canonical prompt only when value is present", async () => {
    const markStage = vi.fn();
    await writeStudioAgentCanonicalPrompt({
      req: {} as never,
      userId: "user-1",
      conversationId: "conv-1",
      canonicalPrompt: null,
      canonicalDbEnabled: true,
      markStage,
      writeFailureStage: "canonical_write_fast_path",
      formatErrorMessage: (error) => String(error),
    });

    expect(upsertAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
    expect(markStage).not.toHaveBeenCalled();
  });

  it("writes canonical prompt and records stage", async () => {
    const markStage = vi.fn();
    upsertAgentConversationCanonicalPromptMock.mockResolvedValue(null);

    await writeStudioAgentCanonicalPrompt({
      req: {} as never,
      userId: "user-1",
      conversationId: "conv-1",
      canonicalPrompt: "enhanced canonical prompt",
      canonicalDbEnabled: true,
      markStage,
      writeFailureStage: "canonical_write_v2",
      formatErrorMessage: () => "unused",
    });

    expect(upsertAgentConversationCanonicalPromptMock).toHaveBeenCalledWith({
      userId: "user-1",
      conversationId: "conv-1",
      canonicalPrompt: "enhanced canonical prompt",
    });
    expect(markStage).toHaveBeenCalledTimes(1);
  });
});
