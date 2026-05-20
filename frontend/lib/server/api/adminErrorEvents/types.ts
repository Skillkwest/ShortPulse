/**
 * Shared contracts for admin error-events query/filter/summary helpers.
 */

export type EventQuery = {
  eq: (column: string, value: string) => EventQuery;
  like: (column: string, value: string) => EventQuery;
  not: (column: string, operator: string, value: string) => EventQuery;
  gte: (column: string, value: string) => EventQuery;
  is: (column: string, value: null) => EventQuery;
  or: (filters: string) => EventQuery;
};

export type ListQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type CountQueryResult = {
  count: number | null;
  error: { message: string } | null;
};

export type EventRow = {
  id?: string;
  incident_id?: string | null;
  [key: string]: unknown;
};

export type IncidentStatusRow = {
  id: string;
  status: "open" | "resolved" | "ignored";
};

export type SyntheticFilterValue = "all" | "only" | "exclude";

export type SignalFilterValue =
  | "all"
  | "character_mode_reference_refresh_empty"
  | "character_mode_bundle_unavailable_fallback"
  | "provider_running_timeout"
  | "project_workspace_repair_pending";

export type IncidentFilterValue =
  | "all"
  | "actionable"
  | "open"
  | "resolved"
  | "ignored"
  | "unlinked";

export type AdmissionDimensionCounts = Record<string, number>;

export type AdmissionWindowSummary = {
  total: number;
  byTier: AdmissionDimensionCounts;
  byReason: AdmissionDimensionCounts;
  byScope: AdmissionDimensionCounts;
};

export type AdmissionSummary = {
  last15m: AdmissionWindowSummary;
  lastHour: AdmissionWindowSummary;
  last24h: AdmissionWindowSummary;
};

export type ErrorEventsHealth = {
  eventsTableAvailable: boolean;
  degraded: boolean;
  reason: string | null;
};

export type EnrichedEventsResult = {
  events: unknown[];
  degraded: boolean;
  reason: string | null;
};

export type EventFilterInput = {
  scope: string;
  severity: string;
  source: string;
  search: string;
  synthetic: SyntheticFilterValue;
  signal: SignalFilterValue;
  incident: IncidentFilterValue;
  excludeTelemetrySources: boolean;
  excludeGrowthTelemetrySources?: boolean;
};
