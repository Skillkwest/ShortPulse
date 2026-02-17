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
    };
    expect(body.messages?.[body.messages.length - 1]).toEqual({ role: "user", content: " " });
    expect(
      result.current.messages.some((message) => message.content === "Describe this image")
    ).toBe(false);
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
});
