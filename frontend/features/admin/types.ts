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

export type AdminErrorLogRow = {
  id: string;
  source: string;
  scope: "app" | "generation";
  severity: "low" | "medium" | "high";
  status: "open" | "ignored" | "resolved";
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
};
