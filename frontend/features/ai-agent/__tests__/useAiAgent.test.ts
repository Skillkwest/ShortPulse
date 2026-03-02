import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiAgent } from "../useAiAgent";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

vi.mock("../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

describe("useAiAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("allows image-context-only turns without injecting describe text", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Image context received." }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "",
        payloadText: "",
        skipUserEcho: true,
        context: {
          media: [{ id: "img-1", kind: "image", url: "https://cdn.test/image.png" }],
        },
      });
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
      clientSessionKey?: string;
    };
    expect(body.messages?.[body.messages.length - 1]).toEqual({ role: "user", content: " " });
    expect(
      result.current.messages.some((message) => message.content === "Describe this image")
    ).toBe(false);
    expect(typeof body.clientSessionKey).toBe("string");
    expect((body.clientSessionKey ?? "").length).toBeGreaterThan(0);
  });

  it("still returns early for empty text with no media context", async () => {
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "   ",
        payloadText: "   ",
        skipUserEcho: true,
        context: {},
      });
    });

    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("reuses stored clientSessionKey across hook remounts and rotates on reset", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);

    const { result, unmount } = renderHook(() =>
      useAiAgent({ enabled: true, sessionNamespace: "ai-studio:test" })
    );

    await act(async () => {
      await result.current.send({
        text: "first",
        payloadText: "first",
      });
    });

    const firstBody = JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    expect(typeof firstBody.clientSessionKey).toBe("string");
    const firstKey = firstBody.clientSessionKey as string;

    unmount();

    const remounted = renderHook(() =>
      useAiAgent({ enabled: true, sessionNamespace: "ai-studio:test" })
    );
    await act(async () => {
      await remounted.result.current.send({
        text: "second",
        payloadText: "second",
      });
    });

    const secondBody = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    expect(secondBody.clientSessionKey).toBe(firstKey);

    act(() => {
      remounted.result.current.reset();
    });

    await act(async () => {
      await remounted.result.current.send({
        text: "third",
        payloadText: "third",
      });
    });

    const thirdBody = JSON.parse(String(fetchWithAuthMock.mock.calls[2]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    expect(thirdBody.clientSessionKey).not.toBe(firstKey);
  });

  it("switches clientSessionKey by sessionNamespace and restores prior namespace key", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as Response);

    const hook = renderHook(
      ({ namespace }) => useAiAgent({ enabled: true, sessionNamespace: namespace }),
      { initialProps: { namespace: "ai-studio:tool-a" } }
    );

    await act(async () => {
      await hook.result.current.send({ text: "a1", payloadText: "a1" });
    });
    const bodyA1 = JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    const keyA = bodyA1.clientSessionKey;
    expect(typeof keyA).toBe("string");

    hook.rerender({ namespace: "ai-studio:tool-b" });
    await act(async () => {
      await hook.result.current.send({ text: "b1", payloadText: "b1" });
    });
    const bodyB1 = JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    const keyB = bodyB1.clientSessionKey;
    expect(typeof keyB).toBe("string");
    expect(keyB).not.toBe(keyA);

    hook.rerender({ namespace: "ai-studio:tool-a" });
    await act(async () => {
      await hook.result.current.send({ text: "a2", payloadText: "a2" });
    });
    const bodyA2 = JSON.parse(String(fetchWithAuthMock.mock.calls[2]?.[1]?.body ?? "{}")) as {
      clientSessionKey?: string;
    };
    expect(bodyA2.clientSessionKey).toBe(keyA);
  });

  it("treats refusal payloads as assistant responses without setting error", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "I cannot describe this." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "describe this image",
        payloadText: "describe this image",
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "I cannot describe this.",
      })
    );
  });

  it("treats infra fallback payloads as assistant responses without setting error", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "I can't process that request right now. Please try again.",
          actions: undefined,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "describe this image",
        payloadText: "describe this image",
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "I can't process that request right now. Please try again.",
      })
    );
  });

  it("surfaces structured infra errors in hook state", async () => {
    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Upstream error", detail: "invalid api key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "refine prompt",
        payloadText: "refine prompt",
      });
    });

    expect(result.current.error?.toLowerCase()).toContain("invalid api key");
  });

  it("assigns stable ids to user and assistant messages generated by the hook", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "assistant output" }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "user message",
        payloadText: "user message",
      });
    });

    const userMessage = result.current.messages.find((message) => message.role === "user");
    const assistantMessage = result.current.messages.find(
      (message) => message.role === "assistant"
    );
    expect(userMessage?.id).toMatch(/^agent-user-/);
    expect(assistantMessage?.id).toMatch(/^agent-assistant-/);
  });

  it("updates only the targeted message when updateMessageById is used", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "assistant output" }),
    } as Response);
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    await act(async () => {
      await result.current.send({
        text: "user message",
        payloadText: "user message",
      });
    });

    const assistantMessage = result.current.messages.find(
      (message) => message.role === "assistant"
    );
    expect(assistantMessage?.id).toBeTruthy();

    act(() => {
      result.current.updateMessageById(String(assistantMessage?.id), (message) => ({
        ...message,
        content: "edited assistant output",
      }));
    });

    const updatedAssistant = result.current.messages.find(
      (message) => message.role === "assistant"
    );
    expect(updatedAssistant?.content).toBe("edited assistant output");
    expect(updatedAssistant?.id).toBe(assistantMessage?.id);
  });

  it("replaces chat history when replaceMessages is used", () => {
    const { result } = renderHook(() => useAiAgent({ enabled: true }));

    act(() => {
      result.current.replaceMessages([
        { id: "agent-user-restored-1", role: "user", content: "restored user" },
        { id: "agent-assistant-restored-1", role: "assistant", content: "restored assistant" },
      ]);
    });

    expect(result.current.messages).toEqual([
      { id: "agent-user-restored-1", role: "user", content: "restored user" },
      { id: "agent-assistant-restored-1", role: "assistant", content: "restored assistant" },
    ]);
    expect(result.current.error).toBeNull();
  });
});
