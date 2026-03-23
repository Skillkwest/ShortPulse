/**
 * Runtime flags for admin user-health fleet automation.
 */

export type AdminUserHealthFleetRuntimeFlags = {
  enabled: boolean;
  cronSecret: string | null;
  lookbackDays: number;
  activeWindowDays: number;
  retentionDays: number;
  maxUsersPerRun: number;
  pageSize: number;
  timeBudgetMs: number;
  incidentsEnabled: boolean;
  criticalRiskThreshold: number;
  warningCostWithoutSuccessThresholdCents: number;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const parseInteger = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

/**
 * Read environment-driven runtime config for fleet scans.
 */
export const readAdminUserHealthFleetRuntimeFlags = (): AdminUserHealthFleetRuntimeFlags => {
  return {
    enabled: parseBoolean(process.env.SHORTPULSE_USER_HEALTH_FLEET_ENABLED, false),
    cronSecret: process.env.SHORTPULSE_USER_HEALTH_FLEET_CRON_SECRET?.trim() || null,
    lookbackDays: parseInteger(process.env.SHORTPULSE_USER_HEALTH_FLEET_LOOKBACK_DAYS, 30, 1, 90),
    activeWindowDays: parseInteger(
      process.env.SHORTPULSE_USER_HEALTH_FLEET_ACTIVE_WINDOW_DAYS,
      30,
      1,
      90
    ),
    retentionDays: parseInteger(
      process.env.SHORTPULSE_USER_HEALTH_FLEET_RETENTION_DAYS,
      90,
      7,
      3650
    ),
    maxUsersPerRun: parseInteger(
      process.env.SHORTPULSE_USER_HEALTH_FLEET_MAX_USERS_PER_RUN,
      1000,
      1,
      5000
    ),
    pageSize: parseInteger(process.env.SHORTPULSE_USER_HEALTH_FLEET_PAGE_SIZE, 100, 25, 500),
    timeBudgetMs: parseInteger(
      process.env.SHORTPULSE_USER_HEALTH_FLEET_TIME_BUDGET_MS,
      5 * 60 * 1000,
      30_000,
      30 * 60 * 1000
    ),
    incidentsEnabled: parseBoolean(
      process.env.SHORTPULSE_USER_HEALTH_FLEET_INCIDENTS_ENABLED,
      false
    ),
    criticalRiskThreshold: parseInteger(
      process.env.SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_CRITICAL_RISK,
      80,
      1,
      100
    ),
    warningCostWithoutSuccessThresholdCents: parseInteger(
      process.env.SHORTPULSE_ADMIN_ALERT_USER_HEALTH_FLEET_WARNING_COST_WITHOUT_SUCCESS_CENTS,
      2000,
      1,
      1_000_000_000
    ),
  };
};
