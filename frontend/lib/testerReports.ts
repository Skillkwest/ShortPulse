/**
 * Shared tester-report contracts for admin ingestion and display.
 */
export const TESTER_REPORT_STATUS_VALUES = ["completed", "blocked", "failed", "partial"] as const;

export type TesterReportStatus = (typeof TESTER_REPORT_STATUS_VALUES)[number];

export const TESTER_REPORT_PAGE_SIZE = 25;
export const TESTER_REPORT_MAX_PAGE_SIZE = 100;
export const TESTER_REPORT_EXTERNAL_RUN_ID_MAX_LENGTH = 160;
export const TESTER_REPORT_TESTER_SLUG_MAX_LENGTH = 80;
export const TESTER_REPORT_TESTER_DISPLAY_NAME_MAX_LENGTH = 160;
export const TESTER_REPORT_EMAIL_MAX_LENGTH = 320;
export const TESTER_REPORT_SCENARIO_MAX_LENGTH = 500;
export const TESTER_REPORT_SURFACE_MAX_LENGTH = 1024;
export const TESTER_REPORT_TITLE_MAX_LENGTH = 180;
export const TESTER_REPORT_BODY_MAX_LENGTH = 50000;
export const TESTER_REPORT_SEARCH_MAX_LENGTH = 120;

const TESTER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isTesterReportStatus = (value: unknown): value is TesterReportStatus =>
  typeof value === "string" && (TESTER_REPORT_STATUS_VALUES as readonly string[]).includes(value);

export const normalizeTesterReportText = (
  value: unknown,
  maxLength: number,
  allowEmpty = false
): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized && !allowEmpty) return null;
  if (normalized.length > maxLength) return null;
  return normalized;
};

export const normalizeTesterSlug = (value: unknown): string | null => {
  const normalized = normalizeTesterReportText(value, TESTER_REPORT_TESTER_SLUG_MAX_LENGTH);
  if (!normalized) return null;
  const slug = normalized.toLowerCase();
  return TESTER_SLUG_PATTERN.test(slug) ? slug : null;
};

export const normalizeTesterReportUuid = (value: unknown): string | null => {
  const normalized = normalizeTesterReportText(value, 36, true);
  if (!normalized) return null;
  return UUID_PATTERN.test(normalized) ? normalized : null;
};

export const normalizeTesterReportStatus = (value: unknown): TesterReportStatus | null => {
  if (typeof value === "undefined" || value === null || value === "") return "completed";
  return isTesterReportStatus(value) ? value : null;
};

export const normalizeTesterReportSearch = (value: unknown): string => {
  const normalized = normalizeTesterReportText(value, TESTER_REPORT_SEARCH_MAX_LENGTH, true);
  if (!normalized) return "";
  return normalized
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};
