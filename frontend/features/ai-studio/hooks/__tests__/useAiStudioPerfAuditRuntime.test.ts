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

type PerfAuditWindow = Window & {
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
  };
};

const getPerfWindow = (): PerfAuditWindow => window as PerfAuditWindow;

afterEach(() => {
  delete getPerfWindow().__shortpulseAiStudioPerf;
  window.history.pushState(null, "", "/");
  vi.restoreAllMocks();
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

  it("can seed a 300-active audit workset without using the product cap setter", async () => {
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

    const seeded = getPerfWindow().__shortpulseAiStudioPerf?.seedReferenceGrid(300, {
      activeCapOverride: 300,
    });

    expect(seeded).toEqual({
      requestedCount: 300,
      activeCount: 300,
      archivedCount: 0,
      totalCount: 300,
      activeCapOverride: 300,
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
    expect(setReferenceGridAuditOutputs.mock.calls[0]?.[0].active).toHaveLength(300);
    expect(setOutputs).not.toHaveBeenCalled();

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
