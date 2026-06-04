import { describe, expect, it } from "vitest";
import { resolvePanelMixedAllMediaSignBudget } from "../surfaceConfig";

describe("resolvePanelMixedAllMediaSignBudget", () => {
  it("limits mixed all-media signing to the first usable preview slice", () => {
    expect(
      resolvePanelMixedAllMediaSignBudget({
        initialSignLimit: 6,
        prefetchWindow: 8,
        signBatchSize: 4,
      })
    ).toEqual({
      initialSignLimit: 2,
      prefetchWindow: 3,
      signBatchSize: 2,
    });
  });

  it("keeps a small minimum batch for constrained devices", () => {
    expect(
      resolvePanelMixedAllMediaSignBudget({
        initialSignLimit: 1,
        prefetchWindow: 1,
        signBatchSize: 1,
      })
    ).toEqual({
      initialSignLimit: 2,
      prefetchWindow: 3,
      signBatchSize: 2,
    });
  });
});
