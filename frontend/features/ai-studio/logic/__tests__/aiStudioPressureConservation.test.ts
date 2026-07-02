/**
 * Tests for AI Studio pressure-conservation route scoping.
 */
import { afterEach, describe, expect, it } from "vitest";
import { shouldDeferAiStudioBackgroundWork } from "../aiStudioPressureConservation";

const PRESSURE_QUARANTINE_STORAGE_KEY = "shortpulse.ai_studio.pressure_quarantine.v1";

const writePressureQuarantine = () => {
  window.sessionStorage.setItem(
    PRESSURE_QUARANTINE_STORAGE_KEY,
    JSON.stringify({
      expiresAt: Date.now() + 60_000,
      level: 2,
      reason: "heap_pressure",
      updatedAt: Date.now(),
    })
  );
};

describe("aiStudioPressureConservation", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.pushState(null, "", "/");
  });

  it("defers background work only on AI Studio routes under level-2 pressure", () => {
    writePressureQuarantine();

    window.history.pushState(null, "", "/ai-studio?perfAuditRuntime=1");
    expect(shouldDeferAiStudioBackgroundWork()).toBe(true);

    window.history.pushState(null, "", "/dashboard");
    expect(shouldDeferAiStudioBackgroundWork()).toBe(false);
  });
});
