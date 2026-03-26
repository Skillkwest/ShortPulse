/**
 * Registers AI Studio perf audit helpers on window for manual runtime diagnostics.
 * Keeps page-level orchestration thin while preserving existing audit behavior.
 */
import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  evaluateReferenceGridAuditGates,
  evaluateStudioShellAuditGates,
  type ReferenceGridScenario,
  type StudioShellScenario,
} from "../logic/perfAuditGates";
import {
  getAiStudioShellSectionRenderCounters,
  resetAiStudioShellSectionRenderCounters,
} from "../logic/shellRenderCounters";
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

type AiStudioPerfWindow = Window & {
  __shortpulseAiStudioPerf?: {
    seedReferenceGrid: (count: number) => { requestedCount: number; activeCount: number };
    seedReferenceGridItems: (items: PerfSeedOutputInput[]) => {
      activeCount: number;
      outputIds: string[];
    };
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

type PerfSeedOutputInput = {
  id?: string;
  prompt?: string;
  mode?: "image" | "video" | "text";
  previewUrl?: string | null;
  previewText?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  savedMediaIds?: string[] | null;
  mediaSource?: StudioOutput["mediaSource"];
};

type PerfOutputSnapshot = { outputOrder: string[] };

type UseAiStudioPerfAuditRuntimeParams = {
  enabled: boolean;
  aspect: string;
  currentModelLabel: string;
  model: string | null;
  getOutputSnapshot: () => PerfOutputSnapshot;
  resetReferenceGridState: () => void;
  setActiveOutputId: (outputId: string | null) => void;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
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
  setActiveOutputId,
  setOutputs,
}: UseAiStudioPerfAuditRuntimeParams): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const runtimeEnabled =
      enabled ||
      new URLSearchParams(window.location.search).get("perfAuditRuntime")?.trim() === "1";
    if (process.env.NODE_ENV === "production" && !runtimeEnabled) return;
    if (!runtimeEnabled) return;
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
      toolbarP95MsAt60: 150,
      panelP95MsAt60: 150,
      toolSwitchVisualCommitP95MsAt60: 180,
      longTaskP95Ms: 120,
      maxInputStallMs: 1000,
      nonGridRerendersPerOutputStatusTick: 3,
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
    const createPerfOutputsFromInputs = (items: readonly PerfSeedOutputInput[]): StudioOutput[] => {
      const runId = Date.now();
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
          status: "ready",
          taskState: "success",
          timestamp: "Perf seed",
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
          ".toolbar-item[data-tool-id='create'], .toolbar-item[data-tool-id='edit'], .toolbar-item[data-tool-id='video']"
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

      // Keep panel interactions and status-tick rerender sampling on a stable properties surface.
      const createToolTarget = document.querySelector<HTMLElement>(
        ".toolbar-item[data-tool-id='create']"
      );
      if (createToolTarget) {
        createToolTarget.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
        await afterTwoFrames();
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
      seedReferenceGridItems: (items: PerfSeedOutputInput[]) => {
        const nextOutputs = createPerfOutputsFromInputs(items);
        resetReferenceGridState();
        setOutputs(nextOutputs);
        setActiveOutputId(nextOutputs[0]?.id ?? null);
        return {
          activeCount: nextOutputs.length,
          outputIds: nextOutputs.map((item) => item.id),
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
    enabled,
    getOutputSnapshot,
    model,
    resetReferenceGridState,
    setActiveOutputId,
    setOutputs,
  ]);
}
