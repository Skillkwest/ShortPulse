import { describe, expect, it } from "vitest";
import {
  MEDIA_LIBRARY_SURFACE_CONFIG,
  resolvePanelDenseBrowseSignBudget,
  resolvePanelPressureAwareSignBudget,
} from "../surfaceConfig";

describe("resolvePanelDenseBrowseSignBudget", () => {
  it("limits dense panel signing to the first visible panel column set", () => {
    expect(
      resolvePanelDenseBrowseSignBudget({
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
      resolvePanelDenseBrowseSignBudget({
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

describe("resolvePanelPressureAwareSignBudget", () => {
  const budget = {
    initialSignLimit: 6,
    prefetchWindow: 8,
    signBatchSize: 4,
  };

  it("preserves the budget under normal pressure", () => {
    expect(resolvePanelPressureAwareSignBudget(budget, 0)).toEqual(budget);
  });

  it("reduces signing fanout under constrained pressure", () => {
    expect(resolvePanelPressureAwareSignBudget(budget, 1)).toEqual({
      initialSignLimit: 3,
      prefetchWindow: 2,
      signBatchSize: 2,
    });
  });

  it("keeps only a minimal urgent signing lane under critical pressure", () => {
    expect(resolvePanelPressureAwareSignBudget(budget, 2)).toEqual({
      initialSignLimit: 2,
      prefetchWindow: 0,
      signBatchSize: 1,
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
