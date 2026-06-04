import { describe, expect, it } from "vitest";
import { resolveReferenceGridValidHydrationOutputIds } from "../useReferenceGridRuntimeScaffold";

describe("resolveReferenceGridValidHydrationOutputIds", () => {
  it("keeps Quick Slot-only and active outputs valid for hydration pruning", () => {
    expect(
      resolveReferenceGridValidHydrationOutputIds({
        allOutputIds: ["all-1", "shared-1"],
        curatedOutputIds: ["quick-only-1", "shared-1"],
        activeOutputId: "active-restored-1",
      })
    ).toEqual(["all-1", "shared-1", "quick-only-1", "active-restored-1"]);
  });
});
