import { renderHook, waitFor } from "@testing-library/react";
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
    canvas: null,
    expertEdit: null,
  }) as AiStudioSessionHydrationPayload;

describe("useAiStudioProjectWorkspaceRestoreHydration", () => {
  it("applies an explicit empty-project reset when a resolved project has no snapshot", async () => {
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();
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
        hydrateFromSessionAgentSnapshot,
        applyEmptyProjectState,
        onProjectBootstrapSettled,
      })
    );

    await waitFor(() => {
      expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    });

    expect(hydrateFromSessionSnapshot).not.toHaveBeenCalled();
    expect(hydrateFromSessionAgentSnapshot).not.toHaveBeenCalled();
    expect(onProjectBootstrapSettled).toHaveBeenCalledWith("project-1");
  });

  it("hydrates the saved project snapshot and marks bootstrap complete", async () => {
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const hydrateFromSessionExpertEditSnapshot = vi.fn();
    const applyEmptyProjectState = vi.fn();
    const onProjectBootstrapSettled = vi.fn();
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
        hydrateFromSessionAgentSnapshot,
        hydrateFromSessionExpertEditSnapshot,
        applyEmptyProjectState,
        onProjectBootstrapSettled,
      })
    );

    await waitFor(() => {
      expect(hydrateFromSessionSnapshot).toHaveBeenCalledWith(snapshot);
    });

    expect(hydrateFromSessionAgentSnapshot).toHaveBeenCalledTimes(1);
    expect(hydrateFromSessionExpertEditSnapshot).toHaveBeenCalledTimes(1);
    expect(applyEmptyProjectState).not.toHaveBeenCalled();
    expect(onProjectBootstrapSettled).toHaveBeenCalledWith("project-1");
  });

  it("does not apply empty state when workspace restore fails", async () => {
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();
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
        hydrateFromSessionAgentSnapshot,
        applyEmptyProjectState,
        onProjectBootstrapSettled,
      })
    );

    await waitFor(() => {
      expect(applyEmptyProjectState).not.toHaveBeenCalled();
    });

    expect(hydrateFromSessionSnapshot).not.toHaveBeenCalled();
    expect(hydrateFromSessionAgentSnapshot).not.toHaveBeenCalled();
    expect(onProjectBootstrapSettled).not.toHaveBeenCalled();
  });
});
