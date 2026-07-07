/**
 * Registers AI Studio perf audit helpers on window for manual runtime diagnostics.
 * Keeps page-level orchestration thin while preserving existing audit behavior.
 */
import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  evaluateReferenceGridAuditGates,
  evaluateProjectRestoreAuditGates,
  evaluateProjectWorkspaceAutosaveTypingAuditGates,
  evaluateStudioShellAuditGates,
  type ProjectRestoreScenario,
  type ProjectWorkspaceAutosaveTypingScenario,
  type ReferenceGridScenario,
  type StudioShellScenario,
} from "../logic/perfAuditGates";
import {
  getAiStudioShellSectionRenderCounters,
  resetAiStudioShellSectionRenderCounters,
} from "../logic/shellRenderCounters";
import {
  getProjectWorkspaceAutosavePerfCounters,
  resetProjectWorkspaceAutosavePerfCounters,
  type ProjectWorkspaceAutosavePerfCounters,
} from "../logic/projectWorkspaceAutosavePerf";
import {
  getFreezeInvestigationSnapshot,
  resetFreezeInvestigationSnapshot,
  type FreezeInvestigationSnapshot,
} from "../logic/freezeInvestigationTelemetry";
import {
  limitReferenceGridVisibleOutputs,
  REFERENCE_GRID_MAX_VISIBLE_ITEMS,
  REFERENCE_GRID_TARGET_TOTAL_ITEMS,
} from "../reference-grid/logic/referenceGridLimits";
import {
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotOutputs,
  type AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { createProjectRestoreSnapshot } from "../logic/projectRestoreSnapshot";
import type { StudioOutput } from "../types";

const PERF_REFERENCE_IMAGE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#2ad1ff"/><stop offset="1" stop-color="#0f6fff"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><circle cx="120" cy="94" r="50" fill="rgba(255,255,255,0.24)"/><rect x="48" y="152" width="144" height="56" rx="18" fill="rgba(0,0,0,0.24)"/></svg>'
)}`;
const PERF_AUDIT_REFERENCE_PNG_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 4, 0, 0,
  0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 252, 255, 31, 0, 3, 3, 2, 0, 239,
  154, 236, 175, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

export const getPerfAuditReferenceImageBytes = (): Uint8Array =>
  new Uint8Array(PERF_AUDIT_REFERENCE_PNG_BYTES);

export const createPerfAuditReferenceImageFile = (): File =>
  new File([getPerfAuditReferenceImageBytes()], "audit-reference.png", {
    type: "image/png",
  });

export const AI_STUDIO_PERF_AUDIT_ROOT_SELECTOR = ".ai-studio-page";

/**
 * Returns the ShortPulse-owned AI Studio DOM root used by manual perf audit queries.
 */
export const resolveAiStudioPerfAuditRoot = (
  documentRef: Document | null | undefined = typeof document !== "undefined" ? document : null
): HTMLElement | null => {
  return documentRef?.querySelector<HTMLElement>(AI_STUDIO_PERF_AUDIT_ROOT_SELECTOR) ?? null;
};

/**
 * Queries AI Studio-owned DOM only so extension-injected page nodes cannot skew audit samples.
 */
export const queryAiStudioPerfAudit = <ElementType extends Element>(
  selector: string,
  root: ParentNode | null | undefined = resolveAiStudioPerfAuditRoot()
): ElementType | null => {
  return root?.querySelector<ElementType>(selector) ?? null;
};

/**
 * Queries all matching AI Studio-owned DOM nodes for manual perf audit interactions.
 */
export const queryAiStudioPerfAuditAll = <ElementType extends Element>(
  selector: string,
  root: ParentNode | null | undefined = resolveAiStudioPerfAuditRoot()
): ElementType[] => {
  return root ? Array.from(root.querySelectorAll<ElementType>(selector)) : [];
};

type AiStudioPerfWindow = Window & {
  __shortpulseAiStudioPerfMountDebug?: {
    enabled: boolean;
    routeFlagEnabled: boolean;
    runtimeEnabled: boolean;
    stage: string;
    href: string;
    search: string;
    updatedAt: string;
    hasRuntime: boolean;
  };
  __shortpulseAiStudioReferenceGridAuditProgress?: ReferenceGridAuditProgressSnapshot;
  __shortpulseAiStudioPerf?: {
    seedReferenceGrid: (
      count: number,
      options?: PerfSeedReferenceGridOptions
    ) => {
      requestedCount: number;
      activeCount: number;
      archivedCount: number;
      totalCount: number;
      activeCapOverride: number | null;
    };
    seedReferenceGridItems: (items: PerfSeedOutputInput[]) => {
      activeCount: number;
      archivedCount: number;
      totalCount: number;
      outputIds: string[];
    };
    clearReferenceGrid: () => { activeCount: number; archivedCount: number; totalCount: number };
    runReferenceGridAudit: (options?: {
      counts?: number[];
      clickSamples?: number;
      scrollDurationMsByCount?: Record<number, number>;
      activeCapOverride?: number | null;
    }) => Promise<{
      ok: boolean;
      generatedAt: string;
      scenarios: Array<{
        count: number;
        viewport?: {
          width: number | null;
          height: number | null;
        };
        seeded?: {
          requestedCount?: number;
          activeCount: number;
          archivedCount?: number;
          totalCount?: number;
          activeCapOverride?: number | null;
        };
        click: { samples: number; p95Ms: number | null };
        longTask: { samples: number; p95Ms: number | null };
        interaction: { maxInputStallMs: number };
        memory: { beforeMb: number | null; afterMb: number | null };
        grid: {
          renderedItemCountP95: number | null;
          imageHydrationQueueP95: number | null;
          imageDecodeInflightP95: number | null;
          perfDegradeLevelP95: number | null;
          mediaWorkTokensP95?: number | null;
          videoAttachBudgetP95?: number | null;
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
    getReferenceGridAuditProgress: () => ReferenceGridAuditProgressSnapshot;
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
    runDividerDragAudit: (options?: {
      counts?: number[];
      dragSamples?: number;
      dragDistancePx?: number;
    }) => Promise<{
      ok: boolean;
      generatedAt: string;
      scenarios: Array<{
        count: number;
        shellDivider: {
          targetFound: boolean;
          samples: number;
          dragP95Ms: number | null;
          longTaskP95Ms: number | null;
          projectionCounters: Record<string, number>;
        };
        horizontalDivider: {
          targetFound: boolean;
          samples: number;
          dragP95Ms: number | null;
          longTaskP95Ms: number | null;
          projectionCounters: Record<string, number>;
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
    runProjectWorkspaceAutosaveTypingAudit: (options?: { samples?: number }) => Promise<{
      ok: boolean;
      generatedAt: string;
      projectRouteRequested: boolean;
      scenarios: ProjectWorkspaceAutosaveTypingScenario[];
      gates: Array<{
        name: string;
        pass: boolean;
        actual: number | null;
        expected: string;
        note?: string;
      }>;
    }>;
    runProjectRestoreAudit: (options?: { totalCount?: number; activeCount?: number }) => Promise<{
      ok: boolean;
      generatedAt: string;
      scenarios: ProjectRestoreScenario[];
      gates: Array<{
        name: string;
        pass: boolean;
        actual: number | null;
        expected: string;
        note?: string;
      }>;
    }>;
    getProjectWorkspaceAutosavePerfCounters: () => ProjectWorkspaceAutosavePerfCounters;
    resetProjectWorkspaceAutosavePerfCounters: () => void;
  };
};

type PerfSeedOutputInput = {
  id?: string;
  prompt?: string;
  mode?: "image" | "video" | "text";
  generationId?: string | null;
  previewUrl?: string | null;
  previewText?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  resultUrls?: string[] | null;
  savedMediaIds?: string[] | null;
  mediaSource?: StudioOutput["mediaSource"];
};

type PerfSeedReferenceGridOptions = {
  activeCapOverride?: number | null;
};

type PerfOutputSnapshot = { outputOrder: string[] };

type ReferenceGridAuditProgressSnapshot = {
  status: "idle" | "running" | "done" | "error";
  runId: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  counts: number[];
  currentCount: number | null;
  completedCounts: number[];
  failedCount: number | null;
  error: string | null;
};

type UseAiStudioPerfAuditRuntimeParams = {
  enabled: boolean;
  aspect: string;
  currentModelLabel: string;
  model: string | null;
  getOutputSnapshot: () => PerfOutputSnapshot;
  resetReferenceGridState: () => void;
  projectRouteRequested: boolean;
  standardCreatePrompt: string;
  editReferenceText: string;
  videoReferenceText: string;
  setActiveOutputId: (outputId: string | null) => void;
  setStandardCreatePrompt: (value: string) => void;
  setEditReferenceText: (value: string) => void;
  setVideoReferenceText: (value: string) => void;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  hydrateFromSessionSnapshot?: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  setReferenceGridAuditOutputs?: (collections: {
    active: StudioOutput[];
    archived?: StudioOutput[];
  }) => void;
};

/**
 * Mount window perf helpers used by operator audit scripts.
 * Exposes the same `window.__shortpulseAiStudioPerf` contract as the legacy page implementation.
 */
export function useAiStudioPerfAuditRuntime({
  enabled,
  aspect,
  currentModelLabel,
  model,
  getOutputSnapshot,
  resetReferenceGridState,
  projectRouteRequested,
  standardCreatePrompt,
  editReferenceText,
  videoReferenceText,
  setActiveOutputId,
  setStandardCreatePrompt,
  setEditReferenceText,
  setVideoReferenceText,
  setOutputs,
  hydrateFromSessionSnapshot,
  setReferenceGridAuditOutputs,
}: UseAiStudioPerfAuditRuntimeParams): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const perfWindow = window as AiStudioPerfWindow;
    const routeFlagEnabled =
      new URLSearchParams(window.location.search).get("perfAuditRuntime")?.trim() === "1";
    const runtimeEnabled = enabled || routeFlagEnabled;
    const recordMountDebug = (stage: string) => {
      if (!runtimeEnabled) return;
      perfWindow.__shortpulseAiStudioPerfMountDebug = {
        enabled,
        routeFlagEnabled,
        runtimeEnabled,
        stage,
        href: window.location.href,
        search: window.location.search,
        updatedAt: new Date().toISOString(),
        hasRuntime: Boolean(perfWindow.__shortpulseAiStudioPerf),
      };
    };
    recordMountDebug("effect_enter");
    if (process.env.NODE_ENV === "production" && !runtimeEnabled) return;
    if (!runtimeEnabled) return;
    const CLICK_SAMPLES_DEFAULT = 24;
    const DEFAULT_COUNTS = [20, 40, 50, 60, 100, 300, 400, 500];
    const DEFAULT_SCROLL_MS_BY_COUNT: Record<number, number> = {
      20: 2_500,
      40: 3_500,
      50: 4_500,
      60: 5_000,
      100: 12_000,
      300: 20_000,
      400: 20_000,
      500: 20_000,
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
      crashResilienceCount: 100,
      renderedItemCountP95AtCrashCount: 36,
      longTaskP95MsAtCrashCount: 140,
      maxInputStallMsAtCrashCount: 1_000,
      imageDecodeInflightP95AtCrashCount: 6,
      videoAttachBudgetP95AtCrashCount: 3,
      mediaWorkTokensP95AtCrashCount: 8,
      heapDeltaMbAtCrashCount: 96,
      capacityGateThresholds: [
        {
          count: 400,
          clickP95Ms: 150,
          renderedItemCountP95: 36,
          longTaskP95Ms: 180,
          maxInputStallMs: 1_000,
          imageDecodeInflightP95: 6,
          videoAttachBudgetP95: 3,
          mediaWorkTokensP95: 8,
          heapDeltaMb: 128,
        },
        {
          count: 500,
          clickP95Ms: 150,
          renderedItemCountP95: 36,
          longTaskP95Ms: 180,
          maxInputStallMs: 1_000,
          imageDecodeInflightP95: 6,
          videoAttachBudgetP95: 3,
          mediaWorkTokensP95: 8,
          heapDeltaMb: 128,
        },
      ],
    };
    const SHELL_DEFAULT_COUNTS = [20, 40, 50, 60, 100, 300];
    const SHELL_GATES = {
      toolbarP95MsAt60: 150,
      panelP95MsAt60: 150,
      toolSwitchVisualCommitP95MsAt60: 180,
      longTaskP95Ms: 120,
      maxInputStallMs: 1000,
      nonGridRerendersPerOutputStatusTick: 3,
    };
    const PROJECT_WORKSPACE_AUTOSAVE_TYPING_GATES = {
      standardPromptCommitP95Ms: 45,
      standardPromptBaseSnapshotBuildsP95: 1,
      standardPromptSessionSnapshotComposeCountP95: 1,
      standardPromptCandidateSelectionCountP95: 1,
      draftCommitP95Ms: 30,
      draftBaseSnapshotBuildsP95: 0,
      draftSessionSnapshotComposeCountP95: 0,
      draftCandidateSelectionCountP95: 0,
    };
    const PROJECT_RESTORE_GATES = {
      targetTotalCount: REFERENCE_GRID_TARGET_TOTAL_ITEMS,
      targetActiveCount: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      targetArchivedCount: 0,
      hydrateDurationMsAtTarget: 750,
      settleDurationMsAtTarget: 1_500,
      longTaskP95MsAtTarget: 180,
      maxInputStallMsAtTarget: 1_000,
      heapDeltaMbAtTarget: 128,
      outputStorePublishCountAtTarget: 4,
      allRefsScanCountAtTarget: 4,
      quickSlotLookupCountAtTarget: 4,
    };
    const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const nextFrame = () =>
      new Promise<void>((resolve) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve();
        }, 250);
        window.requestAnimationFrame(() => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          resolve();
        });
      });
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
    let referenceGridAuditProgress: ReferenceGridAuditProgressSnapshot =
      perfWindow.__shortpulseAiStudioReferenceGridAuditProgress ?? {
        status: "idle",
        runId: null,
        startedAt: null,
        updatedAt: null,
        counts: [],
        currentCount: null,
        completedCounts: [],
        failedCount: null,
        error: null,
      };
    const updateReferenceGridAuditProgress = (
      patch: Partial<ReferenceGridAuditProgressSnapshot>
    ): ReferenceGridAuditProgressSnapshot => {
      referenceGridAuditProgress = {
        ...referenceGridAuditProgress,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      perfWindow.__shortpulseAiStudioReferenceGridAuditProgress = referenceGridAuditProgress;
      return referenceGridAuditProgress;
    };
    updateReferenceGridAuditProgress(referenceGridAuditProgress);
    const sampleHeapMb = (): number | null => {
      const runtimePerformance = performance as Performance & {
        memory?: { usedJSHeapSize?: number };
      };
      if (typeof runtimePerformance.memory?.usedJSHeapSize !== "number") return null;
      return Math.round((runtimePerformance.memory.usedJSHeapSize / (1024 * 1024)) * 100) / 100;
    };
    const captureViewport = () => ({
      width:
        typeof window.innerWidth === "number" && Number.isFinite(window.innerWidth)
          ? window.innerWidth
          : null,
      height:
        typeof window.innerHeight === "number" && Number.isFinite(window.innerHeight)
          ? window.innerHeight
          : null,
    });
    const diffAutosaveCounters = (
      before: ProjectWorkspaceAutosavePerfCounters,
      after: ProjectWorkspaceAutosavePerfCounters
    ): ProjectWorkspaceAutosavePerfCounters => ({
      baseSnapshotBuildCount: after.baseSnapshotBuildCount - before.baseSnapshotBuildCount,
      baseSnapshotBuildMs: after.baseSnapshotBuildMs - before.baseSnapshotBuildMs,
      sessionSnapshotComposeCount:
        after.sessionSnapshotComposeCount - before.sessionSnapshotComposeCount,
      sessionSnapshotComposeMs: after.sessionSnapshotComposeMs - before.sessionSnapshotComposeMs,
      candidateSelectionCount: after.candidateSelectionCount - before.candidateSelectionCount,
      candidateSelectionMs: after.candidateSelectionMs - before.candidateSelectionMs,
    });
    const diffFreezeCounters = (
      before: FreezeInvestigationSnapshot,
      after: FreezeInvestigationSnapshot
    ): Record<string, number> => {
      const keys = new Set([...Object.keys(before.counters), ...Object.keys(after.counters)]);
      const diff: Record<string, number> = {};
      keys.forEach((key) => {
        const delta = (after.counters[key] ?? 0) - (before.counters[key] ?? 0);
        if (delta !== 0) diff[key] = delta;
      });
      return diff;
    };
    const createPerfOutputs = (count: number): StudioOutput[] => {
      const safeCount = Math.max(0, Math.floor(count));
      const runId = Date.now();
      const baseCreatedAtMs = Date.now();
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
          createdAt: new Date(baseCreatedAtMs - index).toISOString(),
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
    const createPerfOutputsFromInputs = (items: readonly PerfSeedOutputInput[]): StudioOutput[] => {
      const runId = Date.now();
      const baseCreatedAtMs = Date.now();
      return items.map((item, index) => {
        const mode = item.mode ?? "image";
        const prompt = item.prompt?.trim() || `Perf media reference ${index + 1}`;
        const previewUrl =
          item.previewUrl === null
            ? undefined
            : item.previewUrl?.trim() ||
              (mode === "text" ? undefined : `${PERF_REFERENCE_IMAGE_SVG}#${index + 1}`);
        const previewText =
          item.previewText === null
            ? undefined
            : item.previewText?.trim() || (mode === "text" ? prompt : undefined);
        return {
          id: item.id?.trim() || `perf-custom-${runId}-${index}`,
          prompt,
          mode,
          aspect,
          model: currentModelLabel,
          modelId: model ?? undefined,
          createdAt: new Date(baseCreatedAtMs - index).toISOString(),
          generationId:
            item.generationId === null ? undefined : item.generationId?.trim() || undefined,
          status: "ready",
          taskState: "success",
          timestamp: "Perf seed",
          resultUrls: Array.isArray(item.resultUrls)
            ? item.resultUrls.map((value) => value.trim()).filter(Boolean)
            : undefined,
          previewUrl,
          previewStoragePath:
            item.previewStoragePath === null
              ? null
              : item.previewStoragePath?.trim() ||
                (typeof previewUrl === "string" ? previewUrl : null),
          fullStoragePath:
            item.fullStoragePath === null
              ? null
              : item.fullStoragePath?.trim() ||
                (typeof previewUrl === "string" ? previewUrl : null),
          savedMediaIds: Array.isArray(item.savedMediaIds)
            ? item.savedMediaIds.map((value) => value.trim()).filter(Boolean)
            : undefined,
          previewText,
          mediaSource: item.mediaSource ?? (mode === "text" ? "prompt" : "generated"),
          previewTier: mode === "text" ? "full" : "thumb",
          archivedAt: null,
          archiveReason: null,
          saveState: "idle",
          saveError: null,
        } satisfies StudioOutput;
      });
    };
    const createProjectRestorePerfSnapshot = ({
      totalCount,
      activeCount,
    }: {
      totalCount: number;
      activeCount: number;
    }): {
      snapshot: AiStudioSessionSnapshot;
      activeRows: StudioOutput[];
      archivedRows: StudioOutput[];
    } => {
      const allRows = createPerfOutputs(totalCount);
      const limited = limitReferenceGridVisibleOutputs(allRows, activeCount);
      const activeRows = limited.rows;
      const archivedRows: StudioOutput[] = [];
      const baseSnapshot = createEmptyAiStudioSessionSnapshot({
        sessionId: `perf-project-restore-${Date.now()}`,
        updatedAt: new Date().toISOString(),
      });

      return {
        activeRows,
        archivedRows,
        snapshot: patchAiStudioSessionSnapshotOutputs(baseSnapshot, {
          active: activeRows,
          archived: archivedRows,
          activeOutputId: activeRows[0]?.id ?? null,
          curatedReferenceIds: activeRows.slice(0, 4).map((row) => row.id),
          removedFromAllRefsIds: [],
        }),
      };
    };
    const resolveDropTransfer = () => {
      if (typeof DataTransfer === "undefined") return null;
      const transfer = new DataTransfer();
      transfer.items.add(createPerfAuditReferenceImageFile());
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
    const createSyntheticPointerEvent = (
      type: "pointerdown" | "pointermove" | "pointerup",
      options: {
        pointerId: number;
        clientX: number;
        clientY: number;
        button?: number;
      }
    ): Event => {
      if (typeof PointerEvent !== "undefined") {
        try {
          return new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: options.pointerId,
            pointerType: "mouse",
            button: options.button ?? 0,
            clientX: options.clientX,
            clientY: options.clientY,
          });
        } catch {
          // Fall back for runtimes that expose PointerEvent but reject construction.
        }
      }
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: options.button ?? 0,
        clientX: options.clientX,
        clientY: options.clientY,
      });
      try {
        Object.defineProperties(event, {
          pointerId: { value: options.pointerId },
          pointerType: { value: "mouse" },
        });
      } catch {
        // Ignore runtimes that block pointer metadata on MouseEvent fallback.
      }
      return event;
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

      const toolbarTargets = queryAiStudioPerfAuditAll<HTMLElement>(
        ".toolbar-item[data-tool-id='create'], .toolbar-item[data-tool-id='edit'], .toolbar-item[data-tool-id='video']"
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

      // Keep panel interactions and status-tick rerender sampling on a stable properties surface.
      const createToolTarget = queryAiStudioPerfAudit<HTMLElement>(
        ".toolbar-item[data-tool-id='create']"
      );
      if (createToolTarget) {
        createToolTarget.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
        await afterTwoFrames();
      }

      const panelTargets = queryAiStudioPerfAuditAll<HTMLElement>(
        ".ai-properties textarea, .ai-properties input, .ai-properties button, .ai-properties select"
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
        queryAiStudioPerfAudit<HTMLElement>(".ai-shell-right") ??
        queryAiStudioPerfAudit<HTMLElement>(".reference-canvas-panel");
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

      const referenceTargets = queryAiStudioPerfAuditAll<HTMLElement>(
        ".reference-column .reference-card"
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

      const previewTargets = queryAiStudioPerfAuditAll<HTMLElement>(
        ".studio-column .studio-preview-square, .studio-column .prompt-preview-input, .studio-column .preview-card-actions .ghost-btn"
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
      scrollDurationMs: number,
      seedOptions?: PerfSeedReferenceGridOptions
    ) => {
      const scenarioStartedAt = performance.now();
      const scenarioBudgetMs = Math.max(5_000, scrollDurationMs + clickSamples * 1_500 + 5_000);
      const assertScenarioBudget = (phase: string) => {
        const elapsedMs = performance.now() - scenarioStartedAt;
        if (elapsedMs <= scenarioBudgetMs) return;
        throw new Error(
          `Reference Grid audit scenario ${count} exceeded ${Math.round(
            scenarioBudgetMs
          )}ms during ${phase}.`
        );
      };
      const seedResult = perfWindow.__shortpulseAiStudioPerf?.seedReferenceGrid(count, seedOptions);
      await sleep(280);
      assertScenarioBudget("settle");

      const clickLatenciesMs: number[] = [];
      const renderedItemSamples: number[] = [];
      const hydrationQueueSamples: number[] = [];
      const decodeInflightSamples: number[] = [];
      const perfDegradeSamples: number[] = [];
      const mediaWorkTokenSamples: number[] = [];
      const videoAttachBudgetSamples: number[] = [];
      const previewSrcSwapRateSamples: number[] = [];
      const previewRepaintSpikeSamples: number[] = [];
      const previewSwapBurstSamples: number[] = [];
      const sampleGridRuntimeMetrics = () => {
        const panel = queryAiStudioPerfAudit<HTMLElement>(
          ".reference-canvas-panel[data-grid-surface='reference-grid']"
        );
        if (!panel) return;
        const renderedCount = Number(panel.dataset.renderedItemCount ?? NaN);
        const hydrationQueue = Number(panel.dataset.imageHydrationQueueSize ?? NaN);
        const decodeInflight = Number(panel.dataset.imageDecodeInflightCount ?? NaN);
        const perfDegradeLevel = Number(panel.dataset.gridPerfDegradeLevel ?? NaN);
        const mediaWorkTokens = Number(panel.dataset.gridMediaWorkTokens ?? NaN);
        const videoAttachBudget = Number(panel.dataset.gridVideoAttachBudget ?? NaN);
        const previewSrcSwapRate = Number(panel.dataset.gridSrcSwapRatePerMinute ?? NaN);
        const previewRepaintSpikeCount = Number(panel.dataset.gridRepaintSpikeCount ?? NaN);
        const previewSwapBurstCount = Number(panel.dataset.gridLastSwapBurstCount ?? NaN);
        if (Number.isFinite(renderedCount)) renderedItemSamples.push(renderedCount);
        if (Number.isFinite(hydrationQueue)) hydrationQueueSamples.push(hydrationQueue);
        if (Number.isFinite(decodeInflight)) decodeInflightSamples.push(decodeInflight);
        if (Number.isFinite(perfDegradeLevel)) perfDegradeSamples.push(perfDegradeLevel);
        if (Number.isFinite(mediaWorkTokens)) mediaWorkTokenSamples.push(mediaWorkTokens);
        if (Number.isFinite(videoAttachBudget)) videoAttachBudgetSamples.push(videoAttachBudget);
        if (Number.isFinite(previewSrcSwapRate)) previewSrcSwapRateSamples.push(previewSrcSwapRate);
        if (Number.isFinite(previewRepaintSpikeCount))
          previewRepaintSpikeSamples.push(previewRepaintSpikeCount);
        if (Number.isFinite(previewSwapBurstCount))
          previewSwapBurstSamples.push(previewSwapBurstCount);
      };
      const scroller = queryAiStudioPerfAudit<HTMLElement>(".reference-canvas-scroll");
      for (let index = 0; index < clickSamples; index += 1) {
        const cards = queryAiStudioPerfAuditAll<HTMLElement>(".reference-card");
        if (!cards.length) break;
        const targetCard = cards[index % cards.length];
        if (!targetCard) break;
        const start = performance.now();
        targetCard.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await afterTwoFrames();
        assertScenarioBudget("click sampling");
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
        assertScenarioBudget("click sampling");
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
        assertScenarioBudget("scroll sampling");
      }
      if (observer) observer.disconnect();
      const afterMb = sampleHeapMb();

      return {
        count,
        viewport: captureViewport(),
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
          mediaWorkTokensP95: p95(mediaWorkTokenSamples),
          videoAttachBudgetP95: p95(videoAttachBudgetSamples),
          previewSrcSwapRatePerMinuteP95: p95(previewSrcSwapRateSamples),
          previewRepaintSpikeCountMax: previewRepaintSpikeSamples.length
            ? Math.max(...previewRepaintSpikeSamples)
            : null,
          previewLastSwapBurstCountP95: p95(previewSwapBurstSamples),
        },
      };
    };

    const dispatchSyntheticDividerDrag = async ({
      target,
      axis,
      distancePx,
      pointerId,
    }: {
      target: HTMLElement;
      axis: "x" | "y";
      distancePx: number;
      pointerId: number;
    }) => {
      const rect = target.getBoundingClientRect();
      const startX = rect.left + Math.max(1, rect.width / 2 || 1);
      const startY = rect.top + Math.max(1, rect.height / 2 || 1);
      target.dispatchEvent(
        createSyntheticPointerEvent("pointerdown", {
          pointerId,
          clientX: startX,
          clientY: startY,
        })
      );
      const moveCount = 8;
      for (let moveIndex = 1; moveIndex <= moveCount; moveIndex += 1) {
        const progress = moveIndex / moveCount;
        window.dispatchEvent(
          createSyntheticPointerEvent("pointermove", {
            pointerId,
            clientX: axis === "x" ? startX + distancePx * progress : startX,
            clientY: axis === "y" ? startY + distancePx * progress : startY,
          })
        );
        await nextFrame();
      }
      window.dispatchEvent(
        createSyntheticPointerEvent("pointerup", {
          pointerId,
          clientX: axis === "x" ? startX + distancePx : startX,
          clientY: axis === "y" ? startY + distancePx : startY,
        })
      );
      await afterTwoFrames();
    };

    const findFirstMeasurableElement = (selector: string): HTMLElement | null => {
      const candidates = queryAiStudioPerfAuditAll<HTMLElement>(selector);
      return (
        candidates.find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 0 || rect.height > 0;
        }) ??
        candidates[0] ??
        null
      );
    };

    const runDividerTargetAudit = async ({
      target,
      axis,
      dragSamples,
      dragDistancePx,
      pointerIdBase,
    }: {
      target: HTMLElement | null;
      axis: "x" | "y";
      dragSamples: number;
      dragDistancePx: number;
      pointerIdBase: number;
    }) => {
      if (!target) {
        return {
          targetFound: false,
          samples: 0,
          dragP95Ms: null,
          longTaskP95Ms: null,
          projectionCounters: {},
        };
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

      resetFreezeInvestigationSnapshot();
      const beforeCounters = getFreezeInvestigationSnapshot();
      const dragDurationsMs: number[] = [];
      for (let index = 0; index < dragSamples; index += 1) {
        const startedAt = performance.now();
        await dispatchSyntheticDividerDrag({
          target,
          axis,
          distancePx: index % 2 === 0 ? dragDistancePx : -dragDistancePx,
          pointerId: pointerIdBase + index,
        });
        dragDurationsMs.push(performance.now() - startedAt);
        await sleep(18);
      }
      const afterCounters = getFreezeInvestigationSnapshot();
      if (observer) observer.disconnect();

      return {
        targetFound: true,
        samples: dragDurationsMs.length,
        dragP95Ms: p95(dragDurationsMs),
        longTaskP95Ms: p95(longTaskDurationsMs),
        projectionCounters: diffFreezeCounters(beforeCounters, afterCounters),
      };
    };

    const runDividerDragScenario = async ({
      count,
      dragSamples,
      dragDistancePx,
    }: {
      count: number;
      dragSamples: number;
      dragDistancePx: number;
    }) => {
      perfWindow.__shortpulseAiStudioPerf?.seedReferenceGrid(count);
      await sleep(280);
      const shellDivider = findFirstMeasurableElement(".ai-shell-divider");
      const horizontalDivider = findFirstMeasurableElement(
        ".reference-grid-horizontal-divider-wrap"
      );

      return {
        count,
        shellDivider: await runDividerTargetAudit({
          target: shellDivider,
          axis: "x",
          dragSamples,
          dragDistancePx,
          pointerIdBase: 3_100,
        }),
        horizontalDivider: await runDividerTargetAudit({
          target: horizontalDivider,
          axis: "y",
          dragSamples,
          dragDistancePx,
          pointerIdBase: 4_100,
        }),
      };
    };

    const runProjectRestoreScenario = async ({
      totalCount,
      activeCount,
    }: {
      totalCount: number;
      activeCount: number;
    }): Promise<ProjectRestoreScenario> => {
      if (!hydrateFromSessionSnapshot) {
        return {
          totalCount,
          activeCount,
          archivedCount: Math.max(0, totalCount - activeCount),
          hydrate: { durationMs: null },
          settle: { durationMs: null },
          longTask: { samples: 0, p95Ms: null },
          interaction: { maxInputStallMs: 0 },
          memory: { beforeMb: null, afterMb: null },
          outputStore: {
            instrumentationAvailable: false,
            publishCount: Number.POSITIVE_INFINITY,
            allRefsScanCount: Number.POSITIVE_INFINITY,
            quickSlotLookupCount: Number.POSITIVE_INFINITY,
          },
          semantics: {
            restoredActiveCount: 0,
            restoredArchivedCount: 0,
            quickSlotCount: 0,
            removedFromAllRefsCount: 0,
            activeOutputId: "missing_hydrator",
          },
        };
      }

      const { snapshot, activeRows, archivedRows } = createProjectRestorePerfSnapshot({
        totalCount,
        activeCount,
      });
      resetReferenceGridState();
      await afterTwoFrames();

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

      const expectedTickMs = 50;
      let maxInputStallMs = 0;
      let previousTick = performance.now();
      const stallTimer = window.setInterval(() => {
        const now = performance.now();
        const stall = Math.max(0, now - previousTick - expectedTickMs);
        if (stall > maxInputStallMs) maxInputStallMs = stall;
        previousTick = now;
      }, expectedTickMs);

      resetFreezeInvestigationSnapshot();
      const outputStoreInstrumentationAvailable =
        typeof window.__shortpulseFreezeInvestigation?.getSnapshot === "function";
      const beforeCounters = getFreezeInvestigationSnapshot();
      const beforeMb = sampleHeapMb();
      const restoreSnapshot = createProjectRestoreSnapshot(snapshot);
      const hydrateStartedAt = performance.now();
      const payload = hydrateFromSessionSnapshot(restoreSnapshot);
      const hydrateDurationMs = performance.now() - hydrateStartedAt;
      await afterTwoFrames();
      const settleDurationMs = performance.now() - hydrateStartedAt;
      window.clearInterval(stallTimer);
      if (observer) observer.disconnect();

      const afterMb = sampleHeapMb();
      const afterCounters = getFreezeInvestigationSnapshot();
      const outputStoreCounters = diffFreezeCounters(beforeCounters, afterCounters);
      const outputSnapshot = getOutputSnapshot();

      return {
        totalCount,
        activeCount: activeRows.length,
        archivedCount: archivedRows.length,
        hydrate: {
          durationMs: Math.round(hydrateDurationMs * 100) / 100,
        },
        settle: {
          durationMs: Math.round(settleDurationMs * 100) / 100,
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
        outputStore: {
          instrumentationAvailable: outputStoreInstrumentationAvailable,
          publishCount: outputStoreCounters["outputStore.snapshot.publish"] ?? 0,
          allRefsScanCount: outputStoreCounters["referenceGrid.outputProjection.allRefs.scan"] ?? 0,
          quickSlotLookupCount:
            outputStoreCounters["referenceGrid.outputProjection.quickSlot.lookup"] ?? 0,
        },
        semantics: {
          restoredActiveCount: outputSnapshot.outputOrder.length || payload.outputs.active.length,
          restoredArchivedCount: payload.outputs.archived.length,
          quickSlotCount: payload.outputs.curatedReferenceIds.length,
          removedFromAllRefsCount: payload.outputs.removedFromAllRefsIds.length,
          activeOutputId: payload.outputs.activeOutputId,
        },
      };
    };

    const runProjectWorkspaceAutosaveTypingScenario = async ({
      field,
      currentValue,
      setValue,
      sampleCount,
    }: {
      field: "standardPrompt" | "editReferenceText" | "videoReferenceText";
      currentValue: string;
      setValue: (value: string) => void;
      sampleCount: number;
    }): Promise<ProjectWorkspaceAutosaveTypingScenario> => {
      const commitLatenciesMs: number[] = [];
      const baseSnapshotBuilds: number[] = [];
      const baseSnapshotBuildMs: number[] = [];
      const sessionSnapshotComposeCounts: number[] = [];
      const sessionSnapshotComposeMs: number[] = [];
      const candidateSelectionCounts: number[] = [];
      const candidateSelectionMs: number[] = [];

      resetProjectWorkspaceAutosavePerfCounters();

      for (let index = 0; index < sampleCount; index += 1) {
        const before = getProjectWorkspaceAutosavePerfCounters();
        const startedAt = performance.now();
        setValue(`[perf-audit:${field}:${index}]`);
        await afterTwoFrames();
        commitLatenciesMs.push(performance.now() - startedAt);
        const after = getProjectWorkspaceAutosavePerfCounters();
        const diff = diffAutosaveCounters(before, after);
        baseSnapshotBuilds.push(diff.baseSnapshotBuildCount);
        baseSnapshotBuildMs.push(diff.baseSnapshotBuildMs);
        sessionSnapshotComposeCounts.push(diff.sessionSnapshotComposeCount);
        sessionSnapshotComposeMs.push(diff.sessionSnapshotComposeMs);
        candidateSelectionCounts.push(diff.candidateSelectionCount);
        candidateSelectionMs.push(diff.candidateSelectionMs);
        await sleep(18);
      }

      setValue(currentValue);
      await afterTwoFrames();

      return {
        field,
        commit: {
          samples: commitLatenciesMs.length,
          p95Ms: p95(commitLatenciesMs),
        },
        autosave: {
          baseSnapshotBuildsP95: p95(baseSnapshotBuilds),
          baseSnapshotBuildMsP95: p95(baseSnapshotBuildMs),
          sessionSnapshotComposeCountP95: p95(sessionSnapshotComposeCounts),
          sessionSnapshotComposeMsP95: p95(sessionSnapshotComposeMs),
          candidateSelectionCountP95: p95(candidateSelectionCounts),
          candidateSelectionMsP95: p95(candidateSelectionMs),
        },
      };
    };

    recordMountDebug("building_runtime");
    const auditRuntime: NonNullable<AiStudioPerfWindow["__shortpulseAiStudioPerf"]> = {
      seedReferenceGrid: (count: number, options?: PerfSeedReferenceGridOptions) => {
        const nextOutputs = createPerfOutputs(count);
        const requestedActiveCapOverride =
          typeof options?.activeCapOverride === "number" &&
          Number.isFinite(options.activeCapOverride) &&
          options.activeCapOverride > 0
            ? Math.floor(options.activeCapOverride)
            : null;
        const activeCapOverride = setReferenceGridAuditOutputs ? requestedActiveCapOverride : null;
        const limited = limitReferenceGridVisibleOutputs(
          nextOutputs,
          activeCapOverride ?? undefined
        );
        resetReferenceGridState();
        if (activeCapOverride && setReferenceGridAuditOutputs) {
          setReferenceGridAuditOutputs({
            active: limited.rows,
            archived: [],
          });
          setActiveOutputId(limited.rows[0]?.id ?? null);
        } else {
          setOutputs(nextOutputs);
          setActiveOutputId(nextOutputs[0]?.id ?? null);
        }
        return {
          requestedCount: count,
          activeCount: limited.rows.length,
          archivedCount: limited.trimmedCount,
          totalCount: nextOutputs.length,
          activeCapOverride,
        };
      },
      seedReferenceGridItems: (items: PerfSeedOutputInput[]) => {
        const nextOutputs = createPerfOutputsFromInputs(items);
        const limited = limitReferenceGridVisibleOutputs(nextOutputs);
        resetReferenceGridState();
        setOutputs(nextOutputs);
        setActiveOutputId(nextOutputs[0]?.id ?? null);
        return {
          activeCount: limited.rows.length,
          archivedCount: limited.trimmedCount,
          totalCount: nextOutputs.length,
          outputIds: nextOutputs.map((item) => item.id),
        };
      },
      clearReferenceGrid: () => {
        resetReferenceGridState();
        return { activeCount: 0, archivedCount: 0, totalCount: 0 };
      },
      getReferenceGridAuditProgress: () => referenceGridAuditProgress,
      runReferenceGridAudit: async (options) => {
        const rawCounts =
          options?.counts?.filter((value) => Number.isFinite(value) && value > 0) ?? DEFAULT_COUNTS;
        const counts = rawCounts.map((count) => Math.max(1, Math.floor(count)));
        const clickSamples = Math.max(
          1,
          Math.floor(options?.clickSamples ?? CLICK_SAMPLES_DEFAULT)
        );
        const scrollDurationMsByCount = {
          ...DEFAULT_SCROLL_MS_BY_COUNT,
          ...(options?.scrollDurationMsByCount ?? {}),
        };
        const activeCapOverride =
          typeof options?.activeCapOverride === "number" &&
          Number.isFinite(options.activeCapOverride) &&
          options.activeCapOverride > 0
            ? Math.floor(options.activeCapOverride)
            : null;

        const scenarios: ReferenceGridScenario[] = [];
        const runId = `reference-grid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        updateReferenceGridAuditProgress({
          status: "running",
          runId,
          startedAt: new Date().toISOString(),
          counts,
          currentCount: null,
          completedCounts: [],
          failedCount: null,
          error: null,
        });

        try {
          for (const count of counts) {
            updateReferenceGridAuditProgress({
              currentCount: count,
              failedCount: null,
              error: null,
            });
            const scenario = await runPerfScenario(
              count,
              clickSamples,
              scrollDurationMsByCount[count] ?? DEFAULT_SCROLL_MS_BY_COUNT[300],
              activeCapOverride ? { activeCapOverride } : undefined
            );
            scenarios.push({
              count: scenario.count,
              viewport: scenario.viewport,
              seeded: scenario.seeded,
              click: scenario.click,
              longTask: scenario.longTask,
              interaction: scenario.interaction,
              memory: scenario.memory,
              grid: scenario.grid,
            });
            updateReferenceGridAuditProgress({
              currentCount: null,
              completedCounts: scenarios.map((scenario) => scenario.count),
            });
          }
        } catch (error) {
          updateReferenceGridAuditProgress({
            status: "error",
            failedCount: referenceGridAuditProgress.currentCount,
            error: error instanceof Error ? error.message : "Reference Grid audit failed.",
          });
          throw error;
        }

        const gates = evaluateReferenceGridAuditGates(scenarios, PERF_GATES);

        const result = {
          ok: gates.every((gate) => gate.pass),
          generatedAt: new Date().toISOString(),
          scenarios,
          gates,
        };
        updateReferenceGridAuditProgress({
          status: result.ok ? "done" : "error",
          currentCount: null,
          completedCounts: scenarios.map((scenario) => scenario.count),
          failedCount: result.ok ? null : null,
          error: result.ok ? null : "Reference Grid audit gates failed.",
        });
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
      runDividerDragAudit: async (options) => {
        const counts = options?.counts?.filter((value) => Number.isFinite(value) && value > 0) ?? [
          40, 60, 100, 300,
        ];
        const dragSamples = Math.max(1, Math.floor(options?.dragSamples ?? 6));
        const dragDistancePx = Math.max(8, Math.floor(options?.dragDistancePx ?? 48));
        const scenarios = [];

        for (const count of counts) {
          scenarios.push(
            await runDividerDragScenario({
              count: Math.max(1, Math.floor(count)),
              dragSamples,
              dragDistancePx,
            })
          );
        }

        const gates = scenarios.flatMap((scenario) => [
          {
            name: `shell_divider_target_exists_at_${scenario.count}`,
            pass: scenario.shellDivider.targetFound,
            actual: scenario.shellDivider.targetFound ? 1 : 0,
            expected: "1",
          },
          {
            name: `horizontal_divider_target_exists_at_${scenario.count}`,
            pass: scenario.horizontalDivider.targetFound,
            actual: scenario.horizontalDivider.targetFound ? 1 : 0,
            expected: "1",
          },
        ]);
        const result = {
          ok: gates.every((gate) => gate.pass),
          generatedAt: new Date().toISOString(),
          scenarios,
          gates,
        };
        console.table(gates);
        console.log("[shortpulse][divider-drag-audit]", result);
        return result;
      },
      runProjectWorkspaceAutosaveTypingAudit: async (options) => {
        if (!projectRouteRequested) {
          return {
            ok: false,
            generatedAt: new Date().toISOString(),
            projectRouteRequested,
            scenarios: [],
            gates: [
              {
                name: "project_route_required",
                pass: false,
                actual: null,
                expected: "Open a project route before running the project autosave typing audit.",
              },
            ],
          };
        }

        const sampleCount = Math.max(1, Math.floor(options?.samples ?? 12));

        const scenarios = await Promise.all([
          runProjectWorkspaceAutosaveTypingScenario({
            field: "standardPrompt",
            currentValue: standardCreatePrompt,
            setValue: setStandardCreatePrompt,
            sampleCount,
          }),
          runProjectWorkspaceAutosaveTypingScenario({
            field: "editReferenceText",
            currentValue: editReferenceText,
            setValue: setEditReferenceText,
            sampleCount,
          }),
          runProjectWorkspaceAutosaveTypingScenario({
            field: "videoReferenceText",
            currentValue: videoReferenceText,
            setValue: setVideoReferenceText,
            sampleCount,
          }),
        ]);

        const gates = evaluateProjectWorkspaceAutosaveTypingAuditGates(
          scenarios,
          PROJECT_WORKSPACE_AUTOSAVE_TYPING_GATES
        );
        const result = {
          ok: gates.every((gate) => gate.pass),
          generatedAt: new Date().toISOString(),
          projectRouteRequested,
          scenarios,
          gates,
        };
        console.table(gates);
        console.log("[shortpulse][project-workspace-autosave-typing-audit]", result);
        return result;
      },
      runProjectRestoreAudit: async (options) => {
        const totalCount = Math.max(
          1,
          Math.floor(options?.totalCount ?? PROJECT_RESTORE_GATES.targetTotalCount)
        );
        const activeCount = Math.min(
          totalCount,
          Math.max(1, Math.floor(options?.activeCount ?? PROJECT_RESTORE_GATES.targetActiveCount))
        );
        const scenarios = [
          await runProjectRestoreScenario({
            totalCount,
            activeCount,
          }),
        ];
        const gates = evaluateProjectRestoreAuditGates(scenarios, {
          ...PROJECT_RESTORE_GATES,
          targetTotalCount: totalCount,
          targetActiveCount: activeCount,
          targetArchivedCount: totalCount - activeCount,
        });
        const result = {
          ok: gates.every((gate) => gate.pass),
          generatedAt: new Date().toISOString(),
          scenarios,
          gates,
        };
        console.table(gates);
        console.log("[shortpulse][project-restore-audit]", result);
        return result;
      },
      getProjectWorkspaceAutosavePerfCounters: () => getProjectWorkspaceAutosavePerfCounters(),
      resetProjectWorkspaceAutosavePerfCounters: () => {
        resetProjectWorkspaceAutosavePerfCounters();
      },
    };
    perfWindow.__shortpulseAiStudioPerf = auditRuntime;
    recordMountDebug("assigned");

    return () => {
      if (perfWindow.__shortpulseAiStudioPerf === auditRuntime) {
        delete perfWindow.__shortpulseAiStudioPerf;
        recordMountDebug("cleanup_deleted");
        return;
      }
      recordMountDebug("cleanup_skipped_newer_runtime");
    };
  }, [
    aspect,
    currentModelLabel,
    enabled,
    getOutputSnapshot,
    model,
    resetReferenceGridState,
    projectRouteRequested,
    standardCreatePrompt,
    editReferenceText,
    videoReferenceText,
    setActiveOutputId,
    setStandardCreatePrompt,
    setEditReferenceText,
    setVideoReferenceText,
    setOutputs,
    hydrateFromSessionSnapshot,
    setReferenceGridAuditOutputs,
  ]);
}
