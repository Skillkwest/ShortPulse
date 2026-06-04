import { describe, expect, it } from "vitest";
import { resolvePanelMixedAllMediaSignBudget } from "../surfaceConfig";

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
