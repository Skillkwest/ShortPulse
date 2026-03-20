/**
 * Shared server-side types for admin user-health diagnostics.
 */

export type FleetFindingSeverity = "info" | "warning" | "critical";
export type FleetFindingConfidence = "low" | "medium" | "high";

export type FleetFinding = {
  code: string;
  severity: FleetFindingSeverity;
  confidence: FleetFindingConfidence;
  summary: string;
  details: string;
  recommendedActions: string[];
};

export type FleetRiskBand = "low" | "medium" | "high";

export type FleetUserMetricInput = {
  userId: string;
  email: string | null;
  generatedAt: string;
  spendableCents: number;
  reservedCents: number;
  failRate24hPercent: number;
  failCount24h: number;
  totalCount24h: number;
  stuckGenerationsCount: number;
  exhaustedQueueCount: number;
  reservedWithProviderOver2hCount: number;
  reservedWithoutProviderOver15mCount: number;
  costWithoutSuccessCents: number;
  costWithoutSuccessLinkedCents: number;
  costWithoutSuccessMissingLinkageCents: number;
  partialData: boolean;
  compatibilityWarnings: string[];
};

export type FleetUserEvaluation = {
  highestSeverity: FleetFindingSeverity;
  findings: FleetFinding[];
  riskScore: number;
  riskBand: FleetRiskBand;
  nextSteps: string[];
};

export type FleetTargetUser = {
  userId: string;
  email: string | null;
  lastActivityAt: string | null;
};

export type FleetSnapshotDraft = {
  userId: string;
  userEmail: string | null;
  generatedAt: string;
  highestSeverity: FleetFindingSeverity;
  riskScore: number;
  spendableCents: number;
  reservedCents: number;
  failRate24hPercent: number;
  failCount24h: number;
  totalCount24h: number;
  stuckGenerationsCount: number;
  exhaustedQueueCount: number;
  costWithoutSuccessCents: number;
  costWithoutSuccessLinkedCents: number;
  costWithoutSuccessMissingLinkageCents: number;
  partialData: boolean;
  findingCount: number;
  findings: FleetFinding[];
  nextSteps: string[];
  metadata: Record<string, unknown>;
};

export type FleetRunStatus = "running" | "completed" | "partial" | "failed";

export type FleetRunDrainage = {
  enabled: boolean;
  scanned: number;
  released: number;
  errors: number;
};

export type FleetRunRow = {
  id: string;
  triggerSource: "scheduled" | "manual";
  status: FleetRunStatus;
  lookbackDays: number;
  activeWindowDays: number;
  retentionDays: number;
  targetCount: number;
  processedCount: number;
  failedCount: number;
  partialData: boolean;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorSummary: string | null;
  metadata: Record<string, unknown> | null;
  drainage: FleetRunDrainage;
};

export type FleetSummary = {
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalCostWithoutSuccessCents: number;
  totalStuckGenerations: number;
  totalExhaustedQueueRows: number;
};

export type FleetSnapshotRecord = {
  id: string;
  userId: string;
  userEmail: string | null;
  generatedAt: string;
  highestSeverity: FleetFindingSeverity;
  riskScore: number;
  riskBand: FleetRiskBand;
  spendableCents: number;
  reservedCents: number;
  failRate24hPercent: number;
  failCount24h: number;
  totalCount24h: number;
  stuckGenerationsCount: number;
  exhaustedQueueCount: number;
  costWithoutSuccessCents: number;
  costWithoutSuccessLinkedCents: number;
  costWithoutSuccessMissingLinkageCents: number;
  partialData: boolean;
  findingCount: number;
  findings: FleetFinding[];
};
