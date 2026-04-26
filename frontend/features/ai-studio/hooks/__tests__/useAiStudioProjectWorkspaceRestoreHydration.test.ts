import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioProjectWorkspaceRestoreHydration } from "../useAiStudioProjectWorkspaceRestoreHydration";
import type { AiStudioSessionSnapshot } from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

const createSnapshot = (): AiStudioSessionSnapshot =>
  ({
    schemaVersion: 2,
    sessionId: "sid-1",
    updatedAt: "2026-04-24T17:00:00.000Z",
    workspace: {} as AiStudioSessionSnapshot["workspace"],
    outputs: {} as AiStudioSessionSnapshot["outputs"],
    agent: {} as AiStudioSessionSnapshot["agent"],
  }) as AiStudioSessionSnapshot;

const createHydrationPayload = (): AiStudioSessionHydrationPayload =>
  ({
    workspace: {} as never,
    outputs: {} as never,
    agent: {
      messages: [],
      input: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
    },
    agentRuntimes: {
      standard: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
      pulsePresetId: null,
      pulse: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
    },
    canvas: {
      items: [
        {
          id: "canvas-note-1",
          kind: "text",
          x: 10,
          y: 20,
          z: 1,
          selected: true,
          outputId: null,
          sourceSurface: null,
          text: "Canvas note",
          width: 260,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    },
    expertEdit: null,
  }) as AiStudioSessionHydrationPayload;

describe("useAiStudioProjectWorkspaceRestoreHydration", () => {
  it("applies an explicit empty-project reset when a resolved project has no snapshot", async () => {
    vi.useFakeTimers();
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();
    const onProjectBootstrapSettled = vi.fn();

    renderHook(() =>
      useAiStudioProjectWorkspaceRestoreHydration({
        projectId: "project-1",
        projectWorkspaceRestoreCandidate: {
          status: "ready",
          result: "no_snapshot",
          snapshot: null,
          source: "none",
          error: null,
          retry: vi.fn(),
        },
        hydrateFromSessionSnapshot,
        applyEmptyProjectState,
        onProjectBootstrapSettled,
      })
    );

    expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(hydrateFromSessionSnapshot).not.toHaveBeenCalled();
    expect(onProjectBootstrapSettled).toHaveBeenCalledWith("project-1");
    vi.useRealTimers();
  });

  it("hydrates the saved project snapshot and marks bootstrap complete", async () => {
    vi.useFakeTimers();
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const hydrateFromSessionCanvasSnapshot = vi.fn();
    const hydrateFromSessionExpertEditSnapshot = vi.fn();
    const applyEmptyProjectState = vi.fn();
    const onProjectBootstrapSettled = vi.fn();
    const resetProjectAgentConversation = vi.fn();
    const snapshot = createSnapshot();

    renderHook(() =>
      useAiStudioProjectWorkspaceRestoreHydration({
        projectId: "project-1",
        projectWorkspaceRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        hydrateFromSessionSnapshot,
        hydrateFromSessionCanvasSnapshot,
        hydrateFromSessionExpertEditSnapshot,
        applyEmptyProjectState,
        resetProjectAgentConversation,
        onProjectBootstrapSettled,
      })
    );

    expect(hydrateFromSessionSnapshot).toHaveBeenCalledWith(snapshot);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(resetProjectAgentConversation).toHaveBeenCalledTimes(1);
    expect(hydrateFromSessionCanvasSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: "canvas-note-1",
            kind: "text",
            text: "Canvas note",
          }),
        ],
      })
    );
    expect(hydrateFromSessionExpertEditSnapshot).toHaveBeenCalledTimes(1);
    expect(applyEmptyProjectState).not.toHaveBeenCalled();
    expect(onProjectBootstrapSettled).toHaveBeenCalledWith("project-1");
    vi.useRealTimers();
  });

  it("defers bootstrap completion until after hydration work has been scheduled", async () => {
    vi.useFakeTimers();
    const hydrationOrder: string[] = [];
    const hydrateFromSessionSnapshot = vi.fn(() => {
      hydrationOrder.push("hydrate");
      return createHydrationPayload();
    });
    const onProjectBootstrapSettled = vi.fn(() => {
      hydrationOrder.push("settled");
    });

    renderHook(() =>
      useAiStudioProjectWorkspaceRestoreHydration({
        projectId: "project-1",
        projectWorkspaceRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: createSnapshot(),
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        hydrateFromSessionSnapshot,
        onProjectBootstrapSettled,
      })
    );

    expect(hydrationOrder).toEqual(["hydrate"]);
    expect(onProjectBootstrapSettled).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(hydrationOrder).toEqual(["hydrate", "settled"]);
    expect(onProjectBootstrapSettled).toHaveBeenCalledWith("project-1");
    vi.useRealTimers();
  });

  it("does not apply empty state when workspace restore fails", async () => {
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();
    const onProjectBootstrapSettled = vi.fn();

    renderHook(() =>
      useAiStudioProjectWorkspaceRestoreHydration({
        projectId: "project-1",
        projectWorkspaceRestoreCandidate: {
          status: "error",
          result: "load_failed",
          snapshot: null,
          source: "none",
          error: "Failed to load project workspace.",
          retry: vi.fn(),
        },
        hydrateFromSessionSnapshot,
        applyEmptyProjectState,
        onProjectBootstrapSettled,
      })
    );

    await waitFor(() => {
      expect(applyEmptyProjectState).not.toHaveBeenCalled();
    });

    expect(hydrateFromSessionSnapshot).not.toHaveBeenCalled();
    expect(onProjectBootstrapSettled).not.toHaveBeenCalled();
  });
});
