/**
 * Resolves when AI Studio media autosave may begin for the current route.
 * Keeps non-project routes live immediately and waits for project-route bootstrap settlement.
 */
type ProjectIdentityStatus = "idle" | "loading" | "ready" | "error";

/**
 * Returns whether route-level media autosave should be enabled for the current project bootstrap state.
 */
export const resolveAiStudioMediaAutosaveRouteEnabled = ({
  projectRouteRequested,
  projectStatus,
  projectBootstrapSettled,
}: {
  projectRouteRequested: boolean;
  projectStatus: ProjectIdentityStatus;
  projectBootstrapSettled: boolean;
}): boolean => !projectRouteRequested || (projectStatus === "ready" && projectBootstrapSettled);
