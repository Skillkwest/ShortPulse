import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REFERENCE_GRID_MAX_VISIBLE_ITEMS,
  REFERENCE_GRID_TARGET_TOTAL_ITEMS,
} from "../../reference-grid/logic/referenceGridLimits";
import {
  AI_STUDIO_PERF_AUDIT_ROOT_SELECTOR,
  createPerfAuditReferenceImageFile,
  getPerfAuditReferenceImageBytes,
  queryAiStudioPerfAudit,
  queryAiStudioPerfAuditAll,
  resolveAiStudioPerfAuditRoot,
  useAiStudioPerfAuditRuntime,
} from "../useAiStudioPerfAuditRuntime";
import type { AiStudioSessionSnapshot } from "../../logic/sessionSnapshot";

type PerfAuditWindow = Window & {
  __shortpulseAiStudioReferenceGridAuditProgress?: {
    status: "idle" | "running" | "done" | "error";
    counts: number[];
    currentCount: number | null;
    completedCounts: number[];
    failedCount: number | null;
    error: string | null;
  };
  __shortpulseAiStudioPerf?: {
    seedReferenceGrid: (
      count: number,
      options?: { activeCapOverride?: number | null }
    ) => {
      requestedCount: number;
      activeCount: number;
      archivedCount: number;
      totalCount: number;
      activeCapOverride: number | null;
    };
    runProjectRestoreAudit: (options?: { totalCount?: number; activeCount?: number }) => Promise<{
      ok: boolean;
      scenarios: Array<{
        totalCount: number;
        activeCount: number;
        archivedCount: number;
        semantics: {
          restoredActiveCount: number;
          restoredArchivedCount: number;
          activeOutputId: string | null;
        };
        outputStore: {
          instrumentationAvailable: boolean;
        };
      }>;
    }>;
    runReferenceGridAudit: (options?: {
      counts?: number[];
      clickSamples?: number;
      scrollDurationMsByCount?: Record<number, number>;
    }) => Promise<{
      ok: boolean;
      scenarios: Array<{ count: number }>;
    }>;
    getReferenceGridAuditProgress: () => {
      status: "idle" | "running" | "done" | "error";
      counts: number[];
      currentCount: number | null;
      completedCounts: number[];
      failedCount: number | null;
      error: string | null;
    };
  };
};

const getPerfWindow = (): PerfAuditWindow => window as PerfAuditWindow;

afterEach(() => {
  delete getPerfWindow().__shortpulseAiStudioPerf;
  delete getPerfWindow().__shortpulseAiStudioReferenceGridAuditProgress;
  window.history.pushState(null, "", "/");
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("createPerfAuditReferenceImageFile", () => {
  it("builds a valid PNG file for shell audit drop sampling", async () => {
    const file = createPerfAuditReferenceImageFile();
    const bytes = getPerfAuditReferenceImageBytes();

    expect(file.name).toBe("audit-reference.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBe(bytes.length);
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});

describe("useAiStudioPerfAuditRuntime", () => {
  it("registers the browser audit helper from the perfAuditRuntime route flag and seeds the 500 target", async () => {
    window.history.pushState(null, "", "/ai-studio?perfAuditRuntime=1");

    const { unmount } = renderHook(() =>
      useAiStudioPerfAuditRuntime({
        enabled: false,
        aspect: "9:16",
        currentModelLabel: "Seedream",
        model: "seedream",
        getOutputSnapshot: () => ({ outputOrder: [] }),
        resetReferenceGridState: vi.fn(),
        projectRouteRequested: false,
        standardCreatePrompt: "",
        editReferenceText: "",
        videoReferenceText: "",
        setActiveOutputId: vi.fn(),
        setStandardCreatePrompt: vi.fn(),
        setEditReferenceText: vi.fn(),
        setVideoReferenceText: vi.fn(),
        setOutputs: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(getPerfWindow().__shortpulseAiStudioPerf?.seedReferenceGrid).toEqual(
        expect.any(Function)
      );
    });

    const seeded = getPerfWindow().__shortpulseAiStudioPerf?.seedReferenceGrid(
      REFERENCE_GRID_TARGET_TOTAL_ITEMS
    );

    expect(seeded).toEqual({
      requestedCount: REFERENCE_GRID_TARGET_TOTAL_ITEMS,
      activeCount: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      archivedCount: REFERENCE_GRID_TARGET_TOTAL_ITEMS - REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      totalCount: REFERENCE_GRID_TARGET_TOTAL_ITEMS,
      activeCapOverride: null,
    });

    unmount();

    await waitFor(() => {
      expect(getPerfWindow().__shortpulseAiStudioPerf).toBeUndefined();
    });
  });

  it("can seed a max-active audit workset without using the product cap setter", async () => {
    window.history.pushState(null, "", "/ai-studio?perfAuditRuntime=1");
    const setOutputs = vi.fn();
    const setReferenceGridAuditOutputs = vi.fn();

    const { unmount } = renderHook(() =>
      useAiStudioPerfAuditRuntime({
        enabled: false,
        aspect: "9:16",
        currentModelLabel: "Seedream",
        model: "seedream",
        getOutputSnapshot: () => ({ outputOrder: [] }),
        resetReferenceGridState: vi.fn(),
        projectRouteRequested: false,
        standardCreatePrompt: "",
        editReferenceText: "",
        videoReferenceText: "",
        setActiveOutputId: vi.fn(),
        setStandardCreatePrompt: vi.fn(),
        setEditReferenceText: vi.fn(),
        setVideoReferenceText: vi.fn(),
        setOutputs,
        setReferenceGridAuditOutputs,
      })
    );

    await waitFor(() => {
      expect(getPerfWindow().__shortpulseAiStudioPerf?.seedReferenceGrid).toEqual(
        expect.any(Function)
      );
    });

    const seeded = getPerfWindow().__shortpulseAiStudioPerf?.seedReferenceGrid(
      REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      {
        activeCapOverride: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      }
    );

    expect(seeded).toEqual({
      requestedCount: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      activeCount: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      archivedCount: 0,
      totalCount: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
      activeCapOverride: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
    });
    expect(setReferenceGridAuditOutputs).toHaveBeenCalledWith({
      active: expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^perf-/),
          archivedAt: null,
        }),
      ]),
      archived: [],
    });
    expect(setReferenceGridAuditOutputs.mock.calls[0]?.[0].active).toHaveLength(
      REFERENCE_GRID_MAX_VISIBLE_ITEMS
    );
    expect(setOutputs).not.toHaveBeenCalled();

    unmount();
  });

  it("runs the project restore audit through the provided session hydrator", async () => {
    window.history.pushState(null, "", "/ai-studio?perfAuditRuntime=1");
    let restoredOutputOrder: string[] = [];
    const hydrateFromSessionSnapshot = vi.fn((snapshot: AiStudioSessionSnapshot) => {
      restoredOutputOrder = snapshot.outputs.active.map((output) => output.id);
      return {
        outputs: {
          active: snapshot.outputs.active,
          archived: snapshot.outputs.archived,
          activeOutputId: snapshot.outputs.activeOutputId,
          curatedReferenceIds: snapshot.outputs.curatedReferenceIds,
          removedFromAllRefsIds: snapshot.outputs.removedFromAllRefsIds,
        },
      } as never;
    });

    const { unmount } = renderHook(() =>
      useAiStudioPerfAuditRuntime({
        enabled: false,
        aspect: "9:16",
        currentModelLabel: "Seedream",
        model: "seedream",
        getOutputSnapshot: () => ({ outputOrder: restoredOutputOrder }),
        resetReferenceGridState: vi.fn(),
        projectRouteRequested: false,
        standardCreatePrompt: "",
        editReferenceText: "",
        videoReferenceText: "",
        setActiveOutputId: vi.fn(),
        setStandardCreatePrompt: vi.fn(),
        setEditReferenceText: vi.fn(),
        setVideoReferenceText: vi.fn(),
        setOutputs: vi.fn(),
        hydrateFromSessionSnapshot,
      })
    );

    await waitFor(() => {
      expect(getPerfWindow().__shortpulseAiStudioPerf?.runProjectRestoreAudit).toEqual(
        expect.any(Function)
      );
    });

    const result = await getPerfWindow().__shortpulseAiStudioPerf?.runProjectRestoreAudit({
      totalCount: REFERENCE_GRID_TARGET_TOTAL_ITEMS,
      activeCount: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
    });

    expect(hydrateFromSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(result?.scenarios[0]).toEqual(
      expect.objectContaining({
        totalCount: REFERENCE_GRID_TARGET_TOTAL_ITEMS,
        activeCount: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
        archivedCount: REFERENCE_GRID_TARGET_TOTAL_ITEMS - REFERENCE_GRID_MAX_VISIBLE_ITEMS,
        semantics: expect.objectContaining({
          restoredActiveCount: REFERENCE_GRID_MAX_VISIBLE_ITEMS,
          restoredArchivedCount:
            REFERENCE_GRID_TARGET_TOTAL_ITEMS - REFERENCE_GRID_MAX_VISIBLE_ITEMS,
          activeOutputId: null,
        }),
        outputStore: expect.objectContaining({
          instrumentationAvailable: true,
        }),
      })
    );
    expect(result?.ok).toBe(true);

    unmount();
  });

  it("reports Reference Grid audit progress for each completed scenario", async () => {
    window.history.pushState(null, "", "/ai-studio?perfAuditRuntime=1");
    document.body.innerHTML = `
      <main class="page page-wide ai-studio-page">
        <section
          class="reference-canvas-panel"
          data-grid-surface="reference-grid"
          data-rendered-item-count="9"
          data-image-hydration-queue-size="0"
          data-image-decode-inflight-count="0"
          data-grid-perf-degrade-level="2"
          data-grid-media-work-tokens="5"
          data-grid-video-attach-budget="1"
          data-grid-src-swap-rate-per-minute="0"
          data-grid-repaint-spike-count="0"
          data-grid-last-swap-burst-count="0"
        >
          <div class="reference-canvas-scroll">
            <button class="reference-card" type="button">Card</button>
          </div>
        </section>
      </main>
    `;
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        window.setTimeout(() => callback(performance.now()), 0);
        return 1;
      });

    const { unmount } = renderHook(() =>
      useAiStudioPerfAuditRuntime({
        enabled: false,
        aspect: "9:16",
        currentModelLabel: "Seedream",
        model: "seedream",
        getOutputSnapshot: () => ({ outputOrder: [] }),
        resetReferenceGridState: vi.fn(),
        projectRouteRequested: false,
        standardCreatePrompt: "",
        editReferenceText: "",
        videoReferenceText: "",
        setActiveOutputId: vi.fn(),
        setStandardCreatePrompt: vi.fn(),
        setEditReferenceText: vi.fn(),
        setVideoReferenceText: vi.fn(),
        setOutputs: vi.fn(),
        setReferenceGridAuditOutputs: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(getPerfWindow().__shortpulseAiStudioPerf?.runReferenceGridAudit).toEqual(
        expect.any(Function)
      );
    });

    const result = await getPerfWindow().__shortpulseAiStudioPerf?.runReferenceGridAudit({
      counts: [40, 60, 100],
      clickSamples: 1,
      scrollDurationMsByCount: {
        40: 1,
        60: 1,
        100: 1,
      },
    });

    const progress = getPerfWindow().__shortpulseAiStudioPerf?.getReferenceGridAuditProgress();
    expect(result?.scenarios.map((scenario) => scenario.count)).toEqual([40, 60, 100]);
    expect(progress).toEqual(
      expect.objectContaining({
        status: "done",
        counts: [40, 60, 100],
        currentCount: null,
        completedCounts: [40, 60, 100],
        failedCount: null,
        error: null,
      })
    );
    expect(getPerfWindow().__shortpulseAiStudioReferenceGridAuditProgress).toEqual(progress);

    requestAnimationFrameSpy.mockRestore();
    unmount();
  });
});

describe("AI Studio perf audit DOM queries", () => {
  it("queries matching nodes only inside the AI Studio app root", () => {
    document.body.innerHTML = `
      <div id="extension-root">
        <button class="toolbar-item" data-tool-id="create" data-testid="outside-toolbar"></button>
        <section class="ai-properties">
          <button data-testid="outside-panel"></button>
        </section>
      </div>
      <main class="page page-wide ai-studio-page">
        <button class="toolbar-item" data-tool-id="create" data-testid="inside-toolbar"></button>
        <section class="ai-properties">
          <button data-testid="inside-panel"></button>
        </section>
      </main>
    `;

    expect(resolveAiStudioPerfAuditRoot()).toBe(
      document.querySelector(AI_STUDIO_PERF_AUDIT_ROOT_SELECTOR)
    );
    expect(
      queryAiStudioPerfAuditAll<HTMLButtonElement>(".toolbar-item[data-tool-id='create']").map(
        (node) => node.dataset.testid
      )
    ).toEqual(["inside-toolbar"]);
    expect(queryAiStudioPerfAudit<HTMLButtonElement>(".ai-properties button")?.dataset.testid).toBe(
      "inside-panel"
    );
  });

  it("returns no audit targets when only extension-injected matching nodes exist", () => {
    document.body.innerHTML = `
      <div id="extension-root">
        <button class="toolbar-item" data-tool-id="create" data-testid="outside-toolbar"></button>
        <div class="reference-card" data-testid="outside-card"></div>
      </div>
    `;

    expect(resolveAiStudioPerfAuditRoot()).toBeNull();
    expect(queryAiStudioPerfAudit<HTMLButtonElement>(".toolbar-item[data-tool-id='create']")).toBe(
      null
    );
    expect(queryAiStudioPerfAuditAll<HTMLElement>(".reference-card")).toEqual([]);
  });
});
