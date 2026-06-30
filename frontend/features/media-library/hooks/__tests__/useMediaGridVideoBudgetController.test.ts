import { describe, expect, it } from "vitest";
import { resolveMediaGridVideoAttachBudget } from "../useMediaGridVideoBudgetController";

describe("resolveMediaGridVideoAttachBudget", () => {
  const baseArgs = {
    isSmallScreen: false,
    isConstrained: false,
    autoplayMaxDesktop: 3,
    autoplayMaxSmallScreen: 2,
    autoplayMaxConstrained: 1,
  };

  it("uses the desktop budget under normal pressure", () => {
    expect(resolveMediaGridVideoAttachBudget({ ...baseArgs, pressureLevel: 0 })).toBe(3);
  });

  it("keeps constrained environments at the constrained budget", () => {
    expect(
      resolveMediaGridVideoAttachBudget({
        ...baseArgs,
        pressureLevel: 0,
        isConstrained: true,
      })
    ).toBe(1);
  });

  it("caps moderate pressure at the constrained budget", () => {
    expect(resolveMediaGridVideoAttachBudget({ ...baseArgs, pressureLevel: 1 })).toBe(1);
  });

  it("suppresses incidental video attachment under critical pressure", () => {
    expect(resolveMediaGridVideoAttachBudget({ ...baseArgs, pressureLevel: 2 })).toBe(0);
  });
});
