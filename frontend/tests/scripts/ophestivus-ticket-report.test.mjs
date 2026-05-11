import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPROVAL_RESERVE,
  DETAILS_MAX_LENGTH,
  STALE_LOCAL_BUNDLE_NOTE,
  buildCompactTicketReport,
  validateCompactTicketReportEvidence,
} from "../../scripts/ophestivus_ticket_report.mjs";

describe("ophestivus ticket report formatter", () => {
  it("leaves room for the review approval note", () => {
    const report = buildCompactTicketReport({
      incidentId: "incident-1",
      issue: "A very long error message ".repeat(20),
      resolutionType: "verified-existing-fix",
      repoChanges: "Verified the current source and targeted tests. ".repeat(20),
      validation: "Vitest, ESLint, type-check, and smoke checks passed. ".repeat(20),
      verificationClass: "live-route-verified",
      recurrence: "0 open incidents and 0 fresh events after the SOP timestamp.",
      riskClass: "monitor",
      residualRisk: "Future recurrence should be caught by Admin Errors.",
      reportPath: "docs/records/artifacts/agent/ophestivus/reports/example.md",
    });

    expect(report.details.length).toBeLessThanOrEqual(
      DETAILS_MAX_LENGTH - DEFAULT_APPROVAL_RESERVE
    );
    expect(report.remainingForApproval).toBeGreaterThanOrEqual(DEFAULT_APPROVAL_RESERVE);
    expect(report.details).toContain("Resolution: Verified existing fix");
    expect(report.details).toContain("Verification class: live-route-verified");
    expect(report.details).toContain("Residual risk: monitor");
    expect(report.details).toContain("Report: docs/records/artifacts");
  });

  it("adds the standard stale local bundle note when requested", () => {
    const report = buildCompactTicketReport({
      incidentId: "incident-2",
      issue: "Local dev chunk used an old symbol.",
      resolutionType: "no-code",
      repoChanges: "No new code edit.",
      validation: "Smoke test passed.",
      verificationClass: "blocked-live-verification",
      recurrence: "No fresh events.",
      riskClass: "monitor",
      residualRisk: "Browser tab may still have stale chunks.",
      includeLocalDevNote: true,
    });

    expect(report.localDevNote).toBe(STALE_LOCAL_BUNDLE_NOTE);
    expect(report.details).toContain("Local dev note:");
  });

  it("preserves the full local report path when compacting long fields", () => {
    const reportPath =
      "docs/records/artifacts/agent/ophestivus/reports/2026-05-01-long-report-path-example-ticket-incident.md";

    const report = buildCompactTicketReport({
      incidentId: "incident-4",
      issue: "A very long issue summary ".repeat(20),
      resolutionType: "new-code",
      repoChanges: "A very long repo change summary. ".repeat(20),
      validation: "A very long validation summary. ".repeat(20),
      verificationClass: "tests-and-data-verified",
      recurrence: "A very long recurrence summary. ".repeat(20),
      riskClass: "monitor",
      residualRisk: "A very long residual risk summary. ".repeat(20),
      reportPath,
    });

    expect(report.details).toContain(`Report: ${reportPath}`);
    expect(report.details).not.toContain("Report: docs/records/artifact...");
    expect(report.details.length).toBeLessThanOrEqual(
      DETAILS_MAX_LENGTH - DEFAULT_APPROVAL_RESERVE
    );
  });

  it("preserves a normal reports path without manual shortening when space is tight", () => {
    const reportPath =
      "docs/records/artifacts/agent/ophestivus/reports/2026-05-10-project-workspace-autosave-retry.md";

    const report = buildCompactTicketReport({
      incidentId: "7aa4cf2b-1b26-483e-8966-91822ebb4c07",
      issue: "AI Studio project workspace autosave Failed to fetch",
      resolutionType: "new-code",
      repoChanges:
        "Enabled one-time network retry for project workspace save requests; added API client coverage.",
      validation:
        "projectWorkspaceApiClient/authenticatedFetch tests pass; eslint touched files pass; diff-check pass; type-check blocked by unrelated existing errors.",
      verificationClass: "tests-and-data-verified",
      recurrence: "0 open; 0 fresh after 2026-05-10T23:21:35Z",
      riskClass: "monitor",
      residualRisk:
        "Monitor visible localhost autosave recurrence; persistent API failures still surface.",
      reportPath,
      includeLocalDevNote: true,
    });

    expect(report.details).toContain(`Report: ${reportPath}`);
    expect(report.details).not.toContain("Report: docs/records/artifacts/agent/ophestivus/re...");
    expect(report.remainingForApproval).toBeGreaterThanOrEqual(DEFAULT_APPROVAL_RESERVE);
  });

  it("validates review-ready ticket summaries", () => {
    const reportPath = "docs/records/artifacts/agent/ophestivus/reports/example.md";
    const report = buildCompactTicketReport({
      incidentId: "incident-5",
      issue: "Issue",
      resolutionType: "new-code",
      repoChanges: "Change",
      validation: "Validation",
      verificationClass: "telemetry-filter-verified",
      recurrence: "Recurrence",
      riskClass: "monitor",
      residualRisk: "Risk",
      reportPath,
    });

    expect(
      validateCompactTicketReportEvidence(report, { requiredReportPath: reportPath })
    ).toEqual({ ok: true, errors: [] });
  });

  it("rejects missing or truncated report paths before Review", () => {
    const reportPath = "docs/records/artifacts/agent/ophestivus/reports/example.md";

    const missing = validateCompactTicketReportEvidence(
      {
        details: "Incident: incident-6\nReport: docs/records/artifact...",
        detailsLength: 55,
        maxLength: DETAILS_MAX_LENGTH,
        remainingForApproval: DEFAULT_APPROVAL_RESERVE,
      },
      { requiredReportPath: reportPath }
    );

    expect(missing.ok).toBe(false);
    expect(missing.errors).toContain(
      "Compact ticket summary does not include the full local report path."
    );
    expect(missing.errors).toContain("Compact ticket summary contains a truncated Report path.");
  });

  it("rejects unknown residual risk classifications", () => {
    expect(() =>
      buildCompactTicketReport({
        incidentId: "incident-3",
        issue: "Issue",
        resolutionType: "new-code",
        repoChanges: "Change",
        validation: "Validation",
        recurrence: "Recurrence",
        riskClass: "unknown",
        residualRisk: "Risk",
      })
    ).toThrow(/risk-class/);
  });

  it("rejects unknown verification classes", () => {
    expect(() =>
      buildCompactTicketReport({
        incidentId: "incident-7",
        issue: "Issue",
        resolutionType: "new-code",
        repoChanges: "Change",
        validation: "Validation",
        verificationClass: "browser-maybe",
        recurrence: "Recurrence",
        riskClass: "monitor",
        residualRisk: "Risk",
      })
    ).toThrow(/verification-class/);
  });
});
