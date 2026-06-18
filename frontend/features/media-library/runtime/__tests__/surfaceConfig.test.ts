import { describe, expect, it } from "vitest";
import {
  MEDIA_LIBRARY_SURFACE_CONFIG,
  resolvePanelMixedAllMediaSignBudget,
} from "../surfaceConfig";

describe("resolvePanelMixedAllMediaSignBudget", () => {
  it("limits mixed all-media signing to the first visible panel column set", () => {
    expect(
      resolvePanelMixedAllMediaSignBudget({
        initialSignLimit: 6,
        prefetchWindow: 8,
        signBatchSize: 4,
      })
    ).toEqual({
      initialSignLimit: 5,
      prefetchWindow: 6,
      signBatchSize: 5,
    });
  });

  it("keeps first-visible coverage even for constrained devices", () => {
    expect(
      resolvePanelMixedAllMediaSignBudget({
        initialSignLimit: 1,
        prefetchWindow: 1,
        signBatchSize: 1,
      })
    ).toEqual({
      initialSignLimit: 5,
      prefetchWindow: 5,
      signBatchSize: 5,
    });
  });
});

describe("MEDIA_LIBRARY_SURFACE_CONFIG", () => {
  it("keeps embedded right-rail surfaces on the shared panel runtime adapter", () => {
    expect(Object.keys(MEDIA_LIBRARY_SURFACE_CONFIG).sort()).toEqual(["modal", "panel"]);
    expect(MEDIA_LIBRARY_SURFACE_CONFIG.panel).toMatchObject({
      kind: "panel",
      listSurface: "media-library-panel",
      adaptiveSurface: "media-library-panel-grid",
    });
  });
});
