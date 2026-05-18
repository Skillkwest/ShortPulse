import { describe, expect, it } from "vitest";
import {
  buildIncidentBrief,
  buildTrainingDatasetSummary,
  parseArgs,
  validateTrainingDataset,
} from "../create_workflow_training_data.mjs";

const createDataset = () => ({
  baseDir: "/tmp/create-workflow-training-data",
  incidents: [
    {
      incident_id: "incident-1",
      agent: "Create Workflow",
      surface: "ai-studio-create-composer",
      source_surfaces: ["reference-grid"],
      modes_affected: ["standard"],
      symptoms: ["flash-then-dark-chip"],
      pattern_tags: ["pattern-1"],
      local_validation_status: "tests passed",
      production_status: "unresolved",
      evidence_status: "missing live capture",
      current_best_hypothesis: "post-drop overwrite",
      next_step: "capture runtime state",
      source_report: "report.md",
    },
  ],
  decisions: [
    {
      episode_id: "episode-1",
      incident_id: "incident-1",
      category: "strategy-pivot",
      context: "local tests passed",
      observed_evidence: ["tests passed", "prod failed"],
      options_considered: ["patch more", "capture runtime"],
      chosen_action: "capture runtime",
      reasoning: "production contradicted local validation",
      outcome: "tooling added",
      lesson: "switch to runtime evidence",
    },
  ],
  attempts: [
    {
      attempt_id: "attempt-1",
      incident_id: "incident-1",
      hypothesis: "single brittle preview source",
      intervention: "added fallback",
      validation: "targeted tests",
      local_result: "passed",
      production_result: "still broken",
      verdict: "helpful-but-incomplete",
      lesson: "local pass is not production proof",
    },
  ],
  patterns: [
    {
      pattern_id: "pattern-1",
      name: "preview-source-overwritten-after-initial-render",
      description: "later write removes preview",
      symptoms: ["flash-then-dark-chip"],
      misleading_signals: ["first render appears fine"],
      confirming_evidence: ["preview_resolved_source_changed goes to null"],
      standard_next_capture: "capture before and after state",
    },
  ],
});

describe("create_workflow_training_data", () => {
  it("parses CLI args", () => {
    expect(parseArgs([])).toEqual({ mode: "summary", incidentId: null });
    expect(parseArgs(["--validate"])).toEqual({ mode: "validate", incidentId: null });
    expect(parseArgs(["--brief", "--incident-id", "incident-1"])).toEqual({
      mode: "brief",
      incidentId: "incident-1",
    });
  });

  it("validates a consistent dataset", () => {
    const validation = validateTrainingDataset(createDataset());

    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it("detects missing incident references", () => {
    const dataset = createDataset();
    dataset.attempts[0].incident_id = "missing-incident";

    const validation = validateTrainingDataset(dataset);

    expect(validation.valid).toBe(false);
    expect(validation.issues[0]).toContain("references unknown incident_id");
  });

  it("builds a compact dataset summary", () => {
    const summary = buildTrainingDatasetSummary(createDataset());

    expect(summary.incidentCount).toBe(1);
    expect(summary.decisionCategories["strategy-pivot"]).toBe(1);
    expect(summary.attemptVerdicts["helpful-but-incomplete"]).toBe(1);
    expect(summary.patternCount).toBe(1);
    expect(summary.incidentPatternTags["pattern-1"]).toBe(1);
    expect(summary.unresolvedIncidents).toEqual(["incident-1"]);
  });

  it("builds an incident brief", () => {
    const brief = buildIncidentBrief(createDataset(), "incident-1");

    expect(brief).toContain("# Incident Brief: incident-1");
    expect(brief).toContain("flash-then-dark-chip");
    expect(brief).toContain("Pattern tags: pattern-1");
    expect(brief).toContain("capture runtime");
    expect(brief).toContain("helpful-but-incomplete");
  });
});
