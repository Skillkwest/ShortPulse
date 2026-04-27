import type { AiStudioProjectEntryPhase } from "../components/AiStudioProjectEntryState";

export const normalizeAiStudioProjectName = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 120) : null;
};

export const resolveProjectEntryPhase = ({
  projectStatus,
  projectRouteRequested,
  projectBootstrapApplied,
  workspaceRestoreCandidate,
}: {
  projectStatus: "idle" | "loading" | "ready" | "error";
  projectRouteRequested: boolean;
  projectBootstrapApplied: boolean;
  workspaceRestoreCandidate: {
    status: "idle" | "loading" | "ready" | "error";
    result?: "idle" | "loading" | "found_snapshot" | "no_snapshot" | "load_failed";
  };
}): AiStudioProjectEntryPhase => {
  if (projectStatus !== "ready") return "resolving-project";
  if (projectBootstrapApplied) return "restoring-workspace";
  if (workspaceRestoreCandidate.status !== "ready") return "loading-workspace";
  if (workspaceRestoreCandidate.result === "no_snapshot") return "preparing-empty-workspace";
  if (
    workspaceRestoreCandidate.result === "found_snapshot" ||
    workspaceRestoreCandidate.result === "idle" ||
    workspaceRestoreCandidate.result === "loading"
  ) {
    return "restoring-workspace";
  }
  if (projectRouteRequested) return "loading-workspace";
  return "resolving-project";
};
