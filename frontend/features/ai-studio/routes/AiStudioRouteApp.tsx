/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import React, { useCallback, useState } from "react";
import { AiStudioPageShell } from "../components/AiStudioPageShell";
import { resolveClientBilledCredits } from "../logic/clientPricingDisplay";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { buildDefaultPricingParams } from "../logic/pricing";
import { captureVideoFrameSnapshotFile } from "../logic/videoFrameSnapshot";
import { resolveAiStudioMediaAutosaveRouteEnabled } from "../logic/mediaAutosaveRouteReadiness";
import { resolveAiStudioRuntimeScopeKey } from "../logic/aiStudioRuntimeScopeKey";
import {
  AI_STUDIO_MEDIA_PLAN_REQUIRED_MESSAGE,
  resolveGenerationAccessCta,
} from "../logic/generationAccessCta";
import {
  AI_STUDIO_WORKFLOW_PLAN_REQUIRED_MESSAGE,
  AI_STUDIO_WORKFLOW_PLAN_CTA_HREF,
  resolveAiStudioWorkflowNavigationAccess,
  resolveAiStudioWorkflowPlanAccess,
  type AiStudioWorkflowPlanAccess,
} from "../../../lib/billing/aiStudioWorkflowEntitlements";
import { buildProfileSectionHref } from "../../profile/profileNavigation";
import {
  resolveWorkflowReloadCharacterContextCandidate,
  resolveWorkflowReloadCharacterSelection,
} from "../logic/workflowReloadCharacterRestore";
import { isManualWorkflowReloadEnabled } from "../logic/workflowReloadAvailability";
import { useAiStudioPageUiNotices } from "../hooks/useAiStudioPageUiNotices";
import {
  useAiStudioPageBaseRuntime,
  type AiStudioPageBaseRuntime,
} from "../hooks/useAiStudioPageBaseRuntime";
import { useAiStudioPageContentRuntime } from "../hooks/useAiStudioPageContentRuntime";
import { useAiStudioPageGenerationRuntime } from "../hooks/useAiStudioPageGenerationRuntime";
import { useAiStudioMediaAutosaveOrchestrator } from "../hooks/useAiStudioMediaAutosaveOrchestrator";
import { useAiStudioPageProjectSessionRuntime } from "../hooks/useAiStudioPageProjectSessionRuntime";
import { useAiStudioShellRuntime } from "../hooks/useAiStudioShellRuntime";
import { useAiStudioAudioRerollController } from "../hooks/useAiStudioAudioRerollController";
import { useAiStudioCreatePanelRuntime } from "../hooks/useAiStudioCreatePanelRuntime";
import { useAiStudioEditVideoPanelRuntimes } from "../hooks/useAiStudioEditVideoPanelRuntimes";
import { useAiStudioReferenceExperienceRuntime } from "../hooks/useAiStudioReferenceExperienceRuntime";
import { resolveMediaStorageQuotaUserMessage } from "../../../lib/mediaStorageQuota";
import { useMediaStorageQuotaSummary } from "../../billing/useMediaStorageQuotaSummary";
import { consumeBillingReturnSyncPending } from "../../billing/clientBillingReturnSync";
import { shouldDeferAiStudioBackgroundWork } from "../logic/aiStudioPressureConservation";
import { useResolvedAccountPlan } from "../../billing/useResolvedAccountPlan";
import { useCreatePulsePresetPageRuntime } from "../hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime";
import type { CreatePageAgentRuntime } from "../createRuntime/contracts";
import { usePulseCreateAgentRuntime } from "../createRuntime/usePulseCreateAgentRuntime";
import { useStandardCreateAgentRuntime } from "../createRuntime/useStandardCreateAgentRuntime";
import type { MediaFileRow } from "../logic/mediaLibraryModalModel";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import {
  createEmptyPulseChatProjectState,
  type PulseChatProjectState,
} from "../pulseChats/pulseChatThread";
import {
  patchAiStudioSessionSnapshotWorkspace,
  patchAiStudioSessionSnapshotPulseChats,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../logic/sessionSnapshot";
import {
  createDefaultRightRailLayout,
  sanitizeRightRailLayoutSnapshot,
} from "../logic/rightRailLayout";
import { PERF_FLAG_PAGE_OUTPUT_DECOUPLE } from "../logic/perfProfileFlags";
const FLAG_PAGE_OUTPUT_DECOUPLE = PERF_FLAG_PAGE_OUTPUT_DECOUPLE;
type CreatePulsePresetPageRuntime = ReturnType<typeof useCreatePulsePresetPageRuntime>;
type CreateRuntimeRootSharedProps = {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
};

const WORKFLOW_PLAN_ACCESS_CTA_ARIA_LABEL = "View subscription plans";

const formatAiStudioPendingSubscriptionDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

export const resolveWorkflowPlanAccessCta = (
  access: AiStudioWorkflowPlanAccess,
  options: { fromPath?: unknown } = {}
) => {
  if (access.allowed || !access.restriction) return null;
  return {
    label: access.restriction.ctaLabel,
    href:
      access.restriction.ctaHref === AI_STUDIO_WORKFLOW_PLAN_CTA_HREF
        ? buildProfileSectionHref({ section: "subscription", fromPath: options.fromPath })
        : access.restriction.ctaHref,
    ariaLabel: WORKFLOW_PLAN_ACCESS_CTA_ARIA_LABEL,
  };
};

type AiStudioRouteDebugWindow = Window & {
  __shortpulseAiStudioRouteDebug?: {
    href: string;
    search: string;
    stage: string;
    updatedAt: string;
  };
};

const recordAiStudioRouteDebug = (stage: string) => {
  if (typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("perfAuditRuntime") !== "1") return;
  (window as AiStudioRouteDebugWindow).__shortpulseAiStudioRouteDebug = {
    href: window.location.href,
    search: window.location.search,
    stage,
    updatedAt: new Date().toISOString(),
  };
};

export default function AiStudioPage() {
  React.useEffect(() => {
    recordAiStudioRouteDebug("route_app_mounted");
    const stableUrlCheckId = window.setTimeout(
      () => recordAiStudioRouteDebug("route_app_stable_url"),
      0
    );

    return () => {
      window.clearTimeout(stableUrlCheckId);
    };
  }, []);
  const base = useAiStudioPageBaseRuntime();
  return <CreateRuntimeRoot base={base} />;
}

const CreateRuntimeRoot = ({ base }: { base: AiStudioPageBaseRuntime }) => {
  const { setPulseCreatePrompt } = base;
  const { refreshBalance, setUiNotice } = base;
  const clearPulsePromptForPage = useCallback(() => {
    setPulseCreatePrompt("");
  }, [setPulseCreatePrompt]);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const checkoutState = url.searchParams.get("checkout");
    const billingReturnSync = consumeBillingReturnSyncPending();
    const shouldRefreshSubscriptionCredits =
      checkoutState === "subscription_success" || billingReturnSync?.scope === "subscription";
    if (
      checkoutState !== "credits_success" &&
      checkoutState !== "credits_cancel" &&
      !shouldRefreshSubscriptionCredits
    ) {
      return;
    }
    if (checkoutState === "credits_cancel") {
      setUiNotice("Credit top-up was canceled.");
    } else if (checkoutState === "credits_success") {
      setUiNotice("Credit purchase completed. Refreshing credits...");
      void refreshBalance({ silent: true }).then((balance) => {
        setUiNotice(
          typeof balance === "number"
            ? "Credits refreshed. You can continue generating."
            : "Payment is processing. Refresh credits in a moment if the balance has not updated."
        );
      });
    } else if (shouldRefreshSubscriptionCredits) {
      setUiNotice("Plan update completed. Refreshing credits...");
      void refreshBalance({ silent: true }).then((balance) => {
        setUiNotice(
          typeof balance === "number"
            ? "Credits refreshed. You can continue generating."
            : "Plan update is processing. Refresh credits in a moment if the balance has not updated."
        );
      });
    }
    url.searchParams.delete("checkout");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [refreshBalance, setUiNotice]);
  const createPulsePageRuntime = useCreatePulsePresetPageRuntime({
    selectedTool: base.selectedTool,
    expertCreateMode: base.expertCreateMode,
    activeCreatePulsePresetId: base.activeCreatePulsePresetId,
    pulseSessionInstanceId: base.pulseSessionInstanceId,
    pulseWorkflowSession: base.pulseWorkflowSession,
    loadSavedPresetPreferences: base.expertCreateMode === "pulse",
    getAgentContext: base.getAgentContext,
    clearPulseRuntime: base.clearPulseRuntime,
    clearPulsePrompt: clearPulsePromptForPage,
    handleExpertCreateModeChange: base.handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange: base.handleActiveCreatePulsePresetIdChange,
  });
  const [lastProjectScopeKey, setLastProjectScopeKey] = React.useState<string | null>(null);
  const projectScopeKey = resolveAiStudioRuntimeScopeKey({
    previousScopeKey: lastProjectScopeKey,
    projectId: base.projectId,
    projectRouteRequested: base.projectRouteRequested,
    projectStatus: base.projectStatus,
    requestedProjectId: base.requestedProjectId,
  });
  React.useEffect(() => {
    setLastProjectScopeKey((previousScopeKey) =>
      previousScopeKey === projectScopeKey ? previousScopeKey : projectScopeKey
    );
  }, [projectScopeKey]);
  return (
    <CreateAgentRuntimeHost
      key={projectScopeKey}
      base={base}
      createPulsePageRuntime={createPulsePageRuntime}
    />
  );
};

const CreateAgentRuntimeHost = ({ base, createPulsePageRuntime }: CreateRuntimeRootSharedProps) => {
  const [projectPulseChatState, setProjectPulseChatState] = useState(() =>
    createEmptyPulseChatProjectState()
  );
  const standardCreateAgentRuntime = useStandardCreateAgentRuntime({
    sessionId: base.sessionId,
    mode: base.mode,
    selectedTool: base.selectedTool,
    prompt: base.standardPrompt,
    getAgentContext: base.getAgentContext,
    setStandardCreatePrompt: base.setStandardCreatePrompt,
    findOutputById: base.findOutputById,
    resolvePanelOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    resolveInternalImageDropSource: base.resolveComposerInternalImageDropSource,
    setUiNotice: base.setUiNotice,
    trackAgentUiEvent: base.trackUiEvent,
  });
  const pulseCreateAgentRuntime = usePulseCreateAgentRuntime({
    sessionId: base.sessionId,
    mode: base.mode,
    selectedTool: base.selectedTool,
    prompt: base.pulsePrompt,
    activePresetSnapshot: createPulsePageRuntime.activeCreatePulsePresetSnapshot,
    activePresetId: base.activeCreatePulsePresetId,
    sessionInstanceId: base.pulseSessionInstanceId,
    workflowSession: base.pulseWorkflowSession,
    setWorkflowSession: base.setPulseWorkflowSession,
    clearRuntime: createPulsePageRuntime.clearPulseRuntimeForPage,
    restartPulse: base.restartPulse,
    getAgentContext: createPulsePageRuntime.pulseCreateAgentContextResolver,
    setPulseCreatePrompt: base.setPulseCreatePrompt,
    findOutputById: base.findOutputById,
    resolvePanelOutputPreviewUrl: base.resolvePanelOutputPreviewUrl,
    resolveInternalImageDropSource: base.resolveComposerInternalImageDropSource,
    setUiNotice: base.setUiNotice,
    trackAgentUiEvent: base.trackUiEvent,
  });
  const activeCreateAgentRuntime =
    base.expertCreateMode === "pulse" ? pulseCreateAgentRuntime : standardCreateAgentRuntime;
  const { setStandardCreateWorkflowReloadPrep } = base;
  React.useEffect(() => {
    setStandardCreateWorkflowReloadPrep(standardCreateAgentRuntime.prepareForWorkflowReload);
    return () => {
      setStandardCreateWorkflowReloadPrep(null);
    };
  }, [setStandardCreateWorkflowReloadPrep, standardCreateAgentRuntime.prepareForWorkflowReload]);

  return (
    <AiStudioPageRuntimeBody
      base={base}
      createPulsePageRuntime={createPulsePageRuntime}
      projectPulseChatState={projectPulseChatState}
      setProjectPulseChatState={setProjectPulseChatState}
      standardCreateAgentRuntime={standardCreateAgentRuntime}
      pulseCreateAgentRuntime={pulseCreateAgentRuntime}
      activeCreateAgentRuntime={activeCreateAgentRuntime}
    />
  );
};

const AiStudioPageRuntimeBody = ({
  base,
  createPulsePageRuntime,
  projectPulseChatState,
  setProjectPulseChatState,
  standardCreateAgentRuntime,
  pulseCreateAgentRuntime,
  activeCreateAgentRuntime,
}: {
  base: AiStudioPageBaseRuntime;
  createPulsePageRuntime: CreatePulsePresetPageRuntime;
  projectPulseChatState: PulseChatProjectState;
  setProjectPulseChatState: React.Dispatch<React.SetStateAction<PulseChatProjectState>>;
  standardCreateAgentRuntime: ReturnType<typeof useStandardCreateAgentRuntime>;
  pulseCreateAgentRuntime: ReturnType<typeof usePulseCreateAgentRuntime>;
  activeCreateAgentRuntime: CreatePageAgentRuntime;
}) => {
  const {
    pendingSubscriptionChange,
    resolvedPlan,
    status: resolvedPlanStatus,
  } = useResolvedAccountPlan();
  const studioProfileReturnPath = base.router.asPath;
  const [dismissedBillingPlanNoticeKey, setDismissedBillingPlanNoticeKey] = useState<string | null>(
    null
  );
  const billingPlanNoticeKey = pendingSubscriptionChange
    ? `${pendingSubscriptionChange.targetPlanId}:${pendingSubscriptionChange.effectiveAt}`
    : null;
  const billingPlanNoticeMessage =
    pendingSubscriptionChange && billingPlanNoticeKey !== dismissedBillingPlanNoticeKey
      ? `${pendingSubscriptionChange.targetPlanLabel} is scheduled for ${formatAiStudioPendingSubscriptionDate(
          pendingSubscriptionChange.effectiveAt
        )}. Your current plan stays active until then.`
      : null;
  const billingPlanNoticeHref = React.useMemo(
    () => buildProfileSectionHref({ section: "subscription", fromPath: studioProfileReturnPath }),
    [studioProfileReturnPath]
  );
  const generationAccessCta = React.useMemo(
    () =>
      resolveGenerationAccessCta({
        resolvedPlan,
        status: resolvedPlanStatus,
      }),
    [resolvedPlan, resolvedPlanStatus]
  );
  const workflowGenerateAccessCta = React.useMemo(() => {
    if (resolvedPlanStatus !== "ready" || !resolvedPlan) return null;
    const access = resolveAiStudioWorkflowPlanAccess({
      planId: resolvedPlan.id,
      mode: "video",
    });
    return resolveWorkflowPlanAccessCta(access, { fromPath: studioProfileReturnPath });
  }, [resolvedPlan, resolvedPlanStatus, studioProfileReturnPath]);
  const workflowNavigationAccessCta = React.useMemo(() => {
    if (resolvedPlanStatus !== "ready" || !resolvedPlan) return null;
    const access = resolveAiStudioWorkflowNavigationAccess({
      planId: resolvedPlan.id,
      mode: "video",
    });
    return resolveWorkflowPlanAccessCta(access, { fromPath: studioProfileReturnPath });
  }, [resolvedPlan, resolvedPlanStatus, studioProfileReturnPath]);
  const [isMediaPlanNoticeVisible, setIsMediaPlanNoticeVisible] = useState(false);
  const [isWorkflowPlanNoticeVisible, setIsWorkflowPlanNoticeVisible] = useState(false);
  React.useEffect(() => {
    if (!generationAccessCta) {
      setIsMediaPlanNoticeVisible(false);
    }
  }, [generationAccessCta]);
  React.useEffect(() => {
    if (!workflowGenerateAccessCta) {
      setIsWorkflowPlanNoticeVisible(false);
    }
  }, [workflowGenerateAccessCta]);
  const {
    activeCreatePrompt,
    activeCreatePulsePresetId,
    activeOutput,
    activeOutputId,
    activeSessionPersistenceSessionId,
    addCharacterReferences,
    addLibraryMediaReference,
    addLibraryMediaReferences,
    addLibraryPromptReference,
    addOutputsFromFiles,
    ingestReferenceFiles,
    aspect,
    balanceCredits,
    balanceError,
    balanceLoading,
    buildProjectWorkspaceSnapshot,
    buildSessionSnapshot,
    canvasSessionState,
    characterCreateRequestKey,
    closeModelModal,
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    handleCharacterPanelSelectedCharacterChange,
    editReferenceText,
    editSubmitIntent,
    effectiveBalanceCredits,
    elementCreateRequestKey,
    expertCreateMode,
    expertEditSessionRevision,
    extraImageUrls,
    generateOutput,
    getExpertEditSessionState,
    getDefaultDurationSeconds,
    flushCanvasSessionState,
    hydrateCanvasSessionState,
    hydrateFromSessionSnapshot,
    imageResolution,
    insertOptimisticGenerationPlaceholder,
    isRailCanvasInteractionActive,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    isProjectsModalOpen,
    klingElements,
    klingMultiPrompts,
    klingWorkflowMode,
    mediaAutosaveEnabled,
    mediaAutosaveError,
    mediaAutosaveSyncState,
    mode,
    model,
    modelPricingPolicy,
    modelPricingPolicyError,
    modelPricingPolicyLoading,
    modelPricingPolicyReady,
    motionReferenceVideoError,
    motionReferenceVideoPending,
    motionReferenceVideoUrl,
    notifyGenerationFailure,
    openModelModal,
    optimisticDebitEntries,
    outputs,
    pendingCharacterUploadRequest,
    pendingHoldCredits,
    project,
    projectError,
    projectId,
    projectRouteRequested,
    projectWorkspaceCriticalSaveSignal,
    projectStatus,
    pulseWorkflowSession,
    referenceGridFileInputRef,
    referenceGridPreconnectOrigin,
    referenceImageUrl,
    refreshBalance,
    refreshCharacterModeInjectionBundleForSubmission,
    refreshCharacterOptions,
    regenerateOutput,
    lipSyncAudio,
    removedFromAllRefsIds,
    removeOptimisticGenerationPlaceholder,
    removeReferencesForDeletedMedia,
    saveReferenceToLibrary,
    clearPendingCharacterUploadRequest,
    resolveCharacterAvatarUrlById,
    resolveCharacterDropReference,
    resolveCharacterModeSubmissionOverrides,
    resolveElementProfileImageDropSource,
    resolveIsCharacterModeEnabledForTool,
    resolveMediaLibraryInternalDropItem,
    resolveReferenceInputsForTool,
    resolveSelectedCharacterIdForTool,
    resolveStyleLibraryInternalDrop,
    resolveVoiceChangerInternalReferenceSource,
    seedance2InputMode,
    seedance2ReferenceAudioUrls,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    selectedStyleContext,
    selectedTool,
    sessionId,
    sessionPersistenceTitleOverride,
    setActiveOutputId,
    setCreateCharacterWorkflowReloadPrep,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setDetailOutputId,
    setEditReferenceText,
    setExpertEditSessionState,
    setIsCreateCharacterModeEnabled,
    setMode,
    setModel,
    setOptimisticDebitEntries,
    setOutputs,
    setPulseCreatePrompt,
    setSelectedStyleContext,
    setSelectedStylePrompt,
    setSelectedToolWithEditIntentReset,
    setShowCreateTools,
    setStandardCreatePrompt,
    setUiError,
    setUiNotice,
    setVideoReferenceText,
    showCreateTools,
    trackCharacterModeFallback,
    trackUiEvent,
    uiError,
    uiNotice,
    updateOutputById,
    useReferenceImageIndicator,
    videoDurationSeconds,
    videoGenerateAudio,
    videoReferenceMode,
    videoReferenceText,
    videoResolution,
  } = base;
  const handleMediaPlanAccessAttempt = useCallback(() => {
    if (!generationAccessCta) return;
    setIsMediaPlanNoticeVisible(true);
    setUiError((current) => (resolveMediaStorageQuotaUserMessage(current) ? null : current));
  }, [generationAccessCta, setUiError]);
  const handleWorkflowPlanAccessAttempt = useCallback(() => {
    if (!workflowGenerateAccessCta) return;
    setIsWorkflowPlanNoticeVisible(true);
  }, [workflowGenerateAccessCta]);
  const [rightRailLayout, setRightRailLayout] = useState(createDefaultRightRailLayout);
  const hydrateRightRailLayout = useCallback((layout: unknown) => {
    setRightRailLayout(sanitizeRightRailLayoutSnapshot(layout));
  }, []);
  const workspaceRuntimeKey = projectId ? null : sessionId ? `session:${sessionId}` : null;
  const { quotaSummary } = useMediaStorageQuotaSummary({
    enabled: true,
    shouldDeferAutomaticRefresh: shouldDeferAiStudioBackgroundWork,
  });
  const isMediaStorageFull = quotaSummary?.isOverLimit === true;
  const { activeCreatePulsePresetSnapshot, beginPulseActivation, hasActivePulseSession } =
    createPulsePageRuntime;
  const {
    linkedPromptReferenceIds,
    setPromptOrigin,
    persistedAgentRuntime,
    resetProjectAgentConversation: resetActiveProjectAgentConversation,
    hydrateFromSessionAgentSnapshot: hydrateActiveFromSessionAgentSnapshot,
  } = activeCreateAgentRuntime;
  const visiblePulseCreateAgentRuntime =
    activeCreateAgentRuntime.kind === "pulse" ? activeCreateAgentRuntime : null;
  const handlePulsePresetStart = visiblePulseCreateAgentRuntime?.handlePulsePresetStart;
  const handlePulsePresetRestartRuntime = visiblePulseCreateAgentRuntime?.handlePulsePresetRestart;
  const createCharacterWorkflowReloadRequestRef = React.useRef(0);
  React.useEffect(() => {
    setCreateCharacterWorkflowReloadPrep((characterContext) => {
      const requestId = createCharacterWorkflowReloadRequestRef.current + 1;
      createCharacterWorkflowReloadRequestRef.current = requestId;
      const candidateSelection = resolveWorkflowReloadCharacterContextCandidate(characterContext);
      const clearCharacterWorkflowReloadSelection = () => {
        if (createCharacterWorkflowReloadRequestRef.current !== requestId) return;
        setIsCreateCharacterModeEnabled(false);
        setCreateSelectedCharacterId("");
        setCreateSelectedCharacterLookId("");
      };
      const applyCharacterWorkflowReloadSelection = ({
        characterId,
        lookId,
      }: {
        characterId: string;
        lookId: string;
      }) => {
        if (createCharacterWorkflowReloadRequestRef.current !== requestId) return;
        setIsCreateCharacterModeEnabled(true);
        setCreateSelectedCharacterId(characterId);
        setCreateSelectedCharacterLookId(lookId);
      };

      if (!candidateSelection) {
        clearCharacterWorkflowReloadSelection();
        return;
      }
      applyCharacterWorkflowReloadSelection(candidateSelection);
      void refreshCharacterOptions()
        .then((refreshedCharacterOptions) => {
          const refreshedSelection = resolveWorkflowReloadCharacterSelection({
            characterContext,
            characterOptions: refreshedCharacterOptions,
          });
          if (!refreshedSelection) {
            clearCharacterWorkflowReloadSelection();
            return;
          }
          applyCharacterWorkflowReloadSelection(refreshedSelection);
        })
        .catch(() => {
          // Submit-time character refresh remains the fail-closed guard if live options cannot load.
        });
    });
    return () => {
      createCharacterWorkflowReloadRequestRef.current += 1;
      setCreateCharacterWorkflowReloadPrep(null);
    };
  }, [
    refreshCharacterOptions,
    setCreateCharacterWorkflowReloadPrep,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setIsCreateCharacterModeEnabled,
  ]);
  const handleStandardCreatePromptChange = useCallback(
    (value: string) => {
      setStandardCreatePrompt(value);
      setPromptOrigin("manual");
    },
    [setPromptOrigin, setStandardCreatePrompt]
  );
  const handlePulseCreatePromptChange = useCallback(
    (value: string) => {
      setPulseCreatePrompt(value);
      setPromptOrigin("manual");
    },
    [setPromptOrigin, setPulseCreatePrompt]
  );
  const setCreatePromptForActiveMode =
    activeCreateAgentRuntime.kind === "pulse" ? setPulseCreatePrompt : setStandardCreatePrompt;

  const handleCreatePulsePresetStart = useCallback(
    async (
      preset: Parameters<NonNullable<typeof handlePulsePresetStart>>[0],
      options?: Parameters<NonNullable<typeof handlePulsePresetStart>>[1]
    ) => {
      if (!handlePulsePresetStart) {
        return {
          status: "failed" as const,
          reason: "scope_discarded" as const,
          message: "Pulse runtime is inactive.",
        };
      }
      const previousActivePresetSnapshot = activeCreatePulsePresetSnapshot;
      const activation = beginPulseActivation(preset);
      try {
        const result = await handlePulsePresetStart(preset, {
          pulseSessionInstanceId: options?.pulseSessionInstanceId ?? null,
          deferWorkflowSessionCommit: options?.deferWorkflowSessionCommit ?? false,
          activationIsCurrent: activation.isCurrent,
          allowInterruptCurrentPulse: options?.allowInterruptCurrentPulse,
        });
        if (!activation.isCurrent()) {
          return {
            status: "failed" as const,
            reason: "scope_discarded" as const,
            message: "Pulse session changed before kickoff completed. Try again.",
          };
        }
        if (result.status !== "started") {
          activation.restoreSnapshot(previousActivePresetSnapshot ?? null);
        }
        return result;
      } catch (error) {
        activation.restoreSnapshot(previousActivePresetSnapshot ?? null);
        throw error;
      } finally {
        activation.clearPending();
      }
    },
    [activeCreatePulsePresetSnapshot, beginPulseActivation, handlePulsePresetStart]
  );
  const handleCreatePulsePresetRestart = useCallback(
    async (
      preset: Parameters<NonNullable<typeof handlePulsePresetRestartRuntime>>[0]
    ): Promise<void> => {
      if (!handlePulsePresetRestartRuntime) return;
      const previousActivePresetSnapshot = activeCreatePulsePresetSnapshot;
      const activation = beginPulseActivation(preset);
      try {
        await handlePulsePresetRestartRuntime(preset, {
          activationIsCurrent: activation.isCurrent,
        });
      } catch (error) {
        activation.restoreSnapshot(previousActivePresetSnapshot ?? null);
        throw error;
      } finally {
        activation.clearPending();
      }
    },
    [activeCreatePulsePresetSnapshot, beginPulseActivation, handlePulsePresetRestartRuntime]
  );
  const patchProjectWorkspaceSnapshot = useCallback(
    (snapshot: AiStudioSessionSnapshot) => {
      if (snapshot.schemaVersion < 2) {
        return snapshot;
      }
      const snapshotWithRightRailLayout = patchAiStudioSessionSnapshotWorkspace(
        snapshot as AiStudioSessionSnapshotV2,
        { rightRailLayout: sanitizeRightRailLayoutSnapshot(rightRailLayout) }
      );
      return patchAiStudioSessionSnapshotPulseChats(
        snapshotWithRightRailLayout,
        projectPulseChatState.threads.length > 0 ? projectPulseChatState : null
      );
    },
    [projectPulseChatState, rightRailLayout]
  );
  const {
    sessionRestoreCandidate,
    projectBootstrapSettled,
    projectBootstrapApplied,
    projectBootstrapError,
    projectWorkspaceStaleProjectId,
    retryProjectBootstrap,
    flushProjectWorkspaceSnapshot,
    resetProjectWorkspace,
  } = useAiStudioPageProjectSessionRuntime({
    activeCreateAgentKind: activeCreateAgentRuntime.kind,
    activeCreatePulsePresetId,
    activeSessionPersistenceSessionId,
    buildProjectWorkspaceSnapshot,
    buildSessionSnapshot,
    projectBootstrapId: base.bootstrapProjectId,
    canvasSessionState,
    flushCanvasSessionState,
    createSelectedCharacterId,
    createSelectedCharacterLookId,
    expertCreateMode,
    expertEditSessionRevision,
    getExpertEditSessionState,
    hasActivePulseSession,
    hydrateActiveFromSessionAgentSnapshot,
    hydratePulseFromSessionAgentSnapshot: pulseCreateAgentRuntime.hydrateFromSessionAgentSnapshot,
    hydrateStandardFromSessionAgentSnapshot:
      standardCreateAgentRuntime.hydrateFromSessionAgentSnapshot,
    hydrateCanvasSessionState,
    hydrateFromSessionSnapshot,
    hydrateRightRailLayout,
    isAutosaveWorkDeferred: isRailCanvasInteractionActive,
    immediateSaveSignal: projectWorkspaceCriticalSaveSignal,
    patchProjectWorkspaceSnapshot,
    persistedAgentRuntime,
    persistedPulseAgentRuntime: pulseCreateAgentRuntime.persistedAgentRuntime,
    persistedStandardAgentRuntime: standardCreateAgentRuntime.persistedAgentRuntime,
    projectId,
    projectRouteRequested,
    setProjectPulseChatState,
    pulseSessionInstanceId: base.pulseSessionInstanceId,
    pulseWorkflowSession,
    resetActiveProjectAgentConversation,
    resetPulseProjectAgentConversation: pulseCreateAgentRuntime.resetProjectAgentConversation,
    resetStandardProjectAgentConversation: standardCreateAgentRuntime.resetProjectAgentConversation,
    sessionPersistenceTitleOverride,
    setCreateSelectedCharacterId,
    setCreateSelectedCharacterLookId,
    setIsCreateCharacterModeEnabled,
    setExpertEditSessionState,
    setMusicPromptDraft: base.setMusicPromptDraft,
    setMusicLyricsDraft: base.setMusicLyricsDraft,
    setSoundEffectsPromptDraft: base.setSoundEffectsPromptDraft,
    setUiNotice,
    setVoiceDesignPromptDraft: base.setVoiceDesignPromptDraft,
    setVoiceScriptDraft: base.setVoiceScriptDraft,
  });
  useAiStudioMediaAutosaveOrchestrator({
    enabled: resolveAiStudioMediaAutosaveRouteEnabled({
      projectRouteRequested,
      projectStatus,
      projectBootstrapSettled,
    }),
    isMediaStorageFull,
    outputs,
    mediaAutosaveEnabled,
    mediaAutosaveSyncState,
    saveReferenceToLibrary,
  });
  const triggerFilePicker = useCallback(() => {
    referenceGridFileInputRef.current?.click();
  }, [referenceGridFileInputRef]);
  const dismissError = () => setUiError(null);
  const dismissNotice = () => setUiNotice(null);
  const { effectiveUiNotice } = useAiStudioPageUiNotices({
    expertCreateMode,
    uiNotice,
    mediaAutosaveError,
    mediaAutosaveSyncState,
  });
  const {
    currentCostCredits,
    dismissFailure,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    filteredModelOptions,
    focusFailure,
    handleEditPromptTextChange,
    handleFileBrowserSelection,
    handleGenerate,
    handleImageRegenerateWithDebit,
    handleManualPromptChange,
    handleMusicGenerate,
    handleOpenMediaLibrary,
    handleOpenModelModal,
    handleReferenceGridFiles,
    handleRegenerateWithDebit,
    handleSelectModelFromModal,
    handleSelectOutput,
    handleSoundEffectsGenerate,
    handleToolSelect,
    handleVideoPromptTextChange,
    handleVoicesGenerate,
    hasSufficientCreditsForPromptReferenceGenerate,
    isTemplateView,
    musicIsGenerating,
    promptReferenceGenerateCostCredits,
    referenceImageWarning,
    resolveModelPickerCredits,
    soundEffectsIsGenerating,
    visibleFailures,
    voicesIsGenerating,
  } = useAiStudioPageGenerationRuntime({
    activeCreatePrompt,
    activeOutput,
    activeOutputId,
    addCharacterReferences,
    addOutputsFromFiles,
    aspect,
    balanceCredits,
    balanceError,
    balanceLoading,
    closeModelModal,
    createCharacterModeInjectionBundle,
    createSelectedCharacterId,
    editReferenceText,
    editSubmitIntent,
    extraImageUrls,
    generateOutput,
    getDefaultDurationSeconds,
    imageResolution,
    insertOptimisticGenerationPlaceholder,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    klingElements,
    klingMultiPrompts,
    klingWorkflowMode,
    mode,
    model,
    modelPricingPolicy,
    modelPricingPolicyError,
    modelPricingPolicyLoading,
    modelPricingPolicyReady,
    lipSyncAudio,
    motionReferenceVideoError,
    motionReferenceVideoPending,
    motionReferenceVideoUrl,
    notifyGenerationFailure,
    optimisticDebitEntries,
    removedFromAllRefsIds,
    outputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : outputs,
    openModelModal,
    projectId,
    workspaceRuntimeKey,
    referenceImageUrl,
    refreshBalance,
    refreshCharacterModeInjectionBundleForSubmission,
    regenerateOutput,
    removeOptimisticGenerationPlaceholder,
    resolveCharacterModeSubmissionOverrides,
    resolveIsCharacterModeEnabledForTool,
    resolveReferenceInputsForTool,
    resolveSelectedCharacterIdForTool,
    seedance2InputMode,
    seedance2ReferenceAudioUrls,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    selectedStyleContext,
    selectedTool,
    setActiveOutputId,
    setDetailOutputId,
    setEditReferenceText,
    setMode,
    setModel,
    setOptimisticDebitEntries,
    setOutputs,
    setPromptOrigin,
    setCreatePromptForActiveMode,
    setShowCreateTools,
    setUiError,
    setUiNotice,
    setVideoReferenceText,
    setSelectedToolWithEditIntentReset,
    trackCharacterModeFallback,
    trackUiEvent,
    updateOutputById,
    useReferenceImageIndicator,
    videoDurationSeconds,
    videoGenerateAudio,
    videoReferenceMode,
    videoReferenceText,
    videoResolution,
  });
  const isWorkflowPlanBlocked = useCallback(
    ({
      selectedTool: workflowTool,
      mode: workflowMode,
    }: {
      selectedTool?: ToolId | string | null;
      mode?: StudioMode | string | null;
    }): boolean => {
      if (resolvedPlanStatus !== "ready" || !resolvedPlan) return false;
      return !resolveAiStudioWorkflowPlanAccess({
        planId: resolvedPlan.id,
        selectedTool: workflowTool,
        mode: workflowMode,
      }).allowed;
    },
    [resolvedPlan, resolvedPlanStatus]
  );
  const isWorkflowNavigationBlocked = useCallback(
    ({
      selectedTool: workflowTool,
      mode: workflowMode,
    }: {
      selectedTool?: ToolId | string | null;
      mode?: StudioMode | string | null;
    }): boolean => {
      if (resolvedPlanStatus !== "ready" || !resolvedPlan) return false;
      return !resolveAiStudioWorkflowNavigationAccess({
        planId: resolvedPlan.id,
        selectedTool: workflowTool,
        mode: workflowMode,
      }).allowed;
    },
    [resolvedPlan, resolvedPlanStatus]
  );
  const resolveStudioOutputWorkflowTool = useCallback(
    (output: StudioOutput): ToolId | string | null =>
      output.workflowReload?.originTool ?? output.audioSourceMode ?? null,
    []
  );
  const isStudioOutputWorkflowPlanBlocked = useCallback(
    (output: StudioOutput | null | undefined): boolean =>
      output
        ? isWorkflowPlanBlocked({
            selectedTool: resolveStudioOutputWorkflowTool(output),
            mode: output.workflowReload?.outputMode ?? output.mode,
          })
        : false,
    [isWorkflowPlanBlocked, resolveStudioOutputWorkflowTool]
  );
  const guardedHandleToolSelect = useCallback(
    (tool: ToolId | null) => {
      if (isWorkflowNavigationBlocked({ selectedTool: tool })) {
        handleWorkflowPlanAccessAttempt();
        return;
      }
      handleToolSelect(tool);
    },
    [handleToolSelect, handleWorkflowPlanAccessAttempt, isWorkflowNavigationBlocked]
  );
  React.useEffect(() => {
    if (!isWorkflowNavigationBlocked({ selectedTool })) return;
    handleWorkflowPlanAccessAttempt();
    handleToolSelect("create");
  }, [
    handleToolSelect,
    handleWorkflowPlanAccessAttempt,
    isWorkflowNavigationBlocked,
    selectedTool,
  ]);
  const guardedHandleGenerate = useCallback(
    async (...args: Parameters<typeof handleGenerate>): ReturnType<typeof handleGenerate> => {
      const options = args[1];
      if (
        isWorkflowPlanBlocked({
          selectedTool: options?.toolOverride ?? selectedTool,
          mode: options?.modeOverride ?? mode,
        })
      ) {
        handleWorkflowPlanAccessAttempt();
        return { accepted: false, optimisticOutputId: null };
      }
      return handleGenerate(...args);
    },
    [handleGenerate, handleWorkflowPlanAccessAttempt, isWorkflowPlanBlocked, mode, selectedTool]
  );
  const guardedHandleRegenerateWithDebit = useCallback(
    async (
      ...args: Parameters<typeof handleRegenerateWithDebit>
    ): ReturnType<typeof handleRegenerateWithDebit> => {
      if (isWorkflowPlanBlocked({ selectedTool: "video", mode: "video" })) {
        handleWorkflowPlanAccessAttempt();
        return;
      }
      return handleRegenerateWithDebit(...args);
    },
    [handleRegenerateWithDebit, handleWorkflowPlanAccessAttempt, isWorkflowPlanBlocked]
  );
  const guardedHandleMusicGenerate = useCallback(
    async (
      ...args: Parameters<typeof handleMusicGenerate>
    ): ReturnType<typeof handleMusicGenerate> => {
      if (isWorkflowPlanBlocked({ selectedTool: "music", mode: "audio" })) {
        handleWorkflowPlanAccessAttempt();
        return false;
      }
      return handleMusicGenerate(...args);
    },
    [handleMusicGenerate, handleWorkflowPlanAccessAttempt, isWorkflowPlanBlocked]
  );
  const guardedHandleSoundEffectsGenerate = useCallback(
    async (
      ...args: Parameters<typeof handleSoundEffectsGenerate>
    ): ReturnType<typeof handleSoundEffectsGenerate> => {
      if (isWorkflowPlanBlocked({ selectedTool: "sound-effects", mode: "audio" })) {
        handleWorkflowPlanAccessAttempt();
        return;
      }
      return handleSoundEffectsGenerate(...args);
    },
    [handleSoundEffectsGenerate, handleWorkflowPlanAccessAttempt, isWorkflowPlanBlocked]
  );
  const guardedHandleVoicesGenerate = useCallback(
    async (
      ...args: Parameters<typeof handleVoicesGenerate>
    ): ReturnType<typeof handleVoicesGenerate> => {
      const request = args[0];
      const requestedTool = request.mode === "voiceover" ? "text-to-speech" : "voice-changer";
      if (isWorkflowPlanBlocked({ selectedTool: requestedTool, mode: "audio" })) {
        handleWorkflowPlanAccessAttempt();
        return;
      }
      return handleVoicesGenerate(...args);
    },
    [handleVoicesGenerate, handleWorkflowPlanAccessAttempt, isWorkflowPlanBlocked]
  );
  const handleFileBrowserSelectionWithPlanNotice = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0 && generationAccessCta) {
        handleMediaPlanAccessAttempt();
        event.target.value = "";
        return;
      }
      handleFileBrowserSelection(event);
    },
    [generationAccessCta, handleFileBrowserSelection, handleMediaPlanAccessAttempt]
  );
  const handleReferenceGridFilesWithPlanNotice = useCallback(
    (files: FileList) => {
      if (files.length > 0 && generationAccessCta) {
        handleMediaPlanAccessAttempt();
        return;
      }
      handleReferenceGridFiles(files);
    },
    [generationAccessCta, handleMediaPlanAccessAttempt, handleReferenceGridFiles]
  );
  const { rerollAudioOutputFromWorkflow, rerollAudioStudioOutputFromWorkflow } =
    useAiStudioAudioRerollController({
      findOutputById: base.findOutputById,
      handleVoicesGenerate: guardedHandleVoicesGenerate,
      handleMusicGenerate: guardedHandleMusicGenerate,
      handleSoundEffectsGenerate: guardedHandleSoundEffectsGenerate,
      setUiNotice,
    });
  const rerollOutputFromReplay = base.rerollOutputFromReplay;
  const rerollStudioOutputFromReplay = base.rerollStudioOutputFromReplay;
  const handleRerollOutputFromWorkflow = useCallback(
    (outputId: string) => {
      const output = base.findOutputById(outputId.trim());
      if (isStudioOutputWorkflowPlanBlocked(output)) {
        handleWorkflowPlanAccessAttempt();
        return;
      }
      if (rerollAudioOutputFromWorkflow(outputId)) return;
      rerollOutputFromReplay(outputId);
    },
    [
      base,
      handleWorkflowPlanAccessAttempt,
      isStudioOutputWorkflowPlanBlocked,
      rerollAudioOutputFromWorkflow,
      rerollOutputFromReplay,
    ]
  );
  const handleRerollStudioOutputFromWorkflow = useCallback(
    (output: StudioOutput) => {
      if (isStudioOutputWorkflowPlanBlocked(output)) {
        handleWorkflowPlanAccessAttempt();
        return;
      }
      if (rerollAudioStudioOutputFromWorkflow(output)) return;
      rerollStudioOutputFromReplay(output);
    },
    [
      handleWorkflowPlanAccessAttempt,
      isStudioOutputWorkflowPlanBlocked,
      rerollAudioStudioOutputFromWorkflow,
      rerollStudioOutputFromReplay,
    ]
  );
  const handleDetailReloadWorkflow = useCallback(
    (output: StudioOutput, options?: { mediaKindHint?: "image" | "video" | "audio" | null }) => {
      if (isStudioOutputWorkflowPlanBlocked(output)) {
        handleWorkflowPlanAccessAttempt();
        return;
      }
      base.reloadWorkflowFromStudioOutput(output, options);
    },
    [base, handleWorkflowPlanAccessAttempt, isStudioOutputWorkflowPlanBlocked]
  );
  const resolveExpertEditVariantCostCredits = useCallback(
    ({
      modelId,
      imageWidth,
      imageHeight,
    }: {
      modelId: string;
      imageWidth: number;
      imageHeight: number;
    }): number | null => {
      if (!modelPricingPolicyReady) return null;
      return resolveClientBilledCredits({
        modelId,
        params: {
          ...buildDefaultPricingParams(modelId),
          aspect,
          imageWidth,
          imageHeight,
        },
        pricingPolicy: modelPricingPolicy,
        pricingPolicyReady: true,
      });
    },
    [aspect, modelPricingPolicy, modelPricingPolicyReady]
  );
  const removeBackgroundCostCredits =
    resolveModelPickerCredits(BRIA_BACKGROUND_REMOVE_MODEL_ID) ?? null;
  const { editExpertPanelProps, videoPanelProps } = useAiStudioEditVideoPanelRuntimes({
    base,
    currentCostCredits,
    removeBackgroundCostCredits,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    generationAccessCta,
    videoGenerationAccessCta: workflowGenerateAccessCta ?? generationAccessCta,
    referenceImageWarning,
    handleOpenModelModal,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleImageRegenerateWithDebit,
    handleRegenerateWithDebit: guardedHandleRegenerateWithDebit,
    resolveExpertEditVariantCostCredits,
  });
  const propertiesCreate = useAiStudioCreatePanelRuntime({
    base,
    createPulsePageRuntime,
    projectPulseChatState,
    setProjectPulseChatState,
    activeCreateAgentRuntime,
    pulseCreateAgentRuntime,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    effectiveGenerationGuardrail,
    effectiveIsGenerateDisabled,
    generationAccessCta,
    handleStandardCreatePromptChange,
    handlePulseCreatePromptChange,
    handleExpertCreateModeChangeForPage: createPulsePageRuntime.handleExpertCreateModeChangeForPage,
    handleActiveCreatePulsePresetIdChangeForPage:
      createPulsePageRuntime.handleActiveCreatePulsePresetIdChangeForPage,
    handleCreatePulsePresetStart,
    handleCreatePulsePresetRestart,
    handleGenerate: guardedHandleGenerate,
    handleOpenModelModal,
    canvasTearOutTargetRegistry: base.canvasTearOutTargetRegistry,
  });
  const {
    propertiesCreate: pagePropertiesCreate,
    propertiesEditExpert,
    propertiesVideo,
    referenceGridProps,
    studioPreviewProps,
    detailModalOutput,
    detailNavigation,
    onDetailClose,
    onUpdateOutputPrompt,
    onDeleteOutput,
    onDetailDownload,
    onDetailSaveReference,
    onDetailSavePrompt,
  } = useAiStudioReferenceExperienceRuntime({
    base,
    isMediaStorageFull,
    mediaPlanAccessCta: generationAccessCta,
    onMediaPlanAccessAttempt: handleMediaPlanAccessAttempt,
    linkedPromptReferenceIds,
    propertiesCreate,
    propertiesEditExpert: editExpertPanelProps,
    propertiesVideo: videoPanelProps,
    handleSelectOutput,
    handleManualPromptChange,
    handleRegenerateWithDebit: guardedHandleRegenerateWithDebit,
    handleOpenMediaLibrary,
    handleRerollOutput: handleRerollOutputFromWorkflow,
  });
  const {
    effectiveProjectName,
    handleProjectNameCommit,
    handleOpenProjectsModal,
    handleCloseProjectsModal,
    handleCreateProjectFromModal,
    handleSelectProjectFromModal,
    handleOpenMediaLibraryPanelOnly,
    handleOpenMediaLibraryProjectNameEditor,
    mediaProjectNameFocusRequestKey,
    shouldGateProjectBootstrap,
    projectEntryPhase,
    modelModalState,
  } = useAiStudioShellRuntime({
    base,
    sessionRestoreCandidate,
    projectBootstrapSettled,
    projectBootstrapApplied,
    projectWorkspaceStaleProjectId,
    flushProjectWorkspaceSnapshot,
    filteredModelOptions,
    resolveModelPickerCredits,
    handleSelectModelFromModal,
  });

  const handleDeleteMediaRowsFromWorkspace = useCallback(
    (rows: MediaFileRow[]) => {
      removeReferencesForDeletedMedia(
        rows.map((row) => ({
          mediaId: row.id,
          storagePath: row.storage_path,
          previewStoragePath: row.preview_storage_path ?? row.preview_variant_path ?? null,
          previewPosterStoragePath: row.poster_variant_path ?? null,
        }))
      );
    },
    [removeReferencesForDeletedMedia]
  );

  const handleSnapshotVideoFrame = useCallback(
    async (video: HTMLVideoElement, filenameHint?: string | null) => {
      const snapshotFile = await captureVideoFrameSnapshotFile(video, { filenameHint });
      await ingestReferenceFiles([snapshotFile], "drop");
    },
    [ingestReferenceFiles]
  );

  const pageContentProps = useAiStudioPageContentRuntime({
    sessionId,
    referenceGridFileInputRef,
    onFileBrowserSelection: handleFileBrowserSelectionWithPlanNotice,
    uiError: generationAccessCta && resolveMediaStorageQuotaUserMessage(uiError) ? null : uiError,
    uiNotice: effectiveUiNotice,
    mediaPlanNoticeMessage: isMediaPlanNoticeVisible ? AI_STUDIO_MEDIA_PLAN_REQUIRED_MESSAGE : null,
    mediaPlanNoticeCta: generationAccessCta,
    onMediaPlanAccessAttempt: handleMediaPlanAccessAttempt,
    billingPlanNoticeMessage,
    billingPlanNoticeHref,
    onDismissBillingPlanNotice: () => setDismissedBillingPlanNoticeKey(billingPlanNoticeKey),
    workflowPlanNoticeMessage: isWorkflowPlanNoticeVisible
      ? AI_STUDIO_WORKFLOW_PLAN_REQUIRED_MESSAGE
      : null,
    workflowPlanAccessCta: workflowNavigationAccessCta,
    onWorkflowPlanAccessAttempt: handleWorkflowPlanAccessAttempt,
    onDismissUiError: dismissError,
    onDismissUiNotice: dismissNotice,
    onDismissMediaPlanNotice: () => setIsMediaPlanNoticeVisible(false),
    onDismissWorkflowPlanNotice: () => setIsWorkflowPlanNoticeVisible(false),
    balanceCredits: effectiveBalanceCredits,
    creditTotalCredits: resolvedPlan?.monthlyCreditsCents ?? null,
    pendingHoldCredits: pendingHoldCredits > 0 ? pendingHoldCredits : null,
    balanceLoading,
    visibleFailures,
    onDismissFailure: dismissFailure,
    onInspectFailure: focusFailure,
    selectedTool,
    characterCreateRequestKey,
    elementCreateRequestKey,
    showCreateTools,
    onOpenProjects: handleOpenProjectsModal,
    onSelectTool: guardedHandleToolSelect,
    onToggleCreateTools: setShowCreateTools,
    propertiesCreate: pagePropertiesCreate,
    propertiesEditExpert,
    propertiesVideo,
    propertiesMusic: {
      balanceCredits,
      isGenerating: musicIsGenerating,
      onGenerate: guardedHandleMusicGenerate,
      onComposerModeChange: base.setMusicComposerMode,
      onDurationChange: base.setMusicDurationSeconds,
      onInstrumentalEnabledChange: base.setMusicInstrumentalEnabled,
      onLyricsChange: base.setMusicLyricsDraft,
      onPromptChange: base.setMusicPromptDraft,
      onSingerEnabledChange: base.setMusicSingerEnabled,
      onSongBatchCountChange: base.setMusicSongBatchCount,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
      generationAccessCta: workflowGenerateAccessCta ?? generationAccessCta,
      composerMode: base.musicComposerMode,
      durationSeconds: base.musicDurationSeconds,
      instrumentalEnabled: base.musicInstrumentalEnabled,
      lyrics: base.musicLyricsDraft,
      prompt: base.musicPromptDraft,
      singerEnabled: base.musicSingerEnabled,
      songBatchCount: base.musicSongBatchCount,
    },
    propertiesSoundEffects: {
      balanceCredits,
      isGenerating: soundEffectsIsGenerating,
      onGenerate: guardedHandleSoundEffectsGenerate,
      onDurationChange: base.setSoundEffectsDurationSeconds,
      onLoopEnabledChange: base.setSoundEffectsLoopEnabled,
      onPromptChange: base.setSoundEffectsPromptDraft,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
      generationAccessCta: workflowGenerateAccessCta ?? generationAccessCta,
      durationSeconds: base.soundEffectsDurationSeconds,
      loopEnabled: base.soundEffectsLoopEnabled,
      prompt: base.soundEffectsPromptDraft,
    },
    propertiesVoices: {
      balanceCredits,
      isGenerating: voicesIsGenerating,
      onGenerate: guardedHandleVoicesGenerate,
      onSelectedVoiceIdChange: base.setVoiceSelectedVoiceId,
      onVoiceChangerSourceChange: base.handleVoiceChangerSourceChange,
      onVoicePromptChange: base.setVoiceDesignPromptDraft,
      onVoiceScriptChange: base.setVoiceScriptDraft,
      pricingPolicy: modelPricingPolicy,
      pricingPolicyReady: modelPricingPolicyReady,
      generationAccessCta: workflowGenerateAccessCta ?? generationAccessCta,
      selectedVoiceId: base.voiceSelectedVoiceId ?? undefined,
      voiceChangerSource: base.voiceChangerSource,
      voicePrompt: base.voiceDesignPromptDraft,
      voiceScript: base.voiceScriptDraft,
    },
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    isTemplateView,
    referenceGridProps,
    studioPreviewProps,
    detailModalOutput,
    detailNavigation,
    sharedDetailModalItem: base.sharedDetailModalItem,
    isMediaStorageFull,
    onDetailClose,
    onUpdateOutputPrompt,
    onDeleteOutput,
    onDetailDownload,
    onDetailSaveReference,
    onSnapshotVideoFrame: handleSnapshotVideoFrame,
    onSnapshotVideoFrameError: setUiError,
    onDetailReloadWorkflow: isManualWorkflowReloadEnabled()
      ? handleDetailReloadWorkflow
      : undefined,
    onMediaLibraryRerollWorkflow: handleRerollStudioOutputFromWorkflow,
    onDetailSavePrompt,
    onAddLibraryMediaReference: addLibraryMediaReference,
    onAddLibraryMediaReferences: addLibraryMediaReferences,
    onAddLibraryPromptReference: addLibraryPromptReference,
    onDeleteMediaRowsFromWorkspace: handleDeleteMediaRowsFromWorkspace,
    mediaLibraryDetailSelectionTarget:
      base.detailSelectionTarget?.kind === "media-file" &&
      (base.detailSelectionTarget.surface === "media-library-panel" ||
        base.detailSelectionTarget.surface === "character-media-panel" ||
        base.detailSelectionTarget.surface === "elements-media-panel")
        ? base.detailSelectionTarget
        : null,
    onMediaLibraryDetailSelectionTargetChange: base.setDetailSelectionTarget,
    projectId,
    projectRouteRequested,
    rightRailLayout,
    onRightRailLayoutChange: setRightRailLayout,
    projectName: effectiveProjectName,
    onProjectNameCommit: handleProjectNameCommit,
    onOpenProjectNameEditor: handleOpenMediaLibraryProjectNameEditor,
    mediaLibraryProjectNameFocusRequestKey: mediaProjectNameFocusRequestKey,
    resolveMediaLibraryInternalDropItem,
    resolveStyleLibraryInternalDrop,
    onOpenMediaLibrary: handleOpenMediaLibraryPanelOnly,
    modelModalState,
    handleReferenceGridFiles: handleReferenceGridFilesWithPlanNotice,
    triggerFilePicker,
    resolveCharacterDropReference,
    canvasTearOutTargetRegistry: base.canvasTearOutTargetRegistry,
    pendingCharacterUploadRequest,
    onCharacterUploadRequestHandled: clearPendingCharacterUploadRequest,
    createSelectedCharacterId,
    onCreateSelectedCharacterIdChange: handleCharacterPanelSelectedCharacterChange,
    resolveElementProfileImageDropSource,
    resolveVoiceChangerInternalReferenceSource,
    onRegisterWorkflowReloadStylePrep: base.setImageStyleWorkflowReloadPrep,
    onSelectedStylePromptChange: setSelectedStylePrompt,
    onSelectedStyleContextChange: setSelectedStyleContext,
  });

  return (
    <AiStudioPageShell
      shouldGateProjectBootstrap={shouldGateProjectBootstrap}
      projectStatus={projectStatus}
      projectBootstrapError={projectBootstrapError}
      projectError={projectError}
      projectEntryPhase={projectEntryPhase}
      projectTitle={project?.title ?? null}
      referenceGridPreconnectOrigin={referenceGridPreconnectOrigin}
      pageContentProps={pageContentProps}
      projectsModalOpen={isProjectsModalOpen}
      projectId={projectId}
      retryProjectBootstrap={retryProjectBootstrap}
      resetProjectWorkspace={resetProjectWorkspace}
      onOpenProjectsModal={handleOpenProjectsModal}
      onCloseProjectsModal={handleCloseProjectsModal}
      onSelectProjectFromModal={handleSelectProjectFromModal}
      onCreateProjectFromModal={handleCreateProjectFromModal}
    />
  );
};
