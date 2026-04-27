/**
 * AI Studio projects picker modal.
 * Lists saved projects and routes selection back through the page-level project identity boundary.
 */
import React from "react";
import { ClockCounterClockwise, Folders, Sparkle, Trash } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type ProjectListRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  previewImageUrls?: string[];
};

type ProjectsModalPayload = {
  projects?: ProjectListRecord[];
  error?: string;
  details?: string;
};

type ProjectsModalProps = {
  isOpen: boolean;
  currentProjectId?: string | null;
  onClose: () => void;
  onSelectProject: (projectId: string) => Promise<void> | void;
};

type ProjectsLoadState =
  | { status: "idle" | "loading"; projects: ProjectListRecord[]; error: null }
  | { status: "ready"; projects: ProjectListRecord[]; error: null }
  | { status: "error"; projects: ProjectListRecord[]; error: string };

const PROJECT_LIST_ALL_QUERY = "all";

const resolveProjectsLoadErrorMessage = (
  status: number,
  payload: ProjectsModalPayload | null
): string => {
  if (status === 401) {
    return "Session expired. Retry project load.";
  }
  return payload?.error?.trim() || payload?.details?.trim() || "Failed to load projects.";
};

const resolveProjectDeleteErrorMessage = (
  status: number,
  payload: ProjectsModalPayload | null
): string => {
  if (status === 401) {
    return "Session expired. Retry project delete.";
  }
  if (status === 404) {
    return "Project no longer exists.";
  }
  return payload?.error?.trim() || payload?.details?.trim() || "Failed to delete project.";
};

export function ProjectsModal({
  isOpen,
  currentProjectId = null,
  onClose,
  onSelectProject,
}: ProjectsModalProps) {
  const [loadState, setLoadState] = React.useState<ProjectsLoadState>({
    status: "idle",
    projects: [],
    error: null,
  });
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = React.useState<string | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = React.useState<ProjectListRecord | null>(
    null
  );
  const [deletePendingProjectId, setDeletePendingProjectId] = React.useState<string | null>(null);
  useAiStudioModalActivity("projects-modal", isOpen);

  React.useEffect(() => {
    if (!isOpen) {
      setActionError(null);
      setPendingProjectId(null);
      setDeleteConfirmProject(null);
      setDeletePendingProjectId(null);
      return;
    }

    let cancelled = false;
    setLoadState((current) => ({
      status: "loading",
      projects: current.projects,
      error: null,
    }));

    void fetchWithAuth(`/api/projects?limit=${PROJECT_LIST_ALL_QUERY}`, {
      method: "GET",
      shortpulseAuthTimeoutMs: 5000,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ProjectsModalPayload;
        if (!response.ok) {
          throw new Error(resolveProjectsLoadErrorMessage(response.status, payload));
        }
        if (cancelled) return;
        setLoadState({
          status: "ready",
          projects: Array.isArray(payload.projects) ? payload.projects : [],
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadState({
          status: "error",
          projects: [],
          error: error instanceof Error ? error.message : "Failed to load projects.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (deleteConfirmProject) {
          setDeleteConfirmProject(null);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteConfirmProject, isOpen, onClose]);

  const handleProjectSelect = React.useCallback(
    async (projectId: string) => {
      if (projectId === currentProjectId) {
        onClose();
        return;
      }

      setActionError(null);
      setPendingProjectId(projectId);
      try {
        await onSelectProject(projectId);
        onClose();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Failed to open project.");
      } finally {
        setPendingProjectId(null);
      }
    },
    [currentProjectId, onClose, onSelectProject]
  );

  const openDeleteConfirm = React.useCallback((project: ProjectListRecord) => {
    setActionError(null);
    setDeleteConfirmProject(project);
  }, []);

  const closeDeleteConfirm = React.useCallback(() => {
    if (deletePendingProjectId) return;
    setDeleteConfirmProject(null);
  }, [deletePendingProjectId]);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteConfirmProject) return;

    setActionError(null);
    setDeletePendingProjectId(deleteConfirmProject.id);
    try {
      const response = await fetchWithAuth(`/api/projects/${deleteConfirmProject.id}`, {
        method: "DELETE",
        shortpulseAuthTimeoutMs: 5000,
      });
      const payload = (await response.json().catch(() => ({}))) as ProjectsModalPayload;
      if (!response.ok) {
        throw new Error(resolveProjectDeleteErrorMessage(response.status, payload));
      }

      setLoadState((current) => ({
        status: "ready",
        projects: current.projects.filter((project) => project.id !== deleteConfirmProject.id),
        error: null,
      }));
      setDeleteConfirmProject(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete project.");
    } finally {
      setDeletePendingProjectId(null);
    }
  }, [deleteConfirmProject]);

  if (!isOpen) {
    return null;
  }

  return (
    <AiStudioModalLayer>
      <div className="model-modal-backdrop ai-projects-modal-backdrop" onClick={onClose} />
      <div
        className="model-modal ai-projects-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-projects-modal-title"
      >
        <div className="model-modal-header ai-projects-modal-header">
          <div className="model-modal-title-group">
            <p id="ai-projects-modal-title" className="model-modal-title">
              Projects
            </p>
            <p className="model-modal-subtitle">
              Open a saved AI Studio project and restore its project-backed workspace.
            </p>
          </div>
          <div className="model-modal-header-actions">
            <span className="ai-projects-modal-count-pill" aria-live="polite">
              {loadState.status === "ready"
                ? `${loadState.projects.length} saved`
                : loadState.status === "loading"
                  ? "Loading..."
                  : "Saved projects"}
            </span>
            <button
              type="button"
              className="ghost-btn mini model-modal-close"
              onClick={onClose}
              aria-label="Close projects modal"
            >
              ×
            </button>
          </div>
        </div>
        <div className="model-modal-scroll ai-projects-modal-scroll">
          {actionError ? (
            <div className="ai-projects-modal-banner ai-projects-modal-banner-error" role="alert">
              {actionError}
            </div>
          ) : null}
          {loadState.status === "error" ? (
            <div className="ai-projects-modal-empty-state" role="alert">
              <Folders size={30} weight="duotone" />
              <h3>Projects unavailable</h3>
              <p>{loadState.error}</p>
            </div>
          ) : null}
          {loadState.status !== "error" && loadState.projects.length === 0 ? (
            <div className="ai-projects-modal-empty-state">
              {loadState.status === "loading" ? (
                <ClockCounterClockwise size={30} weight="duotone" />
              ) : (
                <Sparkle size={30} weight="duotone" />
              )}
              <h3>
                {loadState.status === "loading" ? "Loading projects" : "No saved projects yet"}
              </h3>
              <p>
                {loadState.status === "loading"
                  ? "Fetching your latest AI Studio projects."
                  : "Create a project from the dashboard to start building a saved workspace."}
              </p>
            </div>
          ) : null}
          {loadState.projects.length > 0 ? (
            <div className="ai-projects-modal-grid" aria-label="Saved projects">
              {loadState.projects.map((project) => {
                const isCurrentProject = project.id === currentProjectId;
                const isPending =
                  pendingProjectId === project.id || deletePendingProjectId === project.id;
                const showStatusPill = isCurrentProject || isPending;
                return (
                  <div
                    key={project.id}
                    className={`ai-projects-modal-card-shell${isCurrentProject ? " is-current" : ""}${
                      isPending ? " is-pending" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className={`ai-projects-modal-card${isCurrentProject ? " is-current" : ""}`}
                      onClick={() => {
                        void handleProjectSelect(project.id);
                      }}
                      aria-label={
                        isCurrentProject
                          ? `Current project ${project.title}`
                          : `Open project ${project.title}`
                      }
                      disabled={isPending}
                    >
                      <div className="ai-projects-modal-card-topline">
                        <span className="ai-projects-modal-card-title">{project.title}</span>
                        {showStatusPill ? (
                          <span
                            className={`ai-projects-modal-status-pill${
                              isCurrentProject ? " is-current" : ""
                            }`}
                          >
                            {pendingProjectId === project.id
                              ? "Opening..."
                              : deletePendingProjectId === project.id
                                ? "Deleting..."
                                : "Current"}
                          </span>
                        ) : null}
                      </div>
                      <div className="ai-projects-modal-card-body">
                        {project.previewImageUrls?.length ? (
                          <div
                            className="ai-projects-modal-card-preview-grid"
                            data-testid={`project-preview-grid-${project.id}`}
                            data-count={Math.min(project.previewImageUrls.length, 4)}
                            aria-hidden="true"
                          >
                            {project.previewImageUrls.slice(0, 4).map((url, index) => (
                              <span
                                key={`${project.id}-preview-${index}`}
                                className="ai-projects-modal-card-preview-tile"
                              >
                                <img src={url} alt="" />
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </button>
                    {!isCurrentProject ? (
                      <button
                        type="button"
                        className="ai-projects-modal-card-delete"
                        onClick={() => {
                          openDeleteConfirm(project);
                        }}
                        aria-label={`Delete project ${project.title}`}
                        disabled={isPending}
                      >
                        <Trash size={15} weight="bold" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {deleteConfirmProject ? (
        <ConfirmationModal
          title="Delete this project?"
          body={
            <p>
              <strong>{deleteConfirmProject.title}</strong> and its saved workspace will be removed
              permanently.
            </p>
          }
          confirmLabel="Delete"
          confirmBusyLabel={
            deletePendingProjectId === deleteConfirmProject.id ? "Deleting..." : undefined
          }
          confirmDisabled={deletePendingProjectId === deleteConfirmProject.id}
          cancelDisabled={deletePendingProjectId === deleteConfirmProject.id}
          onCancel={closeDeleteConfirm}
          onConfirm={() => {
            void handleDeleteConfirm();
          }}
        />
      ) : null}
    </AiStudioModalLayer>
  );
}
