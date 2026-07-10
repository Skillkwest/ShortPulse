import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { sendStudioAgentTurnToEndpoint } from "../studioAgentTransport";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

describe("studioAgentTransport", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
  });

  it("sends a bounded mixed ten-image request in deterministic order", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await sendStudioAgentTurnToEndpoint("/api/ai/studio-agent-standard", {
      clientSessionKey: "session-1",
      runtimeMode: "standard",
      messages: [{ role: "user", content: "Describe these references." }],
      context: {
        mode: "image",
        media: Array.from({ length: 10 }, (_, index) => ({
          id: `image-${index + 1}`,
          kind: "image" as const,
          url:
            index % 2 === 0
              ? `https://example.test/${index + 1}.png`
              : `data:image/webp;base64,aW1hZ2Ut${index + 1}`,
        })),
      },
    });
    expect(result.ok).toBe(true);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const request = fetchWithAuthMock.mock.calls[0]?.[1] as { body?: string } | undefined;
    const sent = JSON.parse(request?.body ?? "{}") as {
      context?: { media?: Array<{ id?: string; url?: string }> };
    };
    expect(sent.context?.media?.map((item) => item.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `image-${index + 1}`)
    );
    expect(sent.context?.media?.filter((item) => item.url?.startsWith("https://"))).toHaveLength(5);
    expect(sent.context?.media?.filter((item) => item.url?.startsWith("data:image/"))).toHaveLength(
      5
    );
  });

  it("fails before fetch when the serialized mixed request exceeds its byte ceiling", async () => {
    const result = await sendStudioAgentTurnToEndpoint("/api/ai/studio-agent-standard", {
      clientSessionKey: "session-1",
      runtimeMode: "standard",
      messages: [{ role: "user", content: "x".repeat(1600 * 1024) }],
      context: {
        mode: "image",
        media: [{ id: "image-1", kind: "image", url: "https://example.test/image.png" }],
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: 413,
        parsedError: expect.objectContaining({ code: "REQUEST_BODY_TOO_LARGE" }),
      })
    );
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });
});
