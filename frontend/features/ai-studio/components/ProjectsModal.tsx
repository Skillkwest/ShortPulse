/**
 * AI Studio projects picker modal.
 * Lists saved projects and routes selection back through the page-level project identity boundary.
 */
import React from "react";
import { Sparkle, Trash, X } from "phosphor-react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { normalizeErrorText } from "../../../lib/errorText";
import { AppMessage } from "../../../components/AppMessage";
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
  hasMore?: unknown;
  nextOffset?: unknown;
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
  | {
      status: "idle" | "loading";
      projects: ProjectListRecord[];
      error: null;
      hasMore: boolean;
      nextOffset: number | null;
    }
  | {
      status: "ready";
      projects: ProjectListRecord[];
      error: null;
      hasMore: boolean;
      nextOffset: number | null;
    }
  | {
      status: "error";
      projects: ProjectListRecord[];
      error: string;
      hasMore: boolean;
      nextOffset: number | null;
    };

const PROJECT_LIST_PAGE_SIZE = 12;

const removeProjectFromLoadState = (
  current: ProjectsLoadState,
  projectId: string
): ProjectsLoadState => ({
  status: "ready",
  projects: current.projects.filter((project) => project.id !== projectId),
  error: null,
  hasMore: current.hasMore,
  nextOffset: current.nextOffset,
});

const normalizeProjectPagePayload = (payload: ProjectsModalPayload) => ({
  projects: Array.isArray(payload.projects) ? payload.projects : [],
  hasMore: payload.hasMore === true,
  nextOffset:
    typeof payload.nextOffset === "number" && Number.isSafeInteger(payload.nextOffset)
      ? payload.nextOffset
      : null,
});

const mergeProjectPreviewUrls = (
  projects: ProjectListRecord[],
  previewProjects: ProjectListRecord[]
): ProjectListRecord[] => {
  const previewUrlsByProjectId = new Map(
    previewProjects.map((project) => [project.id, project.previewImageUrls ?? []])
  );
  return projects.map((project) => {
    const previewImageUrls = previewUrlsByProjectId.get(project.id);
    return previewImageUrls ? { ...project, previewImageUrls } : project;
  });
};

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
    hasMore: false,
    nextOffset: 0,
  });
  const loadStateRef = React.useRef(loadState);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = React.useState<string | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = React.useState<ProjectListRecord | null>(
    null
  );
  const [deletePendingProjectId, setDeletePendingProjectId] = React.useState<string | null>(null);
  const projectOpenInFlightIdRef = React.useRef<string | null>(null);
  const deleteInFlightProjectIdRef = React.useRef<string | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const createButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const projectNameModalWasOpenRef = React.useRef(false);
  useAiStudioModalActivity("projects-modal", isOpen);
  const hasProjectActionInFlight = Boolean(pendingProjectId || deletePendingProjectId);
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

  React.useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  const loadProjects = React.useCallback((options: { append?: boolean } = {}) => {
    let cancelled = false;
    const shouldAppend = options.append === true;
    const currentLoadState = loadStateRef.current;
    const requestOffset = shouldAppend
      ? (currentLoadState.nextOffset ?? currentLoadState.projects.length)
      : 0;
    setLoadState((current) => ({
      status: "loading",
      projects: current.projects,
      error: null,
      hasMore: current.hasMore,
      nextOffset: current.nextOffset,
    }));

    const requestPath = `/api/projects?limit=${PROJECT_LIST_PAGE_SIZE}&offset=${requestOffset}`;

    void fetchWithAuth(`${requestPath}&previewMode=none`, {
      method: "GET",
      shortpulseAuthTimeoutMs: 5000,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ProjectsModalPayload;
        if (!response.ok) {
          throw new Error(resolveProjectsLoadErrorMessage(response.status, payload));
        }
        if (cancelled) return;
        const projectPage = normalizeProjectPagePayload(payload);
        setLoadState((current) => ({
          status: "ready",
          projects: shouldAppend
            ? [...current.projects, ...projectPage.projects]
            : projectPage.projects,
          error: null,
          hasMore: projectPage.hasMore,
          nextOffset: projectPage.nextOffset,
        }));

        window.setTimeout(() => {
          if (cancelled) return;
          void fetchWithAuth(requestPath, {
            method: "GET",
            shortpulseAuthTimeoutMs: 5000,
          })
            .then(async (previewResponse) => {
              const previewPayload = (await previewResponse
                .json()
                .catch(() => ({}))) as ProjectsModalPayload;
              if (!previewResponse.ok || cancelled) return;
              const previewPage = normalizeProjectPagePayload(previewPayload);
              setLoadState((current) => ({
                ...current,
                projects: mergeProjectPreviewUrls(current.projects, previewPage.projects),
              }));
            })
            .catch(() => {
              // Project previews are enrichment; the modal remains usable without them.
            });
        }, 250);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadState((current) => ({
          status: "error",
          projects: shouldAppend ? current.projects : [],
          error: error instanceof Error ? error.message : "Failed to load projects.",
          hasMore: shouldAppend ? current.hasMore : false,
          nextOffset: shouldAppend ? current.nextOffset : 0,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setActionError(null);
      setPendingProjectId(null);
      projectOpenInFlightIdRef.current = null;
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
      if (projectOpenInFlightIdRef.current) return;
      if (projectId === currentProjectId) {
        onClose();
        return;
      }

      setActionError(null);
      setPendingProjectId(projectId);
      projectOpenInFlightIdRef.current = projectId;
      try {
        await onSelectProject(projectId);
        onClose();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Failed to open project.");
      } finally {
        if (projectOpenInFlightIdRef.current === projectId) {
          projectOpenInFlightIdRef.current = null;
        }
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
            <p className="model-modal-subtitle">Open a saved AI Studio project.</p>
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
            <button
              ref={closeButtonRef}
              type="button"
              className="ghost-btn mini model-modal-close ai-projects-modal-close-button"
              onClick={onClose}
              aria-label="Close projects modal"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
        <div className="model-modal-scroll ai-projects-modal-scroll">
          {actionError ? (
            <AppMessage
              className="ai-projects-modal-banner ai-projects-modal-banner-error"
              tone="error"
              mode="banner"
              message={actionError}
            />
          ) : null}
          {loadState.status === "error" ? (
            <AppMessage
              className="ai-projects-modal-empty-state"
              tone="error"
              mode="banner"
              title="Projects unavailable"
              message={loadState.error}
              action={{ label: "Retry", onClick: loadProjects }}
            />
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
                  disabled={hasProjectActionInFlight}
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
                const isInteractionDisabled = hasProjectActionInFlight || isPending;
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
                      disabled={isInteractionDisabled}
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
                                <img src={url} alt="" loading="lazy" decoding="async" />
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
                        disabled={isInteractionDisabled}
                      >
                        <Trash size={15} weight="bold" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {loadState.projects.length > 0 && loadState.hasMore ? (
            <div className="ai-projects-modal-load-more">
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => {
                  loadProjects({ append: true });
                }}
                disabled={loadState.status === "loading" || hasProjectActionInFlight}
              >
                {loadState.status === "loading" ? "Loading..." : "Load more"}
              </button>
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
