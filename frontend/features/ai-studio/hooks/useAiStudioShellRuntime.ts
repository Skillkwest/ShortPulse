import { useCallback, useMemo } from "react";
import { reportAppError } from "../../../lib/appErrorReporter";
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";
import {
  normalizeAiStudioProjectName,
  resolveProjectEntryPhase,
} from "../logic/aiStudioPageProjectState";
import { useAiStudioProjectRouteRecovery } from "./useAiStudioProjectRouteRecovery";
import type { AiStudioPageBaseRuntime } from "./useAiStudioPageBaseRuntime";
import type { AiStudioPersistenceController } from "./aiStudioPersistenceControllerContract";

type ModelModalState = AiStudioPageContentProps["modelModalState"];

const PROJECT_OPEN_INTERRUPTED_MESSAGE = "Project open was interrupted. Try again.";
const PROJECT_OPEN_TIMEOUT_MESSAGE = "Project open is taking longer than expected. Try again.";
const PROJECT_OPEN_HANDOFF_TIMEOUT_MS = 8000;

const buildProjectRouteHref = (projectId: string): string =>
  `/ai-studio?projectId=${encodeURIComponent(projectId)}`;

const isProjectRouteTarget = (url: string, projectId: string): boolean => {
  try {
    const parsedUrl = new URL(url, "https://shortpulse.local");
    return (
      parsedUrl.pathname === "/ai-studio" && parsedUrl.searchParams.get("projectId") === projectId
    );
  } catch {
    return url.includes("/ai-studio") && url.includes(`projectId=${encodeURIComponent(projectId)}`);
  }
};

type UseAiStudioShellRuntimeParams = {
  base: AiStudioPageBaseRuntime;
  sessionRestoreCandidate: AiStudioPersistenceController["sessionRestoreCandidate"];
  projectBootstrapSettled: boolean;
  projectBootstrapApplied: boolean;
  flushProjectWorkspaceSnapshot: AiStudioPersistenceController["flushProjectWorkspaceSnapshot"];
  filteredModelOptions: AiStudioPageContentProps["modelModalState"]["options"];
  resolveModelPickerCredits: AiStudioPageContentProps["modelModalState"]["resolveCreditsForModel"];
  handleSelectModelFromModal: AiStudioPageContentProps["modelModalState"]["onSelect"];
};

/**
 * Page-shell runtime for project routing, project naming, and model-modal presentation state.
 */
export const useAiStudioShellRuntime = ({
  base,
  sessionRestoreCandidate,
  projectBootstrapSettled,
  flushProjectWorkspaceSnapshot,
  filteredModelOptions,
  resolveModelPickerCredits,
  handleSelectModelFromModal,
}: UseAiStudioShellRuntimeParams) => {
  const {
    closeModelModal,
    expertCreateMode,
    isModelModalOpen,
    isCreateCharacterModeEnabled,
    localSessionTitleOverride,
    modelModalContext,
    project,
    projectErrorKind,
    projectId,
    projectRouteRequested,
    projectStatus,
    requestedProjectId,
    router,
    sessionId,
    mediaProjectNameFocusRequestKey,
    setIsProjectsModalOpen,
    setMediaProjectNameFocusRequestKey,
    setSelectedToolWithEditIntentReset,
    setSessionTitleOverrideState,
    setShowCreateTools,
    setUiError,
    selectedTool,
    trackUiEvent,
    updateProjectTitle,
    resolveIsCharacterModeEnabledForTool,
    resolveSelectedCharacterIdForTool,
  } = base;

  const effectiveProjectName = useMemo(
    () => project?.title ?? localSessionTitleOverride ?? null,
    [localSessionTitleOverride, project?.title]
  );

  const handleProjectNameCommit = useCallback(
    async (value: string) => {
      if (projectId) {
        try {
          await updateProjectTitle(value);
        } catch (error) {
          setUiError(error instanceof Error ? error.message : "Failed to update project title.");
        }
        return;
      }
      if (!sessionId) return;
      setSessionTitleOverrideState({
        sessionId,
        title: normalizeAiStudioProjectName(value),
      });
    },
    [projectId, sessionId, setSessionTitleOverrideState, setUiError, updateProjectTitle]
  );

  const handleOpenProjectsModal = useCallback(() => {
    setIsProjectsModalOpen(true);
  }, [setIsProjectsModalOpen]);

  const handleCloseProjectsModal = useCallback(() => {
    setIsProjectsModalOpen(false);
  }, [setIsProjectsModalOpen]);

  const navigateToProjectRoute = useCallback(
    async (nextProjectId: string) => {
      const targetHref = buildProjectRouteHref(nextProjectId);
      let cleanupRouteHandoffListeners = () => undefined;

      const routeHandoffCompleted = new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanupRouteHandoffListeners();
          void reportAppError({
            source: "client.ai_studio.project_route_handoff_timeout",
            scope: "app",
            severity: "medium",
            message: PROJECT_OPEN_TIMEOUT_MESSAGE,
            route: typeof window !== "undefined" ? window.location.pathname : null,
            endpoint: targetHref,
            metadata: {
              target_project_id: nextProjectId,
            },
          });
          reject(new Error(PROJECT_OPEN_TIMEOUT_MESSAGE));
        }, PROJECT_OPEN_HANDOFF_TIMEOUT_MS);

        cleanupRouteHandoffListeners = () => {
          router.events.off("routeChangeComplete", handleRouteChangeComplete);
          router.events.off("routeChangeError", handleRouteChangeError);
          window.clearTimeout(timeoutId);
        };

        const settleWithResolve = () => {
          if (settled) return;
          settled = true;
          cleanupRouteHandoffListeners();
          resolve();
        };

        const settleWithReject = () => {
          if (settled) return;
          settled = true;
          cleanupRouteHandoffListeners();
          reject(new Error(PROJECT_OPEN_INTERRUPTED_MESSAGE));
        };

        function handleRouteChangeComplete(url: string) {
          if (isProjectRouteTarget(url, nextProjectId)) {
            settleWithResolve();
          }
        }

        function handleRouteChangeError(_routeError: Error & { cancelled?: boolean }, url: string) {
          if (isProjectRouteTarget(url, nextProjectId)) {
            settleWithReject();
          }
        }

        router.events.on("routeChangeComplete", handleRouteChangeComplete);
        router.events.on("routeChangeError", handleRouteChangeError);
      });

      const routePush = Promise.resolve(
        router.push({
          pathname: "/ai-studio",
          query: { projectId: nextProjectId },
        })
      ).then((didNavigate) => {
        if (!didNavigate) {
          throw new Error(PROJECT_OPEN_INTERRUPTED_MESSAGE);
        }
      });

      const routePushAfterCompletion = routePush.then(() => routeHandoffCompleted);
      void routePush.catch(() => undefined);
      void routeHandoffCompleted.catch(() => undefined);

      try {
        await Promise.race([routeHandoffCompleted, routePushAfterCompletion]);
      } finally {
        cleanupRouteHandoffListeners();
      }
    },
    [router]
  );

  const handleSelectProjectFromModal = useCallback(
    async (nextProjectId: string) => {
      if (nextProjectId === projectId) return;
      await flushProjectWorkspaceSnapshot({ reason: "project_switch" });
      await navigateToProjectRoute(nextProjectId);
    },
    [flushProjectWorkspaceSnapshot, navigateToProjectRoute, projectId]
  );

  const handleOpenMediaLibraryPanelOnly = useCallback(() => {
    setShowCreateTools(false);
    setSelectedToolWithEditIntentReset("media-library");
  }, [setSelectedToolWithEditIntentReset, setShowCreateTools]);

  const handleOpenMediaLibraryProjectNameEditor = useCallback(() => {
    setMediaProjectNameFocusRequestKey((value) => value + 1);
    setShowCreateTools(false);
    setSelectedToolWithEditIntentReset("media-library");
  }, [setMediaProjectNameFocusRequestKey, setSelectedToolWithEditIntentReset, setShowCreateTools]);

  const handleClearStaleProjectRoute = useCallback(async () => {
    const nextQuery = { ...router.query };
    delete nextQuery.projectId;
    return await router.replace({
      pathname: "/ai-studio",
      query: nextQuery,
    });
  }, [router]);

  useAiStudioProjectRouteRecovery({
    requestedProjectId,
    projectRouteRequested,
    projectStatus,
    projectErrorKind,
    onClearStaleProjectRoute: handleClearStaleProjectRoute,
    onOpenProjectsModal: handleOpenProjectsModal,
  });

  const shouldGateProjectBootstrap =
    projectRouteRequested &&
    (projectStatus !== "ready" || (Boolean(projectId) && !projectBootstrapSettled));
  const projectEntryPhase = resolveProjectEntryPhase({
    projectStatus,
    projectRouteRequested,
    projectBootstrapSettled,
    workspaceRestoreCandidate: sessionRestoreCandidate,
  });

  const modelModalState = useMemo<ModelModalState>(
    () => ({
      isOpen: isModelModalOpen,
      options: filteredModelOptions,
      resolveCreditsForModel: resolveModelPickerCredits,
      context: modelModalContext,
      onClose: closeModelModal,
      onSelect: handleSelectModelFromModal,
      onPresentationResolved: ({ context, suppliedOptionCount, visibleOptionCount }) => {
        const isCreateTool = selectedTool === "create" || selectedTool === "text";
        if (!isCreateTool) return;
        const resolvedExpertCreateMode = expertCreateMode === "pulse" ? "pulse" : "standard";
        const characterModeEnabled = resolveIsCharacterModeEnabledForTool
          ? resolveIsCharacterModeEnabledForTool(selectedTool)
          : isCreateCharacterModeEnabled;
        const selectedCharacterIdPresent = Boolean(
          resolveSelectedCharacterIdForTool?.(selectedTool)?.trim()
        );
        const payload = {
          tool: selectedTool,
          expert_create_mode: resolvedExpertCreateMode,
          character_mode_enabled: characterModeEnabled,
          selected_character_id_present: selectedCharacterIdPresent,
          modal_context: context,
          supplied_option_count: suppliedOptionCount,
          visible_option_count: visibleOptionCount,
        };
        trackUiEvent("create_model_modal_presented", payload);
        if (
          characterModeEnabled &&
          resolvedExpertCreateMode === "standard" &&
          context !== "character-image"
        ) {
          trackUiEvent("create_model_modal_context_mismatch", payload);
        }
        if (visibleOptionCount === 0) {
          trackUiEvent("create_model_modal_empty_results", payload);
        }
      },
    }),
    [
      closeModelModal,
      expertCreateMode,
      filteredModelOptions,
      handleSelectModelFromModal,
      isCreateCharacterModeEnabled,
      isModelModalOpen,
      modelModalContext,
      resolveModelPickerCredits,
      resolveIsCharacterModeEnabledForTool,
      resolveSelectedCharacterIdForTool,
      selectedTool,
      trackUiEvent,
    ]
  );

  return {
    effectiveProjectName,
    handleProjectNameCommit,
    handleOpenProjectsModal,
    handleCloseProjectsModal,
    handleSelectProjectFromModal,
    handleCreateProjectFromModal: navigateToProjectRoute,
    handleOpenMediaLibraryPanelOnly,
    handleOpenMediaLibraryProjectNameEditor,
    mediaProjectNameFocusRequestKey,
    shouldGateProjectBootstrap,
    projectEntryPhase,
    modelModalState,
  };
};
