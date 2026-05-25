export const ISSUE_REPORT_STATUS_VALUES = ["new", "reviewing", "resolved"] as const;

export type IssueReportStatus = (typeof ISSUE_REPORT_STATUS_VALUES)[number];

export const ISSUE_REPORT_MESSAGE_MAX_LENGTH = 4000;
export const ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH = 4000;
export const ISSUE_REPORT_EMAIL_MAX_LENGTH = 320;
export const ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH = 1024;
export const ISSUE_REPORT_USER_AGENT_MAX_LENGTH = 1000;
export const ISSUE_REPORT_PAGE_SIZE = 50;

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const toRelativePath = (value: unknown): string | null => {
  const normalized = toTrimmedString(value);
  if (!normalized || !normalized.startsWith("/")) return null;
  return normalized.slice(0, ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH);
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
    return `${parsedReferrer.pathname}${parsedReferrer.search}`.slice(
      0,
      ISSUE_REPORT_SOURCE_PATH_MAX_LENGTH
    );
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
  const explicitSourcePath = toRelativePath(Array.isArray(sourcePath) ? sourcePath[0] : sourcePath);
  if (explicitSourcePath) return explicitSourcePath;

  const fromSourcePath = toRelativePath(Array.isArray(from) ? from[0] : from);
  if (fromSourcePath) return fromSourcePath;

  const referrerPath = toSameOriginReferrerPath(referrer, origin);
  if (referrerPath && referrerPath !== "/report-issue") {
    return referrerPath;
  }

  return toRelativePath(currentPath) ?? "/report-issue";
};

export const isIssueReportStatus = (value: unknown): value is IssueReportStatus =>
  typeof value === "string" && (ISSUE_REPORT_STATUS_VALUES as readonly string[]).includes(value);
