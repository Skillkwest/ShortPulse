/**
 * Evaluates canary promote/hold/rollback decisions against the Phase 3 threshold contract.
 * This module is deterministic and side-effect free so it can be used in tests, scripts,
 * and rollout packet generation without route-runtime coupling.
 */

export type CanaryMetricKey =
  | "schema_failure_rate"
  | "fallback_rate"
  | "false_refusal_rate"
  | "repair_rate"
  | "p95_latency_ms"
  | "error_rate";

export type CanaryDecision = "insufficient_data" | "promote" | "warn" | "hold" | "rollback";
export type CanaryBreachLevel = "none" | "warn" | "hold" | "rollback";
export type CanaryRing =
  | "internal_verification"
  | "preview_canary"
  | "production_canary"
  | "broad_rollout_stabilization";

type CanaryMetricMode = "delta_pp" | "delta_relative_percent" | "absolute";

export type CanaryMetricSample = {
  control: number;
  canary: number;
};

export type CanaryMetricThresholds = {
  warn: number;
  hold: number;
  rollback: number;
  mode: CanaryMetricMode;
};

export type CanaryRingRequirement = {
  minWindowMinutes: number;
  minVolume: number;
};

export type CanaryThresholdContract = Record<CanaryMetricKey, CanaryMetricThresholds>;
export type CanaryRingRequirements = Record<CanaryRing, CanaryRingRequirement>;

export type CanaryDecisionInput = {
  ring: CanaryRing;
  observedWindowMinutes: number;
  observedVolume: number;
  metrics: Record<CanaryMetricKey, CanaryMetricSample>;
  thresholdContract?: CanaryThresholdContract;
  ringRequirements?: CanaryRingRequirements;
};

export type CanaryMetricEvaluation = {
  key: CanaryMetricKey;
  mode: CanaryMetricMode;
  comparedValue: number;
  breach: CanaryBreachLevel;
  thresholds: CanaryMetricThresholds;
};

export type CanaryDecisionResult = {
  decision: CanaryDecision;
  gate: {
    windowMet: boolean;
    volumeMet: boolean;
    requiredWindowMinutes: number;
    requiredVolume: number;
  };
  metricEvaluations: CanaryMetricEvaluation[];
};

/**
 * Canonical numeric thresholds from:
 * docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md
 */
export const DEFAULT_CANARY_THRESHOLD_CONTRACT: CanaryThresholdContract = {
  schema_failure_rate: { warn: 0.2, hold: 0.35, rollback: 0.5, mode: "delta_pp" },
  fallback_rate: { warn: 0.5, hold: 1, rollback: 1.5, mode: "delta_pp" },
  false_refusal_rate: { warn: 0.75, hold: 1.25, rollback: 1.75, mode: "delta_pp" },
  repair_rate: { warn: 0.75, hold: 1.25, rollback: 1.75, mode: "delta_pp" },
  p95_latency_ms: { warn: 15, hold: 25, rollback: 35, mode: "delta_relative_percent" },
  error_rate: { warn: 0.6, hold: 0.8, rollback: 1, mode: "absolute" },
};

export const DEFAULT_CANARY_RING_REQUIREMENTS: CanaryRingRequirements = {
  internal_verification: { minWindowMinutes: 60, minVolume: 200 },
  preview_canary: { minWindowMinutes: 4 * 60, minVolume: 1000 },
  production_canary: { minWindowMinutes: 24 * 60, minVolume: 5000 },
  broad_rollout_stabilization: { minWindowMinutes: 48 * 60, minVolume: 20000 },
};

const compareMetricValue = ({
  threshold,
  sample,
}: {
  threshold: CanaryMetricThresholds;
  sample: CanaryMetricSample;
}): number => {
  if (threshold.mode === "absolute") return sample.canary;
  if (threshold.mode === "delta_pp") return sample.canary - sample.control;
  if (sample.control <= 0) {
    return sample.canary <= 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  return ((sample.canary - sample.control) / sample.control) * 100;
};

const resolveBreachLevel = ({
  comparedValue,
  threshold,
}: {
  comparedValue: number;
  threshold: CanaryMetricThresholds;
}): CanaryBreachLevel => {
  if (comparedValue > threshold.rollback) return "rollback";
  if (comparedValue > threshold.hold) return "hold";
  if (comparedValue > threshold.warn) return "warn";
  return "none";
};

/**
 * Evaluates one ring observation against canary thresholds and decision precedence.
 * Decision precedence: insufficient_data -> rollback -> hold -> warn -> promote.
 */
export const evaluateCanaryThresholdDecision = ({
  ring,
  observedWindowMinutes,
  observedVolume,
  metrics,
  thresholdContract = DEFAULT_CANARY_THRESHOLD_CONTRACT,
  ringRequirements = DEFAULT_CANARY_RING_REQUIREMENTS,
}: CanaryDecisionInput): CanaryDecisionResult => {
  const gateRequirement = ringRequirements[ring];
  const windowMet = observedWindowMinutes >= gateRequirement.minWindowMinutes;
  const volumeMet = observedVolume >= gateRequirement.minVolume;

  const metricEvaluations: CanaryMetricEvaluation[] = (
    Object.keys(thresholdContract) as CanaryMetricKey[]
  ).map((key) => {
    const thresholds = thresholdContract[key];
    const sample = metrics[key];
    const comparedValue = compareMetricValue({ threshold: thresholds, sample });
    return {
      key,
      mode: thresholds.mode,
      comparedValue,
      breach: resolveBreachLevel({ comparedValue, threshold: thresholds }),
      thresholds,
    };
  });

  if (!windowMet || !volumeMet) {
    return {
      decision: "insufficient_data",
      gate: {
        windowMet,
        volumeMet,
        requiredWindowMinutes: gateRequirement.minWindowMinutes,
        requiredVolume: gateRequirement.minVolume,
      },
      metricEvaluations,
    };
  }

  if (metricEvaluations.some((metric) => metric.breach === "rollback")) {
    return {
      decision: "rollback",
      gate: {
        windowMet,
        volumeMet,
        requiredWindowMinutes: gateRequirement.minWindowMinutes,
        requiredVolume: gateRequirement.minVolume,
      },
      metricEvaluations,
    };
  }
  if (metricEvaluations.some((metric) => metric.breach === "hold")) {
    return {
      decision: "hold",
      gate: {
        windowMet,
        volumeMet,
        requiredWindowMinutes: gateRequirement.minWindowMinutes,
        requiredVolume: gateRequirement.minVolume,
      },
      metricEvaluations,
    };
  }
  if (metricEvaluations.some((metric) => metric.breach === "warn")) {
    return {
      decision: "warn",
      gate: {
        windowMet,
        volumeMet,
        requiredWindowMinutes: gateRequirement.minWindowMinutes,
        requiredVolume: gateRequirement.minVolume,
      },
      metricEvaluations,
    };
  }
  return {
    decision: "promote",
    gate: {
      windowMet,
      volumeMet,
      requiredWindowMinutes: gateRequirement.minWindowMinutes,
      requiredVolume: gateRequirement.minVolume,
    },
    metricEvaluations,
  };
};
