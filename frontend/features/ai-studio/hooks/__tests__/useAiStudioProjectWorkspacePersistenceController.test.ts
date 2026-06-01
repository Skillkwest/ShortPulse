import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAiStudioProjectWorkspacePersistenceController } from "../useAiStudioProjectWorkspacePersistenceController";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "../useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "../useAiStudioProjectWorkspaceRestoreHydration";
import { useAiStudioSessionAutosave } from "../useAiStudioSessionAutosave";
import {
  createAiStudioProjectWorkspaceSnapshot,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import { serializeAiStudioSessionCanvasState } from "../../logic/sessionSnapshotCanvas";
import { resetAiStudioOutputStore } from "../aiStudioOutputStore";
import {
  resetAiStudioProjectWorkspaceSnapshotViaApi,
  saveAiStudioProjectWorkspaceSnapshotViaApi,
} from "../../logic/projectWorkspaceApiClient";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import * as sessionAutosaveSerialization from "../../logic/sessionAutosaveSerialization";

vi.mock("../useAiStudioProjectWorkspaceRestoreCandidate", () => ({
  useAiStudioProjectWorkspaceRestoreCandidate: vi.fn(() => ({
    status: "ready",
    result: "no_snapshot",
    snapshot: null,
    source: "none",
    error: null,
    retry: vi.fn(),
  })),
}));

const restoreHydrationMock = vi.fn();
vi.mock("../useAiStudioProjectWorkspaceRestoreHydration", () => ({
  useAiStudioProjectWorkspaceRestoreHydration: vi.fn((params) => restoreHydrationMock(params)),
}));

const sessionAutosaveMock = vi.fn();
vi.mock("../useAiStudioSessionAutosave", () => ({
  useAiStudioSessionAutosave: vi.fn((params) => sessionAutosaveMock(params)),
}));

vi.mock("../aiStudioOutputStore", () => ({
  resetAiStudioOutputStore: vi.fn(),
}));

vi.mock("../../logic/projectWorkspaceApiClient", () => ({
  saveAiStudioProjectWorkspaceSnapshotViaApi: vi.fn(),
  resetAiStudioProjectWorkspaceSnapshotViaApi: vi.fn(async () => undefined),
}));

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

const mockedUseAiStudioProjectWorkspaceRestoreCandidate = vi.mocked(
  useAiStudioProjectWorkspaceRestoreCandidate
);
const mockedUseAiStudioProjectWorkspaceRestoreHydration = vi.mocked(
  useAiStudioProjectWorkspaceRestoreHydration
);
const mockedUseAiStudioSessionAutosave = vi.mocked(useAiStudioSessionAutosave);
const mockedResetAiStudioOutputStore = vi.mocked(resetAiStudioOutputStore);
const mockedSaveProjectWorkspaceViaApi = vi.mocked(saveAiStudioProjectWorkspaceSnapshotViaApi);
const mockedResetProjectWorkspaceViaApi = vi.mocked(resetAiStudioProjectWorkspaceSnapshotViaApi);
const mockedAddBreadcrumb = vi.mocked(addBreadcrumb);

const createDefaultRestoreCandidate = () => ({
  status: "ready" as const,
  result: "no_snapshot" as const,
  snapshot: null,
  source: "none" as const,
  error: null,
  retry: vi.fn(),
});

const createSnapshot = (): AiStudioSessionSnapshot =>
  ({
    schemaVersion: 2,
    sessionId: "session-1",
    updatedAt: "2026-04-24T18:00:00.000Z",
    workspace: {
      expertCreateMode: "pulse",
      activePulsePresetId: "preset-1",
      pulseSessionInstanceId: "pulse-session-1",
      editReferenceText: "Keep this only while the page session stays open.",
      videoReferenceText: "Keep this video draft only while the page session stays open.",
    } as AiStudioSessionSnapshot["workspace"],
    outputs: {} as AiStudioSessionSnapshot["outputs"],
    agent: {
      messages: [{ id: "message-1", role: "assistant", content: "Existing chat" }],
      input: "next shot",
      latestAgentPrompt: "Existing chat",
      promptOrigin: "agent",
      chatModeEnabled: false,
      pulseWorkflowSession: {
        presetId: "preset-1",
        status: "awaiting_input",
        currentStepIndex: 1,
        currentStepLabel: "Action",
        currentStepPrompt: "What happens next?",
        collectedInputs: ["A close-up"],
        lastArtifact: null,
        finalArtifactSource: null,
      },
    },
    agentRuntimes: {
      standard: {
        messages: [{ id: "message-0", role: "assistant", content: "Standard lane" }],
        input: "",
        latestAgentPrompt: "Standard lane",
        promptOrigin: "agent",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
      },
      pulsePresetId: "preset-1",
      pulseSessionInstanceId: "pulse-session-1",
      pulse: {
        messages: [{ id: "message-1", role: "assistant", content: "Existing chat" }],
        input: "next shot",
        latestAgentPrompt: "Existing chat",
        promptOrigin: "agent",
        chatModeEnabled: false,
        pulseWorkflowSession: {
          presetId: "preset-1",
          status: "awaiting_input",
          currentStepIndex: 1,
          currentStepLabel: "Action",
          currentStepPrompt: "What happens next?",
          collectedInputs: ["A close-up"],
          lastArtifact: null,
          finalArtifactSource: null,
        },
      },
    },
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
      pulseSessionInstanceId: null,
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

const mockReadyRestoreCandidate = (snapshot: AiStudioSessionSnapshot | null) => {
  mockedUseAiStudioProjectWorkspaceRestoreCandidate.mockImplementation(() => ({
    status: "ready",
    result: snapshot ? "found_snapshot" : "no_snapshot",
    snapshot,
    source: "project",
    error: null,
    retry: vi.fn(),
  }));
};

const flushBootstrapVisibilityLatch = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("useAiStudioProjectWorkspacePersistenceController", () => {
  beforeEach(() => {
    mockedUseAiStudioProjectWorkspaceRestoreCandidate.mockImplementation(
      createDefaultRestoreCandidate
    );
    mockedUseAiStudioProjectWorkspaceRestoreCandidate.mockClear();
    mockedUseAiStudioProjectWorkspaceRestoreHydration.mockClear();
    mockedUseAiStudioSessionAutosave.mockClear();
    mockedResetAiStudioOutputStore.mockClear();
    restoreHydrationMock.mockClear();
    sessionAutosaveMock.mockClear();
    mockedSaveProjectWorkspaceViaApi.mockReset();
    mockedResetProjectWorkspaceViaApi.mockClear();
    mockedAddBreadcrumb.mockClear();
  });

  it("keeps project autosave disabled until bootstrap settles", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    expect(mockedUseAiStudioSessionAutosave).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: null,
        enabled: false,
      })
    );
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBeNull();
  });

  it("enables project autosave after bootstrap settles for the active project", async () => {
    const snapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();
    const resetProjectAgentConversation = vi.fn();

    const { rerender } = renderHook(
      ({ projectId }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          applyEmptyProjectState,
          resetProjectAgentConversation,
        }),
      {
        initialProps: {
          projectId: "project-1" as string | null,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    expect(restoreHydrationArgs?.applyEmptyProjectState).toBe(applyEmptyProjectState);
    expect(restoreHydrationArgs?.resetProjectAgentConversation).toBe(resetProjectAgentConversation);

    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ projectId: "project-1" });
    await flushBootstrapVisibilityLatch();

    const lastWriteShadowArgs =
      mockedUseAiStudioSessionAutosave.mock.calls[
        mockedUseAiStudioSessionAutosave.mock.calls.length - 1
      ]?.[0];
    expect(lastWriteShadowArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
      })
    );
    expect(lastWriteShadowArgs?.snapshot).toEqual(snapshot);
    expect(lastWriteShadowArgs?.preparedSnapshot).toEqual(
      expect.objectContaining({
        title: null,
        bytes: expect.any(Number),
        hash: expect.any(String),
      })
    );
    expect(lastWriteShadowArgs?.snapshot?.workspace.editReferenceText).toBe("");
    expect(lastWriteShadowArgs?.snapshot?.workspace.videoReferenceText).toBe("");
    expect(buildSessionSnapshot).toHaveBeenCalledWith("session-1");
    expect(mockedAddBreadcrumb).toHaveBeenCalledWith({
      type: "ui",
      level: "info",
      message: "ai_studio_project_workspace_bootstrap_settled",
      data: {
        project_id: "project-1",
        runtime_revision: 0,
      },
    });
  });

  it("keeps autosave snapshot preparation stable across an unrelated rerender", async () => {
    const snapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const prepareSpy = vi.spyOn(
      sessionAutosaveSerialization,
      "prepareAiStudioSessionAutosaveSnapshot"
    );

    const { rerender } = renderHook(
      ({ projectId }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          projectId: "project-1" as string | null,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ projectId: "project-1" });
    await flushBootstrapVisibilityLatch();

    const preparedSnapshotAfterBootstrap =
      mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]?.preparedSnapshot;

    rerender({ projectId: "project-1" });

    expect(prepareSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]?.preparedSnapshot).toEqual(
      preparedSnapshotAfterBootstrap
    );
  });

  it("keeps autosave disabled until the built project snapshot reflects restored quick slots and full durable canvas state", async () => {
    const restoredSnapshot = {
      ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
      outputs: {
        active: [
          {
            id: "out-1",
            prompt: "Restored image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewUrl: "https://cdn.example.com/out-1.png",
            resultUrls: ["https://cdn.example.com/out-1.png"],
          },
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: ["out-1"],
        removedFromAllRefsIds: [],
      },
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-image-1",
            kind: "image",
            x: 120,
            y: 240,
            z: 3,
            selected: false,
            outputId: "out-1",
            sourceSurface: "curated",
            mediaId: "media-1",
            src: "https://cdn.example.com/out-1.png",
            alt: "Restored image",
            width: 512,
            height: 512,
          },
        ],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 40, y: -18, zoom: 1.45 },
        railCamera: { x: -10, y: 12, zoom: 0.8 },
      }),
    } as unknown as AiStudioSessionSnapshot;
    const pendingShellSnapshot = {
      ...restoredSnapshot,
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-image-1",
            kind: "image",
            x: 0,
            y: 0,
            z: 0,
            selected: false,
            outputId: "out-1",
            sourceSurface: "curated",
            mediaId: "media-1",
            src: "https://cdn.example.com/out-1.png",
            alt: "Restored image",
            width: 256,
            height: 256,
          },
        ],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 0, y: 0, zoom: 1 },
      }),
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(restoredSnapshot);
    const pendingBuildSessionSnapshot = vi.fn(() => pendingShellSnapshot);
    const restoredBuildSessionSnapshot = vi.fn(() => restoredSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({
        buildBaseSessionSnapshot,
      }: {
        buildBaseSessionSnapshot: (sessionId: string) => AiStudioSessionSnapshot;
      }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          buildBaseSessionSnapshot: pendingBuildSessionSnapshot as (
            sessionId: string
          ) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({
      buildBaseSessionSnapshot: pendingBuildSessionSnapshot as (
        sessionId: string
      ) => AiStudioSessionSnapshot,
    });
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
        snapshot: pendingShellSnapshot,
      })
    );

    rerender({
      buildBaseSessionSnapshot: restoredBuildSessionSnapshot as (
        sessionId: string
      ) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
        snapshot: restoredSnapshot,
      })
    );
    expect(pendingBuildSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(restoredBuildSessionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("keeps bootstrap applied after legitimate quick-slot and canvas edits following restore", async () => {
    const restoredSnapshot = {
      ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
      outputs: {
        active: [
          {
            id: "out-1",
            prompt: "Restored image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewUrl: "https://cdn.example.com/out-1.png",
            resultUrls: ["https://cdn.example.com/out-1.png"],
          },
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: ["out-1"],
        removedFromAllRefsIds: [],
      },
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-image-1",
            kind: "image",
            x: 120,
            y: 240,
            z: 3,
            selected: false,
            outputId: "out-1",
            sourceSurface: "curated",
            mediaId: "media-1",
            src: "https://cdn.example.com/out-1.png",
            alt: "Restored image",
            width: 512,
            height: 512,
          },
        ],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 40, y: -18, zoom: 1.45 },
        railCamera: { x: -10, y: 12, zoom: 0.8 },
      }),
    } as unknown as AiStudioSessionSnapshot;
    const editedSnapshot = {
      ...restoredSnapshot,
      outputs: {
        ...restoredSnapshot.outputs,
        curatedReferenceIds: ["out-1", "out-2"],
      },
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-image-1",
            kind: "image",
            x: 160,
            y: 280,
            z: 4,
            selected: false,
            outputId: "out-1",
            sourceSurface: "curated",
            mediaId: "media-1",
            src: "https://cdn.example.com/out-1.png",
            alt: "Restored image",
            width: 512,
            height: 512,
          },
        ],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 65, y: -32, zoom: 1.62 },
        railCamera: { x: -24, y: 20, zoom: 0.88 },
      }),
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(restoredSnapshot);
    const restoredBuildSessionSnapshot = vi.fn(() => restoredSnapshot);
    const editedBuildSessionSnapshot = vi.fn(() => editedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({
        buildBaseSessionSnapshot,
      }: {
        buildBaseSessionSnapshot: (sessionId: string) => AiStudioSessionSnapshot;
      }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          buildBaseSessionSnapshot: restoredBuildSessionSnapshot as (
            sessionId: string
          ) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({
      buildBaseSessionSnapshot: restoredBuildSessionSnapshot as (
        sessionId: string
      ) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
        snapshot: restoredSnapshot,
      })
    );

    rerender({
      buildBaseSessionSnapshot: editedBuildSessionSnapshot as (
        sessionId: string
      ) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
        snapshot: editedSnapshot,
      })
    );
  });

  it("treats active output visibility as order-insensitive for bootstrap readiness", async () => {
    const restoredSnapshot = {
      ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
      outputs: {
        active: [
          {
            id: "out-older",
            prompt: "Older image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Earlier",
            createdAt: "2026-04-24T18:00:00.000Z",
            previewUrl: "https://cdn.example.com/out-older.png",
            resultUrls: ["https://cdn.example.com/out-older.png"],
          },
          {
            id: "out-newer",
            prompt: "Newer image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Later",
            createdAt: "2026-04-24T19:00:00.000Z",
            previewUrl: "https://cdn.example.com/out-newer.png",
            resultUrls: ["https://cdn.example.com/out-newer.png"],
          },
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: ["out-newer", "out-older"],
        removedFromAllRefsIds: [],
      },
      canvas: null,
    } as unknown as AiStudioSessionSnapshot;
    const runtimeNormalizedSnapshot = {
      ...restoredSnapshot,
      outputs: {
        ...restoredSnapshot.outputs,
        active: [...restoredSnapshot.outputs.active].reverse(),
      },
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(restoredSnapshot);
    const buildSessionSnapshot = vi.fn(() => runtimeNormalizedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender();
    await flushBootstrapVisibilityLatch();

    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
        snapshot: runtimeNormalizedSnapshot,
      })
    );
  });

  it("invalidates project-owned workspace state immediately when a project route is entered", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();

    renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        applyEmptyProjectState,
      })
    );

    expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(1);
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
    expect(mockedUseAiStudioSessionAutosave.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: null,
        enabled: false,
      })
    );
  });

  it("re-invalidates workspace state and disables autosave when switching projects", async () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();

    const { rerender, result } = renderHook(
      ({ projectId }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          applyEmptyProjectState,
        }),
      {
        initialProps: {
          projectId: "project-1" as string | null,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];

    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ projectId: "project-1" });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);

    rerender({ projectId: "project-2" });

    expect(applyEmptyProjectState).toHaveBeenCalledTimes(2);
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(2);
    expect(result.current.projectBootstrapApplied).toBe(false);
    const lastWriteShadowArgs =
      mockedUseAiStudioSessionAutosave.mock.calls[
        mockedUseAiStudioSessionAutosave.mock.calls.length - 1
      ]?.[0];
    expect(lastWriteShadowArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-2",
        snapshot: null,
        enabled: false,
      })
    );
  });

  it("keeps bootstrap settled when runtime-facing callbacks change for the same project", async () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const nextBuildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const nextHydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();
    const nextApplyEmptyProjectState = vi.fn();
    const resetProjectAgentConversation = vi.fn();
    const nextResetProjectAgentConversation = vi.fn();

    const { result, rerender } = renderHook(
      ({
        buildSnapshot,
        hydrateSnapshot,
        applyEmptyState,
        resetConversation,
      }: {
        buildSnapshot: typeof buildSessionSnapshot;
        hydrateSnapshot: typeof hydrateFromSessionSnapshot;
        applyEmptyState: typeof applyEmptyProjectState;
        resetConversation: typeof resetProjectAgentConversation;
      }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot: hydrateSnapshot,
          applyEmptyProjectState: applyEmptyState,
          resetProjectAgentConversation: resetConversation,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot,
          hydrateSnapshot: hydrateFromSessionSnapshot,
          applyEmptyState: applyEmptyProjectState,
          resetConversation: resetProjectAgentConversation,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({
      buildSnapshot: nextBuildSessionSnapshot,
      hydrateSnapshot: nextHydrateFromSessionSnapshot,
      applyEmptyState: nextApplyEmptyProjectState,
      resetConversation: nextResetProjectAgentConversation,
    });
    await flushBootstrapVisibilityLatch();

    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    expect(nextApplyEmptyProjectState).not.toHaveBeenCalled();
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
      })
    );
    expect(nextBuildSessionSnapshot).toHaveBeenCalledWith("session-1");
  });

  it("reuses the base project snapshot when only the patch callback changes", async () => {
    const snapshot = createSnapshot();
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const firstPatchSessionSnapshot = vi.fn((value: AiStudioSessionSnapshot) => value);
    const secondPatchSessionSnapshot = vi.fn((value: AiStudioSessionSnapshot) => ({
      ...value,
      updatedAt: "2026-04-24T19:00:00.000Z",
    }));
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({ patchSessionSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          patchSessionSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          patchSessionSnapshot: firstPatchSessionSnapshot as (
            snapshot: AiStudioSessionSnapshot
          ) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ patchSessionSnapshot: firstPatchSessionSnapshot });
    await flushBootstrapVisibilityLatch();
    expect(buildSessionSnapshot).toHaveBeenCalledTimes(1);

    rerender({ patchSessionSnapshot: secondPatchSessionSnapshot });

    expect(buildSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(firstPatchSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(secondPatchSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        enabled: true,
        snapshot: expect.objectContaining({
          updatedAt: "2026-04-24T19:00:00.000Z",
        }),
      })
    );
  });

  it("ignores stale bootstrap state after leaving and re-entering the same project", async () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();

    const { result, rerender } = renderHook(
      ({ projectId, projectRouteRequested }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          applyEmptyProjectState,
        }),
      {
        initialProps: {
          projectId: "project-1" as string | null,
          projectRouteRequested: true,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];

    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({
      projectId: "project-1",
      projectRouteRequested: true,
    });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);

    rerender({
      projectId: null,
      projectRouteRequested: false,
    });
    expect(result.current.projectBootstrapApplied).toBe(false);

    rerender({
      projectId: "project-1",
      projectRouteRequested: true,
    });

    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(applyEmptyProjectState).toHaveBeenCalledTimes(2);
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(2);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: null,
        enabled: false,
      })
    );
  });

  it("fails closed while a project route is pending before projectId resolves", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const applyEmptyProjectState = vi.fn();

    const { result, rerender } = renderHook(
      ({ projectId, projectRouteRequested }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          applyEmptyProjectState,
        }),
      {
        initialProps: {
          projectId: null as string | null,
          projectRouteRequested: false,
        },
      }
    );

    expect(applyEmptyProjectState).not.toHaveBeenCalled();
    expect(mockedResetAiStudioOutputStore).not.toHaveBeenCalled();

    rerender({
      projectId: null,
      projectRouteRequested: true,
    });

    expect(applyEmptyProjectState).toHaveBeenCalledTimes(1);
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(1);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBeNull();
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: null,
        snapshot: null,
        enabled: false,
      })
    );
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
  });

  it("surfaces restore errors and keeps project autosave disabled", () => {
    mockedUseAiStudioProjectWorkspaceRestoreCandidate.mockReturnValueOnce({
      status: "error",
      result: "load_failed",
      snapshot: null,
      source: "none",
      error: "Failed to load project workspace.",
      retry: vi.fn(),
    });

    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBe("Failed to load project workspace.");
    expect(mockedUseAiStudioSessionAutosave.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        enabled: false,
        snapshot: null,
      })
    );
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
  });

  it("stabilizes hydration failure handling so restore can settle into an error state", () => {
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    const firstHydrationArgs = mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    const firstFailureHandler = firstHydrationArgs?.onProjectBootstrapFailed;

    act(() => {
      firstFailureHandler?.("project-1", new Error("hydrate failed"));
    });
    rerender();

    const latestHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls.at(-1)?.[0];
    expect(latestHydrationArgs?.onProjectBootstrapFailed).toBe(firstFailureHandler);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBe("hydrate failed");
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        enabled: false,
      })
    );
    expect(mockedAddBreadcrumb).toHaveBeenCalledWith({
      type: "ui",
      level: "warn",
      message: "ai_studio_project_workspace_bootstrap_failed",
      data: {
        project_id: "project-1",
        runtime_revision: 0,
        error: "hydrate failed",
      },
    });
  });

  it("reduces oversized project autosave snapshots before persisting", async () => {
    const oversizedSnapshot = {
      ...createSnapshot(),
      archivedOutputsSentinel: true,
      outputs: {
        ...(createSnapshot().outputs as Record<string, unknown>),
        archived: [
          {
            id: "archived-1",
            prompt: "x".repeat(950_000),
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
          },
        ],
        removedFromAllRefsIds: ["archived-1"],
      },
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(oversizedSnapshot);
    const buildSessionSnapshot = vi.fn(() => oversizedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        onPersistenceWarning: vi.fn(),
      })
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender();
    await flushBootstrapVisibilityLatch();

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(autosaveArgs?.enabled).toBe(true);
    expect(autosaveArgs?.snapshot?.outputs.archived).toEqual([]);
  });

  it("slims settled generated outputs before autosave size checks run", async () => {
    const snapshot = {
      ...createSnapshot(),
      outputs: {
        active: [
          {
            id: "generated-1",
            generationId: "generation-1",
            taskId: "task-1",
            taskState: "success",
            mediaSource: "generated",
            prompt: "x".repeat(950_000),
            transcriptText: "y".repeat(20_000),
            previewUrl: "https://cdn.example.com/generated-1.png",
            resultUrls: ["https://cdn.example.com/generated-1.png"],
          },
        ],
        archived: [],
        activeOutputId: "generated-1",
        curatedReferenceIds: ["generated-1"],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    const projectWorkspaceSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    mockReadyRestoreCandidate(projectWorkspaceSnapshot);
    const buildSessionSnapshot = vi.fn(() => projectWorkspaceSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();

    const { rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        onPersistenceWarning,
      })
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender();
    await flushBootstrapVisibilityLatch();

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(autosaveArgs?.enabled).toBe(true);
    expect(autosaveArgs?.snapshot?.outputs.active?.[0]).toMatchObject({
      id: "generated:generation-1",
      generationId: "generation-1",
      taskId: "task-1",
      taskState: "success",
    });
    expect(autosaveArgs?.snapshot?.outputs.curatedReferenceIds).toEqual(["generated:generation-1"]);
    expect(autosaveArgs?.snapshot?.outputs.active?.[0]).not.toHaveProperty("prompt");
    expect(autosaveArgs?.snapshot?.outputs.active?.[0]).toHaveProperty(
      "previewUrl",
      "https://cdn.example.com/generated-1.png"
    );
    expect(onPersistenceWarning).not.toHaveBeenCalled();
  });

  it("falls back to a reduced snapshot that drops only hidden Pulse runtime parking", async () => {
    const baseSnapshot = createSnapshot() as AiStudioSessionSnapshotV2;
    const snapshot = {
      ...baseSnapshot,
      workspace: {
        ...baseSnapshot.workspace,
        expertCreateMode: "standard",
        activePulsePresetId: "preset-1",
        pulseSessionInstanceId: "pulse-session-1",
      },
      agentRuntimes: {
        ...baseSnapshot.agentRuntimes!,
        pulsePresetId: "preset-1",
        pulseSessionInstanceId: "pulse-session-1",
        pulse: {
          ...baseSnapshot.agentRuntimes!.pulse,
          input: "x".repeat(940_000),
        },
      },
    } as AiStudioSessionSnapshot;
    const buildSessionSnapshot = vi.fn(() => createAiStudioProjectWorkspaceSnapshot(snapshot));
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();

    const { rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        onPersistenceWarning,
      })
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender();
    await flushBootstrapVisibilityLatch();

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    const autosaveSnapshot = autosaveArgs?.snapshot as AiStudioSessionSnapshotV2 | null | undefined;
    expect(autosaveArgs?.enabled).toBe(true);
    expect(autosaveSnapshot?.workspace.activePulsePresetId).toBeNull();
    expect(autosaveSnapshot?.workspace.pulseSessionInstanceId).toBeNull();
    expect(autosaveSnapshot?.agentRuntimes?.pulsePresetId).toBeNull();
    expect(autosaveSnapshot?.agentRuntimes?.pulseSessionInstanceId).toBeNull();
    expect(onPersistenceWarning).not.toHaveBeenCalled();
  });

  it("surfaces one repair-pending warning when autosave succeeds but project association repair is still pending", async () => {
    const snapshot = createSnapshot();
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();

    const { rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        onPersistenceWarning,
      })
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender();

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(autosaveArgs).toBeTruthy();
    const autosaveSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    mockedSaveProjectWorkspaceViaApi.mockResolvedValue({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: autosaveSnapshot,
      createdAt: "2026-04-24T18:00:00.000Z",
      updatedAt: "2026-04-24T18:00:00.000Z",
      saveOutcome: {
        status: "saved_with_repair_pending",
        repairStage: "project_association_backfill",
        repairMessage: "Project workspace save needs project association repair.",
      },
    });

    await act(async () => {
      await autosaveArgs!.persistSnapshot("project-1", autosaveSnapshot);
      await autosaveArgs!.persistSnapshot("project-1", autosaveSnapshot);
    });

    expect(onPersistenceWarning).toHaveBeenCalledTimes(1);
    expect(onPersistenceWarning).toHaveBeenCalledWith(
      "Project autosave saved the workspace, but project asset repair is pending. Recent outputs may not fully restore until the next successful save."
    );
  });

  it("pauses the project autosave warning after repeated persistence failures exhaust retries", () => {
    const snapshot = createSnapshot();
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();

    const { rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        onPersistenceWarning,
      })
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender();

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    act(() => {
      autosaveArgs?.onPersistError?.(new Error("HTTP 500"), {
        reason: "persist_failed",
        sessionId: "project-1",
        maxSnapshotBytes: 1024,
        willRetry: false,
      });
    });

    expect(onPersistenceWarning).toHaveBeenCalledWith(
      "Project autosave paused after repeated failures: HTTP 500"
    );
    expect(mockedAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ui",
        level: "info",
        message: "ai_studio_project_workspace_autosave_measurement",
        data: expect.objectContaining({
          project_id: "project-1",
          reason: "persist_failed",
          fallback_kind: "full",
          will_retry: false,
        }),
      })
    );
  });

  it("records byte breakdown telemetry when project autosave skips an oversized snapshot", () => {
    const snapshot = {
      ...createSnapshot(),
      outputs: {
        active: [
          {
            id: "oversized-1",
            prompt: "x".repeat(64_000),
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
          },
        ],
        archived: [],
        activeOutputId: "oversized-1",
        curatedReferenceIds: ["oversized-1"],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(snapshot);
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();

    const { rerender } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
        onPersistenceWarning,
      })
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender();

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    act(() => {
      autosaveArgs?.onPersistError?.(new Error("Session snapshot exceeds maximum size."), {
        reason: "snapshot_too_large",
        sessionId: "project-1",
        snapshotBytes: 950_000,
        maxSnapshotBytes: 900_000,
      });
    });

    expect(onPersistenceWarning).toHaveBeenCalledWith(
      "Project autosave skipped because workspace size (928KB) exceeded the 879KB limit."
    );
    expect(mockedAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ui",
        level: "warn",
        message: "ai_studio_project_workspace_autosave_measurement",
        data: expect.objectContaining({
          project_id: "project-1",
          reason: "snapshot_too_large",
          snapshot_bytes: 950_000,
          max_snapshot_bytes: 900_000,
          fallback_kind: "full",
          selected_total_b: expect.any(Number),
        }),
      })
    );
  });

  it("resets invalid saved workspaces through the project workspace API", async () => {
    const retry = vi.fn();
    mockedUseAiStudioProjectWorkspaceRestoreCandidate.mockReturnValueOnce({
      status: "error",
      result: "load_failed",
      snapshot: null,
      source: "none",
      error: "Project workspace snapshot is invalid.",
      retry,
    });
    const buildSessionSnapshot = vi.fn(() => createSnapshot());
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspacePersistenceController({
        projectId: "project-1",
        projectRouteRequested: true,
        sessionId: "session-1",
        buildBaseSessionSnapshot: buildSessionSnapshot,
        hydrateFromSessionSnapshot,
      })
    );

    await act(async () => {
      await result.current.resetProjectWorkspace();
    });

    expect(mockedResetProjectWorkspaceViaApi).toHaveBeenCalledWith({ projectId: "project-1" });
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
