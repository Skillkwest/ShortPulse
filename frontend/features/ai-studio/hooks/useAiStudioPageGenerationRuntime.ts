/**
 * AI Studio page generation runtime.
 * Owns page-scoped generation/view-model orchestration so the page shell stays focused on composition.
 */
import type { Dispatch, SetStateAction } from "react";
import type { ModelModalContext } from "../components/ModelModal";
import {
  type CharacterModeFallbackSummary,
  type CharacterModeInjectionBundle,
  type CharacterModeSubmissionOverrides,
} from "./useAiStudioCharacterModeController";
import { useAiStudioAudioGeneration } from "./useAiStudioAudioGeneration";
import { useAiStudioGenerationController } from "./useAiStudioGenerationController";
import { useAiStudioOptimisticDebitReconciliation } from "./useAiStudioOptimisticDebitReconciliation";
import { useAiStudioPageDerivations } from "./useAiStudioPageDerivations";
import { useAiStudioViewModel } from "./useAiStudioViewModel";
import { useAiStudioWorkspaceActions } from "./useAiStudioWorkspaceActions";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import type {
  AiStudioGenerateOutputOptions,
  AiStudioGenerateSubmissionOverrides,
} from "./contracts/generationSubmissionContracts";
import type { LipSyncAudioState, StudioMode, StudioOutput, ToolId } from "../types";
import { createEmptyLipSyncAudioState } from "../logic/lipSyncAudioState";

type OptimisticDebitEntry = {
  credits: number;
  outputId: string | null;
  createdAtMs?: number;
};

type UseAiStudioPageGenerationRuntimeParams = {
  activeCreatePrompt: string;
  activeOutput: StudioOutput | null;
  activeOutputId: string | null;
  addCharacterReferences: (files: FileList) => void;
  addOutputsFromFiles: (files: FileList, source?: "filePicker" | "drop") => void;
  aspect: string;
  balanceCredits: number | null;
  balanceError: string | null;
  balanceLoading: boolean;
  createCharacterModeInjectionBundle: CharacterModeInjectionBundle | null;
  createSelectedCharacterId: string;
  editReferenceText: string;
  editSubmitIntent: Parameters<typeof useAiStudioViewModel>[0]["editSubmitIntent"];
  extraImageUrls: readonly (string | null)[];
  generateOutput: (promptOverride?: string | null, options?: AiStudioGenerateOutputOptions) => void;
  getDefaultDurationSeconds: (modelId: string | null) => number;
  imageResolution: string;
  insertOptimisticGenerationPlaceholder: (args: {
    prompt: string;
    modeOverride?: StudioMode;
    selectedToolOverride?: ToolId | null;
    modelLabelOverride?: string | null;
    modelIdOverride?: string | null;
    providerOverride?: string | null;
  }) => string | null;
  isCreateCharacterBundleLoading: boolean;
  isCreateCharacterModeEnabled: boolean;
  klingElements?: Parameters<typeof useAiStudioViewModel>[0]["klingElements"];
  klingMultiPrompts?: Parameters<typeof useAiStudioViewModel>[0]["klingMultiPrompts"];
  klingWorkflowMode?: Parameters<typeof useAiStudioViewModel>[0]["klingWorkflowMode"];
  mode: StudioMode;
  model: string | null;
  modelPricingPolicy?: Parameters<typeof useAiStudioViewModel>[0]["pricingPolicy"];
  modelPricingPolicyError?: string | null;
  modelPricingPolicyLoading?: boolean;
  modelPricingPolicyReady?: boolean;
  lipSyncAudio?: LipSyncAudioState;
  motionReferenceVideoPending: boolean;
  motionReferenceVideoError: string | null;
  motionReferenceVideoUrl: string | null;
  notifyGenerationFailure: (outputId: string, message: string, detail?: string) => void;
  optimisticDebitEntries: OptimisticDebitEntry[];
  outputs?: StudioOutput[];
  removedFromAllRefsIds?: string[];
  closeModelModal: () => void;
  openModelModal: (
    anchorId: string,
    target: HTMLElement,
    context: ModelModalContext | null
  ) => void;
  projectId: string | null;
  workspaceRuntimeKey?: string | null;
  referenceImageUrl: string | null;
  refreshBalance: (options?: {
    silent?: boolean;
    preferLedger?: boolean;
    beforeCommit?: (snapshot: {
      cents: number;
      updatedAt: string | null;
      reservedCents?: number | null;
      source?: "snapshot" | "fallback";
    }) => void;
  }) => Promise<number | null>;
  refreshCharacterModeInjectionBundleForSubmission: (
    tool: ToolId | null
  ) => Promise<CharacterModeInjectionBundle | null>;
  regenerateOutput: (options?: AiStudioGenerateSubmissionOverrides) => void;
  removeOptimisticGenerationPlaceholder: (outputId: string) => void;
  resolveCharacterModeSubmissionOverrides: (
    userPrompt: string,
    tool: ToolId | null,
    bundleOverride?: CharacterModeInjectionBundle | null,
    userReferenceInputs?: string[]
  ) => CharacterModeSubmissionOverrides;
  resolveIsCharacterModeEnabledForTool: (tool: ToolId | null) => boolean;
  resolveReferenceInputsForTool: (tool: ToolId | null) => {
    referenceImageUrl: string | null;
    extraImageUrls: readonly (string | null)[];
  };
  resolveSelectedCharacterIdForTool: (tool: ToolId | null) => string | null;
  seedance2InputMode?: Parameters<typeof useAiStudioViewModel>[0]["seedance2InputMode"];
  seedance2ReferenceAudioUrls?: Parameters<
    typeof useAiStudioViewModel
  >[0]["seedance2ReferenceAudioUrls"];
  seedance2ReferenceImageUrls?: Parameters<
    typeof useAiStudioViewModel
  >[0]["seedance2ReferenceImageUrls"];
  seedance2ReferenceVideoUrls?: Parameters<
    typeof useAiStudioViewModel
  >[0]["seedance2ReferenceVideoUrls"];
  selectedStyleContext: StudioOutput["styleContext"] | null;
  selectedTool: ToolId | null;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setDetailOutputId: (value: string | null) => void;
  setEditReferenceText: (value: string) => void;
  setMode: Dispatch<SetStateAction<StudioMode>>;
  setModel: (value: string | null) => void;
  setOptimisticDebitEntries: Dispatch<SetStateAction<OptimisticDebitEntry[]>>;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  setCreatePromptForActiveMode: (value: string) => void;
  setShowCreateTools: Dispatch<SetStateAction<boolean>>;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setVideoReferenceText: (value: string) => void;
  setSelectedToolWithEditIntentReset: (tool: ToolId | null) => void;
  trackCharacterModeFallback: (
    overrides: CharacterModeFallbackSummary,
    tool: ToolId | null
  ) => void;
  trackUiEvent: (message: string, data?: Record<string, unknown>) => void;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  useReferenceImageIndicator: boolean;
  videoDurationSeconds: number;
  videoGenerateAudio: boolean;
  videoReferenceMode: Parameters<typeof useAiStudioViewModel>[0]["videoReferenceMode"];
  videoReferenceText: string;
  videoResolution: string;
};

/**
 * Returns generation/view-model runtime state and handlers for the AI Studio page shell.
 */
export const useAiStudioPageGenerationRuntime = ({
  activeCreatePrompt,
  activeOutput,
  activeOutputId,
  addCharacterReferences,
  addOutputsFromFiles,
  aspect,
  balanceCredits,
  balanceError,
  balanceLoading,
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
  lipSyncAudio = createEmptyLipSyncAudioState(),
  motionReferenceVideoPending,
  motionReferenceVideoError,
  motionReferenceVideoUrl,
  notifyGenerationFailure,
  optimisticDebitEntries,
  outputs,
  removedFromAllRefsIds = [],
  closeModelModal,
  openModelModal,
  projectId,
  workspaceRuntimeKey = null,
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
}: UseAiStudioPageGenerationRuntimeParams) => {
  void createSelectedCharacterId;
  void isCreateCharacterBundleLoading;
  const { visibleFailures, dismissFailure, focusFailure } =
    useAiStudioOptimisticDebitReconciliation({
      outputs,
      suppressedFailureIds: removedFromAllRefsIds,
      optimisticDebitEntries,
      setOptimisticDebitEntries,
      refreshBalance,
      setDetailOutputId,
    });

  const {
    isTemplateView,
    costParamsForModel,
    filteredModelOptions,
    resolveDefaultPromptForTool,
    promptForViewModel,
  } = useAiStudioPageDerivations({
    mode,
    selectedTool,
    model,
    aspect,
    createPrompt: activeCreatePrompt,
    editReferenceText,
    videoReferenceText,
    videoReferenceMode,
    referenceImageUrl,
    extraImageUrls,
    isCharacterModeEnabled: isCreateCharacterModeEnabled,
  });

  const {
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    resolveModelPickerCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    isCreditGuardrail,
    generationGuardrail,
    referenceImageWarning,
  } = useAiStudioViewModel({
    mode,
    model,
    aspect,
    prompt: promptForViewModel,
    referenceImageUrl,
    activeOutput,
    selectedTool,
    useReferenceImageIndicator,
    getDefaultDurationSeconds,
    videoDurationSeconds,
    videoResolution,
    videoReferenceMode,
    lipSyncAudio,
    motionReferenceVideoPending,
    motionReferenceVideoError,
    motionReferenceVideoUrl,
    extraImageUrls,
    imageResolution,
    videoGenerateAudio,
    klingWorkflowMode,
    klingMultiPrompts,
    klingElements,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    isCreateCharacterModeEnabled,
    createCharacterModeInjectionBundle,
    balanceCredits,
    balanceError,
    balanceLoading,
    editSubmitIntent,
    costParamsForModel,
    pricingPolicy: modelPricingPolicy,
    pricingPolicyReady: modelPricingPolicyReady,
    pricingPolicyLoading: modelPricingPolicyLoading,
    pricingPolicyError: modelPricingPolicyError,
  });

  const effectiveGenerationGuardrail = generationGuardrail;
  const effectiveIsGenerateDisabled = Boolean(effectiveGenerationGuardrail);

  const {
    handleOpenModelModal,
    handleSelectModelFromModal,
    handleManualPromptChange,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleToolSelect,
    handleOpenMediaLibrary,
    handleFileBrowserSelection,
    handleReferenceGridFiles,
    handleSelectOutput,
  } = useAiStudioWorkspaceActions({
    selectedTool,
    setSelectedTool: setSelectedToolWithEditIntentReset,
    setMode,
    setShowCreateTools,
    setVideoReferenceText,
    setEditReferenceText,
    setSharedPrompt: setCreatePromptForActiveMode,
    setPromptOrigin,
    openModelModal,
    closeModelModal,
    setModel,
    addCharacterReferences,
    addOutputsFromFiles,
    setActiveOutputId,
  });

  const { handleGenerate, handleRegenerateWithDebit, handleImageRegenerateWithDebit } =
    useAiStudioGenerationController({
      mode,
      selectedTool,
      model,
      videoReferenceMode,
      setModel,
      projectId,
      isCharacterModeEnabled: resolveIsCharacterModeEnabledForTool(selectedTool),
      resolveIsCharacterModeEnabledForTool,
      resolveSelectedCharacterIdForTool,
      selectedStyleContext,
      currentCostCredits,
      resolveCostCreditsForModel: resolveModelPickerCredits,
      isGenerateDisabled: effectiveIsGenerateDisabled,
      isCreditGuardrail,
      generationGuardrail: effectiveGenerationGuardrail,
      balanceCredits,
      setUiError,
      setUiNotice,
      setOptimisticDebitEntries,
      refreshBalance,
      resolveDefaultPromptForTool,
      refreshCharacterModeInjectionBundleForSubmission,
      resolveCharacterModeSubmissionOverrides,
      resolveReferenceInputsForTool,
      trackCharacterModeFallback,
      trackCharacterModeEvent: trackUiEvent,
      insertOptimisticGenerationPlaceholder,
      removeOptimisticGenerationPlaceholder,
      generateOutput,
      regenerateOutput,
      activeOutputId,
    });

  const {
    musicIsGenerating,
    voicesIsGenerating,
    soundEffectsIsGenerating,
    handleVoicesGenerate,
    handleMusicGenerate,
    handleSoundEffectsGenerate,
  } = useAiStudioAudioGeneration({
    projectId,
    workspaceRuntimeKey,
    outputs: outputs ?? [],
    setUiError,
    insertOptimisticGenerationPlaceholder,
    notifyGenerationFailure,
    updateOutputById,
    setOutputs,
  });

  return {
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
  };
};
