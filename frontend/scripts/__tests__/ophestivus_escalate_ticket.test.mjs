import { describe, expect, it } from "vitest";
import {
  DETAILS_MAX_LENGTH,
  buildEscalationDetails,
  buildHumanReviewTitle,
} from "../ophestivus_escalate_ticket.mjs";

describe("ophestivus escalate-ticket helper", () => {
  it("prefixes the issue title with the human-review marker once", () => {
    expect(buildHumanReviewTitle("Bad Gateway")).toBe("[HUMAN REVIEW] Bad Gateway");
    expect(buildHumanReviewTitle("[HUMAN REVIEW] Bad Gateway")).toBe(
      "[HUMAN REVIEW] Bad Gateway"
    );
  });

  it("builds a compact human-review handoff within board limits", () => {
    const details = buildEscalationDetails({
      type: "Production deploy",
      why: "Repo fix is ready but preview verification needs deploy.",
      checked: "incident, fingerprint status, route, wrapper, tests",
      tried: "added one immediate retry for transient 502/503/504 upstream failures",
      evidence: "api.exception on /api/elevenlabs/sound-effects with Bad Gateway",
      unresolved: "live preview verification after deploy",
      risk: "claiming resolution without deployment evidence",
      humanAction: "deploy branch to preview/staging and re-run the sound-effects flow",
      resume: "deployed build available for live verification",
      owner: "deploy owner / generation pipeline",
    });

    expect(details.startsWith("*** HUMAN REVIEW REQUIRED ***")).toBe(true);
    expect(details.length).toBeLessThanOrEqual(DETAILS_MAX_LENGTH);
  });

  it("compacts oversized inputs into a board-safe handoff", () => {
    const details = buildEscalationDetails({
      type: "x".repeat(500),
      why: "y".repeat(500),
      checked: "z".repeat(700),
      tried: "a".repeat(700),
      evidence: "b".repeat(700),
      unresolved: "c".repeat(700),
      risk: "d".repeat(700),
      humanAction: "e".repeat(700),
      resume: "f".repeat(700),
      owner: "g".repeat(500),
    });

    expect(details.length).toBeLessThanOrEqual(DETAILS_MAX_LENGTH);
    expect(details).toContain("Escalation type:");
  });
});
