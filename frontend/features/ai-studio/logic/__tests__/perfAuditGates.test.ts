import { describe, expect, it } from "vitest";
import {
  evaluateReferenceGridAuditGates,
  evaluateStudioShellAuditGates,
  type ReferenceGridScenario,
  type StudioShellScenario,
} from "../perfAuditGates";

const REFERENCE_THRESHOLDS = {
  clickP95MsAt500: 120,
  longTaskP95MsAt500: 120,
  maxInputStallMsAt500: 1000,
  heapGrowthRatio100To500: 3,
};

const SHELL_THRESHOLDS = {
  toolbarP95MsAt50: 120,
  panelP95MsAt50: 140,
  dropP95MsAt50: 140,
  longTaskP95Ms: 120,
  maxInputStallMs: 1000,
};

describe("perfAuditGates", () => {
  it("treats missing long-task samples as pass-with-note for shell gates", () => {
    const scenarios: StudioShellScenario[] = [
      {
        count: 50,
        toolbar: { samples: 10, p95Ms: 80 },
        panel: { samples: 10, p95Ms: 90 },
        drop: { samples: 10, p95Ms: 70 },
        longTask: { samples: 0, p95Ms: null },
        interaction: { maxInputStallMs: 40 },
      },
    ];
    const gates = evaluateStudioShellAuditGates(scenarios, SHELL_THRESHOLDS);
    const longTaskGate = gates.find(
      (gate) => gate.name === "long_task_p95_ms_during_shell_actions"
    );
    expect(longTaskGate?.pass).toBe(true);
    expect(longTaskGate?.note).toContain("No long tasks observed");
  });

  it("fails shell gates when p95 exceeds thresholds", () => {
    const scenarios: StudioShellScenario[] = [
      {
        count: 50,
        toolbar: { samples: 10, p95Ms: 240 },
        panel: { samples: 10, p95Ms: 240 },
        drop: { samples: 10, p95Ms: 240 },
        longTask: { samples: 2, p95Ms: 240 },
        interaction: { maxInputStallMs: 1200 },
      },
    ];
    const gates = evaluateStudioShellAuditGates(scenarios, SHELL_THRESHOLDS);
    expect(gates.every((gate) => gate.pass)).toBe(false);
  });

  it("fails heap-growth gate when memory sampling is unavailable", () => {
    const scenarios: ReferenceGridScenario[] = [
      {
        count: 100,
        click: { samples: 10, p95Ms: 60 },
        longTask: { samples: 3, p95Ms: 80 },
        interaction: { maxInputStallMs: 50 },
        memory: { beforeMb: null, afterMb: null },
      },
      {
        count: 500,
        click: { samples: 10, p95Ms: 90 },
        longTask: { samples: 3, p95Ms: 90 },
        interaction: { maxInputStallMs: 70 },
        memory: { beforeMb: null, afterMb: null },
      },
    ];
    const gates = evaluateReferenceGridAuditGates(scenarios, REFERENCE_THRESHOLDS);
    const heapGate = gates.find((gate) => gate.name === "heap_growth_ratio_100_to_500");
    expect(heapGate?.pass).toBe(false);
    expect(heapGate?.note).toContain("JS heap sampling unavailable");
  });
});
