import { beforeEach, describe, expect, it, vi } from "vitest";

const createFalSubmitHandlerMock = vi.fn((_config?: Record<string, unknown>) => vi.fn());
const createFalStatusHandlerMock = vi.fn((_config?: Record<string, unknown>) => vi.fn());
const validateFalPayloadForModelMock = vi.fn((_modelId?: string) => undefined);

vi.mock("../../lib/server/api/falSubmitProxy", () => ({
  createFalSubmitHandler: (config: Record<string, unknown>) => createFalSubmitHandlerMock(config),
}));

vi.mock("../../lib/server/api/falStatusProxy", () => ({
  createFalStatusHandler: (config: Record<string, unknown>) => createFalStatusHandlerMock(config),
}));

vi.mock("../../lib/server/api/falPayloadValidation", () => ({
  validateFalPayloadForModel: (modelId: string) => validateFalPayloadForModelMock(modelId),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
  end: vi.fn().mockReturnThis(),
});

describe("veo image-to-video routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("registers submit and status handlers from the model profile when available", async () => {
    vi.doMock("../../lib/server/falIntegration/modelProfiles", () => ({
      getFalModelProfileByModelId: (modelId: string) =>
        modelId === "fal-ai/veo3.1/image-to-video"
          ? {
              submitTargets: [{ submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video" }],
              statusBases:
                "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests/{requestId}",
              timeoutMs: 20000,
            }
          : null,
    }));

    await import("../../pages/api/fal/veo-image-to-video-submit");
    await import("../../pages/api/fal/veo-image-to-video-status");

    expect(validateFalPayloadForModelMock).toHaveBeenCalledWith("fal-ai/veo3.1/image-to-video");
    expect(createFalSubmitHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "fal-ai/veo3.1/image-to-video",
        routeLabel: "Fal Veo image-to-video",
      })
    );
    expect(createFalStatusHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "Fal Veo image-to-video",
        timeoutMs: 20000,
      })
    );
  });

  it("returns a controlled 500 from the submit route when the profile is unavailable", async () => {
    vi.doMock("../../lib/server/falIntegration/modelProfiles", () => ({
      getFalModelProfileByModelId: () => null,
    }));

    const mod = await import("../../pages/api/fal/veo-image-to-video-submit");
    const res = createMockResponse();

    await mod.default(
      {
        method: "POST",
        headers: {},
        body: {},
      } as never,
      res as never
    );

    expect(createFalSubmitHandlerMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Veo image-to-video is unavailable.",
    });
  });

  it("returns a controlled 500 from the status route when the profile is unavailable", async () => {
    vi.doMock("../../lib/server/falIntegration/modelProfiles", () => ({
      getFalModelProfileByModelId: () => null,
    }));

    const mod = await import("../../pages/api/fal/veo-image-to-video-status");
    const res = createMockResponse();

    await mod.default(
      {
        method: "GET",
        headers: {},
        query: { requestId: "req-1" },
        body: {},
      } as never,
      res as never
    );

    expect(createFalStatusHandlerMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Veo image-to-video is unavailable.",
    });
  });
});
