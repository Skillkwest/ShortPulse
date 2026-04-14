/**
 * Beginner-mode policy map for AI Studio workflows.
 * Lets each panel consume explicit behavior flags instead of a single implicit boolean.
 */

export type WorkflowBeginnerModePolicy = {
  create: {
    beginnerMode: boolean;
    expertCreateEligible: boolean;
  };
  edit: {
    beginnerMode: boolean;
    expertEditEligible: boolean;
  };
  video: {
    beginnerMode: boolean;
  };
  character: {
    beginnerMode: boolean;
  };
};

/**
 * Builds a workflow policy object from the global beginner-mode preference.
 */
export const createWorkflowBeginnerModePolicy = (
  beginnerMode: boolean,
  isExpertCreateUiEnabledByEnv: boolean
): WorkflowBeginnerModePolicy => ({
  create: {
    beginnerMode,
    expertCreateEligible: !beginnerMode && isExpertCreateUiEnabledByEnv,
  },
  edit: {
    beginnerMode,
    expertEditEligible: !beginnerMode,
  },
  video: {
    beginnerMode,
  },
  character: {
    beginnerMode,
  },
});
