/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiStudioPageContent } from "../features/ai-studio/components/AiStudioPageContent";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import { useCharacterWorkflow } from "../features/character/hooks/useCharacterWorkflow";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { MediaLibraryModal } from "../features/ai-studio/components/MediaLibraryModal";
import { useBeginnerModePreference } from "../features/ai-studio/hooks/useBeginnerModePreference";
import { useMediaAutosavePreference } from "../features/ai-studio/hooks/useMediaAutosavePreference";
import { useAiStudioMediaAutosaveOrchestrator } from "../features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator";
import { normalizePromptText } from "../features/ai-studio/logic/agentPromptOwnership";
import {
  CHARACTER_LOADING_GENERATION_GUARDRAIL,
  shouldDisableAgentOutputGenerate,
  shouldDisableGenerateWhileCharacterLoading,
} from "../features/ai-studio/logic/createGenerationGuards";
import { addBreadcrumb } from "../lib/clientBreadcrumbs";
import { useAiStudioAgentBridge } from "../features/ai-studio/hooks/useAiStudioAgentBridge";
import { useAiStudioGenerationController } from "../features/ai-studio/hooks/useAiStudioGenerationController";
import {
  useAiStudioCharacterModeController,
  type CharacterModeInjectionBundle,
} from "../features/ai-studio/hooks/useAiStudioCharacterModeController";
import { useAiStudioCharacterModeLifecycle } from "../features/ai-studio/hooks/useAiStudioCharacterModeLifecycle";
import { useAiStudioReferenceAssetActions } from "../features/ai-studio/hooks/useAiStudioReferenceAssetActions";
import { useAiStudioOptimisticDebitReconciliation } from "../features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation";
import { useAiStudioWorkspaceActions } from "../features/ai-studio/hooks/useAiStudioWorkspaceActions";
import { useAiStudioPageDerivations } from "../features/ai-studio/hooks/useAiStudioPageDerivations";
import { useAiStudioPanelProps } from "../features/ai-studio/hooks/useAiStudioPanelProps";
import { useAiStudioReferenceGridProps } from "../features/ai-studio/hooks/useAiStudioReferenceGridProps";
import { useAiStudioPreviewDetailProps } from "../features/ai-studio/hooks/useAiStudioPreviewDetailProps";
import { mapHookContractsToPageContentProps } from "../features/ai-studio/hooks/contracts/pageContentAdapter";
import { useOutputSelector } from "../features/ai-studio/hooks/aiStudioOutputStore";
import { useAgentOutputBubbleLinking } from "../features/ai-studio/hooks/agentOrchestration/useAgentOutputBubbleLinking";
import {
  evaluateReferenceGridAuditGates,
  evaluateStudioShellAuditGates,
  type ReferenceGridScenario,
  type StudioShellScenario,
} from "../features/ai-studio/logic/perfAuditGates";
import type {
  AgentOutputGenerateInput,
  AgentOutputGenerateRequest,
} from "../features/ai-agent/types";
import type { StudioMode, StudioOutput, ToolId } from "../features/ai-studio/types";
import {
  getAiStudioShellSectionRenderCounters,
  resetAiStudioShellSectionRenderCounters,
} from "../features/ai-studio/logic/shellRenderCounters";
import {
  PERF_FLAG_AUDIT_RUNTIME,
  PERF_FLAG_OUTPUT_SELECTOR_STORE,
  PERF_FLAG_PAGE_OUTPUT_DECOUPLE,
  PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS,
  PERF_FLAG_SELECTOR_CALLBACKS,
} from "../features/ai-studio/logic/perfProfileFlags";

const CHARACTER_MODE_BUNDLE_STALE_AFTER_MS = 45 * 60 * 1000;
const AI_STUDIO_EMERGENCY_DISABLE_SELECTOR_STORE = true;
const FLAG_OUTPUT_SELECTOR_STORE =
  !AI_STUDIO_EMERGENCY_DISABLE_SELECTOR_STORE && PERF_FLAG_OUTPUT_SELECTOR_STORE;
const FLAG_SELECTOR_CALLBACKS = PERF_FLAG_SELECTOR_CALLBACKS;
const FLAG_PAGE_OUTPUT_DECOUPLE =
  !AI_STUDIO_EMERGENCY_DISABLE_SELECTOR_STORE && PERF_FLAG_PAGE_OUTPUT_DECOUPLE;
const FLAG_REFERENCE_GRID_PRECONNECT_HINTS = PERF_FLAG_REFERENCE_GRID_PRECONNECT_HINTS;
const FLAG_PERF_AUDIT_RUNTIME = PERF_FLAG_AUDIT_RUNTIME;

type OptimisticDebitEntry = {
  credits: number;
  outputId: string | null;
  createdAtMs?: number;
};

const PERF_REFERENCE_IMAGE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#2ad1ff"/><stop offset="1" stop-color="#0f6fff"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><circle cx="120" cy="94" r="50" fill="rgba(255,255,255,0.24)"/><rect x="48" y="152" width="144" height="56" rx="18" fill="rgba(0,0,0,0.24)"/></svg>'
)}`;

type AiStudioPerfWindow = Window & {
  __shortpulseAiStudioPerf?: {
    seedReferenceGrid: (count: number) => { requestedCount: number; activeCount: number };
    clearReferenceGrid: () => { activeCount: number };
    runReferenceGridAudit: (options?: {
      counts?: number[];
      clickSamples?: number;
      scrollDurationMsByCount?: Record<number, number>;
    }) => Promise<{
      ok: boolean;
      generatedAt: string;
      scenarios: Array<{
        count: number;
        click: { samples: number; p95Ms: number | null };
        longTask: { samples: number; p95Ms: number | null };
        interaction: { maxInputStallMs: number };
        memory: { beforeMb: number | null; afterMb: number | null };
        grid: {
          renderedItemCountP95: number | null;
          imageHydrationQueueP95: number | null;
          imageDecodeInflightP95: number | null;
          perfDegradeLevelP95: number | null;
          previewSrcSwapRatePerMinuteP95: number | null;
          previewRepaintSpikeCountMax: number | null;
          previewLastSwapBurstCountP95: number | null;
        };
      }>;
      gates: Array<{
        name: string;
        pass: boolean;
        actual: number | null;
        expected: string;
        note?: string;
      }>;
    }>;
    capturePerfBaseline: () => Promise<{
      generatedAt: string;
      referenceGrid: {
        ok: boolean;
        generatedAt: string;
        scenarios: ReferenceGridScenario[];
        gates: Array<{
          name: string;
          pass: boolean;
          actual: number | null;
          expected: string;
          note?: string;
        }>;
      };
      studioShell: {
        ok: boolean;
        generatedAt: string;
        scenarios: StudioShellScenario[];
        gates: Array<{
          name: string;
          pass: boolean;
          actual: number | null;
          expected: string;
          note?: string;
        }>;
      };
    }>;
    runStudioShellAudit: (options?: {
      counts?: number[];
      toolbarSamples?: number;
      panelSamples?: number;
      dropSamples?: number;
    }) => Promise<{
      ok: boolean;
      generatedAt: string;
      scenarios: Array<{
        count: number;
        toolbar: { samples: number; p95Ms: number | null };
        panel: { samples: number; p95Ms: number | null };
        drop: { samples: number; p95Ms: number | null };
        toolSwitchVisualCommit: { samples: number; p95Ms: number | null };
        sectionRenderCounters: {
          toolbar: number;
          properties: number;
          reference: number;
          preview: number;
        };
        sectionCommit: {
          toolbarP95Ms: number | null;
          propertiesP95Ms: number | null;
          referenceP95Ms: number | null;
          previewP95Ms: number | null;
        };
        nonGridRerendersPerOutputStatusTick: {
          samples: number;
          toolbarP95: number | null;
          propertiesP95: number | null;
        };
        longTask: { samples: number; p95Ms: number | null };
        interaction: { maxInputStallMs: number };
      }>;
      gates: Array<{
        name: string;
        pass: boolean;
        actual: number | null;
        expected: string;
        note?: string;
      }>;
    }>;
  };
};

export default function AiStudioPage() {
  const {
    mediaAutosaveEnabled,
    syncState: mediaAutosaveSyncState,
    error: mediaAutosaveError,
  } = useMediaAutosavePreference();
  const { balanceCents, balanceReservedCents, balanceLoading, refreshBalance } = useCredits();
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const [optimisticDebitEntries, setOptimisticDebitEntries] = useState<OptimisticDebitEntry[]>([]);
  const [isCharacterBundleLoading, setIsCharacterBundleLoading] = useState(false);
  const [isCharacterModeEnabled, setIsCharacterModeEnabled] = useState(false);
  const [characterModeInjectionBundle, setCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);

  // Character workflow state (shared with Character tool workflows and error surfaces)
  const {
    error: characterError,
    addReferences: addCharacterReferences,
    clearError: clearCharacterError,
  } = useCharacterWorkflow();

  const {
    promptRef,
    mode,
    setMode,
    aspect,
    setAspect,
    model,
    setModel,
    currentModelLabel,
    prompt,
    outputs,
    setOutputs,
    resetReferenceGridState,
    curatedReferenceIds,
    removedFromAllRefsIds,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    archivedOutputs,
    activeOutput,
    activeOutputId,
    setActiveOutputId,
    selectedTool,
    setSelectedTool,
    showCreateTools,
    setShowCreateTools,
    referenceImageUrl,
    setReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    videoReferenceMode,
    setVideoReferenceMode,
    videoDurationSeconds,
    setVideoDurationSeconds,
    videoResolution,
    setVideoResolution,
    imageResolution,
    setImageResolution,
    videoGenerateAudio,
    setVideoGenerateAudio,
    videoCameraFixed,
    setVideoCameraFixed,
    videoAutoFix,
    setVideoAutoFix,
    klingNegativePrompt,
    setKlingNegativePrompt,
    klingCfgScale,
    setKlingCfgScale,
    klingShotType,
    setKlingShotType,
    klingVoiceIds,
    setKlingVoiceIds,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    editReferenceText,
    setEditReferenceText,
    videoReferenceText,
    setVideoReferenceText,
    setSharedPrompt,
    useReferenceImageIndicator,
    detailOutput,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
    modelModalContext,
    modelModalPosition,
    isPromptGenerating,
    generateOutput,
    regenerateOutput,
    rerollOutputFromReplay,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
    addOutputsFromFiles,
    addLibraryMediaReference,
    addLibraryPromptReference,
    toggleReferenceIndicator,
    openModelModal,
    closeModelModal,
    updateOutputPrompt,
    deleteOutput,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    uiError,
    setUiError,
    uiNotice,
    setUiNotice,
    getDefaultDurationSeconds,
    getAgentContext,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    getOutputById,
    getOutputSnapshot,
  } = useAiStudioState({
    isCharacterModeEnabled,
  });
  useAiStudioMediaAutosaveOrchestrator({
    outputs,
    mediaAutosaveEnabled,
    saveReferenceToLibrary,
  });
  const selectorInFlightOutputIds = useOutputSelector((snapshot) => snapshot.indexes.inFlightIds);
  const fallbackInFlightOutputIds = useMemo(
    () =>
      new Set(
        outputs
          .filter((output) => output.taskState === "pending" || output.taskState === "running")
          .map((output) => output.id)
      ),
    [outputs]
  );
  const inFlightOutputIds = FLAG_OUTPUT_SELECTOR_STORE
    ? selectorInFlightOutputIds
    : fallbackInFlightOutputIds;
  const resolveStorePanelOutputPreviewUrl = useCallback(
    (id: string | null | undefined) => getOutputById(id ?? "")?.previewUrl ?? null,
    [getOutputById]
  );
  const resolveLegacyPanelOutputPreviewUrl = useCallback(
    (id: string | null | undefined) => {
      if (!id) return null;
      return outputs.find((item) => item.id === id)?.previewUrl ?? null;
    },
    [outputs]
  );
  const resolvePanelOutputPreviewUrl = FLAG_OUTPUT_SELECTOR_STORE
    ? resolveStorePanelOutputPreviewUrl
    : resolveLegacyPanelOutputPreviewUrl;
  const fallbackFindOutputById = useCallback(
    (id: string) => {
      if (!id) return null;
      return outputs.find((item) => item.id === id) ?? null;
    },
    [outputs]
  );
  const findOutputById =
    FLAG_OUTPUT_SELECTOR_STORE && FLAG_SELECTOR_CALLBACKS ? getOutputById : fallbackFindOutputById;
  const optimisticInFlightDebitCredits = useMemo(
    () =>
      optimisticDebitEntries.reduce((sum, entry) => {
        if (entry.outputId == null) return sum + entry.credits;
        if (inFlightOutputIds.has(entry.outputId)) return sum + entry.credits;
        return sum;
      }, 0),
    [optimisticDebitEntries, inFlightOutputIds]
  );
  const reservedCredits = useMemo(
    () => Math.max(0, Math.floor(balanceReservedCents ?? 0)),
    [balanceReservedCents]
  );
  const optimisticUncoveredDebitCredits = useMemo(
    () => Math.max(0, optimisticInFlightDebitCredits - reservedCredits),
    [optimisticInFlightDebitCredits, reservedCredits]
  );
  const pendingHoldCredits = useMemo(() => {
    return reservedCredits + optimisticUncoveredDebitCredits;
  }, [reservedCredits, optimisticUncoveredDebitCredits]);
  const referenceGridPreconnectOrigin = useMemo(() => {
    if (!FLAG_REFERENCE_GRID_PRECONNECT_HINTS) return null;
    const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!rawSupabaseUrl) return null;
    try {
      return new URL(rawSupabaseUrl).origin;
    } catch {
      return null;
    }
  }, []);
  const effectiveBalanceCredits = useMemo(() => {
    if (balanceCredits == null) return null;
    return Math.max(0, balanceCredits - optimisticUncoveredDebitCredits);
  }, [balanceCredits, optimisticUncoveredDebitCredits]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production" && !FLAG_PERF_AUDIT_RUNTIME) return;
    const perfWindow = window as AiStudioPerfWindow;
    const CLICK_SAMPLES_DEFAULT = 24;
    const DEFAULT_COUNTS = [20, 40, 50, 60, 100, 300];
    const DEFAULT_SCROLL_MS_BY_COUNT: Record<number, number> = {
      20: 2_500,
      40: 3_500,
      50: 4_500,
      60: 5_000,
      100: 12_000,
      300: 20_000,
    };
    const BASELINE_COUNTS = [40, 60, 100];
    const PERF_GATES = {
      clickP95MsAt40: 90,
      longTaskP95MsAt40: 70,
      maxInputStallMsAt40: 450,
      renderedItemCountP95At40: 24,
      clickP95MsAt60: 120,
      longTaskP95MsAt60: 100,
      maxInputStallMsAt60: 800,
      renderedItemCountP95At60: 28,
    };
    const SHELL_DEFAULT_COUNTS = [20, 40, 50, 60, 100, 300];
    const SHELL_GATES = {
      toolbarP95MsAt60: 120,
      panelP95MsAt60: 140,
      toolSwitchVisualCommitP95MsAt60: 180,
      longTaskP95Ms: 120,
      maxInputStallMs: 1000,
      nonGridRerendersPerOutputStatusTick: 1,
    };
    const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const nextFrame = () =>
      new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const afterTwoFrames = async () => {
      await nextFrame();
      await nextFrame();
    };
    const p95 = (values: number[]): number | null => {
      if (!values.length) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      return Math.round((sorted[index] ?? 0) * 100) / 100;
    };
    const sampleHeapMb = (): number | null => {
      const runtimePerformance = performance as Performance & {
        memory?: { usedJSHeapSize?: number };
      };
      if (typeof runtimePerformance.memory?.usedJSHeapSize !== "number") return null;
      return Math.round((runtimePerformance.memory.usedJSHeapSize / (1024 * 1024)) * 100) / 100;
    };
    const createPerfOutputs = (count: number): StudioOutput[] => {
      const safeCount = Math.max(0, Math.floor(count));
      const runId = Date.now();
      return Array.from({ length: safeCount }, (_, index) => {
        const id = `perf-${runId}-${index}`;
        const isPromptOnly = index % 17 === 0;
        const prompt = isPromptOnly
          ? `Perf prompt reference ${index + 1}`
          : `Perf media reference ${index + 1}`;
        const previewUrl = isPromptOnly ? undefined : `${PERF_REFERENCE_IMAGE_SVG}#${index + 1}`;
        return {
          id,
          prompt,
          mode: isPromptOnly ? "text" : "image",
          aspect,
          model: currentModelLabel,
          modelId: model ?? undefined,
          status: "ready",
          taskState: "success",
          timestamp: "Perf seed",
          previewUrl,
          previewStoragePath: previewUrl ?? null,
          fullStoragePath: previewUrl ?? null,
          previewText: isPromptOnly ? prompt : undefined,
          mediaSource: isPromptOnly ? "prompt" : "generated",
          previewTier: isPromptOnly ? "full" : "thumb",
          archivedAt: null,
          archiveReason: null,
          saveState: "idle",
          saveError: null,
        } satisfies StudioOutput;
      });
    };
    const resolveDropTransfer = () => {
      if (typeof DataTransfer === "undefined") return null;
      const transfer = new DataTransfer();
      transfer.items.add(new File(["audit"], "audit-reference.png", { type: "image/png" }));
      return transfer;
    };
    const createSyntheticDragEvent = (type: "dragover" | "drop", transfer: DataTransfer | null) => {
      if (typeof DragEvent !== "undefined") {
        try {
          return new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer ?? undefined,
          });
        } catch {
          // Fall back for runtimes that expose DragEvent but reject construction.
        }
      }
      const fallbackEvent = new Event(type, { bubbles: true, cancelable: true });
      if (transfer) {
        try {
          Object.defineProperty(fallbackEvent, "dataTransfer", {
            value: transfer,
            configurable: true,
          });
        } catch {
          // Ignore if runtime blocks property definition on Event objects.
        }
      }
      return fallbackEvent;
    };

    const runStudioShellScenario = async (
      count: number,
      toolbarSamples: number,
      panelSamples: number,
      dropSamples: number
    ) => {
      perfWindow.__shortpulseAiStudioPerf?.seedReferenceGrid(count);
      await sleep(220);
      resetAiStudioShellSectionRenderCounters();
      await afterTwoFrames();

      const toolbarLatenciesMs: number[] = [];
      const panelLatenciesMs: number[] = [];
      const dropLatenciesMs: number[] = [];
      const referenceCommitLatenciesMs: number[] = [];
      const previewCommitLatenciesMs: number[] = [];
      const toolSwitchCommitLatenciesMs: number[] = [];
      const longTaskDurationsMs: number[] = [];
      const toolbarStatusTickRerenders: number[] = [];
      const propertiesStatusTickRerenders: number[] = [];

      let observer: PerformanceObserver | null = null;
      if (typeof PerformanceObserver !== "undefined") {
        observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            longTaskDurationsMs.push(entry.duration);
          });
        });
        try {
          observer.observe({ type: "longtask" });
        } catch {
          observer.disconnect();
          observer = null;
        }
      }

      const expectedTickMs = 100;
      let maxInputStallMs = 0;
      let previousTick = performance.now();
      const sampleInputStall = async () => {
        await sleep(expectedTickMs);
        const now = performance.now();
        const stall = Math.max(0, now - previousTick - expectedTickMs);
        if (stall > maxInputStallMs) {
          maxInputStallMs = stall;
        }
        previousTick = now;
      };

      const toolbarTargets = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".toolbar-item[data-tool-id='create'], .toolbar-item[data-tool-id='edit'], .toolbar-item[data-tool-id='video'], .toolbar-item[data-tool-id='character'], .toolbar-item[data-tool-id='canvas']"
        )
      );
      for (let index = 0; index < toolbarSamples; index += 1) {
        const target = toolbarTargets[index % toolbarTargets.length];
        if (!target) break;
        const startedAt = performance.now();
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await afterTwoFrames();
        const commitMs = performance.now() - startedAt;
        toolbarLatenciesMs.push(commitMs);
        toolSwitchCommitLatenciesMs.push(commitMs);
        await sampleInputStall();
      }

      const panelTargets = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".ai-properties textarea, .ai-properties input, .ai-properties button, .ai-properties select"
        )
      );
      for (let index = 0; index < panelSamples; index += 1) {
        const target = panelTargets[index % panelTargets.length];
        if (!target) break;
        const startedAt = performance.now();
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          target.focus();
          target.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }
        await afterTwoFrames();
        panelLatenciesMs.push(performance.now() - startedAt);
        await sampleInputStall();
      }

      const dropTarget =
        document.querySelector<HTMLElement>(".ai-shell-right") ??
        document.querySelector<HTMLElement>(".reference-canvas-panel");
      for (let index = 0; index < dropSamples; index += 1) {
        if (!dropTarget) break;
        const transfer = resolveDropTransfer();
        const startedAt = performance.now();
        const dragOverEvent = createSyntheticDragEvent("dragover", transfer);
        dropTarget.dispatchEvent(dragOverEvent);
        const dropEvent = createSyntheticDragEvent("drop", transfer);
        dropTarget.dispatchEvent(dropEvent);
        await afterTwoFrames();
        dropLatenciesMs.push(performance.now() - startedAt);
        await sampleInputStall();
      }

      const referenceTargets = Array.from(
        document.querySelectorAll<HTMLElement>(".reference-column .reference-card")
      );
      for (let index = 0; index < Math.max(4, Math.floor(dropSamples / 2)); index += 1) {
        const target = referenceTargets[index % referenceTargets.length];
        if (!target) break;
        const startedAt = performance.now();
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await afterTwoFrames();
        referenceCommitLatenciesMs.push(performance.now() - startedAt);
        await sampleInputStall();
      }

      const previewTargets = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".studio-column .studio-preview-square, .studio-column .prompt-preview-input, .studio-column .preview-card-actions .ghost-btn"
        )
      );
      for (let index = 0; index < Math.max(4, Math.floor(dropSamples / 2)); index += 1) {
        const target = previewTargets[index % previewTargets.length];
        if (!target) break;
        const startedAt = performance.now();
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          target.focus();
          target.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }
        await afterTwoFrames();
        previewCommitLatenciesMs.push(performance.now() - startedAt);
        await sampleInputStall();
      }

      const statusTickSamples = 6;
      for (let sampleIndex = 0; sampleIndex < statusTickSamples; sampleIndex += 1) {
        const beforeCounters = getAiStudioShellSectionRenderCounters();
        const outputId = getOutputSnapshot().outputOrder[0] ?? null;
        if (!outputId) break;
        setOutputs((prev) => {
          const targetIndex = prev.findIndex((item) => item.id === outputId);
          if (targetIndex === -1) return prev;
          const current = prev[targetIndex];
          if (!current) return prev;
          const nextState = current.taskState === "running" ? "pending" : "running";
          const nextOutput: StudioOutput = {
            ...current,
            taskState: nextState,
            timestamp: "Perf status tick",
          };
          const next = [...prev];
          next[targetIndex] = nextOutput;
          return next;
        });
        await afterTwoFrames();
        const afterCounters = getAiStudioShellSectionRenderCounters();
        toolbarStatusTickRerenders.push(
          Math.max(0, afterCounters.toolbar - beforeCounters.toolbar)
        );
        propertiesStatusTickRerenders.push(
          Math.max(0, afterCounters.properties - beforeCounters.properties)
        );
      }

      if (observer) observer.disconnect();
      const sectionRenderCounters = getAiStudioShellSectionRenderCounters();
      return {
        count,
        toolbar: {
          samples: toolbarLatenciesMs.length,
          p95Ms: p95(toolbarLatenciesMs),
        },
        panel: {
          samples: panelLatenciesMs.length,
          p95Ms: p95(panelLatenciesMs),
        },
        drop: {
          samples: dropLatenciesMs.length,
          p95Ms: p95(dropLatenciesMs),
        },
        toolSwitchVisualCommit: {
          samples: toolSwitchCommitLatenciesMs.length,
          p95Ms: p95(toolSwitchCommitLatenciesMs),
        },
        sectionRenderCounters,
        sectionCommit: {
          toolbarP95Ms: p95(toolbarLatenciesMs),
          propertiesP95Ms: p95(panelLatenciesMs),
          referenceP95Ms: p95(referenceCommitLatenciesMs),
          previewP95Ms: p95(previewCommitLatenciesMs),
        },
        nonGridRerendersPerOutputStatusTick: {
          samples: Math.min(
            toolbarStatusTickRerenders.length,
            propertiesStatusTickRerenders.length
          ),
          toolbarP95: p95(toolbarStatusTickRerenders),
          propertiesP95: p95(propertiesStatusTickRerenders),
        },
        longTask: {
          samples: longTaskDurationsMs.length,
          p95Ms: p95(longTaskDurationsMs),
        },
        interaction: {
          maxInputStallMs: Math.round(maxInputStallMs * 100) / 100,
        },
      };
    };
    const runPerfScenario = async (
      count: number,
      clickSamples: number,
      scrollDurationMs: number
    ) => {
      const seedResult = perfWindow.__shortpulseAiStudioPerf?.seedReferenceGrid(count);
      await sleep(280);

      const clickLatenciesMs: number[] = [];
      const renderedItemSamples: number[] = [];
      const hydrationQueueSamples: number[] = [];
      const decodeInflightSamples: number[] = [];
      const perfDegradeSamples: number[] = [];
      const previewSrcSwapRateSamples: number[] = [];
      const previewRepaintSpikeSamples: number[] = [];
      const previewSwapBurstSamples: number[] = [];
      const sampleGridRuntimeMetrics = () => {
        const panel = document.querySelector<HTMLElement>(
          ".reference-canvas-panel[data-grid-surface='reference-grid']"
        );
        if (!panel) return;
        const renderedCount = Number(panel.dataset.renderedItemCount ?? NaN);
        const hydrationQueue = Number(panel.dataset.imageHydrationQueueSize ?? NaN);
        const decodeInflight = Number(panel.dataset.imageDecodeInflightCount ?? NaN);
        const perfDegradeLevel = Number(panel.dataset.gridPerfDegradeLevel ?? NaN);
        const previewSrcSwapRate = Number(panel.dataset.gridSrcSwapRatePerMinute ?? NaN);
        const previewRepaintSpikeCount = Number(panel.dataset.gridRepaintSpikeCount ?? NaN);
        const previewSwapBurstCount = Number(panel.dataset.gridLastSwapBurstCount ?? NaN);
        if (Number.isFinite(renderedCount)) renderedItemSamples.push(renderedCount);
        if (Number.isFinite(hydrationQueue)) hydrationQueueSamples.push(hydrationQueue);
        if (Number.isFinite(decodeInflight)) decodeInflightSamples.push(decodeInflight);
        if (Number.isFinite(perfDegradeLevel)) perfDegradeSamples.push(perfDegradeLevel);
        if (Number.isFinite(previewSrcSwapRate)) previewSrcSwapRateSamples.push(previewSrcSwapRate);
        if (Number.isFinite(previewRepaintSpikeCount))
          previewRepaintSpikeSamples.push(previewRepaintSpikeCount);
        if (Number.isFinite(previewSwapBurstCount))
          previewSwapBurstSamples.push(previewSwapBurstCount);
      };
      const scroller = document.querySelector(".reference-canvas-scroll");
      for (let index = 0; index < clickSamples; index += 1) {
        const cards = Array.from(document.querySelectorAll(".reference-card"));
        if (!cards.length) break;
        const targetCard = cards[index % cards.length];
        if (!targetCard) break;
        const start = performance.now();
        targetCard.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await afterTwoFrames();
        clickLatenciesMs.push(performance.now() - start);
        sampleGridRuntimeMetrics();
        if (scroller instanceof HTMLElement && scroller.scrollHeight > scroller.clientHeight) {
          const nextTop = Math.min(
            scroller.scrollHeight - scroller.clientHeight,
            scroller.scrollTop + 220
          );
          scroller.scrollTop = nextTop;
        }
        await sleep(18);
      }

      const longTaskDurationsMs: number[] = [];
      let observer: PerformanceObserver | null = null;
      if (typeof PerformanceObserver !== "undefined") {
        observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            longTaskDurationsMs.push(entry.duration);
          });
        });
        try {
          observer.observe({ type: "longtask" });
        } catch {
          observer.disconnect();
          observer = null;
        }
      }

      const beforeMb = sampleHeapMb();
      const expectedTickMs = 100;
      let maxInputStallMs = 0;
      const startedAt = performance.now();
      let previousTick = startedAt;
      while (performance.now() - startedAt < scrollDurationMs) {
        await sleep(expectedTickMs);
        const now = performance.now();
        const stall = Math.max(0, now - previousTick - expectedTickMs);
        if (stall > maxInputStallMs) maxInputStallMs = stall;
        previousTick = now;
        if (scroller instanceof HTMLElement && scroller.scrollHeight > scroller.clientHeight) {
          const nextTop =
            scroller.scrollTop + 280 >= scroller.scrollHeight - scroller.clientHeight
              ? 0
              : scroller.scrollTop + 280;
          scroller.scrollTop = nextTop;
        }
        sampleGridRuntimeMetrics();
      }
      if (observer) observer.disconnect();
      const afterMb = sampleHeapMb();

      return {
        count,
        seeded: seedResult,
        click: {
          samples: clickLatenciesMs.length,
          p95Ms: p95(clickLatenciesMs),
        },
        longTask: {
          samples: longTaskDurationsMs.length,
          p95Ms: p95(longTaskDurationsMs),
        },
        interaction: {
          maxInputStallMs: Math.round(maxInputStallMs * 100) / 100,
        },
        memory: {
          beforeMb,
          afterMb,
        },
        grid: {
          renderedItemCountP95: p95(renderedItemSamples),
          imageHydrationQueueP95: p95(hydrationQueueSamples),
          imageDecodeInflightP95: p95(decodeInflightSamples),
          perfDegradeLevelP95: p95(perfDegradeSamples),
          previewSrcSwapRatePerMinuteP95: p95(previewSrcSwapRateSamples),
          previewRepaintSpikeCountMax: previewRepaintSpikeSamples.length
            ? Math.max(...previewRepaintSpikeSamples)
            : null,
          previewLastSwapBurstCountP95: p95(previewSwapBurstSamples),
        },
      };
    };

    perfWindow.__shortpulseAiStudioPerf = {
      seedReferenceGrid: (count: number) => {
        const nextOutputs = createPerfOutputs(count);
        resetReferenceGridState();
        setOutputs(nextOutputs);
        setActiveOutputId(nextOutputs[0]?.id ?? null);
        return {
          requestedCount: count,
          activeCount: nextOutputs.length,
        };
      },
      clearReferenceGrid: () => {
        resetReferenceGridState();
        return { activeCount: 0 };
      },
      runReferenceGridAudit: async (options) => {
        const counts =
          options?.counts?.filter((value) => Number.isFinite(value) && value > 0) ?? DEFAULT_COUNTS;
        const clickSamples = Math.max(
          1,
          Math.floor(options?.clickSamples ?? CLICK_SAMPLES_DEFAULT)
        );
        const scrollDurationMsByCount = {
          ...DEFAULT_SCROLL_MS_BY_COUNT,
          ...(options?.scrollDurationMsByCount ?? {}),
        };

        const scenarios: ReferenceGridScenario[] = [];

        for (const count of counts) {
          const safeCount = Math.max(1, Math.floor(count));
          const scenario = await runPerfScenario(
            safeCount,
            clickSamples,
            scrollDurationMsByCount[safeCount] ?? DEFAULT_SCROLL_MS_BY_COUNT[300]
          );
          scenarios.push({
            count: scenario.count,
            click: scenario.click,
            longTask: scenario.longTask,
            interaction: scenario.interaction,
            memory: scenario.memory,
            grid: scenario.grid,
          });
        }

        const gates = evaluateReferenceGridAuditGates(scenarios, PERF_GATES);

        const result = {
          ok: gates.every((gate) => gate.pass),
          generatedAt: new Date().toISOString(),
          scenarios,
          gates,
        };
        console.table(gates);
        console.log("[shortpulse][reference-grid-audit]", result);
        return result;
      },
      capturePerfBaseline: async () => {
        const referenceGrid = await perfWindow.__shortpulseAiStudioPerf!.runReferenceGridAudit({
          counts: BASELINE_COUNTS,
        });
        const studioShell = await perfWindow.__shortpulseAiStudioPerf!.runStudioShellAudit({
          counts: BASELINE_COUNTS,
        });
        const baseline = {
          generatedAt: new Date().toISOString(),
          referenceGrid,
          studioShell,
        };
        console.log("[shortpulse][perf-baseline]", baseline);
        return baseline;
      },
      runStudioShellAudit: async (options) => {
        const counts =
          options?.counts?.filter((value) => Number.isFinite(value) && value > 0) ??
          SHELL_DEFAULT_COUNTS;
        const toolbarSamples = Math.max(1, Math.floor(options?.toolbarSamples ?? 24));
        const panelSamples = Math.max(1, Math.floor(options?.panelSamples ?? 24));
        const dropSamples = Math.max(1, Math.floor(options?.dropSamples ?? 16));
        const scenarios: StudioShellScenario[] = [];

        for (const count of counts) {
          const scenario = await runStudioShellScenario(
            Math.max(1, Math.floor(count)),
            toolbarSamples,
            panelSamples,
            dropSamples
          );
          scenarios.push(scenario);
        }

        const gates = evaluateStudioShellAuditGates(scenarios, SHELL_GATES);

        const result = {
          ok: gates.every((gate) => gate.pass),
          generatedAt: new Date().toISOString(),
          scenarios,
          gates,
        };
        console.table(gates);
        console.log("[shortpulse][studio-shell-audit]", result);
        return result;
      },
    };

    return () => {
      if (perfWindow.__shortpulseAiStudioPerf) {
        delete perfWindow.__shortpulseAiStudioPerf;
      }
    };
  }, [
    aspect,
    currentModelLabel,
    getOutputSnapshot,
    model,
    resetReferenceGridState,
    setActiveOutputId,
    setOutputs,
  ]);

  const referenceGridFileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    beginnerMode,
    loading: beginnerModeLoading,
    error: beginnerModeError,
    syncState: beginnerModeSyncState,
    setBeginnerMode,
  } = useBeginnerModePreference();
  const trackUiEvent = useCallback((message: string, data?: Record<string, unknown>) => {
    addBreadcrumb({
      type: "ui",
      message,
      data,
    });
  }, []);
  const {
    characterOptions,
    selectedCharacterId,
    setSelectedCharacterId,
    isCharacterOptionsLoading,
  } = useAiStudioCharacterModeLifecycle({
    setUiError,
    setCharacterModeInjectionBundle,
    setIsCharacterBundleLoading,
  });
  const {
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeFallback,
  } = useAiStudioCharacterModeController({
    isCharacterModeEnabled,
    selectedCharacterId,
    characterModeInjectionBundle,
    isCharacterBundleLoading,
    characterOptions,
    setCharacterModeInjectionBundle,
    setIsCharacterBundleLoading,
    trackCharacterModeEvent: trackUiEvent,
    bundleStaleAfterMs: CHARACTER_MODE_BUNDLE_STALE_AFTER_MS,
  });
  const {
    agentEnabled,
    agentMessages,
    agentError,
    agentBusy,
    agentInput,
    agentAttachmentError,
    agentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    agentActions,
    isAgentChatOpen,
    latestAgentPrompt,
    setPromptOrigin,
    agentPrimarySource,
    stagedAgentPrompt,
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentInputChange,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleAgentDescribeTargets,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAgentApplyPrompt,
    handleAgentSelectVariation,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  } = useAiStudioAgentBridge({
    mode,
    selectedTool,
    prompt,
    setSharedPrompt,
    getAgentContext,
    addAgentPromptReference,
    editReferenceText,
    setEditReferenceText,
    videoReferenceText,
    setVideoReferenceText,
    findOutputById,
    resolvePanelOutputPreviewUrl,
    aspect,
    model,
    setOutputs,
    setActiveOutputId,
    setUiNotice,
    trackAgentUiEvent: trackUiEvent,
  });
  const triggerFilePicker = () => referenceGridFileInputRef.current?.click();
  const dismissError = () => setUiError(null);
  const dismissNotice = () => setUiNotice(null);
  const beginnerModeUiNotice = beginnerModeError
    ? `Beginner mode preference sync failed: ${beginnerModeError}`
    : beginnerModeSyncState === "saving"
      ? "Saving beginner mode preference..."
      : null;
  const mediaAutosaveUiNotice = mediaAutosaveError
    ? `Media autosave preference sync failed: ${mediaAutosaveError}`
    : mediaAutosaveSyncState === "saving"
      ? "Saving media autosave preference..."
      : null;
  const effectiveUiNotice = uiNotice ?? beginnerModeUiNotice ?? mediaAutosaveUiNotice;
  const handleBeginnerModeChange = useCallback(
    (value: boolean) => {
      if (beginnerModeLoading || beginnerModeSyncState === "saving") return;
      setBeginnerMode(value);
    },
    [beginnerModeLoading, beginnerModeSyncState, setBeginnerMode]
  );

  const { visibleFailures, dismissFailure, focusFailure } =
    useAiStudioOptimisticDebitReconciliation({
      outputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : outputs,
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
    prompt,
    editReferenceText,
    videoReferenceText,
    videoReferenceMode,
    isCharacterModeEnabled,
  });

  const {
    currentCostCredits,
    promptReferenceGenerateCostCredits,
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
    motionReferenceVideoUrl,
    extraImageUrls,
    imageResolution,
    videoGenerateAudio,
    balanceCredits: effectiveBalanceCredits,
    costParamsForModel,
  });
  const isCharacterLoadingGenerateDisabled = useMemo(
    () =>
      shouldDisableGenerateWhileCharacterLoading({
        selectedTool,
        characterModeEnabled: isCharacterModeEnabled,
        isCharacterBundleLoading,
      }),
    [isCharacterBundleLoading, isCharacterModeEnabled, selectedTool]
  );
  const effectiveGenerationGuardrail =
    generationGuardrail ??
    (isCharacterLoadingGenerateDisabled ? CHARACTER_LOADING_GENERATION_GUARDRAIL : null);
  const effectiveIsGenerateDisabled = Boolean(effectiveGenerationGuardrail);
  const {
    isMediaLibraryOpen,
    handleOpenModelModal,
    handleSelectModelFromModal,
    handleManualPromptChange,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleToolSelect,
    handleOpenMediaLibrary,
    handleCloseMediaLibrary,
    handleFileBrowserSelection,
    handleReferenceGridFiles,
    handleSelectOutput,
  } = useAiStudioWorkspaceActions({
    selectedTool,
    setSelectedTool,
    setMode,
    setShowCreateTools,
    setVideoReferenceText,
    setEditReferenceText,
    setSharedPrompt,
    setPromptOrigin,
    openModelModal,
    closeModelModal,
    setModel,
    addCharacterReferences,
    addOutputsFromFiles,
    setActiveOutputId,
  });

  const {
    isGenerateClickLocked,
    handleGenerate,
    handlePrimarySubmit,
    handleRegenerateWithDebit,
    handleImageRegenerateWithDebit,
  } = useAiStudioGenerationController({
    mode,
    selectedTool,
    model,
    setModel,
    isCharacterModeEnabled,
    prompt,
    agentInput,
    agentBusy,
    currentCostCredits,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    isCreditGuardrail,
    generationGuardrail: effectiveGenerationGuardrail,
    effectiveBalanceCredits,
    balanceCredits,
    optimisticUncoveredDebitTotal: optimisticUncoveredDebitCredits,
    setUiError,
    setUiNotice,
    setPromptOrigin,
    setOptimisticDebitEntries,
    refreshBalance,
    handleAgentSend,
    addAgentPromptReference,
    resolveDefaultPromptForTool,
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeFallback,
    trackCharacterModeEvent: trackUiEvent,
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    generateOutput,
    regenerateOutput,
    activeOutputId,
  });
  const { assistantBubbleMedia, registerOutputLink } = useAgentOutputBubbleLinking({ outputs });
  const resolveAgentOutputGenerateRequest = useCallback(
    (input: AgentOutputGenerateInput): AgentOutputGenerateRequest | null => {
      if (typeof input === "string") {
        const legacyPrompt = normalizePromptText(input);
        if (!legacyPrompt) return null;
        return {
          messageId: "legacy-agent-output",
          prompt: legacyPrompt,
          source: "history",
        };
      }
      const normalizedPrompt = normalizePromptText(input.prompt);
      const messageId = input.messageId?.trim();
      if (!normalizedPrompt || !messageId) return null;
      return {
        messageId,
        prompt: normalizedPrompt,
        source: input.source,
      };
    },
    []
  );
  const handleGenerateFromAgentOutputPrompt = useCallback(
    (input: AgentOutputGenerateInput) => {
      const request = resolveAgentOutputGenerateRequest(input);
      if (!request) return;
      const isVideoWorkflow = selectedTool === "video" || selectedTool === "kling";
      const isEditWorkflow = selectedTool === "edit" || selectedTool === "image";
      const workflowTool: ToolId = isVideoWorkflow ? "video" : isEditWorkflow ? "edit" : "create";
      const workflowMode: StudioMode = isVideoWorkflow ? "video" : "image";

      if (workflowTool === "video") {
        setVideoReferenceText(request.prompt);
      } else if (workflowTool === "edit") {
        setEditReferenceText(request.prompt);
      } else {
        setSharedPrompt(request.prompt);
        if (selectedTool !== "create" && selectedTool !== "text") {
          setSelectedTool("create");
        }
        setMode("image");
      }

      setPromptOrigin("agent");
      void handleGenerate(request.prompt, {
        modeOverride: workflowMode,
        toolOverride: workflowTool,
        costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
      })
        .then((result) => {
          if (!result.accepted || !result.optimisticOutputId) return;
          registerOutputLink({
            messageId: request.messageId,
            optimisticOutputId: result.optimisticOutputId,
          });
        })
        .catch(() => {
          // The generation controller surfaces user-facing errors.
        });
    },
    [
      currentCostCredits,
      handleGenerate,
      promptReferenceGenerateCostCredits,
      registerOutputLink,
      resolveAgentOutputGenerateRequest,
      selectedTool,
      setEditReferenceText,
      setMode,
      setPromptOrigin,
      setSelectedTool,
      setSharedPrompt,
      setVideoReferenceText,
    ]
  );
  const disableAgentOutputGenerate = useMemo(
    () =>
      shouldDisableAgentOutputGenerate({
        mode,
        selectedTool,
        isGenerateDisabled: effectiveIsGenerateDisabled,
        isGenerateClickLocked,
        hasSufficientCreditsForOutputGenerate: hasSufficientCreditsForPromptReferenceGenerate,
        modelId: model,
        characterModeEnabled: isCharacterModeEnabled,
        selectedCharacterId,
      }),
    [
      hasSufficientCreditsForPromptReferenceGenerate,
      isCharacterModeEnabled,
      isGenerateClickLocked,
      effectiveIsGenerateDisabled,
      mode,
      model,
      selectedCharacterId,
      selectedTool,
    ]
  );
  const { handleDownloadReference, handleSaveReference } = useAiStudioReferenceAssetActions({
    findOutputById,
    saveReferenceToLibrary,
    setUiError,
  });

  const panelProps = useAiStudioPanelProps({
    mode,
    aspect,
    model,
    currentModelLabel,
    prompt,
    promptRef,
    agentEnabled,
    agentMessages,
    agentActions,
    agentInput,
    agentBusy,
    agentAttachmentError,
    agentError,
    agentPrimarySource,
    stagedAgentPrompt,
    agentAttachments,
    isAgentDropActive,
    handleAgentInputChange,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleAgentAttachmentDrop,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    handleAgentApplyPrompt,
    handleAgentSelectVariation,
    handleAgentDescribeTargets,
    handleGenerateFromAgentOutputPrompt,
    assistantBubbleMedia,
    useReferenceImageIndicator,
    activeOutput,
    isModelModalOpen,
    modelModalAnchor,
    handleOpenModelModal,
    handleManualPromptChange,
    toggleReferenceIndicator,
    isPromptGenerating,
    isPromptRefining,
    describeInFlightCount,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    isGenerateDisabled: effectiveIsGenerateDisabled,
    isGenerateClickLocked,
    generationGuardrail: effectiveGenerationGuardrail,
    handleExpandChat,
    handleClearAgentChat,
    isAgentChatOpen,
    handlePrimarySubmit,
    savePromptReference,
    characterOptions,
    selectedCharacterId,
    setSelectedCharacterId,
    isCharacterOptionsLoading,
    isCharacterModeEnabled,
    setIsCharacterModeEnabled,
    videoDurationSeconds,
    videoResolution,
    imageResolution,
    videoGenerateAudio,
    videoCameraFixed,
    videoAutoFix,
    setAspect,
    setVideoDurationSeconds,
    setVideoResolution,
    setImageResolution,
    setVideoGenerateAudio,
    setVideoCameraFixed,
    setVideoAutoFix,
    beginnerMode,
    referenceImageUrl,
    extraImageUrls,
    editReferenceText,
    handleImageRegenerateWithDebit,
    referenceImageWarning,
    resolveOutputPreviewUrl: resolvePanelOutputPreviewUrl,
    isReferencePromptEnhancing,
    handleReferencePromptEnhance,
    setReferenceImageUrl,
    setExtraImageUrl,
    handleEditPromptTextChange,
    videoReferenceText,
    videoReferenceMode,
    setVideoReferenceMode,
    klingNegativePrompt,
    klingCfgScale,
    klingShotType,
    klingVoiceIds,
    klingMultiPrompts,
    klingElements,
    setKlingNegativePrompt,
    setKlingCfgScale,
    setKlingShotType,
    setKlingVoiceIds,
    setKlingMultiPrompts,
    setKlingElements,
    motionReferenceVideoUrl,
    setMotionReferenceVideoUrl,
    handleVideoPromptTextChange,
    handleRegenerateWithDebit,
  });
  const referenceGridHookProps = useAiStudioReferenceGridProps({
    outputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : outputs,
    archivedOutputs: FLAG_PAGE_OUTPUT_DECOUPLE ? undefined : archivedOutputs,
    activeOutputId,
    curatedReferenceIds,
    removedFromAllRefsIds,
    onReferenceOutputMediaLoaded,
    linkedPromptReferenceIds,
    handleSelectOutput,
    setDetailOutputId,
    handleSaveReference,
    handleDownloadReference,
    handlePasteTextReference: addPastedPromptReference,
    handlePasteMediaReference: addPastedMediaReference,
    retryOutputStatus,
    handleRerollOutput: rerollOutputFromReplay,
    deleteOutput,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    selectedTool,
  });
  const previewDetailProps = useAiStudioPreviewDetailProps({
    activeOutput,
    referenceImageUrl,
    selectedTool,
    videoReferenceText,
    editReferenceText,
    setReferenceImageUrl,
    handleManualPromptChange,
    handleRegenerateWithDebit,
    detailOutput,
    setDetailOutputId,
    updateOutputPrompt,
    deleteOutput,
    handleDownloadReference,
    savePromptToLibrary,
    handleOpenMediaLibrary,
  });
  const {
    propertiesCreate,
    propertiesImage,
    propertiesVideo,
    referenceGridProps,
    studioPreviewProps,
    detailModalOutput,
    onDetailClose,
    onUpdateOutputPrompt,
    onDeleteOutput,
    onDetailDownload,
    onDetailSavePrompt,
    onOpenMediaLibrary,
  } = mapHookContractsToPageContentProps({
    panelProps,
    referenceGridProps: referenceGridHookProps,
    previewDetailProps,
  });

  return (
    <>
      <Head>
        <title>ShortPulse · AI Studio</title>
        <meta name="description" content="AI Studio — prompt, generate, preview, save." />
        {referenceGridPreconnectOrigin ? (
          <>
            <link rel="preconnect" href={referenceGridPreconnectOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={referenceGridPreconnectOrigin} />
          </>
        ) : null}
      </Head>
      <AiStudioPageContent
        referenceGridFileInputRef={referenceGridFileInputRef}
        onFileBrowserSelection={handleFileBrowserSelection}
        uiError={uiError}
        uiNotice={effectiveUiNotice}
        characterError={characterError}
        onDismissUiError={dismissError}
        onDismissUiNotice={dismissNotice}
        onDismissCharacterError={clearCharacterError}
        beginnerMode={beginnerMode}
        onBeginnerModeChange={handleBeginnerModeChange}
        balanceCredits={effectiveBalanceCredits}
        pendingHoldCredits={pendingHoldCredits > 0 ? pendingHoldCredits : null}
        balanceLoading={balanceLoading}
        visibleFailures={visibleFailures}
        onDismissFailure={dismissFailure}
        onInspectFailure={focusFailure}
        selectedTool={selectedTool}
        showCreateTools={showCreateTools}
        onSelectTool={handleToolSelect}
        onToggleCreateTools={setShowCreateTools}
        propertiesCreate={propertiesCreate}
        propertiesImage={propertiesImage}
        propertiesVideo={propertiesVideo}
        isTemplateView={isTemplateView}
        referenceGridProps={referenceGridProps}
        studioPreviewProps={studioPreviewProps}
        detailModalOutput={detailModalOutput}
        onDetailClose={onDetailClose}
        onUpdateOutputPrompt={onUpdateOutputPrompt}
        onDeleteOutput={onDeleteOutput}
        onDetailDownload={onDetailDownload}
        onDetailSavePrompt={onDetailSavePrompt}
        onOpenMediaLibrary={onOpenMediaLibrary}
        modelModalState={{
          isOpen: isModelModalOpen,
          position: modelModalPosition,
          options: filteredModelOptions,
          anchorId: modelModalAnchor,
          context: modelModalContext,
          onClose: closeModelModal,
          onSelect: handleSelectModelFromModal,
        }}
        agentChat={{
          isOpen: isAgentChatOpen,
          agentMessages,
          agentActions,
          agentInput,
          agentIsSending: agentBusy,
          latestAgentPrompt,
          agentPrimarySource,
          stagedAttachments: agentAttachments,
          agentDropActive: isAgentDropActive,
          onInputChange: handleAgentInputChange,
          onSend: handleAgentSend,
          onAddToGrid: handleAgentAddToGrid,
          onClose: handleCloseAgentChat,
          onAttachmentDrop: handleAgentAttachmentDrop,
          onAttachmentDragOver: handleAgentAttachmentDragOver,
          onAttachmentDragEnter: handleAgentAttachmentDragEnter,
          onAttachmentDragLeave: handleAgentAttachmentDragLeave,
          onRemoveAttachment: handleRemoveAgentAttachment,
          onClearAttachments: handleClearAgentAttachments,
          onAgentApplyPrompt: handleAgentApplyPrompt,
          onAgentSelectVariation: handleAgentSelectVariation,
          onAgentDescribeTargets: handleAgentDescribeTargets,
          onGenerateFromOutputPrompt: handleGenerateFromAgentOutputPrompt,
          assistantBubbleMedia,
          outputGenerateCostCredits: promptReferenceGenerateCostCredits,
          disableOutputGenerate: disableAgentOutputGenerate,
        }}
        handleReferenceGridFiles={handleReferenceGridFiles}
        triggerFilePicker={triggerFilePicker}
      />
      <MediaLibraryModal
        isOpen={isMediaLibraryOpen}
        onClose={handleCloseMediaLibrary}
        onSelectMedia={(payload) => addLibraryMediaReference(payload)}
        onSelectPrompt={(payload) => addLibraryPromptReference(payload)}
      />
    </>
  );
}
