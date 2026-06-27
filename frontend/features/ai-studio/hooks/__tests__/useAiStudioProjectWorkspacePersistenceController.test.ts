import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAiStudioProjectWorkspacePersistenceController } from "../useAiStudioProjectWorkspacePersistenceController";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "../useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "../useAiStudioProjectWorkspaceRestoreHydration";
import { useAiStudioSessionAutosave } from "../useAiStudioSessionAutosave";
import {
  createEmptyAiStudioSessionSnapshot,
  createAiStudioProjectWorkspaceSnapshot,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../../logic/sessionSnapshot";
import type { AiStudioRightRailLayoutV1 } from "../../logic/rightRailLayout";
import {
  PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES,
  PROJECT_WORKSPACE_KEEPALIVE_MAX_SNAPSHOT_BYTES,
} from "../../../../lib/ai-studio-session/projectWorkspaceLimits";
import {
  createProjectRestoreSnapshot,
  createProjectRestoreVisibilitySnapshot,
} from "../../logic/projectRestoreSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import { serializeAiStudioSessionCanvasState } from "../../logic/sessionSnapshotCanvas";
import { resetAiStudioOutputStore } from "../aiStudioOutputStore";
import {
  resetAiStudioProjectWorkspaceSnapshotViaApi,
  saveAiStudioProjectWorkspaceSnapshotViaApi,
} from "../../logic/projectWorkspaceApiClient";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import { reportAppError } from "../../../../lib/appErrorReporter";
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

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(async () => undefined),
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
const mockedReportAppError = vi.mocked(reportAppError);

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

const createProjectSnapshotWithOutputPrompt = (prompt: string): AiStudioSessionSnapshot =>
  ({
    ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
    outputs: {
      active: [
        {
          id: "generated:output-1",
          prompt,
          mode: "image",
          mediaSource: "generated",
          status: "ready",
          previewText: prompt,
          createdAt: "2026-04-24T18:00:00.000Z",
        },
      ],
      archived: [],
      activeOutputId: "generated:output-1",
      curatedReferenceIds: ["generated:output-1"],
      removedFromAllRefsIds: [],
    },
  }) as unknown as AiStudioSessionSnapshot;

const createWorkspaceSaveResponse = (snapshot: AiStudioSessionSnapshot) => ({
  projectId: "project-1",
  schemaVersion: 2,
  snapshot,
  createdAt: "2026-04-24T18:00:00.000Z",
  updatedAt: "2026-04-24T18:01:00.000Z",
  saveOutcome: { status: "saved" as const },
});

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
    pulseChats: {
      schemaVersion: 1,
      activeThreadId: null,
      threads: [],
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
    mockedReportAppError.mockClear();
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
        enableLifecycleFlush: false,
      })
    );
    expect(buildSessionSnapshot).not.toHaveBeenCalled();
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(result.current.projectBootstrapError).toBeNull();
  });

  it("treats the default empty canvas runtime state as matching a no-snapshot project bootstrap", async () => {
    const liveEmptyProjectSnapshot = {
      ...createEmptyAiStudioSessionSnapshot({
        sessionId: "session-1",
        updatedAt: "2026-04-24T18:00:00.000Z",
      }),
      canvas: serializeAiStudioSessionCanvasState({
        items: [],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 0, y: 0, zoom: 1 },
      }),
    } as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(null);
    const buildSessionSnapshot = vi.fn(() => liveEmptyProjectSnapshot);
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

    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();

    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
      })
    );
  });

  it("keeps autosave locked until restored right-rail layout is visible", async () => {
    const restoreSnapshot = {
      ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
      workspace: {
        ...createSnapshot().workspace,
        rightRailLayout: {
          schemaVersion: 1,
          panels: {
            canvas: true,
            quickSlot: false,
            referenceGrid: true,
          },
          splits: {
            canvasInventoryTopRatio: 0.34,
            quickSlotReferenceTopRatio: 0.72,
          },
        },
      },
    } as AiStudioSessionSnapshotV2;
    const mismatchedLiveSnapshot = {
      ...restoreSnapshot,
      workspace: {
        ...restoreSnapshot.workspace,
        rightRailLayout: {
          ...restoreSnapshot.workspace.rightRailLayout,
          panels: {
            ...restoreSnapshot.workspace.rightRailLayout?.panels,
            quickSlot: true,
          },
        },
      },
    } as AiStudioSessionSnapshotV2;
    mockReadyRestoreCandidate(restoreSnapshot);
    const buildSessionSnapshot = vi.fn(() => mismatchedLiveSnapshot);
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

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    await flushBootstrapVisibilityLatch();

    expect(result.current.projectBootstrapSettled).toBe(true);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
      })
    );
  });

  it("marks bootstrap settled before the stricter visibility proof matches", async () => {
    const restoreSnapshot = createAiStudioProjectWorkspaceSnapshot(
      createSnapshot()
    ) as AiStudioSessionSnapshotV2;
    const mismatchedLiveSnapshot = createAiStudioProjectWorkspaceSnapshot({
      ...restoreSnapshot,
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-text-1",
            kind: "text",
            text: "draft",
            x: 16,
            y: 24,
            z: 1,
            selected: false,
            outputId: null,
            sourceSurface: null,
            width: 180,
            height: 48,
          },
        ],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 0, y: 0, zoom: 1 },
      }),
    }) as AiStudioSessionSnapshotV2;
    const userEditedLiveSnapshot = createAiStudioProjectWorkspaceSnapshot({
      ...mismatchedLiveSnapshot,
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-text-1",
            kind: "text",
            text: "draft after user edit",
            x: 32,
            y: 40,
            z: 1,
            selected: false,
            outputId: null,
            sourceSurface: null,
            width: 220,
            height: 60,
          },
        ],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 0, y: 0, zoom: 1 },
      }),
    }) as AiStudioSessionSnapshotV2;
    mockReadyRestoreCandidate(restoreSnapshot);
    const buildSessionSnapshot = vi.fn(() => mismatchedLiveSnapshot);
    const buildEditedSessionSnapshot = vi.fn(() => userEditedLiveSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    await act(async () => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
      await Promise.resolve();
    });

    expect(result.current.projectBootstrapSettled).toBe(true);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
      })
    );

    await act(async () => {
      rerender({ buildSnapshot: buildEditedSessionSnapshot });
      await Promise.resolve();
    });

    expect(result.current.projectBootstrapSettled).toBe(true);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: userEditedLiveSnapshot,
        enabled: true,
      })
    );
  });

  it("enables project autosave for a reference-grid media add after unresolved restore proof", async () => {
    const restoredSnapshot = {
      ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
      outputs: {
        active: [
          {
            id: "out-restored-1",
            prompt: "Restored image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewUrl: "https://cdn.example.com/restored.png",
            resultUrls: ["https://cdn.example.com/restored.png"],
          },
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: [],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    const mismatchedLiveSnapshot = {
      ...restoredSnapshot,
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-text-1",
            kind: "text",
            text: "draft",
            x: 16,
            y: 24,
            z: 1,
            selected: false,
            outputId: null,
            sourceSurface: null,
            width: 180,
            height: 48,
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
    const mediaAddedSnapshot = {
      ...mismatchedLiveSnapshot,
      outputs: {
        ...mismatchedLiveSnapshot.outputs,
        active: [
          {
            id: "library-1",
            mediaSource: "library",
            mode: "image",
            status: "ready",
            previewUrl: "https://cdn.example.com/library.png",
            resultUrls: ["https://cdn.example.com/library.png"],
            previewStoragePath: "user-1/media/library-preview.webp",
            fullStoragePath: "user-1/media/library-full.png",
            savedMediaIds: ["11111111-1111-4111-8111-111111111111"],
          },
          ...(mismatchedLiveSnapshot.outputs?.active ?? []),
        ],
      },
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(restoredSnapshot);
    const buildSessionSnapshot = vi.fn(() => mismatchedLiveSnapshot);
    const buildMediaAddedSessionSnapshot = vi.fn(() => mediaAddedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    await act(async () => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
      await Promise.resolve();
    });

    expect(result.current.projectBootstrapSettled).toBe(true);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
      })
    );

    await act(async () => {
      rerender({ buildSnapshot: buildMediaAddedSessionSnapshot });
      await Promise.resolve();
    });

    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: mediaAddedSnapshot,
        enabled: true,
      })
    );
  });

  it("enables project autosave for an archived reference add after unresolved restore proof", async () => {
    const restoredSnapshot = {
      ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
      outputs: {
        active: [
          {
            id: "out-restored-1",
            prompt: "Restored image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewUrl: "https://cdn.example.com/restored.png",
            resultUrls: ["https://cdn.example.com/restored.png"],
          },
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: [],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    const mismatchedLiveSnapshot = {
      ...restoredSnapshot,
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-text-1",
            kind: "text",
            text: "draft",
            x: 16,
            y: 24,
            z: 1,
            selected: false,
            outputId: null,
            sourceSurface: null,
            width: 180,
            height: 48,
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
    const archivedAddedSnapshot = {
      ...mismatchedLiveSnapshot,
      outputs: {
        ...mismatchedLiveSnapshot.outputs,
        archived: [
          {
            id: "archived-library-1",
            mediaSource: "library",
            mode: "image",
            status: "ready",
            previewUrl: "https://cdn.example.com/archived-library.png",
            resultUrls: ["https://cdn.example.com/archived-library.png"],
            previewStoragePath: "user-1/media/archived-library-preview.webp",
            fullStoragePath: "user-1/media/archived-library-full.png",
            savedMediaIds: ["22222222-2222-4222-8222-222222222222"],
            archivedAt: "2026-06-27T12:00:00.000Z",
            archiveReason: "cleanup",
          },
        ],
        removedFromAllRefsIds: ["archived-library-1"],
      },
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(restoredSnapshot);
    const buildSessionSnapshot = vi.fn(() => mismatchedLiveSnapshot);
    const buildArchivedAddedSessionSnapshot = vi.fn(() => archivedAddedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    await act(async () => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
      await Promise.resolve();
    });

    expect(result.current.projectBootstrapSettled).toBe(true);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
      })
    );

    await act(async () => {
      rerender({ buildSnapshot: buildArchivedAddedSessionSnapshot });
      await Promise.resolve();
    });

    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: archivedAddedSnapshot,
        enabled: true,
      })
    );
  });

  it("keeps project autosave blocked for volatile preview-url churn while restore proof is unresolved", async () => {
    const restoredSnapshot = {
      ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
      outputs: {
        active: [
          {
            id: "out-restored-1",
            prompt: "Restored image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewUrl: "https://cdn.example.com/restored.png",
            resultUrls: ["https://cdn.example.com/restored.png"],
          },
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: [],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    const mismatchedLiveSnapshot = {
      ...restoredSnapshot,
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-text-1",
            kind: "text",
            text: "draft",
            x: 16,
            y: 24,
            z: 1,
            selected: false,
            outputId: null,
            sourceSurface: null,
            width: 180,
            height: 48,
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
    const refreshedPreviewSnapshot = {
      ...mismatchedLiveSnapshot,
      outputs: {
        ...mismatchedLiveSnapshot.outputs,
        active: (mismatchedLiveSnapshot.outputs?.active ?? []).map((output) => ({
          ...output,
          previewUrl: "https://cdn.example.com/restored.png?token=refreshed",
          resultUrls: ["https://cdn.example.com/restored.png?token=refreshed"],
        })),
      },
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(restoredSnapshot);
    const buildSessionSnapshot = vi.fn(() => mismatchedLiveSnapshot);
    const buildRefreshedPreviewSnapshot = vi.fn(() => refreshedPreviewSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    await act(async () => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
      await Promise.resolve();
    });

    await act(async () => {
      rerender({ buildSnapshot: buildRefreshedPreviewSnapshot });
      await Promise.resolve();
    });

    expect(result.current.projectBootstrapSettled).toBe(true);
    expect(result.current.projectBootstrapApplied).toBe(false);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: null,
        enabled: false,
        preparedSnapshot: null,
      })
    );
  });

  it("treats media-backed canvas signed URL refreshes as matching restore visibility", async () => {
    const restoredSnapshot = {
      ...createAiStudioProjectWorkspaceSnapshot(createSnapshot()),
      outputs: {
        active: [
          {
            id: "out-restored-canvas-1",
            prompt: "Restored canvas image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewUrl: "https://cdn.example.com/restored-canvas.png?token=old",
            resultUrls: ["https://cdn.example.com/restored-canvas.png?token=old"],
            savedMediaIds: ["media-canvas-1"],
          },
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: ["out-restored-canvas-1"],
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
            outputId: "out-restored-canvas-1",
            sourceSurface: "curated",
            mediaId: "media-canvas-1",
            src: "https://cdn.example.com/restored-canvas.png?token=old",
            alt: "Restored canvas image",
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
    const refreshedCanvasSnapshot = {
      ...restoredSnapshot,
      outputs: {
        ...restoredSnapshot.outputs,
        active: (restoredSnapshot.outputs?.active ?? []).map((output) => ({
          ...output,
          previewUrl: "https://cdn.example.com/restored-canvas.png?token=fresh",
          resultUrls: ["https://cdn.example.com/restored-canvas.png?token=fresh"],
        })),
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
            outputId: "out-restored-canvas-1",
            sourceSurface: "curated",
            mediaId: "media-canvas-1",
            src: "https://cdn.example.com/restored-canvas.png?token=fresh",
            alt: "Restored canvas image",
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
    mockReadyRestoreCandidate(restoredSnapshot);
    const buildSessionSnapshot = vi.fn(() => refreshedCanvasSnapshot);
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

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    await act(async () => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
      await Promise.resolve();
    });
    await flushBootstrapVisibilityLatch();

    expect(result.current.projectBootstrapSettled).toBe(true);
    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: null,
        enabled: false,
        preparedSnapshot: null,
      })
    );
  });

  it("enables project autosave for immediate quick-slot and canvas edits after bootstrap settles", async () => {
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
        curatedReferenceIds: [],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    const pendingLiveSnapshot = {
      ...restoredSnapshot,
      canvas: serializeAiStudioSessionCanvasState({
        items: [],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 0, y: 0, zoom: 1 },
      }),
    } as unknown as AiStudioSessionSnapshot;
    const quickSlotAndCanvasEditedSnapshot = {
      ...pendingLiveSnapshot,
      outputs: {
        ...pendingLiveSnapshot.outputs,
        curatedReferenceIds: ["out-1"],
      },
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-text-1",
            kind: "text",
            text: "fast edit",
            x: 20,
            y: 30,
            z: 1,
            selected: false,
            outputId: null,
            sourceSurface: null,
            width: 180,
            height: 48,
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
    const buildSessionSnapshot = vi.fn(() => pendingLiveSnapshot);
    const buildEditedSessionSnapshot = vi.fn(() => quickSlotAndCanvasEditedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    await act(async () => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
      await Promise.resolve();
    });

    await act(async () => {
      rerender({ buildSnapshot: buildEditedSessionSnapshot });
      await Promise.resolve();
    });

    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        snapshot: quickSlotAndCanvasEditedSnapshot,
        enabled: true,
      })
    );
  });

  it("keeps project autosave idle after bootstrap settles without durable changes", async () => {
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
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
      })
    );
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
    const prepareCallsAfterBootstrap = prepareSpy.mock.calls.length;

    rerender({ projectId: "project-1" });

    expect(prepareSpy.mock.calls.length).toBe(0);
    expect(prepareSpy.mock.calls.length).toBe(prepareCallsAfterBootstrap);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]?.preparedSnapshot).toEqual(
      preparedSnapshotAfterBootstrap
    );
    prepareSpy.mockRestore();
  });

  it("defers project autosave snapshot rebuilds while canvas interaction is active", async () => {
    const initialSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const updatedSnapshot = {
      ...initialSnapshot,
      updatedAt: "2026-04-24T18:01:00.000Z",
    };
    const buildSessionSnapshot = vi.fn(() => updatedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({ isAutosaveWorkDeferred }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSessionSnapshot,
          hydrateFromSessionSnapshot,
          isAutosaveWorkDeferred,
        }),
      {
        initialProps: {
          isAutosaveWorkDeferred: false,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });

    rerender({ isAutosaveWorkDeferred: false });
    await flushBootstrapVisibilityLatch();

    expect(buildSessionSnapshot).toHaveBeenCalledTimes(1);
    const preparedSnapshotBeforeInteraction =
      mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]?.preparedSnapshot;

    rerender({ isAutosaveWorkDeferred: true });

    expect(buildSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]?.preparedSnapshot).toEqual(
      preparedSnapshotBeforeInteraction
    );

    rerender({ isAutosaveWorkDeferred: false });

    expect(buildSessionSnapshot).toHaveBeenCalledTimes(2);
  });

  it("flushes the current project workspace snapshot while autosave work is deferred", async () => {
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
        curatedReferenceIds: [],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    const editedSnapshot = {
      ...restoredSnapshot,
      outputs: {
        ...restoredSnapshot.outputs,
        curatedReferenceIds: ["out-1"],
      },
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-text-1",
            kind: "text",
            text: "current rail edit",
            x: 20,
            y: 30,
            z: 1,
            selected: false,
            outputId: null,
            sourceSurface: null,
            width: 180,
            height: 48,
          },
        ],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 48, y: -24, zoom: 1.6 },
      }),
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(restoredSnapshot);
    const buildRestoredSnapshot = vi.fn(() => restoredSnapshot);
    const buildEditedSnapshot = vi.fn(() => editedSnapshot);
    const prepareCurrentSnapshot = vi.fn();
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    mockedSaveProjectWorkspaceViaApi.mockResolvedValue({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: editedSnapshot,
      createdAt: "2026-04-24T18:00:00.000Z",
      updatedAt: "2026-04-24T18:01:00.000Z",
      saveOutcome: { status: "saved" },
    });

    const { result, rerender } = renderHook(
      ({ buildSnapshot, isAutosaveWorkDeferred }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
          isAutosaveWorkDeferred,
          prepareCurrentSnapshot,
        }),
      {
        initialProps: {
          buildSnapshot: buildRestoredSnapshot,
          isAutosaveWorkDeferred: false,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender({
      buildSnapshot: buildRestoredSnapshot,
      isAutosaveWorkDeferred: false,
    });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);

    rerender({
      buildSnapshot: buildEditedSnapshot,
      isAutosaveWorkDeferred: true,
    });

    let flushResult: Awaited<ReturnType<typeof result.current.flushProjectWorkspaceSnapshot>>;
    await act(async () => {
      flushResult = await result.current.flushProjectWorkspaceSnapshot({
        reason: "pagehide",
        keepalive: true,
      });
    });

    expect(flushResult!).toEqual(
      expect.objectContaining({
        status: "saved",
        projectId: "project-1",
        keepalive: true,
      })
    );
    expect(prepareCurrentSnapshot).toHaveBeenCalledTimes(1);
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        snapshot: editedSnapshot,
        keepalive: true,
      })
    );
  });

  it("coalesces overlapping critical saves and persists the latest pending snapshot after the active save settles", async () => {
    const restoredSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const firstSnapshot = createProjectSnapshotWithOutputPrompt("first critical save");
    const latestSnapshot = createProjectSnapshotWithOutputPrompt("latest critical save");
    let resolveFirstSave: (() => void) | null = null;
    const firstSavePromise = new Promise<ReturnType<typeof createWorkspaceSaveResponse>>(
      (resolve) => {
        resolveFirstSave = () => resolve(createWorkspaceSaveResponse(firstSnapshot));
      }
    );
    mockedSaveProjectWorkspaceViaApi.mockImplementation((request) =>
      mockedSaveProjectWorkspaceViaApi.mock.calls.length === 1
        ? firstSavePromise
        : Promise.resolve(createWorkspaceSaveResponse(request.snapshot as AiStudioSessionSnapshot))
    );
    mockReadyRestoreCandidate(restoredSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({
        immediateSaveSignal,
        snapshot,
      }: {
        immediateSaveSignal: number;
        snapshot: AiStudioSessionSnapshot;
      }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: () => snapshot,
          hydrateFromSessionSnapshot,
          immediateSaveSignal,
        }),
      {
        initialProps: {
          immediateSaveSignal: 0,
          snapshot: restoredSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    await act(async () => {
      rerender({ immediateSaveSignal: 0, snapshot: restoredSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      rerender({ immediateSaveSignal: 1, snapshot: firstSnapshot });
      await Promise.resolve();
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ immediateSaveSignal: 2, snapshot: latestSnapshot });
      await Promise.resolve();
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstSave?.();
      await firstSavePromise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(2);
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        projectId: "project-1",
        snapshot: latestSnapshot,
        keepalive: false,
      })
    );
  });

  it("dedupes same-hash lifecycle flushes while an imperative flush is already in flight", async () => {
    const restoredSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const editedSnapshot = createProjectSnapshotWithOutputPrompt("same hash save");
    let resolveFirstSave: (() => void) | null = null;
    const firstSavePromise = new Promise<ReturnType<typeof createWorkspaceSaveResponse>>(
      (resolve) => {
        resolveFirstSave = () => resolve(createWorkspaceSaveResponse(editedSnapshot));
      }
    );
    mockedSaveProjectWorkspaceViaApi.mockReturnValue(firstSavePromise);
    mockReadyRestoreCandidate(restoredSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: AiStudioSessionSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: () => snapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          snapshot: restoredSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender({ snapshot: restoredSnapshot });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);
    rerender({ snapshot: editedSnapshot });

    let firstFlush!: ReturnType<typeof result.current.flushProjectWorkspaceSnapshot>;
    let duplicateFlush!: ReturnType<typeof result.current.flushProjectWorkspaceSnapshot>;
    await act(async () => {
      firstFlush = result.current.flushProjectWorkspaceSnapshot({ reason: "manual" });
      duplicateFlush = result.current.flushProjectWorkspaceSnapshot({
        reason: "pagehide",
        keepalive: true,
      });
      await Promise.resolve();
    });

    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstSave?.();
      await Promise.all([firstFlush, duplicateFlush]);
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);
  });

  it("dedupes debounced autosave persistence with same-hash imperative flushes", async () => {
    const restoredSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const editedSnapshot = createProjectSnapshotWithOutputPrompt("autosave same hash save");
    let resolveFirstSave: (() => void) | null = null;
    const firstSavePromise = new Promise<ReturnType<typeof createWorkspaceSaveResponse>>(
      (resolve) => {
        resolveFirstSave = () => resolve(createWorkspaceSaveResponse(editedSnapshot));
      }
    );
    mockedSaveProjectWorkspaceViaApi.mockReturnValue(firstSavePromise);
    mockReadyRestoreCandidate(restoredSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: AiStudioSessionSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: () => snapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          snapshot: restoredSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    await act(async () => {
      rerender({ snapshot: restoredSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender({ snapshot: editedSnapshot });

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(autosaveArgs?.preparedSnapshot?.hash).toBeTruthy();

    let autosavePersist!: Promise<void>;
    let duplicateFlush!: ReturnType<typeof result.current.flushProjectWorkspaceSnapshot>;
    await act(async () => {
      autosavePersist = Promise.resolve(
        autosaveArgs!.persistSnapshot("project-1", editedSnapshot, {
          snapshotHash: autosaveArgs!.preparedSnapshot!.hash,
          preparedSnapshot: autosaveArgs!.preparedSnapshot!,
        })
      );
      duplicateFlush = result.current.flushProjectWorkspaceSnapshot({
        reason: "pagehide",
        keepalive: true,
      });
      await Promise.resolve();
    });

    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstSave?.();
      await Promise.all([autosavePersist, duplicateFlush]);
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);
  });

  it("keeps same-project dedupe intact while another project save is in flight", async () => {
    const projectOneRestoredSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const projectOneSnapshot = createProjectSnapshotWithOutputPrompt("project one overlap save");
    const projectTwoSnapshot = createProjectSnapshotWithOutputPrompt("project two overlap save");
    let resolveProjectOneSave: (() => void) | null = null;
    let resolveProjectTwoSave: (() => void) | null = null;
    const projectOneSavePromise = new Promise<ReturnType<typeof createWorkspaceSaveResponse>>(
      (resolve) => {
        resolveProjectOneSave = () => resolve(createWorkspaceSaveResponse(projectOneSnapshot));
      }
    );
    const projectTwoSavePromise = new Promise<ReturnType<typeof createWorkspaceSaveResponse>>(
      (resolve) => {
        resolveProjectTwoSave = () =>
          resolve({
            ...createWorkspaceSaveResponse(projectTwoSnapshot),
            projectId: "project-2",
          });
      }
    );
    mockedSaveProjectWorkspaceViaApi.mockImplementation((request) =>
      request.projectId === "project-1" ? projectOneSavePromise : projectTwoSavePromise
    );
    mockReadyRestoreCandidate(projectOneRestoredSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({ projectId, snapshot }: { projectId: string; snapshot: AiStudioSessionSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId,
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: () => snapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          projectId: "project-1",
          snapshot: projectOneRestoredSnapshot,
        },
      }
    );

    let restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls.at(-1)?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    await act(async () => {
      rerender({
        projectId: "project-1",
        snapshot: projectOneSnapshot,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const projectOneAutosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    const preparedProjectOneSnapshot =
      sessionAutosaveSerialization.prepareAiStudioSessionAutosaveSnapshot(projectOneSnapshot, {
        title: null,
      });
    expect(preparedProjectOneSnapshot.hash).toBeTruthy();
    let firstProjectOnePersist!: Promise<void>;
    await act(async () => {
      firstProjectOnePersist = Promise.resolve(
        projectOneAutosaveArgs!.persistSnapshot("project-1", projectOneSnapshot, {
          snapshotHash: preparedProjectOneSnapshot.hash,
          preparedSnapshot: preparedProjectOneSnapshot,
        })
      );
      await Promise.resolve();
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({
        projectId: "project-2",
        snapshot: projectTwoSnapshot,
      });
      await Promise.resolve();
    });
    restoreHydrationArgs = mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls.at(-1)?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-2");
    });
    await act(async () => {
      rerender({
        projectId: "project-2",
        snapshot: projectTwoSnapshot,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const projectTwoAutosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    const preparedProjectTwoSnapshot =
      sessionAutosaveSerialization.prepareAiStudioSessionAutosaveSnapshot(projectTwoSnapshot, {
        title: null,
      });
    expect(preparedProjectTwoSnapshot.hash).toBeTruthy();
    let projectTwoPersist!: Promise<void>;
    let duplicateProjectOnePersist!: Promise<void>;
    await act(async () => {
      projectTwoPersist = Promise.resolve(
        projectTwoAutosaveArgs!.persistSnapshot("project-2", projectTwoSnapshot, {
          snapshotHash: preparedProjectTwoSnapshot.hash,
          preparedSnapshot: preparedProjectTwoSnapshot,
        })
      );
      duplicateProjectOnePersist = Promise.resolve(
        projectOneAutosaveArgs!.persistSnapshot("project-1", projectOneSnapshot, {
          snapshotHash: preparedProjectOneSnapshot.hash,
          preparedSnapshot: preparedProjectOneSnapshot,
        })
      );
      await Promise.resolve();
    });

    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveProjectOneSave?.();
      resolveProjectTwoSave?.();
      await Promise.all([firstProjectOnePersist, projectTwoPersist, duplicateProjectOnePersist]);
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(2);
  });

  it("contains rejected background critical saves after reporting the persistence warning", async () => {
    const restoredSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const editedSnapshot = createProjectSnapshotWithOutputPrompt("rejected background save");
    const onPersistenceWarning = vi.fn();
    mockedSaveProjectWorkspaceViaApi.mockRejectedValue(new Error("workspace down"));
    mockReadyRestoreCandidate(restoredSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({
        immediateSaveSignal,
        snapshot,
      }: {
        immediateSaveSignal: number;
        snapshot: AiStudioSessionSnapshot;
      }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: () => snapshot,
          hydrateFromSessionSnapshot,
          immediateSaveSignal,
          onPersistenceWarning,
        }),
      {
        initialProps: {
          immediateSaveSignal: 0,
          snapshot: restoredSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    await act(async () => {
      rerender({ immediateSaveSignal: 0, snapshot: restoredSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      rerender({ immediateSaveSignal: 1, snapshot: editedSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);
    expect(onPersistenceWarning).toHaveBeenCalledWith(
      expect.stringContaining("Project autosave is retrying"),
      expect.objectContaining({
        reason: "persist_failed",
        recovered: false,
      })
    );
  });

  it("preserves project-switch flush failure propagation", async () => {
    const restoredSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const editedSnapshot = createProjectSnapshotWithOutputPrompt("project switch failure");
    const onPersistenceWarning = vi.fn();
    mockedSaveProjectWorkspaceViaApi.mockRejectedValue(new Error("workspace down"));
    mockReadyRestoreCandidate(restoredSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: AiStudioSessionSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: () => snapshot,
          hydrateFromSessionSnapshot,
          onPersistenceWarning,
        }),
      {
        initialProps: {
          snapshot: restoredSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    await act(async () => {
      rerender({ snapshot: restoredSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender({ snapshot: editedSnapshot });

    await expect(
      result.current.flushProjectWorkspaceSnapshot({ reason: "project_switch" })
    ).rejects.toThrow("workspace down");
    expect(onPersistenceWarning).toHaveBeenCalledWith(
      expect.stringContaining("workspace down"),
      expect.objectContaining({
        reason: "persist_failed",
        recovered: false,
      })
    );
  });

  it("falls back to normal transport for lifecycle flushes above the keepalive budget", async () => {
    const restoredSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const editedSnapshot = {
      ...restoredSnapshot,
      outputs: {
        active: [
          {
            id: "large-output-1",
            prompt: "large lifecycle save ".repeat(4_000),
            mode: "video",
            mediaSource: "generated",
            status: "ready",
            previewText: "Large lifecycle save output",
            createdAt: "2026-04-24T18:00:00.000Z",
          },
        ],
        archived: [],
        activeOutputId: "large-output-1",
        curatedReferenceIds: ["large-output-1"],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    mockReadyRestoreCandidate(restoredSnapshot);
    const buildRestoredSnapshot = vi.fn(() => restoredSnapshot);
    const buildEditedSnapshot = vi.fn(() => editedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();
    mockedSaveProjectWorkspaceViaApi.mockResolvedValue({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: editedSnapshot,
      createdAt: "2026-04-24T18:00:00.000Z",
      updatedAt: "2026-04-24T18:01:00.000Z",
      saveOutcome: { status: "saved" },
    });

    const { result, rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
          onPersistenceWarning,
        }),
      {
        initialProps: {
          buildSnapshot: buildRestoredSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender({
      buildSnapshot: buildRestoredSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);

    rerender({
      buildSnapshot: buildEditedSnapshot,
    });

    let flushResult: Awaited<ReturnType<typeof result.current.flushProjectWorkspaceSnapshot>>;
    await act(async () => {
      flushResult = await result.current.flushProjectWorkspaceSnapshot({
        reason: "pagehide",
        keepalive: true,
      });
    });

    expect(flushResult!).toEqual(
      expect.objectContaining({
        status: "saved",
        projectId: "project-1",
        keepalive: false,
      })
    );
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        snapshot: editedSnapshot,
        keepalive: false,
      })
    );
    expect(onPersistenceWarning).not.toHaveBeenCalledWith(
      expect.stringContaining("exceeded the 59KB limit"),
      expect.anything()
    );
  });

  it("does not carry keepalive from an older queued lifecycle flush onto a larger latest snapshot", async () => {
    const restoredSnapshot = createAiStudioProjectWorkspaceSnapshot(createSnapshot());
    const activeSnapshot = createProjectSnapshotWithOutputPrompt("active in-flight save");
    const smallQueuedSnapshot = createProjectSnapshotWithOutputPrompt(
      "small queued lifecycle save"
    );
    const largeQueuedSnapshot = {
      ...restoredSnapshot,
      outputs: {
        active: [
          {
            id: "large-output-1",
            prompt: "large queued lifecycle save ".repeat(4_000),
            mode: "video",
            mediaSource: "generated",
            status: "ready",
            previewText: "Large queued lifecycle save output",
            createdAt: "2026-04-24T18:00:00.000Z",
          },
        ],
        archived: [],
        activeOutputId: "large-output-1",
        curatedReferenceIds: ["large-output-1"],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    const preparedLargeSnapshot =
      sessionAutosaveSerialization.prepareAiStudioSessionAutosaveSnapshot(largeQueuedSnapshot, {
        title: null,
      });
    expect(preparedLargeSnapshot.bytes).toBeGreaterThan(
      PROJECT_WORKSPACE_KEEPALIVE_MAX_SNAPSHOT_BYTES
    );
    let resolveFirstSave: (() => void) | null = null;
    const firstSavePromise = new Promise<ReturnType<typeof createWorkspaceSaveResponse>>(
      (resolve) => {
        resolveFirstSave = () => resolve(createWorkspaceSaveResponse(activeSnapshot));
      }
    );
    mockedSaveProjectWorkspaceViaApi.mockImplementation((request) =>
      mockedSaveProjectWorkspaceViaApi.mock.calls.length === 1
        ? firstSavePromise
        : Promise.resolve(createWorkspaceSaveResponse(request.snapshot as AiStudioSessionSnapshot))
    );
    mockReadyRestoreCandidate(restoredSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { result, rerender } = renderHook(
      ({ snapshot }: { snapshot: AiStudioSessionSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: () => snapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          snapshot: restoredSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    await act(async () => {
      rerender({ snapshot: restoredSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });

    let activeFlush!: ReturnType<typeof result.current.flushProjectWorkspaceSnapshot>;
    let smallQueuedFlush!: ReturnType<typeof result.current.flushProjectWorkspaceSnapshot>;
    let largeQueuedFlush!: ReturnType<typeof result.current.flushProjectWorkspaceSnapshot>;
    await act(async () => {
      rerender({ snapshot: activeSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      activeFlush = result.current.flushProjectWorkspaceSnapshot({ reason: "manual" });
      await Promise.resolve();
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ snapshot: smallQueuedSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      smallQueuedFlush = result.current.flushProjectWorkspaceSnapshot({
        reason: "pagehide",
        keepalive: true,
      });
      await Promise.resolve();
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ snapshot: largeQueuedSnapshot });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      largeQueuedFlush = result.current.flushProjectWorkspaceSnapshot({
        reason: "pagehide",
        keepalive: true,
      });
      await Promise.resolve();
    });
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstSave?.();
      await Promise.all([activeFlush, smallQueuedFlush, largeQueuedFlush]);
    });

    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenCalledTimes(2);
    expect(mockedSaveProjectWorkspaceViaApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        projectId: "project-1",
        snapshot: largeQueuedSnapshot,
        keepalive: false,
      })
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
        snapshot: null,
        preparedSnapshot: null,
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
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
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
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
      })
    );

    await act(async () => {
      rerender({
        buildBaseSessionSnapshot: editedBuildSessionSnapshot as (
          sessionId: string
        ) => AiStudioSessionSnapshot,
      });
      await Promise.resolve();
    });
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

    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();

    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
      })
    );
  });

  it("uses the normalized project restore visibility snapshot for bootstrap visibility", async () => {
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
        archived: [
          {
            id: "out-archived",
            prompt: "Archived image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Earlier",
            previewUrl: "https://cdn.example.com/out-archived.png",
            resultUrls: ["https://cdn.example.com/out-archived.png"],
          },
        ],
        activeOutputId: null,
        curatedReferenceIds: ["out-1", "out-archived"],
        removedFromAllRefsIds: ["out-archived"],
      },
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-text-1",
            kind: "text",
            x: 12,
            y: 24,
            z: 1,
            selected: true,
            outputId: null,
            sourceSurface: null,
            text: "Draft note",
            width: 260,
            height: 180,
          },
        ],
        draftTextEntry: { x: 10, y: 20, value: "typing" },
        textEditSession: { itemId: "canvas-text-1", value: "editing" },
        draftOwnerInstanceId: "rail",
        textEditOwnerInstanceId: "main",
        mainCamera: { x: 1, y: 2, zoom: 1.2 },
        railCamera: { x: -4, y: 8, zoom: 0.8 },
      }),
    } as unknown as AiStudioSessionSnapshot;
    const runtimeNormalizedSnapshot = createProjectRestoreVisibilitySnapshot(restoredSnapshot);
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

    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();

    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
      })
    );
  });

  it("matches bootstrap visibility after project output canonicalization changes generated ids", async () => {
    const restoredSnapshot = {
      ...createSnapshot(),
      schemaVersion: 2,
      outputs: {
        active: [
          {
            id: "out-generated-legacy",
            generationId: "gen-1",
            prompt: "Generated image",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewUrl: "https://cdn.example.com/out-generated-legacy.png",
            resultUrls: ["https://cdn.example.com/out-generated-legacy.png"],
          },
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: ["out-generated-legacy"],
        removedFromAllRefsIds: [],
      },
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-image-1",
            kind: "image",
            x: 12,
            y: 24,
            z: 1,
            selected: true,
            outputId: "out-generated-legacy",
            sourceSurface: "curated",
            mediaId: null,
            src: "https://cdn.example.com/out-generated-legacy.png",
            alt: "Generated image",
            width: 220,
            height: 275,
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
    const runtimeNormalizedSnapshot = createProjectRestoreSnapshot(restoredSnapshot);
    const runtimeVisibilitySnapshot = createProjectRestoreVisibilitySnapshot(restoredSnapshot);
    mockReadyRestoreCandidate(restoredSnapshot);
    const buildSessionSnapshot = vi.fn(() => runtimeVisibilitySnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    expect(runtimeNormalizedSnapshot.outputs.active.map((output) => output.id)).toEqual([
      "out-generated-legacy",
    ]);
    expect(runtimeVisibilitySnapshot.outputs.active.map((output) => output.id)).toEqual([
      "generated:gen-1",
    ]);
    expect(runtimeVisibilitySnapshot.outputs.curatedReferenceIds).toEqual(["generated:gen-1"]);

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

    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();

    expect(result.current.projectBootstrapApplied).toBe(true);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
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

    expect(applyEmptyProjectState).not.toHaveBeenCalled();
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

    expect(applyEmptyProjectState).not.toHaveBeenCalled();
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
    expect(applyEmptyProjectState).not.toHaveBeenCalled();
    expect(nextApplyEmptyProjectState).not.toHaveBeenCalled();
    expect(mockedResetAiStudioOutputStore).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
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
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
      })
    );
  });

  it("enables project autosave when only the right-rail layout patch changes", async () => {
    const baseSnapshot = createSnapshot();
    const initialLayout: AiStudioRightRailLayoutV1 = {
      schemaVersion: 1,
      panels: {
        canvas: false,
        quickSlot: true,
        referenceGrid: true,
      },
      splits: {
        canvasInventoryTopRatio: null,
        quickSlotReferenceTopRatio: null,
      },
    };
    const editedLayout: AiStudioRightRailLayoutV1 = {
      schemaVersion: 1,
      panels: {
        canvas: true,
        quickSlot: false,
        referenceGrid: true,
      },
      splits: {
        canvasInventoryTopRatio: 0.41,
        quickSlotReferenceTopRatio: 0.68,
      },
    };
    const buildSessionSnapshot = vi.fn(() => baseSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const patchWithRightRailLayout = (layout: AiStudioRightRailLayoutV1) =>
      vi.fn((snapshot: AiStudioSessionSnapshot) => ({
        ...snapshot,
        workspace: {
          ...snapshot.workspace,
          rightRailLayout: layout,
        },
      }));
    const initialPatchSessionSnapshot = patchWithRightRailLayout(initialLayout);
    const editedPatchSessionSnapshot = patchWithRightRailLayout(editedLayout);

    const { result, rerender } = renderHook(
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
          patchSessionSnapshot: initialPatchSessionSnapshot as (
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

    rerender({ patchSessionSnapshot: initialPatchSessionSnapshot });
    await flushBootstrapVisibilityLatch();
    expect(result.current.projectBootstrapApplied).toBe(true);
    const initialAutosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(initialAutosaveArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: false,
        snapshot: null,
        preparedSnapshot: null,
      })
    );
    const initialPreparedHash = initialAutosaveArgs?.preparedSnapshot?.hash;
    expect(initialPreparedHash).toBeUndefined();

    await act(async () => {
      rerender({ patchSessionSnapshot: editedPatchSessionSnapshot });
      await Promise.resolve();
    });

    const editedAutosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(editedAutosaveArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
        snapshot: expect.objectContaining({
          updatedAt: baseSnapshot.updatedAt,
          workspace: expect.objectContaining({
            rightRailLayout: editedLayout,
          }),
        }),
      })
    );
    expect(editedAutosaveArgs?.preparedSnapshot?.hash).toMatch(/^fnv1a32:/);

    await act(async () => {
      rerender({ patchSessionSnapshot: initialPatchSessionSnapshot });
      await Promise.resolve();
    });

    const revertedAutosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(revertedAutosaveArgs).toEqual(
      expect.objectContaining({
        sessionId: "project-1",
        enabled: true,
        snapshot: expect.objectContaining({
          updatedAt: baseSnapshot.updatedAt,
          workspace: expect.objectContaining({
            rightRailLayout: initialLayout,
          }),
        }),
      })
    );
    expect(revertedAutosaveArgs?.preparedSnapshot?.hash).toMatch(/^fnv1a32:/);
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
    expect(applyEmptyProjectState).not.toHaveBeenCalled();
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

    expect(applyEmptyProjectState).not.toHaveBeenCalled();
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
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });

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
    const runtimeNormalizedSnapshot = createProjectRestoreSnapshot(oversizedSnapshot);
    const editedRuntimeSnapshot = {
      ...runtimeNormalizedSnapshot,
      outputs: {
        ...runtimeNormalizedSnapshot.outputs,
        curatedReferenceIds: ["post-bootstrap-edit"],
      },
    } as AiStudioSessionSnapshot;
    const buildSessionSnapshot = vi.fn(() => runtimeNormalizedSnapshot);
    const buildEditedSessionSnapshot = vi.fn(() => editedRuntimeSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
          onPersistenceWarning: vi.fn(),
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    await act(async () => {
      rerender({
        buildSnapshot: buildEditedSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
      });
      await Promise.resolve();
    });

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
    const editedProjectWorkspaceSnapshot = {
      ...projectWorkspaceSnapshot,
      outputs: {
        ...projectWorkspaceSnapshot.outputs,
        curatedReferenceIds: ["generated:generation-1", "post-bootstrap-edit"],
      },
    } as AiStudioSessionSnapshot;
    const buildSessionSnapshot = vi.fn(() => projectWorkspaceSnapshot);
    const buildEditedSessionSnapshot = vi.fn(() => editedProjectWorkspaceSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();

    const { rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
          onPersistenceWarning,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    await act(async () => {
      rerender({
        buildSnapshot: buildEditedSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
      });
      await Promise.resolve();
    });

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(autosaveArgs?.enabled).toBe(true);
    expect(autosaveArgs?.snapshot?.outputs.active?.[0]).toMatchObject({
      id: "generated:generation-1",
      generationId: "generation-1",
      taskId: "task-1",
      taskState: "success",
    });
    expect(autosaveArgs?.snapshot?.outputs.curatedReferenceIds).toEqual([
      "generated:generation-1",
      "post-bootstrap-edit",
    ]);
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
    const baselineSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    const editedSnapshot = {
      ...baselineSnapshot,
      workspace: {
        ...baselineSnapshot.workspace,
        rightRailLayout: {
          schemaVersion: 1,
          panels: {
            canvas: true,
            quickSlot: false,
            referenceGrid: true,
          },
          splits: {
            canvasInventoryTopRatio: 0.4,
            quickSlotReferenceTopRatio: 0.6,
          },
        },
      },
    } as AiStudioSessionSnapshot;
    const buildSessionSnapshot = vi.fn(() => baselineSnapshot);
    const buildEditedSessionSnapshot = vi.fn(() => editedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();

    const { rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
          onPersistenceWarning,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    await act(async () => {
      rerender({
        buildSnapshot: buildEditedSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
      });
      await Promise.resolve();
    });

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
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });

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
      "Project autosave saved the workspace, but project asset repair is pending. Recent outputs may not fully restore until the next successful save.",
      expect.objectContaining({
        scope: "project_autosave",
        reason: "repair_pending",
        projectId: "project-1",
        recovered: false,
      })
    );
  });

  it("clears a matching Failed to fetch project autosave warning after a successful save", async () => {
    const snapshot = {
      ...createSnapshot(),
      outputs: {
        active: [
          {
            id: "out-1",
            mode: "image",
            prompt: "A forest",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "2026-04-24T18:00:00.000Z",
            mediaSource: "library",
            savedMediaIds: ["media-1"],
          },
        ],
        archived: [],
        activeOutputId: "out-1",
        curatedReferenceIds: ["out-1"],
        removedFromAllRefsIds: [],
      },
    } as AiStudioSessionSnapshot;
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
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    act(() => {
      autosaveArgs?.onPersistError?.(new Error("Failed to fetch"), {
        reason: "persist_failed",
        sessionId: "project-1",
        snapshotHash: "hash-1",
        maxSnapshotBytes: 1024,
        willRetry: true,
      });
    });

    const autosaveSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    mockedSaveProjectWorkspaceViaApi.mockResolvedValue({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: autosaveSnapshot,
      createdAt: "2026-04-24T18:00:00.000Z",
      updatedAt: "2026-04-24T18:00:00.000Z",
      saveOutcome: { status: "saved" },
    });

    await act(async () => {
      await autosaveArgs!.persistSnapshot("project-1", autosaveSnapshot, {
        snapshotHash: "hash-1",
      });
    });

    expect(onPersistenceWarning).toHaveBeenNthCalledWith(
      1,
      "Project autosave is retrying in the background: Failed to fetch",
      expect.objectContaining({
        reason: "persist_failed",
        recovered: false,
        snapshotHash: "hash-1",
      })
    );
    expect(onPersistenceWarning).toHaveBeenNthCalledWith(
      2,
      null,
      expect.objectContaining({
        reason: "persist_failed",
        recovered: true,
        snapshotHash: "hash-1",
      })
    );
  });

  it("bounds repeated Quick Slot save-result diagnostics for the same snapshot shape", async () => {
    const snapshot = {
      ...createSnapshot(),
      outputs: {
        active: [
          {
            id: "out-1",
            mode: "image",
            prompt: "A forest",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "2026-04-24T18:00:00.000Z",
            mediaSource: "library",
            savedMediaIds: ["media-1"],
          },
        ],
        archived: [],
        activeOutputId: "out-1",
        curatedReferenceIds: ["out-1"],
        removedFromAllRefsIds: [],
      },
    } as AiStudioSessionSnapshot;
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(() =>
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
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    mockedReportAppError.mockClear();

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    const autosaveSnapshot = createAiStudioProjectWorkspaceSnapshot(snapshot);
    mockedSaveProjectWorkspaceViaApi.mockResolvedValue({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: autosaveSnapshot,
      createdAt: "2026-04-24T18:00:00.000Z",
      updatedAt: "2026-04-24T18:00:00.000Z",
      saveOutcome: { status: "saved" },
    });

    await act(async () => {
      await autosaveArgs!.persistSnapshot("project-1", autosaveSnapshot, {
        snapshotHash: "hash-1",
      });
      await autosaveArgs!.persistSnapshot("project-1", autosaveSnapshot, {
        snapshotHash: "hash-1",
      });
    });

    expect(mockedReportAppError).toHaveBeenCalledTimes(1);
    expect(mockedReportAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.ai_studio.project_workspace.quick_slot_save_result",
      })
    );
  });

  it("pauses the project autosave warning after repeated persistence failures exhaust retries", async () => {
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
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();

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
      "Project autosave paused after repeated failures: HTTP 500",
      expect.objectContaining({
        scope: "project_autosave",
        reason: "persist_failed",
        projectId: "project-1",
        recovered: false,
      })
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

  it("reduces durable-backed near-route-limit project snapshots before autosave selection", async () => {
    const rawSnapshot = {
      ...createSnapshot(),
      outputs: {
        active: [
          {
            id: "near-route-limit-1",
            prompt: "x".repeat(930_000),
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewText: "near route limit",
            savedMediaIds: ["media-1"],
          },
        ],
        archived: [],
        activeOutputId: "near-route-limit-1",
        curatedReferenceIds: ["near-route-limit-1"],
        removedFromAllRefsIds: [],
      },
    } as unknown as AiStudioSessionSnapshot;
    const snapshot = createAiStudioProjectWorkspaceSnapshot(rawSnapshot);
    mockReadyRestoreCandidate(snapshot);
    const editedSnapshot = {
      ...snapshot,
      outputs: {
        ...snapshot.outputs,
        curatedReferenceIds: ["near-route-limit-1", "post-bootstrap-edit"],
      },
    } as AiStudioSessionSnapshot;
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const buildEditedSessionSnapshot = vi.fn(() => editedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());

    const { rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    await act(async () => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
      await Promise.resolve();
    });
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    await act(async () => {
      rerender({
        buildSnapshot: buildEditedSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
      });
      await Promise.resolve();
    });

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    expect(autosaveArgs?.preparedSnapshot?.bytes).toBeLessThanOrEqual(
      PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES
    );
    expect(autosaveArgs?.snapshot?.outputs.active?.[0]).toMatchObject({
      id: "near-route-limit-1",
      prompt: "x".repeat(1000),
      savedMediaIds: ["media-1"],
    });
    expect(autosaveArgs).toEqual(
      expect.objectContaining({
        snapshot: editedSnapshot,
        maxSnapshotBytes: PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES,
        maxKeepaliveSnapshotBytes: PROJECT_WORKSPACE_KEEPALIVE_MAX_SNAPSHOT_BYTES,
      })
    );
  });

  it("records byte breakdown telemetry when project autosave skips an oversized snapshot", async () => {
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
    const editedSnapshot = {
      ...snapshot,
      outputs: {
        ...snapshot.outputs,
        curatedReferenceIds: ["oversized-1", "post-bootstrap-edit"],
      },
    } as AiStudioSessionSnapshot;
    const buildSessionSnapshot = vi.fn(() => snapshot);
    const buildEditedSessionSnapshot = vi.fn(() => editedSnapshot);
    const hydrateFromSessionSnapshot = vi.fn(() => createHydrationPayload());
    const onPersistenceWarning = vi.fn();

    const { rerender } = renderHook(
      ({ buildSnapshot }) =>
        useAiStudioProjectWorkspacePersistenceController({
          projectId: "project-1",
          projectRouteRequested: true,
          sessionId: "session-1",
          buildBaseSessionSnapshot: buildSnapshot,
          hydrateFromSessionSnapshot,
          onPersistenceWarning,
        }),
      {
        initialProps: {
          buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
        },
      }
    );

    const restoreHydrationArgs =
      mockedUseAiStudioProjectWorkspaceRestoreHydration.mock.calls[0]?.[0];
    act(() => {
      restoreHydrationArgs?.onProjectBootstrapSettled?.("project-1");
    });
    rerender({
      buildSnapshot: buildSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
    });
    await flushBootstrapVisibilityLatch();
    await act(async () => {
      rerender({
        buildSnapshot: buildEditedSessionSnapshot as (sessionId: string) => AiStudioSessionSnapshot,
      });
      await Promise.resolve();
    });

    const autosaveArgs = mockedUseAiStudioSessionAutosave.mock.calls.at(-1)?.[0];
    act(() => {
      autosaveArgs?.onPersistError?.(new Error("Session snapshot exceeds maximum size."), {
        reason: "snapshot_too_large",
        sessionId: "project-1",
        snapshotBytes: 1_010_000,
        maxSnapshotBytes: PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES,
      });
    });

    expect(onPersistenceWarning).toHaveBeenCalledWith(
      "Project autosave skipped because workspace size (987KB) exceeded the 879KB limit.",
      expect.objectContaining({
        scope: "project_autosave",
        reason: "snapshot_too_large",
        projectId: "project-1",
        recovered: false,
      })
    );
    expect(mockedAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ui",
        level: "warn",
        message: "ai_studio_project_workspace_autosave_measurement",
        data: expect.objectContaining({
          project_id: "project-1",
          reason: "snapshot_too_large",
          snapshot_bytes: 1_010_000,
          max_snapshot_bytes: PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES,
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
