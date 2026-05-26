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
  grid: {
    renderedItemCountP95: number | null;
    imageHydrationQueueP95: number | null;
    imageDecodeInflightP95: number | null;
    perfDegradeLevelP95: number | null;
    previewSrcSwapRatePerMinuteP95: number | null;
    previewRepaintSpikeCountMax: number | null;
    previewLastSwapBurstCountP95: number | null;
  };
};

export type StudioShellScenario = {
  count: number;
  toolbar: { samples: number; p95Ms: number | null };
  panel: { samples: number; p95Ms: number | null };
  drop: { samples: number; p95Ms: number | null };
  toolSwitchVisualCommit: { samples: number; p95Ms: number | null };
  sectionRenderCounters: {
    toolbar: number;
    properties: number;
    reference: number;
    preview: number;
  };
  sectionCommit: {
    toolbarP95Ms: number | null;
    propertiesP95Ms: number | null;
    referenceP95Ms: number | null;
    previewP95Ms: number | null;
  };
  nonGridRerendersPerOutputStatusTick: {
    samples: number;
    toolbarP95: number | null;
    propertiesP95: number | null;
  };
  longTask: { samples: number; p95Ms: number | null };
  interaction: { maxInputStallMs: number };
};

export type ProjectWorkspaceAutosaveTypingScenario = {
  field: "standardPrompt" | "editReferenceText" | "videoReferenceText";
  commit: { samples: number; p95Ms: number | null };
  autosave: {
    baseSnapshotBuildsP95: number | null;
    baseSnapshotBuildMsP95: number | null;
    sessionSnapshotComposeCountP95: number | null;
    sessionSnapshotComposeMsP95: number | null;
    candidateSelectionCountP95: number | null;
    candidateSelectionMsP95: number | null;
  };
};

export const evaluateReferenceGridAuditGates = (
  scenarios: ReferenceGridScenario[],
  thresholds: {
    clickP95MsAt40: number;
    longTaskP95MsAt40: number;
    maxInputStallMsAt40: number;
    renderedItemCountP95At40: number;
    clickP95MsAt60: number;
    longTaskP95MsAt60: number;
    maxInputStallMsAt60: number;
    renderedItemCountP95At60: number;
  }
): PerfGate[] => {
  const scenarioByCount = new Map(scenarios.map((scenario) => [scenario.count, scenario]));
  const gates: PerfGate[] = [];
  const scenarioTargets = [
    {
      count: 40,
      clickThreshold: thresholds.clickP95MsAt40,
      longTaskThreshold: thresholds.longTaskP95MsAt40,
      inputStallThreshold: thresholds.maxInputStallMsAt40,
      renderedThreshold: thresholds.renderedItemCountP95At40,
    },
    {
      count: 60,
      clickThreshold: thresholds.clickP95MsAt60,
      longTaskThreshold: thresholds.longTaskP95MsAt60,
      inputStallThreshold: thresholds.maxInputStallMsAt60,
      renderedThreshold: thresholds.renderedItemCountP95At60,
    },
  ] as const;

  scenarioTargets.forEach((target) => {
    const scenario = scenarioByCount.get(target.count);
    if (!scenario) {
      gates.push({
        name: `scenario_${target.count}_exists`,
        pass: false,
        actual: null,
        expected: `${target.count}-card scenario must run`,
      });
      return;
    }

    gates.push({
      name: `grid_click_p95_ms_at_${target.count}`,
      pass:
        typeof scenario.click.p95Ms === "number" && scenario.click.p95Ms <= target.clickThreshold,
      actual: scenario.click.p95Ms,
      expected: `<= ${target.clickThreshold}`,
    });
    gates.push({
      name: `grid_long_task_p95_ms_at_${target.count}`,
      pass:
        typeof scenario.longTask.p95Ms !== "number" ||
        scenario.longTask.p95Ms <= target.longTaskThreshold,
      actual: scenario.longTask.p95Ms,
      expected: `<= ${target.longTaskThreshold}`,
      note:
        typeof scenario.longTask.p95Ms === "number"
          ? undefined
          : "No long tasks observed during reference-grid scenario.",
    });
    gates.push({
      name: `grid_max_input_stall_ms_at_${target.count}`,
      pass: scenario.interaction.maxInputStallMs <= target.inputStallThreshold,
      actual: scenario.interaction.maxInputStallMs,
      expected: `<= ${target.inputStallThreshold}`,
    });
    gates.push({
      name: `rendered_item_count_p95_at_${target.count}`,
      pass:
        typeof scenario.grid.renderedItemCountP95 === "number" &&
        scenario.grid.renderedItemCountP95 <= target.renderedThreshold,
      actual: scenario.grid.renderedItemCountP95,
      expected: `<= ${target.renderedThreshold}`,
      note:
        typeof scenario.grid.renderedItemCountP95 === "number"
          ? undefined
          : "Rendered-item metric unavailable from grid surface.",
    });
  });

  return gates;
};

export const evaluateStudioShellAuditGates = (
  scenarios: StudioShellScenario[],
  thresholds: {
    toolbarP95MsAt60: number;
    panelP95MsAt60: number;
    toolSwitchVisualCommitP95MsAt60: number;
    longTaskP95Ms: number;
    maxInputStallMs: number;
    nonGridRerendersPerOutputStatusTick: number;
  }
): PerfGate[] => {
  const scenarioByCount = new Map(scenarios.map((scenario) => [scenario.count, scenario]));
  const s60 = scenarioByCount.get(60) ?? scenarios[0] ?? null;
  const gates: PerfGate[] = [];

  if (!s60) {
    gates.push({
      name: "scenario_exists",
      pass: false,
      actual: null,
      expected: "At least one shell scenario must run.",
    });
    return gates;
  }

  gates.push({
    name: "toolbar_switch_p95_ms_at_60",
    pass: typeof s60.toolbar.p95Ms === "number" && s60.toolbar.p95Ms <= thresholds.toolbarP95MsAt60,
    actual: s60.toolbar.p95Ms,
    expected: `<= ${thresholds.toolbarP95MsAt60}`,
  });
  gates.push({
    name: "panel_interaction_p95_ms_at_60",
    pass: typeof s60.panel.p95Ms === "number" && s60.panel.p95Ms <= thresholds.panelP95MsAt60,
    actual: s60.panel.p95Ms,
    expected: `<= ${thresholds.panelP95MsAt60}`,
  });
  gates.push({
    name: "tool_switch_visual_commit_p95_ms_at_60",
    pass:
      typeof s60.toolSwitchVisualCommit.p95Ms === "number" &&
      s60.toolSwitchVisualCommit.p95Ms <= thresholds.toolSwitchVisualCommitP95MsAt60,
    actual: s60.toolSwitchVisualCommit.p95Ms,
    expected: `<= ${thresholds.toolSwitchVisualCommitP95MsAt60}`,
  });
  gates.push({
    name: "long_task_p95_ms_during_shell_actions",
    pass: typeof s60.longTask.p95Ms !== "number" || s60.longTask.p95Ms <= thresholds.longTaskP95Ms,
    actual: s60.longTask.p95Ms,
    expected: `<= ${thresholds.longTaskP95Ms}`,
    note:
      typeof s60.longTask.p95Ms === "number"
        ? undefined
        : "No long tasks observed during shell actions.",
  });
  gates.push({
    name: "max_input_stall_ms_during_shell_actions",
    pass: s60.interaction.maxInputStallMs <= thresholds.maxInputStallMs,
    actual: s60.interaction.maxInputStallMs,
    expected: `<= ${thresholds.maxInputStallMs}`,
  });
  gates.push({
    name: "non_grid_toolbar_rerenders_per_output_status_tick",
    pass:
      typeof s60.nonGridRerendersPerOutputStatusTick.toolbarP95 !== "number" ||
      s60.nonGridRerendersPerOutputStatusTick.toolbarP95 <=
        thresholds.nonGridRerendersPerOutputStatusTick,
    actual: s60.nonGridRerendersPerOutputStatusTick.toolbarP95,
    expected: `<= ${thresholds.nonGridRerendersPerOutputStatusTick}`,
    note:
      typeof s60.nonGridRerendersPerOutputStatusTick.toolbarP95 === "number"
        ? undefined
        : "No output status tick samples captured for toolbar.",
  });
  gates.push({
    name: "non_grid_properties_rerenders_per_output_status_tick",
    pass:
      typeof s60.nonGridRerendersPerOutputStatusTick.propertiesP95 !== "number" ||
      s60.nonGridRerendersPerOutputStatusTick.propertiesP95 <=
        thresholds.nonGridRerendersPerOutputStatusTick,
    actual: s60.nonGridRerendersPerOutputStatusTick.propertiesP95,
    expected: `<= ${thresholds.nonGridRerendersPerOutputStatusTick}`,
    note:
      typeof s60.nonGridRerendersPerOutputStatusTick.propertiesP95 === "number"
        ? undefined
        : "No output status tick samples captured for properties.",
  });

  return gates;
};

export const evaluateProjectWorkspaceAutosaveTypingAuditGates = (
  scenarios: ProjectWorkspaceAutosaveTypingScenario[],
  thresholds: {
    standardPromptCommitP95Ms: number;
    standardPromptBaseSnapshotBuildsP95: number;
    standardPromptSessionSnapshotComposeCountP95: number;
    standardPromptCandidateSelectionCountP95: number;
    draftCommitP95Ms: number;
    draftBaseSnapshotBuildsP95: number;
    draftSessionSnapshotComposeCountP95: number;
    draftCandidateSelectionCountP95: number;
  }
): PerfGate[] => {
  const scenarioByField = new Map(scenarios.map((scenario) => [scenario.field, scenario]));
  const gates: PerfGate[] = [];
  const standardPrompt = scenarioByField.get("standardPrompt") ?? null;
  const editReferenceText = scenarioByField.get("editReferenceText") ?? null;
  const videoReferenceText = scenarioByField.get("videoReferenceText") ?? null;

  if (!standardPrompt || !editReferenceText || !videoReferenceText) {
    gates.push({
      name: "project_workspace_autosave_typing_scenarios_exist",
      pass: false,
      actual: null,
      expected: "standardPrompt, editReferenceText, and videoReferenceText scenarios must run.",
    });
    return gates;
  }

  gates.push({
    name: "project_standard_prompt_commit_p95_ms",
    pass:
      typeof standardPrompt.commit.p95Ms === "number" &&
      standardPrompt.commit.p95Ms <= thresholds.standardPromptCommitP95Ms,
    actual: standardPrompt.commit.p95Ms,
    expected: `<= ${thresholds.standardPromptCommitP95Ms}`,
  });
  gates.push({
    name: "project_standard_prompt_base_snapshot_builds_p95",
    pass:
      typeof standardPrompt.autosave.baseSnapshotBuildsP95 === "number" &&
      standardPrompt.autosave.baseSnapshotBuildsP95 <=
        thresholds.standardPromptBaseSnapshotBuildsP95,
    actual: standardPrompt.autosave.baseSnapshotBuildsP95,
    expected: `<= ${thresholds.standardPromptBaseSnapshotBuildsP95}`,
  });
  gates.push({
    name: "project_standard_prompt_session_snapshot_compose_count_p95",
    pass:
      typeof standardPrompt.autosave.sessionSnapshotComposeCountP95 === "number" &&
      standardPrompt.autosave.sessionSnapshotComposeCountP95 <=
        thresholds.standardPromptSessionSnapshotComposeCountP95,
    actual: standardPrompt.autosave.sessionSnapshotComposeCountP95,
    expected: `<= ${thresholds.standardPromptSessionSnapshotComposeCountP95}`,
  });
  gates.push({
    name: "project_standard_prompt_candidate_selection_count_p95",
    pass:
      typeof standardPrompt.autosave.candidateSelectionCountP95 === "number" &&
      standardPrompt.autosave.candidateSelectionCountP95 <=
        thresholds.standardPromptCandidateSelectionCountP95,
    actual: standardPrompt.autosave.candidateSelectionCountP95,
    expected: `<= ${thresholds.standardPromptCandidateSelectionCountP95}`,
  });

  [editReferenceText, videoReferenceText].forEach((scenario) => {
    gates.push({
      name: `project_${scenario.field}_commit_p95_ms`,
      pass:
        typeof scenario.commit.p95Ms === "number" &&
        scenario.commit.p95Ms <= thresholds.draftCommitP95Ms,
      actual: scenario.commit.p95Ms,
      expected: `<= ${thresholds.draftCommitP95Ms}`,
    });
    gates.push({
      name: `project_${scenario.field}_base_snapshot_builds_p95`,
      pass:
        typeof scenario.autosave.baseSnapshotBuildsP95 === "number" &&
        scenario.autosave.baseSnapshotBuildsP95 <= thresholds.draftBaseSnapshotBuildsP95,
      actual: scenario.autosave.baseSnapshotBuildsP95,
      expected: `<= ${thresholds.draftBaseSnapshotBuildsP95}`,
    });
    gates.push({
      name: `project_${scenario.field}_session_snapshot_compose_count_p95`,
      pass:
        typeof scenario.autosave.sessionSnapshotComposeCountP95 === "number" &&
        scenario.autosave.sessionSnapshotComposeCountP95 <=
          thresholds.draftSessionSnapshotComposeCountP95,
      actual: scenario.autosave.sessionSnapshotComposeCountP95,
      expected: `<= ${thresholds.draftSessionSnapshotComposeCountP95}`,
    });
    gates.push({
      name: `project_${scenario.field}_candidate_selection_count_p95`,
      pass:
        typeof scenario.autosave.candidateSelectionCountP95 === "number" &&
        scenario.autosave.candidateSelectionCountP95 <= thresholds.draftCandidateSelectionCountP95,
      actual: scenario.autosave.candidateSelectionCountP95,
      expected: `<= ${thresholds.draftCandidateSelectionCountP95}`,
    });
  });

  return gates;
};
