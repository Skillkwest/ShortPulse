/**
 * Shared types for admin dashboard data contracts.
 */

export type AdminUserRow = {
  id: string;
  email: string | null;
  planId: string | null;
  subscriptionStatus: string | null;
  credits: number;
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
  lastHourCount: number;
  last24hCount: number;
  app24hCount: number;
  generation24hCount: number;
  high24hCount: number;
  total15mThreshold: number;
  high15mThreshold: number;
  generation15mThreshold: number;
  total15mBreached: boolean;
  high15mBreached: boolean;
  generation15mBreached: boolean;
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
