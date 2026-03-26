/**
 * Shared finding and risk policy for admin user-health diagnostics.
 */
import type {
  FleetFinding,
  FleetFindingConfidence,
  FleetFindingSeverity,
  FleetRiskBand,
  FleetUserEvaluation,
  FleetUserMetricInput,
} from "./types";

const severityRank: Record<FleetFindingSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

const findingRiskWeight: Record<FleetFindingSeverity, number> = {
  info: 5,
  warning: 20,
  critical: 45,
};

const pushUnique = (steps: string[]): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const step of steps) {
    const normalized = step.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
};

const addFinding = (
  findings: FleetFinding[],
  severity: FleetFindingSeverity,
  confidence: FleetFindingConfidence,
  code: string,
  summary: string,
  details: string,
  recommendedActions: string[]
) => {
  findings.push({
    code,
    severity,
    confidence,
    summary,
    details,
    recommendedActions,
  });
};

const resolveHighestSeverity = (findings: FleetFinding[]): FleetFindingSeverity => {
  if (!findings.length) return "info";
  return findings
    .slice()
    .sort((left, right) => severityRank[right.severity] - severityRank[left.severity])[0].severity;
};

const clampRiskScore = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const resolveRiskBand = (riskScore: number): FleetRiskBand => {
  if (riskScore >= 70) return "high";
  if (riskScore >= 40) return "medium";
  return "low";
};

const resolveRiskScore = ({
  metrics,
  findings,
}: {
  metrics: FleetUserMetricInput;
  findings: FleetFinding[];
}): number => {
  let score = 0;

  for (const finding of findings) {
    score += findingRiskWeight[finding.severity];
  }

  score += Math.min(25, metrics.costWithoutSuccessCents / 500);
  score += Math.min(20, metrics.stuckGenerationsCount * 10);
  if (metrics.failRate24hPercent >= 10) {
    score += Math.min(15, metrics.failRate24hPercent / 2);
  }
  if (
    metrics.reservedWithProviderOver1hCount > 0 ||
    metrics.reservedWithoutProviderOver15mCount > 0
  ) {
    score += 10;
  }
  if (metrics.partialData) {
    score += 5;
  }

  return clampRiskScore(score);
};

/**
 * Evaluate one user's fleet-health metrics into findings, risk score, and next actions.
 */
export const evaluateFleetUserHealth = (metrics: FleetUserMetricInput): FleetUserEvaluation => {
  const findings: FleetFinding[] = [];

  if (
    metrics.reservedWithProviderOver1hCount > 0 ||
    metrics.reservedWithoutProviderOver15mCount > 0
  ) {
    addFinding(
      findings,
      "critical",
      "high",
      "ACTIVE_RESERVED_HOLDS",
      "Aged active reservation holds detected.",
      `${metrics.reservedWithProviderOver1hCount} provider-attached holds are older than 1h and ${metrics.reservedWithoutProviderOver15mCount} pre-submit holds are older than 15m.`,
      [
        "Run /api/internal/generation-recovery/run and re-check hold counts.",
        "Use /admin/generation-trace for affected request_id/source_ref rows.",
      ]
    );
  }

  if (metrics.stuckGenerationsCount > 0) {
    addFinding(
      findings,
      "critical",
      "high",
      "STUCK_GENERATIONS",
      "Stuck generations detected.",
      `${metrics.stuckGenerationsCount} generation rows are older than 1h in queued/recovering states.`,
      [
        "Inspect one affected row in /admin/generation-trace.",
        "Replay targeted rows with /api/admin/generation-recovery/replay.",
      ]
    );
  }

  if (metrics.totalCount24h >= 10 && metrics.failRate24hPercent >= 10) {
    addFinding(
      findings,
      "warning",
      "medium",
      "HIGH_FAIL_RATE_24H",
      "24h generation fail rate is elevated.",
      `${metrics.failCount24h}/${metrics.totalCount24h} runs failed in 24h (${metrics.failRate24hPercent.toFixed(2)}%).`,
      [
        "Break down failures by model/provider and compare against known incidents.",
        "Use /admin/errors and /admin/generation-trace for correlated request IDs.",
      ]
    );
  }

  if (metrics.costWithoutSuccessLinkedCents > 0) {
    addFinding(
      findings,
      "warning",
      "high",
      "CHARGED_LINKED_NON_SUCCESS_GENERATION",
      "Charges linked to non-success generation outcomes.",
      `${metrics.costWithoutSuccessLinkedCents} credits are linked to non-success generation rows within lookback.`,
      [
        "Inspect source_ref rows in /admin/generation-trace and confirm settlement lifecycle.",
        "Prepare targeted credit adjustment only if customer impact is confirmed.",
      ]
    );
  }

  if (metrics.costWithoutSuccessMissingLinkageCents > 0) {
    addFinding(
      findings,
      "warning",
      "medium",
      "CHARGED_MISSING_LINKAGE_DATA",
      "Charged rows with incomplete linkage data.",
      `${metrics.costWithoutSuccessMissingLinkageCents} credits cannot be confidently linked to successful generations within lookback.`,
      [
        "Validate source_ref linkage in /admin/generation-trace.",
        "Review reservation/ledger idempotency for affected source_ref keys.",
      ]
    );
  }

  if (metrics.exhaustedQueueCount > 0) {
    addFinding(
      findings,
      metrics.exhaustedQueueCount >= 25 ? "warning" : "info",
      metrics.exhaustedQueueCount >= 25 ? "medium" : "low",
      "EXHAUSTED_QUEUE_ROWS",
      "Exhausted queue rows present.",
      `${metrics.exhaustedQueueCount} exhausted queue rows were observed in the lookback window.`,
      [
        "Confirm exhausted rows are expected historical artifacts.",
        "If fresh/excessive, inspect queue dispatch limits and provider availability.",
      ]
    );
  }

  for (const warning of metrics.compatibilityWarnings) {
    addFinding(
      findings,
      "info",
      "high",
      "COMPATIBILITY_WARNING",
      "Partial compatibility fallback used.",
      warning,
      ["Review schema parity and rerun fleet scan after alignment."]
    );
  }

  if (!findings.length) {
    addFinding(
      findings,
      "info",
      "medium",
      "HEALTHY_BASELINE",
      "No high-risk health signals detected.",
      "No stuck rows, aged holds, or cost-without-success leakage were detected in this fleet snapshot.",
      ["Continue routine monitoring and rerun after major incidents."]
    );
  }

  const highestSeverity = resolveHighestSeverity(findings);
  const riskScore = resolveRiskScore({ metrics, findings });
  const riskBand = resolveRiskBand(riskScore);
  const nextSteps = pushUnique(findings.flatMap((finding) => finding.recommendedActions)).slice(
    0,
    8
  );

  return {
    highestSeverity,
    findings,
    riskScore,
    riskBand,
    nextSteps,
  };
};
