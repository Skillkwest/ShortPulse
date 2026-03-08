/**
 * AI Studio right-rail panel visibility domain helpers.
 * Centralizes workflow-scoped visibility state, derived render visibility, and header toggle behavior.
 */
import type { ToolId } from "../types";

export type HeaderShortcutId = "canvas" | "quick-slot-inventory" | "reference-grid" | "styles";
export type WorkflowPanelVisibilityKey = "create" | "edit" | "video" | "canvas";
export type WorkflowPanelVisibilityState = {
  canvas: boolean;
  quickSlot: boolean;
  referenceGrid: boolean;
  styles: boolean;
};
export type WorkflowPanelVisibilityByWorkflow = Record<
  WorkflowPanelVisibilityKey,
  WorkflowPanelVisibilityState
>;
export type PanelToggleAvailability = {
  canvas: boolean;
  quickSlot: boolean;
  styles: boolean;
};
export type EffectivePanelVisibility = {
  canvas: boolean;
  quickSlot: boolean;
  referenceGrid: boolean;
  styles: boolean;
};
export type HeaderShortcutState = {
  pressed: boolean;
  disabled: boolean;
};
export type HeaderShortcutStateMap = Record<HeaderShortcutId, HeaderShortcutState>;

const DEFAULT_WORKFLOW_PANEL_VISIBILITY_TEMPLATE: WorkflowPanelVisibilityByWorkflow = {
  create: { canvas: true, quickSlot: true, referenceGrid: true, styles: false },
  edit: { canvas: true, quickSlot: true, referenceGrid: true, styles: false },
  video: { canvas: true, quickSlot: true, referenceGrid: true, styles: false },
  canvas: { canvas: false, quickSlot: true, referenceGrid: true, styles: false },
};

const cloneWorkflowPanelVisibilityState = (
  state: WorkflowPanelVisibilityState
): WorkflowPanelVisibilityState => ({
  canvas: state.canvas,
  quickSlot: state.quickSlot,
  referenceGrid: state.referenceGrid,
  styles: state.styles,
});

/**
 * Creates a fresh workflow visibility map for local UI state initialization.
 */
export const createInitialWorkflowPanelVisibility = (): WorkflowPanelVisibilityByWorkflow => ({
  create: cloneWorkflowPanelVisibilityState(DEFAULT_WORKFLOW_PANEL_VISIBILITY_TEMPLATE.create),
  edit: cloneWorkflowPanelVisibilityState(DEFAULT_WORKFLOW_PANEL_VISIBILITY_TEMPLATE.edit),
  video: cloneWorkflowPanelVisibilityState(DEFAULT_WORKFLOW_PANEL_VISIBILITY_TEMPLATE.video),
  canvas: cloneWorkflowPanelVisibilityState(DEFAULT_WORKFLOW_PANEL_VISIBILITY_TEMPLATE.canvas),
});

/**
 * Resolves the workflow bucket used for per-workflow panel visibility persistence.
 */
export const resolvePanelVisibilityWorkflowKey = (
  tool: ToolId | null
): WorkflowPanelVisibilityKey => {
  switch (tool) {
    case "edit":
    case "image":
      return "edit";
    case "video":
      return "video";
    case "canvas":
      return "canvas";
    default:
      // Create group intentionally includes create/text/kling and all non-panel workflows.
      return "create";
  }
};

/**
 * Applies runtime availability gates to a workflow visibility snapshot to produce render visibility.
 */
export const resolveEffectivePanelVisibility = ({
  workflowVisibility,
  availability,
}: {
  workflowVisibility: WorkflowPanelVisibilityState;
  availability: PanelToggleAvailability;
}): EffectivePanelVisibility => ({
  canvas: availability.canvas && workflowVisibility.canvas,
  quickSlot: availability.quickSlot && workflowVisibility.quickSlot,
  referenceGrid: workflowVisibility.referenceGrid,
  styles: availability.styles && workflowVisibility.styles,
});

/**
 * Computes header toggle pressed/disabled state from effective visibility and availability.
 */
export const resolveHeaderShortcutStateMap = ({
  effectiveVisibility,
  availability,
}: {
  effectiveVisibility: EffectivePanelVisibility;
  availability: PanelToggleAvailability;
}): HeaderShortcutStateMap => ({
  canvas: {
    pressed: effectiveVisibility.canvas,
    disabled: !availability.canvas,
  },
  "quick-slot-inventory": {
    pressed: effectiveVisibility.quickSlot,
    disabled: !availability.quickSlot,
  },
  "reference-grid": {
    pressed: effectiveVisibility.referenceGrid,
    disabled: false,
  },
  styles: {
    pressed: effectiveVisibility.styles,
    disabled: !availability.styles,
  },
});

const withWorkflowStateUpdate = (
  byWorkflow: WorkflowPanelVisibilityByWorkflow,
  workflowKey: WorkflowPanelVisibilityKey,
  resolver: (state: WorkflowPanelVisibilityState) => WorkflowPanelVisibilityState
): WorkflowPanelVisibilityByWorkflow => {
  const currentWorkflowState = byWorkflow[workflowKey];
  const nextWorkflowState = resolver(currentWorkflowState);
  if (nextWorkflowState === currentWorkflowState) return byWorkflow;
  return {
    ...byWorkflow,
    [workflowKey]: nextWorkflowState,
  };
};

/**
 * Toggles a single header shortcut for the active workflow while respecting toggle availability.
 */
export const toggleWorkflowPanelVisibilityByShortcut = ({
  byWorkflow,
  workflowKey,
  shortcutId,
  availability,
}: {
  byWorkflow: WorkflowPanelVisibilityByWorkflow;
  workflowKey: WorkflowPanelVisibilityKey;
  shortcutId: HeaderShortcutId;
  availability: PanelToggleAvailability;
}): WorkflowPanelVisibilityByWorkflow => {
  if (shortcutId === "styles") {
    if (!availability.styles) return byWorkflow;
    return withWorkflowStateUpdate(byWorkflow, workflowKey, (state) => ({
      ...state,
      styles: !state.styles,
    }));
  }
  if (shortcutId === "canvas" && !availability.canvas) return byWorkflow;
  if (shortcutId === "quick-slot-inventory" && !availability.quickSlot) return byWorkflow;
  return withWorkflowStateUpdate(byWorkflow, workflowKey, (state) => ({
    ...state,
    canvas: shortcutId === "canvas" ? !state.canvas : state.canvas,
    quickSlot: shortcutId === "quick-slot-inventory" ? !state.quickSlot : state.quickSlot,
    referenceGrid: shortcutId === "reference-grid" ? !state.referenceGrid : state.referenceGrid,
  }));
};
