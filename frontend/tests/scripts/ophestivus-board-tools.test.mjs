import { describe, expect, it } from "vitest";
import { buildAppendedDetails, buildNote } from "../../scripts/ophestivus_append_ticket_note.mjs";
import { DEFAULT_ALLOWED_TARGETS, normalizeStatus } from "../../scripts/ophestivus_move_ticket.mjs";
import {
  buildApprovalNote,
  inferResidualRiskFromDetails,
} from "../../scripts/ophestivus_review.mjs";
import { buildRunLogMarkdown, slugify } from "../../scripts/ophestivus_run_log.mjs";

describe("ophestivus board helpers", () => {
  it("builds and compacts appended ticket notes", () => {
    const note = buildNote({ label: "Approval", note: "Passed validation ".repeat(20) });
    const result = buildAppendedDetails("Existing details", note, {
      compact: true,
      maxLength: 120,
    });

    expect(result.ok).toBe(true);
    expect(result.compacted).toBe(true);
    expect(result.details.length).toBeLessThanOrEqual(120);
    expect(result.details).toContain("Existing details");
    expect(result.details).toContain("Approval:");
  });

  it("blocks notes when existing details leave no useful room", () => {
    const result = buildAppendedDetails("x".repeat(990), "Note:\nMore detail", {
      compact: true,
      maxLength: 1000,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/leave only/);
  });

  it("keeps published out of default move targets", () => {
    expect(normalizeStatus("review", "--status")).toBe("review");
    expect(DEFAULT_ALLOWED_TARGETS.has("published")).toBe(false);
    expect(() => normalizeStatus("bad", "--status")).toThrow(/must be one of/);
  });

  it("carries ticket residual risk into review approval notes", () => {
    const ticketDetails = [
      "Incident: inc-1",
      "Residual risk: monitor - Visible and production failures remain actionable.",
      "Report: docs/records/artifacts/agent/ophestivus/reports/run.md",
    ].join("\n");

    expect(inferResidualRiskFromDetails(ticketDetails)).toBe(
      "monitor - Visible and production failures remain actionable."
    );
    expect(buildApprovalNote({ ticketDetails })).toContain(
      "Residual risk: monitor - Visible and production failures remain actionable."
    );
  });

  it("supports two-line residual risk summary templates", () => {
    const ticketDetails = [
      "Residual risk classification: Follow-up",
      "Residual risk: Needs a separate cleanup ticket.",
    ].join("\n");

    expect(inferResidualRiskFromDetails(ticketDetails)).toBe(
      "Follow-up - Needs a separate cleanup ticket."
    );
  });

  it("builds local run log markdown", () => {
    const markdown = buildRunLogMarkdown({
      title: "Failed to fetch",
      ticketId: "6b3e6fe7-3e53-4814-987b-f9aa5e8ea34b",
      incidentId: "ef12f5e7-f714-47e2-992f-e5d478647928",
      status: "complete",
      summary: "Resolved hidden local fetch noise.",
      changes: "Added skip rule.",
      validation: "Tests passed.",
      risk: "Monitor.",
      createdAt: "2026-05-01T00:00:00.000Z",
    });

    expect(slugify("Failed to fetch!")).toBe("failed-to-fetch");
    expect(markdown).toContain("# Failed to fetch");
    expect(markdown).toContain("Ticket: 6b3e6fe7-3e53-4814-987b-f9aa5e8ea34b");
    expect(markdown).toContain("## Validation");
  });
});
