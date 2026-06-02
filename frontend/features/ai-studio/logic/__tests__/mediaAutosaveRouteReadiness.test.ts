import { describe, expect, it } from "vitest";
import { resolveAiStudioMediaAutosaveRouteEnabled } from "../mediaAutosaveRouteReadiness";

describe("resolveAiStudioMediaAutosaveRouteEnabled", () => {
  it("keeps autosave enabled on non-project AI Studio routes", () => {
    expect(
      resolveAiStudioMediaAutosaveRouteEnabled({
        projectRouteRequested: false,
        projectStatus: "idle",
        projectBootstrapSettled: false,
      })
    ).toBe(true);
  });

  it("enables project media autosave after bootstrap settles without waiting for workspace autosave readiness", () => {
    expect(
      resolveAiStudioMediaAutosaveRouteEnabled({
        projectRouteRequested: true,
        projectStatus: "ready",
        projectBootstrapSettled: true,
      })
    ).toBe(true);
  });

  it("blocks project media autosave until bootstrap settles", () => {
    expect(
      resolveAiStudioMediaAutosaveRouteEnabled({
        projectRouteRequested: true,
        projectStatus: "ready",
        projectBootstrapSettled: false,
      })
    ).toBe(false);
  });

  it("blocks project media autosave until the route project identity is ready", () => {
    expect(
      resolveAiStudioMediaAutosaveRouteEnabled({
        projectRouteRequested: true,
        projectStatus: "loading",
        projectBootstrapSettled: true,
      })
    ).toBe(false);
  });
});
