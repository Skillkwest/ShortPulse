import { describe, expect, it } from "vitest";
import { AI_STUDIO_PLAN_CTA, resolveGenerationAccessCta } from "../generationAccessCta";

describe("resolveGenerationAccessCta", () => {
  it("returns the pricing CTA for a confirmed baseline account", () => {
    expect(
      resolveGenerationAccessCta({
        resolvedPlan: { id: "free" },
        status: "ready",
      })
    ).toEqual(AI_STUDIO_PLAN_CTA);
  });

  it("keeps paid plans on the normal Generate path even when credits are exhausted", () => {
    expect(
      resolveGenerationAccessCta({
        resolvedPlan: { id: "starter" },
        status: "ready",
      })
    ).toBeNull();
  });

  it("does not infer no-plan access from fallback or unavailable account data", () => {
    expect(
      resolveGenerationAccessCta({
        resolvedPlan: { id: "free" },
        status: "unavailable",
      })
    ).toBeNull();
  });
});
