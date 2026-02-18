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
import { useAiAgent } from "../features/ai-agent/useAiAgent";
import { randomId } from "../features/ai-studio/logic/ids";
import type { AgentActions } from "../prefabs/agent";
import { useAiStudioViewModel } from "../features/ai-studio/hooks/useAiStudioViewModel";
import { MediaLibraryModal } from "../features/ai-studio/components/MediaLibraryModal";
import { useBeginnerModePreference } from "../features/ai-studio/hooks/useBeginnerModePreference";
import {
  getStagedAgentPrompt,
  normalizePromptText,
  resolvePromptSourceBadge,
  type PromptOrigin,
} from "../features/ai-studio/logic/agentPromptOwnership";
import { isEditPromptTool } from "../features/ai-studio/logic/promptTargeting";
import { addBreadcrumb } from "../lib/clientBreadcrumbs";
import { useAiStudioAgentComposer } from "../features/ai-studio/hooks/useAiStudioAgentComposer";
import { useAiStudioAgentOrchestration } from "../features/ai-studio/hooks/useAiStudioAgentOrchestration";
import { useAiStudioAgentInteractions } from "../features/ai-studio/hooks/useAiStudioAgentInteractions";
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
import { useAiStudioCharacterPanelProps } from "../features/ai-studio/hooks/useAiStudioCharacterPanelProps";
import { useAiStudioReferenceCanvasProps } from "../features/ai-studio/hooks/useAiStudioReferenceCanvasProps";
import { useAiStudioPreviewDetailProps } from "../features/ai-studio/hooks/useAiStudioPreviewDetailProps";
import { useAiStudioSelectors } from "../features/ai-studio/hooks/useAiStudioSelectors";
import {
  evaluateReferenceGridAuditGates,
  evaluateStudioShellAuditGates,
  type ReferenceGridScenario,
  type StudioShellScenario,
} from "../features/ai-studio/logic/perfAuditGates";
import type { StudioOutput } from "../features/ai-studio/types";

const CHARACTER_MODE_BACKGROUND_MODEL_ID = "fal-ai/bytedance/seedream/v4.5/edit";
const CHARACTER_MODE_BUNDLE_STALE_AFTER_MS = 45 * 60 * 1000;
const FLAG_SHELL_DECOUPLE = process.env.NEXT_PUBLIC_AI_STUDIO_SHELL_DECOUPLE !== "false";

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
      }>;
      gates: Array<{
        name: string;
        pass: boolean;
        actual: number | null;
        expected: string;
        note?: string;
      }>;
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
  const [agentConversationId] = useState<string>(() => randomId());

  // Character workflow state (used when Character tool is active)
  const {
    identity,
    aspect: characterAspect,
    modelId: characterModelId,
    engine: characterEngine,
    prompt: characterPrompt,
    poseId: characterPoseId,
    isBuildingIdentity,
    isGenerating: isCharacterGenerating,
    error: characterError,
    hasWebGpu: characterHasWebGpu,
    modelsAvailable: characterModelsAvailable,
    capabilityMessage: characterCapabilityMessage,
    setPrompt: setCharacterPrompt,
    setAspect: setCharacterAspect,
    setModelId: setCharacterModelId,
    setEngine: setCharacterEngine,
    setPoseId: setCharacterPoseId,
    addReferences: addCharacterReferences,
    removeReference: removeCharacterReference,
    buildIdentity: buildCharacterIdentity,
    generate: generateCharacter,
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
    outputOrder,
    outputById,
    setOutputs,
    resetReferenceGridState,
    archivedOutputs,
    archivedOutputOrder,
    archivedOutputById,
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
    resolvePreviewUrlById,
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
  } = useAiStudioState({
    isCharacterModeEnabled,
  });
  const { resolveOutputPreviewUrl } = useAiStudioSelectors({
    outputOrder,
    archivedOutputOrder,
    outputById,
    archivedOutputById,
    activeOutputId,
  });
  const resolveLegacyPanelOutputPreviewUrl = useCallback(
    (id: string | null | undefined) => resolvePreviewUrlById(outputs, id),
    [outputs, resolvePreviewUrlById]
  );
  const resolvePanelOutputPreviewUrl = FLAG_SHELL_DECOUPLE
    ? resolveOutputPreviewUrl
    : resolveLegacyPanelOutputPreviewUrl;
  const inFlightOutputIds = useMemo(
    () =>
      new Set(
        outputs
          .filter((output) => output.taskState === "pending" || output.taskState === "running")
          .map((output) => output.id)
      ),
    [outputs]
  );
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
  const effectiveBalanceCredits = useMemo(() => {
    if (balanceCredits == null) return null;
    return Math.max(0, balanceCredits - optimisticUncoveredDebitCredits);
  }, [balanceCredits, optimisticUncoveredDebitCredits]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production") return;
    const perfWindow = window as AiStudioPerfWindow;
    const CLICK_SAMPLES_DEFAULT = 24;
    const DEFAULT_COUNTS = [100, 300, 500];
    const DEFAULT_SCROLL_MS_BY_COUNT: Record<number, number> = {
      100: 12_000,
      300: 20_000,
      500: 60_000,
    };
    const PERF_GATES = {
      clickP95MsAt500: 120,
      longTaskP95MsAt500: 120,
      maxInputStallMsAt500: 1000,
      heapGrowthRatio100To500: 3,
    };
    const SHELL_DEFAULT_COUNTS = [50, 100, 300];
    const SHELL_GATES = {
      toolbarP95MsAt50: 120,
      panelP95MsAt50: 140,
      dropP95MsAt50: 140,
      longTaskP95Ms: 120,
      maxInputStallMs: 1000,
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

      const toolbarLatenciesMs: number[] = [];
      const panelLatenciesMs: number[] = [];
      const dropLatenciesMs: number[] = [];
      const longTaskDurationsMs: number[] = [];

      let observer: PerformanceObserver | null = null;
      if (typeof PerformanceObserver !== "undefined") {
        observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            longTaskDurationsMs.push(entry.duration);
          });
        });
        try {
          observer.observe({ type: "longtask", buffered: true });
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
          ".toolbar-item[data-tool-id='create'], .toolbar-item[data-tool-id='edit'], .toolbar-item[data-tool-id='video'], .toolbar-item[data-tool-id='canvas']"
        )
      );
      for (let index = 0; index < toolbarSamples; index += 1) {
        const target = toolbarTargets[index % toolbarTargets.length];
        if (!target) break;
        const startedAt = performance.now();
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await afterTwoFrames();
        toolbarLatenciesMs.push(performance.now() - startedAt);
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

      if (observer) observer.disconnect();
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
          observer.observe({ type: "longtask", buffered: true });
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
            scrollDurationMsByCount[safeCount] ?? DEFAULT_SCROLL_MS_BY_COUNT[500]
          );
          scenarios.push({
            count: scenario.count,
            click: scenario.click,
            longTask: scenario.longTask,
            interaction: scenario.interaction,
            memory: scenario.memory,
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
  }, [aspect, currentModelLabel, model, resetReferenceGridState, setActiveOutputId, setOutputs]);

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);
  const { beginnerMode, setBeginnerMode } = useBeginnerModePreference();
  const agentFlag = process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true";
  const [agentSessionEnabled, setAgentSessionEnabled] = useState<boolean>(true);
  const agentEnabled = agentFlag || agentSessionEnabled;
  const {
    messages: agentMessages,
    isSending: agentIsSending,
    error: agentError,
    send: sendToAgent,
    appendUserMessage,
    reset: resetAgentChat,
  } = useAiAgent({
    enabled: true, // allow first-click activation; API will gate if truly disabled server-side
    conversationId: agentConversationId,
  });
  const [agentUiBusy, setAgentUiBusy] = useState(false);
  const agentUiBusyRef = useRef(false);
  const agentBusy = agentIsSending || agentUiBusy;
  const [agentActions, setAgentActions] = useState<AgentActions | undefined>(undefined);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [latestAgentPrompt, setLatestAgentPrompt] = useState<string | null>(null);
  const [promptOrigin, setPromptOrigin] = useState<PromptOrigin>("manual");
  const ensureAgentSession = useCallback(() => {
    setAgentSessionEnabled(true);
  }, []);
  const {
    agentInput,
    setAgentInput,
    handleAgentInputChange,
    agentAttachmentError,
    setAgentAttachmentError,
    agentAttachments,
    setAgentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    markAttachmentDelivery,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    resetAgentComposer,
  } = useAiStudioAgentComposer({
    agentSessionEnabled,
    ensureAgentSession,
    outputs,
    resolvePreviewUrlById,
  });
  const latestAssistantMessage = useMemo(
    () => [...agentMessages].reverse().find((msg) => msg.role === "assistant")?.content ?? null,
    [agentMessages]
  );
  const agentPrimarySource = resolvePromptSourceBadge(promptOrigin);
  const stagedAgentPrompt = getStagedAgentPrompt(promptOrigin, latestAgentPrompt);
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
    isCharacterModeEnabled,
    selectedTool,
    model,
    setModel,
    setUiError,
    setCharacterModeInjectionBundle,
    setIsCharacterBundleLoading,
    backgroundModelId: CHARACTER_MODE_BACKGROUND_MODEL_ID,
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

  const editPromptToolSelected = isEditPromptTool(selectedTool);

  const {
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleDescribeReference,
    handleAgentDescribeTargets,
  } = useAiStudioAgentOrchestration({
    agentIsSending,
    agentUiBusyRef,
    setAgentUiBusy,
    agentSessionEnabled,
    setAgentSessionEnabled,
    agentInput,
    setAgentInput,
    agentAttachments,
    setAgentAttachments,
    setAgentAttachmentError,
    markAttachmentDelivery,
    prompt,
    latestAgentPrompt,
    setLatestAgentPrompt,
    setAgentActions,
    selectedTool,
    setSharedPrompt,
    setPromptOrigin,
    sendToAgent,
    appendUserMessage,
    getAgentContext,
    trackAgentUiEvent: trackUiEvent,
    addAgentPromptReference,
    editReferenceText,
    setEditReferenceText,
    videoReferenceText,
    setVideoReferenceText,
    outputs,
    aspect,
    model,
    setOutputs,
    setActiveOutputId,
    lastAssistantMessage: latestAssistantMessage,
    setUiNotice,
  });

  const {
    handleAgentApplyPrompt,
    handleAgentSelectVariation,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  } = useAiStudioAgentInteractions({
    editPromptToolSelected,
    setSharedPrompt,
    setLatestAgentPrompt,
    setPromptOrigin,
    trackAgentUiEvent: trackUiEvent,
    setAgentInput,
    addAgentPromptReference,
    setIsAgentChatOpen,
    agentSessionEnabled,
    setAgentSessionEnabled,
    latestAgentPrompt,
    agentActions,
    resetAgentChat,
    resetAgentComposer,
    setAgentActions,
  });
  const triggerFilePicker = () => referenceCanvasFileInputRef.current?.click();
  const dismissError = () => setUiError(null);
  const dismissNotice = () => setUiNotice(null);

  const { visibleFailures, dismissFailure, focusFailure } =
    useAiStudioOptimisticDebitReconciliation({
      outputs,
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
  });

  const {
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForCost,
    hasSufficientCreditsForPromptReferenceGenerate,
    isCreditGuardrail,
    generationGuardrail,
    isGenerateDisabled,
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
    handleReferenceCanvasFiles,
    handleSelectOutput,
    showReferencePromptGenerate,
    disableReferencePromptGenerate,
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
    model,
    hasSufficientCreditsForCost,
    referenceImageUrl,
    extraImageUrls,
    motionReferenceVideoUrl,
    editReferenceText,
    videoReferenceText,
    videoReferenceMode,
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
    prompt,
    agentInput,
    agentBusy,
    currentCostCredits,
    isGenerateDisabled,
    isCreditGuardrail,
    generationGuardrail,
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
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
    generateOutput,
    regenerateOutput,
  });
  const handleGenerateFromAgentOutputPrompt = useCallback(
    (promptText: string) => {
      const normalizedPrompt = normalizePromptText(promptText);
      if (!normalizedPrompt) return;
      setPromptOrigin("agent");
      void handleGenerate(normalizedPrompt, {
        costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
      });
    },
    [currentCostCredits, handleGenerate, promptReferenceGenerateCostCredits, setPromptOrigin]
  );
  const disableAgentOutputGenerate = useMemo(() => {
    const isCreatePromptTool = selectedTool === "create" || selectedTool === "text";
    const missingGenerationTarget = isCreatePromptTool
      ? isCharacterModeEnabled
        ? !selectedCharacterId
        : !model
      : false;
    const isCreatePromptTextMode = isCreatePromptTool && mode === "text";
    return (
      isCreatePromptTextMode ||
      isPromptGenerating ||
      isGenerateDisabled ||
      agentBusy ||
      isGenerateClickLocked ||
      missingGenerationTarget ||
      !hasSufficientCreditsForPromptReferenceGenerate
    );
  }, [
    agentBusy,
    hasSufficientCreditsForPromptReferenceGenerate,
    isCharacterModeEnabled,
    isGenerateClickLocked,
    isGenerateDisabled,
    isPromptGenerating,
    mode,
    model,
    selectedCharacterId,
    selectedTool,
  ]);
  const { handleDownloadReference, handleSaveReference, handleGenerateFromPromptReference } =
    useAiStudioReferenceAssetActions({
      outputs,
      selectedTool,
      currentCostCredits,
      setVideoReferenceText,
      setEditReferenceText,
      setSharedPrompt,
      setSelectedTool,
      setMode,
      setPromptOrigin,
      handleGenerate,
      saveReferenceToLibrary,
      setUiError,
    });

  const { propertiesText, propertiesImage, propertiesVideo } = useAiStudioPanelProps({
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
    useReferenceImageIndicator,
    activeOutput,
    isModelModalOpen,
    modelModalAnchor,
    handleOpenModelModal,
    setModel,
    handleManualPromptChange,
    toggleReferenceIndicator,
    isPromptGenerating,
    isPromptRefining,
    describeInFlightCount,
    currentCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForPromptReferenceGenerate,
    isGenerateDisabled,
    isGenerateClickLocked,
    generationGuardrail,
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
  const propertiesCharacter = useAiStudioCharacterPanelProps({
    identity,
    characterAspect,
    characterModelId,
    characterEngine,
    characterPrompt,
    characterPoseId,
    isBuildingIdentity,
    isCharacterGenerating,
    characterHasWebGpu,
    characterModelsAvailable,
    characterCapabilityMessage,
    setCharacterPrompt,
    setCharacterAspect,
    setCharacterModelId,
    setCharacterEngine,
    setCharacterPoseId,
    addCharacterReferences,
    removeCharacterReference,
    buildCharacterIdentity,
    generateCharacter,
    triggerFilePicker,
  });
  const referenceCanvasProps = useAiStudioReferenceCanvasProps({
    outputs,
    archivedOutputs,
    activeOutputId,
    onReferenceOutputMediaLoaded,
    linkedPromptReferenceIds,
    showReferencePromptGenerate,
    disableReferencePromptGenerate,
    handleSelectOutput,
    setDetailOutputId,
    handleDescribeReference,
    handleSaveReference,
    handleDownloadReference,
    handleGenerateFromPromptReference,
    handlePasteTextReference: addPastedPromptReference,
    handlePasteMediaReference: addPastedMediaReference,
    retryOutputStatus,
    deleteOutput,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    currentCostCredits,
    selectedTool,
  });
  const {
    studioPreviewProps,
    detailModalOutput,
    onDetailClose,
    onUpdateOutputPrompt,
    onDeleteOutput,
    onDetailDownload,
    onDetailSavePrompt,
    onOpenMediaLibrary,
  } = useAiStudioPreviewDetailProps({
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

  return (
    <>
      <Head>
        <title>ShortPulse · AI Studio</title>
        <meta name="description" content="AI Studio — prompt, generate, preview, save." />
      </Head>
      <AiStudioPageContent
        referenceCanvasFileInputRef={referenceCanvasFileInputRef}
        onFileBrowserSelection={handleFileBrowserSelection}
        uiError={uiError}
        uiNotice={uiNotice}
        characterError={characterError}
        onDismissUiError={dismissError}
        onDismissUiNotice={dismissNotice}
        onDismissCharacterError={clearCharacterError}
        beginnerMode={beginnerMode}
        onBeginnerModeChange={setBeginnerMode}
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
        propertiesText={propertiesText}
        propertiesCharacter={propertiesCharacter}
        propertiesImage={propertiesImage}
        propertiesVideo={propertiesVideo}
        isTemplateView={isTemplateView}
        referenceCanvasProps={referenceCanvasProps}
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
          outputGenerateCostCredits: promptReferenceGenerateCostCredits,
          disableOutputGenerate: disableAgentOutputGenerate,
        }}
        handleReferenceCanvasFiles={handleReferenceCanvasFiles}
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
