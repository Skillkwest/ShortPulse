import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalSubmitHandler } from "../../lib/server/api/falSubmitProxy";

const chargeGenerationRequestMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("createFalSubmitHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      markSubmitted: vi.fn().mockResolvedValue(undefined),
      refund: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to secondary submit target when primary alias returns 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "req-fallback" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [
        {
          submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video",
          transformPayload: (payload) => ({
            ...payload,
            image_url: "https://cdn.shortpulse.test/first.png",
          }),
        },
        {
          submitUrl: "https://queue.fal.run/fal-ai/veo3.1/reference-to-video",
          transformPayload: (payload) => ({
            ...payload,
            image_urls: ["https://cdn.shortpulse.test/first.png"],
          }),
        },
      ],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "animate this frame",
        image_urls: ["https://cdn.shortpulse.test/first.png"],
      },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ request_id: "req-fallback" });
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.markSubmitted).toHaveBeenCalledWith(
      "req-fallback",
      expect.objectContaining({
        upstream_status: 200,
      })
    );
    expect(charge.refund).not.toHaveBeenCalled();
  });

  it("keeps primary failure response when primary is non-404 and fallback also fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "primary fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "fallback fail" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalSubmitHandler({
      modelId: "fal-ai/veo3.1/image-to-video",
      submitTargets: [
        { submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video" },
        { submitUrl: "https://queue.fal.run/fal-ai/veo3.1/reference-to-video" },
      ],
      routeLabel: "Fal Veo image-to-video",
    });

    const req = {
      method: "POST",
      body: { prompt: "animate this frame" },
      headers: {},
      url: "/api/fal/veo-image-to-video-submit",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "primary fail" });
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-refund: Fal submit rejected.",
      expect.objectContaining({
        upstream_status: 500,
      })
    );
  });
});
