import { describe, expect, it, vi } from "vitest";

const createFalSubmitHandlerMock = vi.fn((...args: unknown[]) => {
  void args;
  return vi.fn();
});
const validateFalPayloadForModelMock = vi.fn((...args: unknown[]) => {
  void args;
  return undefined;
});
const getFalSubmitUrlRequiredMock = vi.fn((...args: unknown[]) => {
  void args;
  return "https://queue.fal.run/fal-ai/flux-pro/v1/fill";
});
const getFalTimeoutMsOrDefaultMock = vi.fn((...args: unknown[]) => {
  void args;
  return 20000;
});

vi.mock("../../lib/server/api/falSubmitProxy", () => ({
  createFalSubmitHandler: (config: Record<string, unknown>) => createFalSubmitHandlerMock(config),
}));

vi.mock("../../lib/server/api/falPayloadValidation", () => ({
  validateFalPayloadForModel: (modelId: string) => validateFalPayloadForModelMock(modelId),
}));

vi.mock("../../lib/server/api/falRouteConfig", () => ({
  getFalSubmitUrlRequired: (modelId: string) => getFalSubmitUrlRequiredMock(modelId),
  getFalTimeoutMsOrDefault: (modelId: string, fallbackMs: number) =>
    getFalTimeoutMsOrDefaultMock(modelId, fallbackMs),
}));

describe("flux pro fill submit route", () => {
  it("registers FLUX Pro Fill submit with route config and payload validation", async () => {
    await import("../../pages/api/fal/flux-pro-fill-submit");

    expect(validateFalPayloadForModelMock).toHaveBeenCalledWith("fal-ai/flux-pro/v1/fill");
    expect(getFalSubmitUrlRequiredMock).toHaveBeenCalledWith("fal-ai/flux-pro/v1/fill");
    expect(getFalTimeoutMsOrDefaultMock).toHaveBeenCalledWith("fal-ai/flux-pro/v1/fill", 20000);
    expect(createFalSubmitHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "fal-ai/flux-pro/v1/fill",
        routeLabel: "Fal FLUX Pro Fill",
      })
    );
  });
});
