/**
 * Shared types for admin dashboard data contracts.
 */

export type AdminUserRow = {
  id: string;
  email: string | null;
  planId: string | null;
  subscriptionStatus: string | null;
  credits: number;
  availableCredits: number;
  reservedCredits: number;
  spendableCredits: number;
  createdAt: string | null;
};

export type AdminErrorStatus = "open" | "ignored" | "resolved";

export type AdminErrorLogRow = {
  id: string;
  fingerprint: string;
  source: string;
  scope: "app" | "generation";
  severity: "low" | "medium" | "high";
  status: AdminErrorStatus;
  message: string;
  stack: string | null;
  route: string | null;
  endpoint: string | null;
  requestId: string | null;
  httpStatus: number | null;
  userId: string | null;
  userEmail: string | null;
  metadata: Record<string, unknown> | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  occurrencesCount: number;
};

export type AdminErrorSummary = {
  openCount: number;
  highSeverityOpenCount: number;
  last24hCount: number;
  appOpenCount: number;
  generationOpenCount: number;
};

export type AdminErrorEventRow = {
  id: string;
  incidentId: string | null;
  incidentStatus: AdminErrorStatus | null;
  fingerprint: string;
  source: string;
  scope: "app" | "generation";
  severity: "low" | "medium" | "high";
  message: string;
  stack: string | null;
  route: string | null;
  endpoint: string | null;
  requestId: string | null;
  httpStatus: number | null;
  userId: string | null;
  userEmail: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string | null;
  createdAt: string | null;
};

export type AdminErrorEventSummary = {
  last15mCount: number;
  high15mCount: number;
  generation15mCount: number;
  providerRunningTimeout15mCount: number;
  lastHourCount: number;
  last24hCount: number;
  app24hCount: number;
  generation24hCount: number;
  high24hCount: number;
  characterModeReferenceRefreshEmptyLastHourCount: number;
  characterModeReferenceRefreshEmptyLast24hCount: number;
  characterModeBundleUnavailableFallbackLastHourCount: number;
  characterModeBundleUnavailableFallbackLast24hCount: number;
  total15mThreshold: number;
  high15mThreshold: number;
  generation15mThreshold: number;
  providerRunningTimeout15mThreshold: number;
  total15mBreached: boolean;
  high15mBreached: boolean;
  generation15mBreached: boolean;
  providerRunningTimeout15mBreached: boolean;
};

export type AdminErrorEventSignalFilter =
  | "all"
  | "character_mode_reference_refresh_empty"
  | "character_mode_bundle_unavailable_fallback"
  | "provider_running_timeout";

export type AdminErrorEventIncidentFilter =
  | "all"
  | "actionable"
  | "open"
  | "resolved"
  | "ignored"
  | "unlinked";

export type AdminErrorEventsHealth = {
  eventsTableAvailable: boolean;
  degraded: boolean;
  reason: string | null;
};

export type AdminPagination = {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type AdminCreditPricingBreakdown = {
  usdRaw: number | null;
  rawCredits: number | null;
  billedCredits: number | null;
  billedUsd: number | null;
};

export type AdminCreditLedgerRow = {
  id: string;
  userId: string;
  changeCents: number;
  reason: string;
  source: string;
  sourceRef: string | null;
  pricingBreakdown: AdminCreditPricingBreakdown | null;
  createdAt: string | null;
};

export type AdminAccessVia = "role" | "allowlist" | "none";

export type AdminAccessResponse =
  | {
      ok: true;
      isAdmin: true;
      accessVia: Exclude<AdminAccessVia, "none">;
      user: {
        id: string;
        email: string | null;
      };
    }
  | {
      ok: true;
      isAdmin: false;
      accessVia: "none";
    };

export type AdminDashboardAnnouncement = {
  id: string;
  title: string;
  message: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

export type AdminHealthFindingSeverity = "info" | "warning" | "critical";
export type AdminHealthFindingConfidence = "high" | "medium" | "low";

export type AdminHealthFinding = {
  code: string;
  severity: AdminHealthFindingSeverity;
  confidence: AdminHealthFindingConfidence;
  summary: string;
  details: string;
  recommendedActions: string[];
};

export type AdminHealthWindowSummary = {
  window: "24h" | "7d" | "30d";
  totalDebitCents: number;
  generationDebitCents: number;
  nonGenerationDebitCents: number;
  avgPerDayCents: number;
};

export type AdminUserHealthResponse = {
  generatedAt: string;
  lookbackDays: number;
  target: {
    lookup: string;
    lookupMode: "auto" | "email" | "user_id";
    userId: string;
    email: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
  compatibility: {
    generationsSelectUsed: string;
    reservationsSupported: boolean;
    queueSupported: boolean;
    ledgerLegacySchema: boolean;
    warnings: string[];
  };
  credits: {
    availableCents: number;
    reservedCents: number;
    spendableCents: number;
    balanceUpdatedAt: string | null;
    totalGrantsCents: number;
    totalDebitsCentsAbs: number;
    generationDebitsCentsAbs: number;
  };
  drainage: {
    windows: AdminHealthWindowSummary[];
    dailyDebits: Array<{
      day: string;
      totalDebitCents: number;
      generationDebitCents: number;
    }>;
    topDebitSources: Array<{ source: string; cents: number }>;
    costWithoutSuccessfulGeneration: {
      debitCents: number;
      rowCount: number;
      sample: Array<{
        sourceRef: string | null;
        amountCents: number;
        reason: string;
        generationStatus: string | null;
        bucket: "linked_non_success_generation" | "missing_linkage_data";
      }>;
      linkedNonSuccessGeneration: {
        debitCents: number;
        rowCount: number;
        sample: Array<{
          sourceRef: string | null;
          amountCents: number;
          reason: string;
          generationStatus: string | null;
        }>;
      };
      missingLinkageData: {
        debitCents: number;
        rowCount: number;
        sample: Array<{
          sourceRef: string | null;
          amountCents: number;
          reason: string;
          generationStatus: string | null;
        }>;
      };
    };
  };
  generations: {
    total: number;
    byStatus: Record<string, number>;
    last24h: { total: number; success: number; fail: number; failRatePercent: number };
    last7d: { total: number; success: number; fail: number; failRatePercent: number };
    last30d: { total: number; success: number; fail: number; failRatePercent: number };
    topFailReasonsLookback: Array<{ reason: string; count: number }>;
    stuckOver2hCount: number;
    stuckOver2hSample: Array<{
      id: string;
      status: string | null;
      recoveryState: string | null;
      requestId: string | null;
      modelId: string | null;
      createdAt: string | null;
      ageHours: number | null;
      nextRecoveryAt: string | null;
    }>;
  };
  reservations: {
    total: number;
    byStatus: Record<string, number>;
    reservedWithProviderOver2hCount: number;
    reservedWithoutProviderOver15mCount: number;
    topCapturedModels: Array<{ modelId: string; cents: number }>;
  };
  queue: {
    total: number;
    byStatus: Record<string, number>;
    exhaustedCount: number;
    exhaustedWithReleasedReservationCount: number;
    exhaustedWithChargeCount: number;
    oldestCreatedAt: string | null;
    recentExhaustedSample: Array<{
      queueId: string;
      sourceRef: string | null;
      modelId: string | null;
      errorCode: string | null;
      generationStatus: string | null;
      reservationStatus: string | null;
      chargeCount: number;
      createdAt: string | null;
    }>;
  };
  findings: AdminHealthFinding[];
  nextSteps: string[];
};

export type AdminUserHealthFleetRiskBand = "low" | "medium" | "high";

export type AdminUserHealthFleetRun = {
  id: string;
  triggerSource: "scheduled" | "manual";
  status: "running" | "completed" | "partial" | "failed";
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
  drainage: {
    enabled: boolean;
    scanned: number;
    released: number;
    errors: number;
  };
};

export type AdminUserHealthFleetSnapshot = {
  id: string;
  userId: string;
  userEmail: string | null;
  generatedAt: string;
  highestSeverity: AdminHealthFindingSeverity;
  riskScore: number;
  riskBand: AdminUserHealthFleetRiskBand;
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
  findings: AdminHealthFinding[];
};

export type AdminUserHealthFleetSummary = {
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

export type AdminUserHealthFleetResponse = {
  run: AdminUserHealthFleetRun | null;
  summary: AdminUserHealthFleetSummary;
  snapshots: AdminUserHealthFleetSnapshot[];
  pagination: AdminPagination;
  health: {
    degraded: boolean;
    reason: string | null;
  };
  filters: {
    runId: string | null;
    severity: "all" | "critical" | "warning" | "info";
    findingCode: string;
    riskBand: "all" | AdminUserHealthFleetRiskBand;
    search: string;
  };
};
