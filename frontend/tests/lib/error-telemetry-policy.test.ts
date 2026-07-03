import { describe, expect, it } from "vitest";
import {
  ADMISSION_LIMITED_TELEMETRY_SOURCE,
  CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT,
  CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT,
  CHARACTER_MODE_TELEMETRY_SOURCE,
  DIRECT_SUBMIT_ADMISSION_LIMITED_TELEMETRY_SOURCE,
  GENERATION_RECOVERY_MEDIA_VISIBLE_EVENT,
  GENERATION_RECOVERY_MEDIA_VISIBLE_TELEMETRY_SOURCE,
  GENERATION_RECOVERY_RUNNING_TIMEOUT_EVENT,
  GENERATION_RECOVERY_RUNNING_TIMEOUT_TELEMETRY_SOURCE,
  GROWTH_TELEMETRY_SOURCE_LIKE_PATTERNS,
  ROUTINE_NON_ACTIONABLE_TELEMETRY_SOURCE_LIKE_PATTERNS,
  SYNTHETIC_TEST_SOURCE_LIKE_PATTERN,
  TELEMETRY_SOURCE_LIKE_PATTERN,
  isGrowthTelemetrySource,
  isRoutineNonActionableTelemetrySource,
  isTelemetrySource,
  shouldRetainEventUserEmail,
  shouldRetainRichEventContext,
} from "../../lib/server/api/errorTelemetryPolicy";

describe("error telemetry source policy", () => {
  it("classifies telemetry sources by prefix", () => {
    expect(isTelemetrySource("telemetry.queue.dispatch.retry")).toBe(true);
    expect(isTelemetrySource("api.exception")).toBe(false);
  });

  it("classifies growth telemetry as non-actionable telemetry", () => {
    expect(isGrowthTelemetrySource("telemetry.marketing.page_view")).toBe(true);
    expect(isGrowthTelemetrySource("telemetry.auth.signup_submitted")).toBe(true);
    expect(isGrowthTelemetrySource("telemetry.billing.checkout_started")).toBe(true);
    expect(isGrowthTelemetrySource("telemetry.character_mode")).toBe(false);
    expect(isRoutineNonActionableTelemetrySource("telemetry.marketing.page_view")).toBe(true);
    expect(
      isRoutineNonActionableTelemetrySource("telemetry.ai_studio.stability.window_focus")
    ).toBe(true);
    expect(isRoutineNonActionableTelemetrySource("telemetry.character_mode")).toBe(false);
  });

  it("keeps rich event context and email snapshots for incidents, not routine telemetry", () => {
    expect(
      shouldRetainRichEventContext({
        source: "client.runtime",
        severity: "high",
      })
    ).toBe(true);
    expect(
      shouldRetainRichEventContext({
        source: "telemetry.ai_studio.stability.pressure_level_changed",
        severity: "medium",
      })
    ).toBe(false);
    expect(
      shouldRetainRichEventContext({
        source: "telemetry.api.fal_submit.direct_transition_failed",
        severity: "high",
      })
    ).toBe(true);
    expect(shouldRetainEventUserEmail("client.runtime")).toBe(true);
    expect(shouldRetainEventUserEmail("telemetry.marketing.page_view")).toBe(false);
  });

  it("exposes stable query patterns and known telemetry source constants", () => {
    expect(TELEMETRY_SOURCE_LIKE_PATTERN).toBe("telemetry.%");
    expect(GROWTH_TELEMETRY_SOURCE_LIKE_PATTERNS).toEqual([
      "telemetry.marketing.%",
      "telemetry.auth.%",
      "telemetry.billing.%",
    ]);
    expect(ROUTINE_NON_ACTIONABLE_TELEMETRY_SOURCE_LIKE_PATTERNS).toEqual([
      "telemetry.marketing.%",
      "telemetry.auth.%",
      "telemetry.billing.%",
      "telemetry.ai_studio.stability.%",
    ]);
    expect(SYNTHETIC_TEST_SOURCE_LIKE_PATTERN).toBe("admin.synthetic_test.%");
    expect(ADMISSION_LIMITED_TELEMETRY_SOURCE).toBe("telemetry.api.fal_submit.admission_limited");
    expect(DIRECT_SUBMIT_ADMISSION_LIMITED_TELEMETRY_SOURCE).toBe(
      "telemetry.api.direct_submit.admission_limited"
    );
    expect(CHARACTER_MODE_TELEMETRY_SOURCE).toBe("telemetry.character_mode");
    expect(CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT).toBe(
      "character_mode_reference_refresh_empty"
    );
    expect(CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT).toBe(
      "character_mode_injection_fallback.bundle_unavailable"
    );
    expect(GENERATION_RECOVERY_RUNNING_TIMEOUT_TELEMETRY_SOURCE).toBe(
      "telemetry.generation.recovery.running_hard_timeout"
    );
    expect(GENERATION_RECOVERY_RUNNING_TIMEOUT_EVENT).toBe("provider_running_timeout");
    expect(GENERATION_RECOVERY_MEDIA_VISIBLE_TELEMETRY_SOURCE).toBe(
      "telemetry.generation.recovery.media_visible"
    );
    expect(GENERATION_RECOVERY_MEDIA_VISIBLE_EVENT).toBe("media_visible");
  });
});
