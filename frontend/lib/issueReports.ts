export const ISSUE_REPORT_STATUS_VALUES = ["new", "reviewing", "resolved"] as const;

export type IssueReportStatus = (typeof ISSUE_REPORT_STATUS_VALUES)[number];

export const ISSUE_REPORT_MESSAGE_MAX_LENGTH = 4000;
export const ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH = 4000;
export const ISSUE_REPORT_EMAIL_MAX_LENGTH = 320;
export const ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH = 1024;
export const ISSUE_REPORT_USER_AGENT_MAX_LENGTH = 1000;
export const ISSUE_REPORT_PAGE_SIZE = 50;
export const ISSUE_REPORT_SCREENSHOT_BUCKET = "issue_report_screenshots";
export const ISSUE_REPORT_SCREENSHOT_MAX_COUNT = 3;
export const ISSUE_REPORT_SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024;
export const ISSUE_REPORT_SCREENSHOT_FILENAME_MAX_LENGTH = 255;
export const ISSUE_REPORT_SCREENSHOT_SIGNED_URL_TTL_SECONDS = 60 * 60;
export const ISSUE_REPORT_SCREENSHOT_ORPHAN_CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;
export const ISSUE_REPORT_SCREENSHOT_ORPHAN_CLEANUP_LIMIT = 50;
export const ISSUE_REPORT_SCREENSHOT_MIME_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type IssueReportScreenshotMimeType = (typeof ISSUE_REPORT_SCREENSHOT_MIME_TYPES)[number];

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

export const normalizeIssueReportSourcePath = (value: unknown): string | null => {
  const normalized = toTrimmedString(value);
  if (!normalized || !normalized.startsWith("/") || normalized.startsWith("//")) return null;
  if (normalized.length > ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH) return null;
  return normalized;
};

const toSameOriginReferrerPath = (
  referrer: unknown,
  origin: string | null | undefined
): string | null => {
  const normalizedReferrer = toTrimmedString(referrer);
  if (!normalizedReferrer) return null;
  try {
    const parsedReferrer = new URL(normalizedReferrer);
    if (origin) {
      const parsedOrigin = new URL(origin);
      if (parsedReferrer.origin !== parsedOrigin.origin) {
        return null;
      }
    }
    return normalizeIssueReportSourcePath(`${parsedReferrer.pathname}${parsedReferrer.search}`);
  } catch {
    return null;
  }
};

export const resolveIssueReportSourcePath = ({
  currentPath,
  sourcePath,
  from,
  referrer,
  origin,
}: {
  currentPath: string | null | undefined;
  sourcePath?: string | string[] | null;
  from?: string | string[] | null;
  referrer?: string | null;
  origin?: string | null;
}): string => {
  const explicitSourcePath = normalizeIssueReportSourcePath(
    Array.isArray(sourcePath) ? sourcePath[0] : sourcePath
  );
  if (explicitSourcePath) return explicitSourcePath;

  const fromSourcePath = normalizeIssueReportSourcePath(Array.isArray(from) ? from[0] : from);
  if (fromSourcePath) return fromSourcePath;

  const referrerPath = toSameOriginReferrerPath(referrer, origin);
  if (referrerPath && referrerPath !== "/report-issue") {
    return referrerPath;
  }

  return normalizeIssueReportSourcePath(currentPath) ?? "/report-issue";
};

export const isIssueReportStatus = (value: unknown): value is IssueReportStatus =>
  typeof value === "string" && (ISSUE_REPORT_STATUS_VALUES as readonly string[]).includes(value);

export const isIssueReportScreenshotMimeType = (
  value: unknown
): value is IssueReportScreenshotMimeType =>
  typeof value === "string" &&
  (ISSUE_REPORT_SCREENSHOT_MIME_TYPES as readonly string[]).includes(value);
