import { describe, expect, it, vi } from "vitest";

const createFalSubmitHandlerMock = vi.fn((config?: Record<string, unknown>) => {
  void config;
  return vi.fn();
});
const validateFalPayloadForModelMock = vi.fn((modelId?: string) => {
  void modelId;
  return undefined;
});

vi.mock("../../lib/server/api/falSubmitProxy", () => ({
  createFalSubmitHandler: (config: Record<string, unknown>) => createFalSubmitHandlerMock(config),
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
  it("returns disabled responses for the submit and status routes", async () => {
    await import("../../pages/api/fal/veo-image-to-video-submit");
    const submitMod = await import("../../pages/api/fal/veo-image-to-video-submit");
    const statusMod = await import("../../pages/api/fal/veo-image-to-video-status");
    const submitRes = createMockResponse();
    const statusRes = createMockResponse();

    await submitMod.default({ method: "POST", headers: {}, body: {} } as never, submitRes as never);
    await statusMod.default({ method: "POST", headers: {}, body: {} } as never, statusRes as never);

    expect(createFalSubmitHandlerMock).not.toHaveBeenCalled();
    expect(validateFalPayloadForModelMock).not.toHaveBeenCalled();
    expect(submitRes.status).toHaveBeenCalledWith(410);
    expect(submitRes.json).toHaveBeenCalledWith({
      error: "Fal Veo 3.1 image-to-video is disabled.",
      detail: "Use Kie Veo 3.1 or another active video model instead.",
    });
    expect(statusRes.status).toHaveBeenCalledWith(410);
    expect(statusRes.json).toHaveBeenCalledWith({
      error: "Fal Veo 3.1 image status route is disabled.",
      detail: "Use Kie Veo 3.1 instead.",
    });
  });

  it("allows OPTIONS on the disabled status route", async () => {
    const mod = await import("../../pages/api/fal/veo-image-to-video-submit");
    const res = createMockResponse();

    await mod.default(
      {
        method: "GET",
        headers: {},
        body: {},
      } as never,
      res as never
    );

    expect(createFalSubmitHandlerMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
