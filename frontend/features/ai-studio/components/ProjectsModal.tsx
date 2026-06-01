/**
 * AI Studio projects picker modal.
 * Lists saved projects and routes selection back through the page-level project identity boundary.
 */
import React from "react";
import { Folders, Sparkle, Trash } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { normalizeErrorText } from "../../../lib/errorText";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import { ProjectNameModal } from "../../projects/components/ProjectNameModal";
import { useProjectCreationDialog } from "../../projects/hooks/useProjectCreationDialog";
import styles from "../../../styles/ai-studio-projects-modal.module.css";

type ProjectListRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  previewImageUrls?: string[];
};

type ProjectsModalPayload = {
  projects?: ProjectListRecord[];
  error?: unknown;
  details?: unknown;
};

type ProjectsModalProps = {
  isOpen: boolean;
  currentProjectId?: string | null;
  onClose: () => void;
  onSelectProject: (projectId: string) => Promise<void> | void;
  onCreateProject?: (projectId: string) => Promise<void> | void;
};

type ProjectsLoadState =
  | { status: "idle" | "loading"; projects: ProjectListRecord[]; error: null }
  | { status: "ready"; projects: ProjectListRecord[]; error: null }
  | { status: "error"; projects: ProjectListRecord[]; error: string };

const PROJECT_LIST_ALL_QUERY = "all";

const removeProjectFromLoadState = (
  current: ProjectsLoadState,
  projectId: string
): ProjectsLoadState => ({
  status: "ready",
  projects: current.projects.filter((project) => project.id !== projectId),
  error: null,
});

const resolveProjectsLoadErrorMessage = (
  status: number,
  payload: ProjectsModalPayload | null
): string => {
  if (status === 401) {
    return "Session expired. Retry project load.";
  }
  return (
    normalizeErrorText(payload?.error, { fallback: "" }) ||
    normalizeErrorText(payload?.details, { fallback: "Failed to load projects." })
  );
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
  return (
    normalizeErrorText(payload?.error, { fallback: "" }) ||
    normalizeErrorText(payload?.details, { fallback: "Failed to delete project." })
  );
};

export function ProjectsModal({
  isOpen,
  currentProjectId = null,
  onClose,
  onSelectProject,
  onCreateProject,
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
  const deleteInFlightProjectIdRef = React.useRef<string | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const createButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const projectNameModalWasOpenRef = React.useRef(false);
  useAiStudioModalActivity("projects-modal", isOpen);
  const {
    isOpen: isProjectNameModalOpen,
    title: createProjectTitle,
    error: createProjectError,
    isCreating: isCreatingProject,
    openDialog: openCreateProjectDialog,
    closeDialog: closeCreateProjectDialog,
    setTitle: setCreateProjectTitle,
    submit: submitProjectCreate,
  } = useProjectCreationDialog({
    onCreatedProject: async (project) => {
      if (!onCreateProject) return;
      await onCreateProject(project.id);
      onClose();
    },
  });

  const loadProjects = React.useCallback(() => {
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
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setActionError(null);
      setPendingProjectId(null);
      setDeleteConfirmProject(null);
      setDeletePendingProjectId(null);
      deleteInFlightProjectIdRef.current = null;
      return;
    }
    return loadProjects();
  }, [isOpen, loadProjects]);

  React.useEffect(() => {
    if (isOpen) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const focusTarget = onCreateProject ? createButtonRef.current : closeButtonRef.current;
      queueMicrotask(() => {
        focusTarget?.focus();
      });
      return;
    }
    restoreFocusRef.current?.focus();
    restoreFocusRef.current = null;
  }, [isOpen, onCreateProject]);

  React.useEffect(() => {
    if (!isOpen) {
      projectNameModalWasOpenRef.current = false;
      return;
    }
    if (projectNameModalWasOpenRef.current && !isProjectNameModalOpen) {
      const focusTarget = onCreateProject ? createButtonRef.current : closeButtonRef.current;
      queueMicrotask(() => {
        focusTarget?.focus();
      });
    }
    projectNameModalWasOpenRef.current = isProjectNameModalOpen;
  }, [isOpen, isProjectNameModalOpen, onCreateProject]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isProjectNameModalOpen) {
          closeCreateProjectDialog();
          return;
        }
        if (deleteConfirmProject) {
          setDeleteConfirmProject(null);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeCreateProjectDialog, deleteConfirmProject, isOpen, isProjectNameModalOpen, onClose]);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: !isOpen || isProjectNameModalOpen,
  });

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
    if (deleteInFlightProjectIdRef.current) return;

    setActionError(null);
    deleteInFlightProjectIdRef.current = deleteConfirmProject.id;
    setDeletePendingProjectId(deleteConfirmProject.id);
    try {
      const response = await fetchWithAuth(`/api/projects/${deleteConfirmProject.id}`, {
        method: "DELETE",
        shortpulseAuthTimeoutMs: 5000,
      });
      const payload = (await response.json().catch(() => ({}))) as ProjectsModalPayload;
      if (!response.ok) {
        if (response.status === 404) {
          setLoadState((current) => removeProjectFromLoadState(current, deleteConfirmProject.id));
          setDeleteConfirmProject(null);
          return;
        }
        throw new Error(resolveProjectDeleteErrorMessage(response.status, payload));
      }

      setLoadState((current) => removeProjectFromLoadState(current, deleteConfirmProject.id));
      setDeleteConfirmProject(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete project.");
    } finally {
      deleteInFlightProjectIdRef.current = null;
      setDeletePendingProjectId(null);
    }
  }, [deleteConfirmProject]);

  if (!isOpen) {
    return null;
  }

  return (
    <AiStudioModalLayer>
      <div
        className={`model-modal-backdrop ai-projects-modal-backdrop ${styles.bootstrapStyleScope}`}
        {...backdropDismiss}
      />
      <div
        className={`model-modal ai-projects-modal ${styles.bootstrapStyleScope}`}
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
            {onCreateProject ? (
              <button
                ref={createButtonRef}
                type="button"
                className="ghost-btn mini ai-projects-modal-create-button"
                onClick={openCreateProjectDialog}
                disabled={Boolean(pendingProjectId || deletePendingProjectId || isCreatingProject)}
              >
                New Project
              </button>
            ) : null}
            <span className="ai-projects-modal-count-pill" aria-live="polite">
              {loadState.status === "ready"
                ? `${loadState.projects.length} saved`
                : loadState.status === "loading"
                  ? "Loading..."
                  : "Saved projects"}
            </span>
            <button
              ref={closeButtonRef}
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
              <button type="button" className="ghost-btn mini" onClick={loadProjects}>
                Retry
              </button>
            </div>
          ) : null}
          {loadState.status !== "error" && loadState.projects.length === 0 ? (
            <div
              className={`ai-projects-modal-empty-state${
                loadState.status === "loading" ? " is-loading" : ""
              }`}
              role={loadState.status === "loading" ? "status" : undefined}
              aria-busy={loadState.status === "loading" ? "true" : undefined}
              aria-live={loadState.status === "loading" ? "polite" : undefined}
            >
              {loadState.status === "loading" ? (
                <span className="ai-projects-modal-loading-spinner" aria-hidden="true" />
              ) : (
                <Sparkle size={30} weight="duotone" />
              )}
              <h3>
                {loadState.status === "loading" ? "Loading projects" : "No saved projects yet"}
              </h3>
              <p>
                {loadState.status === "loading"
                  ? "Fetching your latest AI Studio projects."
                  : onCreateProject
                    ? "Create a project from here to start building a saved workspace."
                    : "Create a project from the dashboard to start building a saved workspace."}
              </p>
              {onCreateProject && loadState.status !== "loading" ? (
                <button
                  type="button"
                  className="ghost-btn mini ai-projects-modal-empty-action"
                  onClick={openCreateProjectDialog}
                >
                  New Project
                </button>
              ) : null}
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
                                {/* Signed thumbnail URLs are already surface-sized for this modal. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
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
      {isProjectNameModalOpen ? (
        <ProjectNameModal
          value={createProjectTitle}
          isCreating={isCreatingProject}
          error={createProjectError}
          onChange={setCreateProjectTitle}
          onCancel={closeCreateProjectDialog}
          onSubmit={() => {
            void submitProjectCreate();
          }}
        />
      ) : null}
    </AiStudioModalLayer>
  );
}
