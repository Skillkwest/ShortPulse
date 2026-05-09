/**
 * Final prop-packing runtime for the Expert Edit stage workspace.
 * Collapses the prepared shell/runtime nodes into the stage-workspace contract so the panel body stays thin.
 */
import React from "react";

import { ExpertEditStageWorkspace } from "./ExpertEditStageWorkspace";

type StageWorkspaceProps = React.ComponentProps<typeof ExpertEditStageWorkspace>;

type UseExpertEditStageWorkspacePropsRuntimeArgs = StageWorkspaceProps;

/**
 * Returns the final `ExpertEditStageWorkspace` prop bag from already-prepared runtime values.
 */
export function useExpertEditStageWorkspacePropsRuntime(
  args: UseExpertEditStageWorkspacePropsRuntimeArgs
) {
  return args;
}
