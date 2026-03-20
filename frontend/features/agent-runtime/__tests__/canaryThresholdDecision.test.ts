import { describe, expect, it } from "vitest";
import {
  evaluateCanaryThresholdDecision,
  type CanaryMetricSample,
} from "../canaryThresholdDecision";

const metricSamples = (
  overrides: Partial<Record<string, CanaryMetricSample>> = {}
): Record<
  | "schema_failure_rate"
  | "fallback_rate"
  | "false_refusal_rate"
  | "repair_rate"
  | "p95_latency_ms"
  | "error_rate",
  CanaryMetricSample
> => ({
  schema_failure_rate: { control: 1, canary: 1.1 },
  fallback_rate: { control: 2, canary: 2.3 },
  false_refusal_rate: { control: 1, canary: 1.4 },
  repair_rate: { control: 0.8, canary: 1.1 },
  p95_latency_ms: { control: 2000, canary: 2200 },
  error_rate: { control: 0.4, canary: 0.55 },
  ...(overrides as Record<string, CanaryMetricSample>),
});

describe("evaluateCanaryThresholdDecision", () => {
  it("returns promote when all metrics are below warn thresholds", () => {
    const result = evaluateCanaryThresholdDecision({
      ring: "preview_canary",
      observedWindowMinutes: 300,
      observedVolume: 2000,
      metrics: metricSamples(),
    });
    expect(result.decision).toBe("promote");
    expect(result.metricEvaluations.every((metric) => metric.breach === "none")).toBe(true);
  });

  it("returns warn when at least one metric breaches warn only", () => {
    const result = evaluateCanaryThresholdDecision({
      ring: "preview_canary",
      observedWindowMinutes: 300,
      observedVolume: 2000,
      metrics: metricSamples({
        fallback_rate: { control: 1, canary: 1.6 }, // +0.6pp
      }),
    });
    expect(result.decision).toBe("warn");
    expect(result.metricEvaluations.find((metric) => metric.key === "fallback_rate")?.breach).toBe(
      "warn"
    );
  });

  it("returns hold when hold threshold is breached without rollback breach", () => {
    const result = evaluateCanaryThresholdDecision({
      ring: "preview_canary",
      observedWindowMinutes: 300,
      observedVolume: 2000,
      metrics: metricSamples({
        false_refusal_rate: { control: 1, canary: 2.3 }, // +1.3pp
      }),
    });
    expect(result.decision).toBe("hold");
    expect(
      result.metricEvaluations.find((metric) => metric.key === "false_refusal_rate")?.breach
    ).toBe("hold");
  });

  it("returns rollback when any rollback threshold is breached", () => {
    const result = evaluateCanaryThresholdDecision({
      ring: "production_canary",
      observedWindowMinutes: 1600,
      observedVolume: 7000,
      metrics: metricSamples({
        schema_failure_rate: { control: 1, canary: 1.6 }, // +0.6pp
      }),
    });
    expect(result.decision).toBe("rollback");
    expect(
      result.metricEvaluations.find((metric) => metric.key === "schema_failure_rate")?.breach
    ).toBe("rollback");
  });

  it("returns insufficient_data when window or volume requirement is not met", () => {
    const result = evaluateCanaryThresholdDecision({
      ring: "preview_canary",
      observedWindowMinutes: 120,
      observedVolume: 500,
      metrics: metricSamples({
        schema_failure_rate: { control: 1, canary: 1.9 },
      }),
    });
    expect(result.decision).toBe("insufficient_data");
    expect(result.gate.windowMet).toBe(false);
    expect(result.gate.volumeMet).toBe(false);
  });

  it("treats latency delta as infinite when control baseline is zero and canary is nonzero", () => {
    const result = evaluateCanaryThresholdDecision({
      ring: "internal_verification",
      observedWindowMinutes: 90,
      observedVolume: 300,
      metrics: metricSamples({
        p95_latency_ms: { control: 0, canary: 100 },
      }),
    });
    expect(result.decision).toBe("rollback");
    const latency = result.metricEvaluations.find((metric) => metric.key === "p95_latency_ms");
    expect(latency?.comparedValue).toBe(Number.POSITIVE_INFINITY);
    expect(latency?.breach).toBe("rollback");
  });

  it("uses absolute threshold mode for error_rate (not delta)", () => {
    const result = evaluateCanaryThresholdDecision({
      ring: "internal_verification",
      observedWindowMinutes: 90,
      observedVolume: 300,
      metrics: metricSamples({
        error_rate: { control: 0.1, canary: 0.85 },
      }),
    });
    expect(result.decision).toBe("hold");
    expect(result.metricEvaluations.find((metric) => metric.key === "error_rate")?.breach).toBe(
      "hold"
    );
  });
});
