/**
 * Runtime availability gate for the manual AI Studio workflow reload action.
 */

const MANUAL_WORKFLOW_RELOAD_ENABLED_VALUE = "true";

/**
 * Returns whether users may manually hydrate workflow controls from generated output metadata.
 */
export const isManualWorkflowReloadEnabled = (
  rawValue: string | undefined = process.env.NEXT_PUBLIC_AI_STUDIO_MANUAL_WORKFLOW_RELOAD_ENABLED
): boolean => rawValue === MANUAL_WORKFLOW_RELOAD_ENABLED_VALUE;
