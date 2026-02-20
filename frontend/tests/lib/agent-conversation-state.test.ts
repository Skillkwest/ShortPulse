import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_CONVERSATION_ID_MAX_LENGTH,
  AGENT_CANONICAL_PROMPT_MAX_LENGTH,
  clampCanonicalPrompt,
  readAgentConversationCanonicalPrompt,
  upsertAgentConversationCanonicalPrompt,
} from "../../lib/server/api/agentConversationState";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createQueryBuilder = () => {
  const queryBuilder = {
    eq: vi.fn(),
    gt: vi.fn(),
    maybeSingle: vi.fn(),
  };
  queryBuilder.eq.mockImplementation(() => queryBuilder);
  queryBuilder.gt.mockImplementation(() => queryBuilder);
  return queryBuilder;
};

describe("agentConversationState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clamps and trims canonical prompts to the configured max length", () => {
    const longPrompt = `  ${"a".repeat(AGENT_CANONICAL_PROMPT_MAX_LENGTH + 32)}  `;
    const clamped = clampCanonicalPrompt(longPrompt);

    expect(clamped).not.toBeNull();
    expect(clamped?.length).toBe(AGENT_CANONICAL_PROMPT_MAX_LENGTH);
    expect(clampCanonicalPrompt("   ")).toBeNull();
  });

  it("reads canonical prompt rows scoped by user/conversation and expiry", async () => {
    const queryBuilder = createQueryBuilder();
    const selectMock = vi.fn(() => queryBuilder);
    const fromMock = vi.fn(() => ({ select: selectMock }));
    getSupabaseAdminMock.mockReturnValue({
      from: fromMock,
      rpc: vi.fn(),
    });
    queryBuilder.maybeSingle.mockResolvedValue({
      data: { canonical_prompt: "  cinematic forest at dusk  " },
      error: null,
    });

    const canonical = await readAgentConversationCanonicalPrompt({
      userId: "user-1",
      conversationId: " convo-1 ",
    });

    expect(canonical).toBe("cinematic forest at dusk");
    expect(fromMock).toHaveBeenCalledWith("ai_agent_conversation_state");
    expect(selectMock).toHaveBeenCalledWith("canonical_prompt");
    expect(queryBuilder.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(queryBuilder.eq).toHaveBeenNthCalledWith(2, "conversation_id", "convo-1");
    expect(queryBuilder.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("upserts canonical prompt rows through the bounded RPC helper", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [{ canonical_prompt: "final prompt" }],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(),
      rpc: rpcMock,
    });

    const canonical = await upsertAgentConversationCanonicalPrompt({
      userId: "user-1",
      conversationId: " convo-1 ",
      canonicalPrompt: " final prompt ",
    });

    expect(canonical).toBe("final prompt");
    expect(rpcMock).toHaveBeenCalledWith("upsert_ai_agent_conversation_state", {
      p_user_id: "user-1",
      p_conversation_id: "convo-1",
      p_canonical_prompt: "final prompt",
      p_ttl: "30 days",
      p_user_cap: 200,
    });
  });

  it("retries upsert without ttl when rpc signature cache misses", async () => {
    const rpcMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the function public.upsert_ai_agent_conversation_state(p_canonical_prompt, p_conversation_id, p_user_cap, p_user_id) in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: [{ canonical_prompt: "final prompt" }],
        error: null,
      });

    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(),
      rpc: rpcMock,
    });

    const canonical = await upsertAgentConversationCanonicalPrompt({
      userId: "user-1",
      conversationId: "convo-1",
      canonicalPrompt: "final prompt",
    });

    expect(canonical).toBe("final prompt");
    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "upsert_ai_agent_conversation_state", {
      p_user_id: "user-1",
      p_conversation_id: "convo-1",
      p_canonical_prompt: "final prompt",
      p_ttl: "30 days",
      p_user_cap: 200,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "upsert_ai_agent_conversation_state", {
      p_user_id: "user-1",
      p_conversation_id: "convo-1",
      p_canonical_prompt: "final prompt",
      p_user_cap: 200,
    });
  });

  it("throws when supabase read/upsert calls fail", async () => {
    const queryBuilder = createQueryBuilder();
    const fromMock = vi.fn(() => ({ select: vi.fn(() => queryBuilder) }));
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    });
    getSupabaseAdminMock.mockReturnValue({
      from: fromMock,
      rpc: rpcMock,
    });
    queryBuilder.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "read failed" },
    });

    await expect(
      readAgentConversationCanonicalPrompt({
        userId: "user-1",
        conversationId: "convo-1",
      })
    ).rejects.toThrow("Failed to read canonical prompt state: read failed");

    await expect(
      upsertAgentConversationCanonicalPrompt({
        userId: "user-1",
        conversationId: "convo-1",
        canonicalPrompt: "prompt",
      })
    ).rejects.toThrow("Failed to upsert canonical prompt state: rpc failed");
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("skips read/upsert when conversation id exceeds max length", async () => {
    const queryBuilder = createQueryBuilder();
    const selectMock = vi.fn(() => queryBuilder);
    const fromMock = vi.fn(() => ({ select: selectMock }));
    const rpcMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({
      from: fromMock,
      rpc: rpcMock,
    });

    const tooLongConversationId = `c-${"x".repeat(AGENT_CONVERSATION_ID_MAX_LENGTH)}`;
    const readResult = await readAgentConversationCanonicalPrompt({
      userId: "user-1",
      conversationId: tooLongConversationId,
    });
    const upsertResult = await upsertAgentConversationCanonicalPrompt({
      userId: "user-1",
      conversationId: tooLongConversationId,
      canonicalPrompt: "prompt",
    });

    expect(readResult).toBeNull();
    expect(upsertResult).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
