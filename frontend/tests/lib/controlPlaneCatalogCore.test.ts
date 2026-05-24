import { describe, expect, it, vi } from "vitest";
import {
  createControlPlaneCatalogCacheState,
  resolveCachedControlPlaneCatalog,
} from "../../lib/server/api/controlPlaneCatalogCore";

type TestCatalog = {
  value: string;
};

type TestResolution = {
  value: string;
  source: "control_plane" | "seed";
  degraded: boolean;
};

describe("resolveCachedControlPlaneCatalog", () => {
  it("keeps the last known good control-plane catalog when a later read degrades", async () => {
    const cacheState = createControlPlaneCatalogCacheState<TestResolution>();
    const fetchActiveCatalog = vi
      .fn<() => Promise<TestCatalog | null>>()
      .mockResolvedValueOnce({ value: "stored catalog" })
      .mockRejectedValueOnce(new Error("temporary control-plane read failure"));

    const resolveCatalog = (bypassCache = false) =>
      resolveCachedControlPlaneCatalog<TestCatalog, TestResolution>({
        cacheState,
        bypassCache,
        controlPlaneCacheTtlMs: "1000",
        fetchActiveCatalog,
        buildControlPlaneResolution: (activeCatalog) => ({
          value: activeCatalog.value,
          source: "control_plane",
          degraded: false,
        }),
        buildSeedResolution: (degraded) => ({
          value: "seed catalog",
          source: "seed",
          degraded,
        }),
        buildDegradedResolutionFromPrevious: (previousResolution) => ({
          ...previousResolution,
          degraded: true,
        }),
      });

    await expect(resolveCatalog(true)).resolves.toEqual({
      value: "stored catalog",
      source: "control_plane",
      degraded: false,
    });

    await expect(resolveCatalog(true)).resolves.toEqual({
      value: "stored catalog",
      source: "control_plane",
      degraded: true,
    });
  });

  it("falls back to a degraded seed catalog when there is no previous catalog", async () => {
    const cacheState = createControlPlaneCatalogCacheState<TestResolution>();

    await expect(
      resolveCachedControlPlaneCatalog<TestCatalog, TestResolution>({
        cacheState,
        bypassCache: true,
        controlPlaneCacheTtlMs: "1000",
        fetchActiveCatalog: async () => {
          throw new Error("control-plane read failure");
        },
        buildControlPlaneResolution: (activeCatalog: TestCatalog) => ({
          value: activeCatalog.value,
          source: "control_plane",
          degraded: false,
        }),
        buildSeedResolution: (degraded) => ({
          value: "seed catalog",
          source: "seed",
          degraded,
        }),
      })
    ).resolves.toEqual({
      value: "seed catalog",
      source: "seed",
      degraded: true,
    });
  });
});
