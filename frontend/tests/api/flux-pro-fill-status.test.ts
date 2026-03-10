import { describe, expect, it, vi } from "vitest";

const createFalStatusHandlerMock = vi.fn((...args: unknown[]) => {
  void args;
  return vi.fn();
});
const getFalStatusBaseUrlsRequiredMock = vi.fn((...args: unknown[]) => {
  void args;
  return "https://queue.fal.run/fal-ai/flux-pro/v1/fill/requests";
});
const getFalTimeoutMsOrDefaultMock = vi.fn((...args: unknown[]) => {
  void args;
  return 60000;
});

vi.mock("../../lib/server/api/falStatusProxy", () => ({
  createFalStatusHandler: (config: Record<string, unknown>) => createFalStatusHandlerMock(config),
}));

vi.mock("../../lib/server/api/falRouteConfig", () => ({
  getFalStatusBaseUrlsRequired: (modelId: string) => getFalStatusBaseUrlsRequiredMock(modelId),
  getFalTimeoutMsOrDefault: (modelId: string, fallbackMs: number) =>
    getFalTimeoutMsOrDefaultMock(modelId, fallbackMs),
}));

describe("flux pro fill status route", () => {
  it("registers FLUX Pro Fill status with route config", async () => {
    await import("../../pages/api/fal/flux-pro-fill-status");

    expect(getFalStatusBaseUrlsRequiredMock).toHaveBeenCalledWith("fal-ai/flux-pro/v1/fill");
    expect(getFalTimeoutMsOrDefaultMock).toHaveBeenCalledWith("fal-ai/flux-pro/v1/fill", 60000);
    expect(createFalStatusHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queueBaseUrl: "https://queue.fal.run/fal-ai/flux-pro/v1/fill/requests",
        routeLabel: "Fal FLUX Pro Fill",
      })
    );
  });
});
