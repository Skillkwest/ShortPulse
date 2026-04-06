import { beforeEach, describe, expect, it, vi } from "vitest";

const createFalStatusHandlerMock = vi.fn<(config: unknown) => unknown>(() => vi.fn());

vi.mock("../../lib/server/api/falStatusProxy", () => ({
  createFalStatusHandler: (config: unknown) => createFalStatusHandlerMock(config),
}));

describe("Kie status route wiring", () => {
  beforeEach(() => {
    vi.resetModules();
    createFalStatusHandlerMock.mockClear();
  });

  it("wires kie-veo-status with explicit modelId", async () => {
    const { KIE_VEO_31_FAST_I2V_MODEL_ID } =
      await import("../../lib/model-runtime/providerModelIds");
    const { getKieStatusBaseUrlsRequired, getKieTimeoutMsOrDefault } =
      await import("../../lib/server/api/falRouteConfig");

    await import("../../pages/api/fal/kie-veo-status");

    expect(createFalStatusHandlerMock).toHaveBeenCalledWith({
      provider: "kie",
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      queueBaseUrl: getKieStatusBaseUrlsRequired(KIE_VEO_31_FAST_I2V_MODEL_ID),
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: getKieTimeoutMsOrDefault(KIE_VEO_31_FAST_I2V_MODEL_ID, 60000),
    });
  });

  it("wires kie-kling-status with explicit modelId", async () => {
    const { KIE_KLING_30_MODEL_ID } = await import("../../lib/model-runtime/providerModelIds");
    const { getKieStatusBaseUrlsRequired, getKieTimeoutMsOrDefault } =
      await import("../../lib/server/api/falRouteConfig");

    await import("../../pages/api/fal/kie-kling-status");

    expect(createFalStatusHandlerMock).toHaveBeenCalledWith({
      provider: "kie",
      modelId: KIE_KLING_30_MODEL_ID,
      queueBaseUrl: getKieStatusBaseUrlsRequired(KIE_KLING_30_MODEL_ID),
      routeLabel: "Kie Kling 3.0",
      timeoutMs: getKieTimeoutMsOrDefault(KIE_KLING_30_MODEL_ID, 60000),
    });
  });

  it("wires kie-seedance-status with explicit modelId", async () => {
    const { KIE_SEEDANCE_15_PRO_MODEL_ID } =
      await import("../../lib/model-runtime/providerModelIds");
    const { getKieStatusBaseUrlsRequired, getKieTimeoutMsOrDefault } =
      await import("../../lib/server/api/falRouteConfig");

    await import("../../pages/api/fal/kie-seedance-status");

    expect(createFalStatusHandlerMock).toHaveBeenCalledWith({
      provider: "kie",
      modelId: KIE_SEEDANCE_15_PRO_MODEL_ID,
      queueBaseUrl: getKieStatusBaseUrlsRequired(KIE_SEEDANCE_15_PRO_MODEL_ID),
      routeLabel: "Kie Seedance 1.5 Pro",
      timeoutMs: getKieTimeoutMsOrDefault(KIE_SEEDANCE_15_PRO_MODEL_ID, 60000),
    });
  });
});
