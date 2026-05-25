import { describe, expect, it } from "vitest";
import {
  normalizeIssueReportSourcePath,
  resolveIssueReportSourcePath,
} from "../../lib/issueReports";

describe("resolveIssueReportSourcePath", () => {
  it("prefers an explicit sourcePath query value over the report page route", () => {
    expect(
      resolveIssueReportSourcePath({
        currentPath: "/report-issue?sourcePath=%2Fdashboard",
        sourcePath: "/dashboard",
        from: null,
        referrer: "https://shortpulse.ai/profile",
        origin: "https://shortpulse.ai",
      })
    ).toBe("/dashboard");
  });

  it("falls back to a same-origin referrer when the page was opened directly", () => {
    expect(
      resolveIssueReportSourcePath({
        currentPath: "/report-issue",
        sourcePath: null,
        from: null,
        referrer: "https://shortpulse.ai/projects/abc?tab=media",
        origin: "https://shortpulse.ai",
      })
    ).toBe("/projects/abc?tab=media");
  });

  it("ignores external referrers and falls back to the current page path", () => {
    expect(
      resolveIssueReportSourcePath({
        currentPath: "/report-issue",
        sourcePath: null,
        from: null,
        referrer: "https://example.com/help",
        origin: "https://shortpulse.ai",
      })
    ).toBe("/report-issue");
  });

  it("rejects protocol-relative and oversized source paths", () => {
    expect(normalizeIssueReportSourcePath("//evil.example/path")).toBeNull();
    expect(normalizeIssueReportSourcePath(`/${"a".repeat(1024)}`)).toBeNull();
  });
});
