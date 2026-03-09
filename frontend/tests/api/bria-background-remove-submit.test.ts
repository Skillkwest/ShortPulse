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
  return "https://queue.fal.run/fal-ai/bria/background/remove";
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

describe("bria background remove submit route", () => {
  it("registers Bria submit with billing disabled", async () => {
    await import("../../pages/api/fal/bria-background-remove-submit");

    expect(createFalSubmitHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "fal-ai/bria/background/remove",
        skipBilling: true,
      })
    );
  });
});
