import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotWorkspace,
  type AiStudioSessionSnapshot,
} from "../../logic/sessionSnapshot";
import {
  normalizeProjectRestoreSnapshotForCreateCharacterMode,
  shouldRestoreCreateCharacterModeFromProjectSnapshot,
  useAiStudioPageProjectSessionRuntime,
} from "../useAiStudioPageProjectSessionRuntime";

const useAiStudioPageSessionPersistenceMock = vi.fn();

vi.mock("../useAiStudioPageSessionPersistence", () => ({
  useAiStudioPageSessionPersistence: (...args: unknown[]) =>
    useAiStudioPageSessionPersistenceMock(...args),
}));

const createProjectSnapshot = (
  workspacePatch: Partial<AiStudioSessionSnapshot["workspace"]> = {}
): AiStudioSessionSnapshot =>
  patchAiStudioSessionSnapshotWorkspace(createEmptyAiStudioSessionSnapshot(), {
    mode: "image",
    selectedTool: "create",
    ...workspacePatch,
  });

const createHydrationPayload = (
  snapshot: AiStudioSessionSnapshot
): {
  workspace: {
    selectedCharacterId: string | null;
    selectedCharacterLookId: string | null;
  };
  outputs: never;
  agent: never;
  agentRuntimes: never;
  canvas: null;
  expertEdit: null;
} => ({
  workspace: {
    selectedCharacterId: snapshot.workspace.selectedCharacterId ?? null,
    selectedCharacterLookId: snapshot.workspace.selectedCharacterLookId ?? null,
  },
  outputs: null as never,
  agent: null as never,
  agentRuntimes: null as never,
  canvas: null,
  expertEdit: null,
});

describe("useAiStudioPageProjectSessionRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAiStudioPageSessionPersistenceMock.mockImplementation((args) => ({
      sessionRestoreCandidate: {
        status: "idle",
        result: "idle",
        snapshot: null,
        source: "none",
        error: null,
        retry: vi.fn(),
      },
      sessionSnapshot: null,
      projectBootstrapApplied: false,
      projectBootstrapError: null,
      retryProjectBootstrap: vi.fn(),
      __capturedArgs: args,
    }));
  });

  it("detects Character Mode project snapshots from Character Mode-only create models", () => {
    const characterSnapshot = createProjectSnapshot({
      model: "fal-ai/bytedance/seedream/v4.5/edit",
      selectedCharacterId: "char-1",
    });
    const standardSnapshot = createProjectSnapshot({
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      selectedCharacterId: "char-1",
    });

    expect(shouldRestoreCreateCharacterModeFromProjectSnapshot(characterSnapshot)).toBe(true);
    expect(shouldRestoreCreateCharacterModeFromProjectSnapshot(standardSnapshot)).toBe(false);
  });

  it("preserves Character Mode create models through project restore normalization", () => {
    const snapshot = createProjectSnapshot({
      model: "fal-ai/bytedance/seedream/v4.5/edit",
      selectedCharacterId: "char-1",
    });

    const normalized = normalizeProjectRestoreSnapshotForCreateCharacterMode(snapshot);

    expect(normalized.workspace.model).toBe("fal-ai/bytedance/seedream/v4.5/edit");
  });

  it("re-enables Character Mode when hydrating a project snapshot with a Character Mode-only create model", () => {
    const hydrateFromSessionSnapshot = vi.fn((snapshot: AiStudioSessionSnapshot) =>
      createHydrationPayload(snapshot)
    );
    const setCreateSelectedCharacterId = vi.fn();
    const setCreateSelectedCharacterLookId = vi.fn();
    const setIsCreateCharacterModeEnabled = vi.fn();

    renderHook(() =>
      useAiStudioPageProjectSessionRuntime({
        activeCreateAgentKind: "standard",
        activeCreatePulsePresetId: null,
        activeSessionPersistenceSessionId: "session-1",
        buildSessionSnapshot: vi.fn(() => createEmptyAiStudioSessionSnapshot()),
        canvasSessionState: null,
        createSelectedCharacterId: "",
        createSelectedCharacterLookId: "",
        expertCreateMode: "standard",
        expertEditSessionRevision: 0,
        getExpertEditSessionState: vi.fn(() => null),
        hasActivePulseSession: false,
        hydrateActiveFromSessionAgentSnapshot: vi.fn(),
        hydrateCanvasSessionState: vi.fn(),
        hydrateFromSessionSnapshot,
        pendingCreateRuntimeAgentHydrationRef: { current: null },
        persistedAgentRuntime: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        projectId: "project-1",
        projectRouteRequested: false,
        pulseWorkflowSession: null,
        resetActiveProjectAgentConversation: vi.fn(),
        sessionPersistenceTitleOverride: null,
        setCreateSelectedCharacterId,
        setCreateSelectedCharacterLookId,
        setIsCreateCharacterModeEnabled,
        setExpertEditSessionState: vi.fn(),
        setUiNotice: vi.fn(),
      })
    );

    const capturedArgs = useAiStudioPageSessionPersistenceMock.mock.calls[0]?.[0] as {
      hydrateFromSessionSnapshot: (snapshot: AiStudioSessionSnapshot) => unknown;
    };
    const snapshot = createProjectSnapshot({
      model: "fal-ai/bytedance/seedream/v4.5/edit",
      selectedCharacterId: "char-1",
      selectedCharacterLookId: "look-1",
    });

    act(() => {
      capturedArgs.hydrateFromSessionSnapshot(snapshot);
    });

    expect(hydrateFromSessionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({
          model: "fal-ai/bytedance/seedream/v4.5/edit",
          selectedCharacterId: "char-1",
          selectedCharacterLookId: "look-1",
        }),
      })
    );
    expect(setCreateSelectedCharacterId).toHaveBeenCalledWith("char-1");
    expect(setCreateSelectedCharacterLookId).toHaveBeenCalledWith("look-1");
    expect(setIsCreateCharacterModeEnabled).toHaveBeenCalledWith(true);
  });

  it("keeps Character Mode off when the project snapshot restores a standard create model", () => {
    const hydrateFromSessionSnapshot = vi.fn((snapshot: AiStudioSessionSnapshot) =>
      createHydrationPayload(snapshot)
    );
    const setIsCreateCharacterModeEnabled = vi.fn();

    renderHook(() =>
      useAiStudioPageProjectSessionRuntime({
        activeCreateAgentKind: "standard",
        activeCreatePulsePresetId: null,
        activeSessionPersistenceSessionId: "session-1",
        buildSessionSnapshot: vi.fn(() => createEmptyAiStudioSessionSnapshot()),
        canvasSessionState: null,
        createSelectedCharacterId: "",
        createSelectedCharacterLookId: "",
        expertCreateMode: "standard",
        expertEditSessionRevision: 0,
        getExpertEditSessionState: vi.fn(() => null),
        hasActivePulseSession: false,
        hydrateActiveFromSessionAgentSnapshot: vi.fn(),
        hydrateCanvasSessionState: vi.fn(),
        hydrateFromSessionSnapshot,
        pendingCreateRuntimeAgentHydrationRef: { current: null },
        persistedAgentRuntime: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        projectId: "project-1",
        projectRouteRequested: false,
        pulseWorkflowSession: null,
        resetActiveProjectAgentConversation: vi.fn(),
        sessionPersistenceTitleOverride: null,
        setCreateSelectedCharacterId: vi.fn(),
        setCreateSelectedCharacterLookId: vi.fn(),
        setIsCreateCharacterModeEnabled,
        setExpertEditSessionState: vi.fn(),
        setUiNotice: vi.fn(),
      })
    );

    const capturedArgs = useAiStudioPageSessionPersistenceMock.mock.calls[0]?.[0] as {
      hydrateFromSessionSnapshot: (snapshot: AiStudioSessionSnapshot) => unknown;
    };
    const snapshot = createProjectSnapshot({
      model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      selectedCharacterId: "char-1",
    });

    act(() => {
      capturedArgs.hydrateFromSessionSnapshot(snapshot);
    });

    expect(setIsCreateCharacterModeEnabled).toHaveBeenCalledWith(false);
  });
});
