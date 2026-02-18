export type PerfGate = {
  name: string;
  pass: boolean;
  actual: number | null;
  expected: string;
  note?: string;
};

export type ReferenceGridScenario = {
  count: number;
  click: { samples: number; p95Ms: number | null };
  longTask: { samples: number; p95Ms: number | null };
  interaction: { maxInputStallMs: number };
  memory: { beforeMb: number | null; afterMb: number | null };
};

export type StudioShellScenario = {
  count: number;
  toolbar: { samples: number; p95Ms: number | null };
  panel: { samples: number; p95Ms: number | null };
  drop: { samples: number; p95Ms: number | null };
  longTask: { samples: number; p95Ms: number | null };
  interaction: { maxInputStallMs: number };
};

export const evaluateReferenceGridAuditGates = (
  scenarios: ReferenceGridScenario[],
  thresholds: {
    clickP95MsAt500: number;
    longTaskP95MsAt500: number;
    maxInputStallMsAt500: number;
    heapGrowthRatio100To500: number;
  }
): PerfGate[] => {
  const scenarioByCount = new Map(scenarios.map((scenario) => [scenario.count, scenario]));
  const s100 = scenarioByCount.get(100) ?? null;
  const s500 = scenarioByCount.get(500) ?? null;
  const gates: PerfGate[] = [];

  if (s500) {
    gates.push({
      name: "click_p95_ms_at_500",
      pass: typeof s500.click.p95Ms === "number" && s500.click.p95Ms <= thresholds.clickP95MsAt500,
      actual: s500.click.p95Ms,
      expected: `<= ${thresholds.clickP95MsAt500}`,
    });
    gates.push({
      name: "long_task_p95_ms_at_500",
      pass:
        typeof s500.longTask.p95Ms === "number" &&
        s500.longTask.p95Ms <= thresholds.longTaskP95MsAt500,
      actual: s500.longTask.p95Ms,
      expected: `<= ${thresholds.longTaskP95MsAt500}`,
    });
    gates.push({
      name: "max_input_stall_ms_at_500",
      pass: s500.interaction.maxInputStallMs <= thresholds.maxInputStallMsAt500,
      actual: s500.interaction.maxInputStallMs,
      expected: `<= ${thresholds.maxInputStallMsAt500}`,
    });
  } else {
    gates.push({
      name: "scenario_500_exists",
      pass: false,
      actual: null,
      expected: "500-card scenario must run",
    });
  }

  if (
    s100 &&
    s500 &&
    typeof s100.memory.afterMb === "number" &&
    typeof s500.memory.afterMb === "number" &&
    s100.memory.afterMb > 0
  ) {
    const ratio = Math.round((s500.memory.afterMb / s100.memory.afterMb) * 100) / 100;
    gates.push({
      name: "heap_growth_ratio_100_to_500",
      pass: ratio <= thresholds.heapGrowthRatio100To500,
      actual: ratio,
      expected: `<= ${thresholds.heapGrowthRatio100To500}`,
    });
  } else {
    gates.push({
      name: "heap_growth_ratio_100_to_500",
      pass: false,
      actual: null,
      expected: `<= ${thresholds.heapGrowthRatio100To500}`,
      note: "JS heap sampling unavailable for this browser/runtime.",
    });
  }

  return gates;
};

export const evaluateStudioShellAuditGates = (
  scenarios: StudioShellScenario[],
  thresholds: {
    toolbarP95MsAt50: number;
    panelP95MsAt50: number;
    dropP95MsAt50: number;
    longTaskP95Ms: number;
    maxInputStallMs: number;
  }
): PerfGate[] => {
  const scenarioByCount = new Map(scenarios.map((scenario) => [scenario.count, scenario]));
  const s50 = scenarioByCount.get(50) ?? scenarios[0] ?? null;
  const gates: PerfGate[] = [];

  if (!s50) {
    gates.push({
      name: "scenario_exists",
      pass: false,
      actual: null,
      expected: "At least one shell scenario must run.",
    });
    return gates;
  }

  gates.push({
    name: "toolbar_switch_p95_ms_at_50",
    pass: typeof s50.toolbar.p95Ms === "number" && s50.toolbar.p95Ms <= thresholds.toolbarP95MsAt50,
    actual: s50.toolbar.p95Ms,
    expected: `<= ${thresholds.toolbarP95MsAt50}`,
  });
  gates.push({
    name: "panel_interaction_p95_ms_at_50",
    pass: typeof s50.panel.p95Ms === "number" && s50.panel.p95Ms <= thresholds.panelP95MsAt50,
    actual: s50.panel.p95Ms,
    expected: `<= ${thresholds.panelP95MsAt50}`,
  });
  gates.push({
    name: "drop_cycle_p95_ms_at_50",
    pass: typeof s50.drop.p95Ms === "number" && s50.drop.p95Ms <= thresholds.dropP95MsAt50,
    actual: s50.drop.p95Ms,
    expected: `<= ${thresholds.dropP95MsAt50}`,
  });
  gates.push({
    name: "long_task_p95_ms_during_shell_actions",
    pass: typeof s50.longTask.p95Ms !== "number" || s50.longTask.p95Ms <= thresholds.longTaskP95Ms,
    actual: s50.longTask.p95Ms,
    expected: `<= ${thresholds.longTaskP95Ms}`,
    note:
      typeof s50.longTask.p95Ms === "number"
        ? undefined
        : "No long tasks observed during shell actions.",
  });
  gates.push({
    name: "max_input_stall_ms_during_shell_actions",
    pass: s50.interaction.maxInputStallMs <= thresholds.maxInputStallMs,
    actual: s50.interaction.maxInputStallMs,
    expected: `<= ${thresholds.maxInputStallMs}`,
  });

  return gates;
};
