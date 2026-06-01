import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotOutputs,
  patchAiStudioSessionSnapshotWorkspace,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import { parseAiStudioSessionCanvasState } from "../../logic/sessionSnapshotCanvas";
import { createProjectRestoreSnapshot } from "../../logic/projectRestoreSnapshot";
import { useAiStudioPageProjectSessionRuntime } from "../useAiStudioPageProjectSessionRuntime";

const useAiStudioPageSessionPersistenceMock = vi.fn();
const createNoopDraftSetter = () => vi.fn();

vi.mock("../useAiStudioPageSessionPersistence", () => ({
  useAiStudioPageSessionPersistence: (...args: unknown[]) =>
    useAiStudioPageSessionPersistenceMock(...args),
}));

const createProjectSnapshot = (
  workspacePatch: Partial<AiStudioSessionSnapshot["workspace"]> = {}
): AiStudioSessionSnapshotV2 =>
  patchAiStudioSessionSnapshotWorkspace(createEmptyAiStudioSessionSnapshot(), {
    mode: "image",
    selectedTool: "create",
    ...workspacePatch,
  });

const createHydrationPayload = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionHydrationPayload => ({
  workspace: {
    ...createEmptyAiStudioSessionSnapshot().workspace,
    ...snapshot.workspace,
    prompt: snapshot.workspace.prompt ?? snapshot.workspace.standardPrompt ?? "",
    standardPrompt: snapshot.workspace.standardPrompt ?? "",
    pulsePrompt: snapshot.workspace.pulsePrompt ?? "",
    expertCreateMode: snapshot.workspace.expertCreateMode ?? "standard",
    activePulsePresetId: snapshot.workspace.activePulsePresetId ?? null,
    pulseSessionInstanceId: snapshot.workspace.pulseSessionInstanceId ?? null,
    selectedCharacterId: snapshot.workspace.selectedCharacterId ?? null,
    selectedCharacterLookId: snapshot.workspace.selectedCharacterLookId ?? null,
  } as AiStudioSessionHydrationPayload["workspace"],
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
      projectBootstrapSettled: false,
      projectBootstrapApplied: false,
      projectBootstrapError: null,
      retryProjectBootstrap: vi.fn(),
      resetProjectWorkspace: vi.fn(async () => undefined),
      __capturedArgs: args,
    }));
  });

  it("normalizes project restore snapshots to blank Create while keeping durable outputs and canvas", () => {
    const snapshot = patchAiStudioSessionSnapshotCanvas(
      patchAiStudioSessionSnapshotOutputs(
        createProjectSnapshot({
          model: "fal-ai/bytedance/seedream/v4.5/edit",
          selectedCharacterId: "char-1",
          selectedCharacterLookId: "look-1",
          prompt: "A portrait",
          standardPrompt: "A portrait",
        }),
        {
          active: [
            {
              id: "out-1",
              prompt: "Prompt",
              mode: "image",
              aspect: "1:1",
              model: "model-1",
              status: "ready",
              timestamp: "Just now",
              previewUrl: "https://cdn.example.com/out-1.png",
            },
          ],
          archived: [
            {
              id: "out-archived",
              prompt: "Archived",
              mode: "image",
              aspect: "1:1",
              model: "model-1",
              status: "ready",
              timestamp: "Just now",
              previewUrl: "https://cdn.example.com/out-archived.png",
            },
          ],
          activeOutputId: "out-1",
          curatedReferenceIds: ["out-1", "out-archived"],
          removedFromAllRefsIds: ["out-archived"],
        }
      ),
      {
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
      }
    );

    const normalized = createProjectRestoreSnapshot(snapshot);
    const normalizedCanvas = parseAiStudioSessionCanvasState(normalized.canvas ?? null);

    expect(normalized.workspace.mode).toBe("text");
    expect(normalized.workspace.selectedTool).toBe("create");
    expect(normalized.workspace.prompt).toBe("");
    expect(normalized.workspace.model).toBeNull();
    expect(normalized.workspace.selectedCharacterId).toBeNull();
    expect(normalized.workspace.selectedCharacterLookId).toBeNull();
    expect(normalized.outputs.active.map((output) => output.id)).toEqual(["out-1"]);
    expect(normalized.outputs.archived).toEqual([]);
    expect(normalized.outputs.activeOutputId).toBeNull();
    expect(normalized.outputs.curatedReferenceIds).toEqual(["out-1"]);
    expect(normalized.outputs.removedFromAllRefsIds).toEqual([]);
    expect(normalizedCanvas?.draftTextEntry).toBeNull();
    expect(normalizedCanvas?.textEditSession).toBeNull();
    expect(normalizedCanvas?.items[0]?.selected).toBe(false);
    expect("expertEdit" in normalized).toBe(false);
  });

  it("hydrates project snapshots through the blank Create restore contract", () => {
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
        buildProjectWorkspaceSnapshot: vi.fn(() => createEmptyAiStudioSessionSnapshot()),
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
        setMusicPromptDraft: createNoopDraftSetter(),
        setMusicLyricsDraft: createNoopDraftSetter(),
        setSoundEffectsPromptDraft: createNoopDraftSetter(),
        setUiNotice: vi.fn(),
        setVoiceDesignPromptDraft: createNoopDraftSetter(),
        setVoiceScriptDraft: createNoopDraftSetter(),
      })
    );

    const capturedArgs = useAiStudioPageSessionPersistenceMock.mock.calls[0]?.[0] as {
      hydrateFromSessionSnapshot: (snapshot: AiStudioSessionSnapshot) => unknown;
    };
    const snapshot = patchAiStudioSessionSnapshotOutputs(
      createProjectSnapshot({
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        selectedCharacterId: "char-1",
        selectedCharacterLookId: "look-1",
      }),
      {
        active: [
          {
            id: "out-1",
            prompt: "Prompt",
            mode: "image",
            aspect: "1:1",
            model: "model-1",
            status: "ready",
            timestamp: "Just now",
            previewUrl: "https://cdn.example.com/out-1.png",
          },
        ],
        archived: [],
        activeOutputId: "out-1",
        curatedReferenceIds: ["out-1"],
        removedFromAllRefsIds: [],
      }
    );

    act(() => {
      capturedArgs.hydrateFromSessionSnapshot(snapshot);
    });

    expect(hydrateFromSessionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        outputs: expect.objectContaining({
          active: [expect.objectContaining({ id: "out-1" })],
          activeOutputId: null,
        }),
        workspace: expect.objectContaining({
          mode: "text",
          selectedTool: "create",
          model: null,
          selectedCharacterId: null,
          selectedCharacterLookId: null,
        }),
      })
    );
    expect(setCreateSelectedCharacterId).toHaveBeenCalledWith("");
    expect(setCreateSelectedCharacterLookId).toHaveBeenCalledWith("");
    expect(setIsCreateCharacterModeEnabled).toHaveBeenCalledWith(false);
  });

  it("does not wire project persistence through Expert Edit hydration anymore", () => {
    const hydrateFromSessionSnapshot = vi.fn((snapshot: AiStudioSessionSnapshot) =>
      createHydrationPayload(snapshot)
    );

    renderHook(() =>
      useAiStudioPageProjectSessionRuntime({
        activeCreateAgentKind: "standard",
        activeCreatePulsePresetId: null,
        activeSessionPersistenceSessionId: "session-1",
        buildProjectWorkspaceSnapshot: vi.fn(() => createEmptyAiStudioSessionSnapshot()),
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
        setIsCreateCharacterModeEnabled: vi.fn(),
        setExpertEditSessionState: vi.fn(),
        setMusicPromptDraft: createNoopDraftSetter(),
        setMusicLyricsDraft: createNoopDraftSetter(),
        setSoundEffectsPromptDraft: createNoopDraftSetter(),
        setUiNotice: vi.fn(),
        setVoiceDesignPromptDraft: createNoopDraftSetter(),
        setVoiceScriptDraft: createNoopDraftSetter(),
      })
    );

    const capturedArgs = useAiStudioPageSessionPersistenceMock.mock.calls[0]?.[0] as {
      patchSessionSnapshot?: unknown;
    };

    expect(capturedArgs.patchSessionSnapshot).toBeUndefined();
  });

  it("clears session-only sound drafts when applying empty project state", () => {
    const setMusicPromptDraft = vi.fn();
    const setMusicLyricsDraft = vi.fn();
    const setSoundEffectsPromptDraft = vi.fn();
    const setVoiceDesignPromptDraft = vi.fn();
    const setVoiceScriptDraft = vi.fn();

    renderHook(() =>
      useAiStudioPageProjectSessionRuntime({
        activeCreateAgentKind: "standard",
        activeCreatePulsePresetId: null,
        activeSessionPersistenceSessionId: "session-1",
        buildProjectWorkspaceSnapshot: vi.fn(() => createEmptyAiStudioSessionSnapshot()),
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
        hydrateFromSessionSnapshot: vi.fn((snapshot: AiStudioSessionSnapshot) =>
          createHydrationPayload(snapshot)
        ),
        persistedAgentRuntime: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        projectId: "project-1",
        projectRouteRequested: true,
        pulseWorkflowSession: null,
        resetActiveProjectAgentConversation: vi.fn(),
        sessionPersistenceTitleOverride: null,
        setCreateSelectedCharacterId: vi.fn(),
        setCreateSelectedCharacterLookId: vi.fn(),
        setIsCreateCharacterModeEnabled: vi.fn(),
        setExpertEditSessionState: vi.fn(),
        setMusicPromptDraft,
        setMusicLyricsDraft,
        setSoundEffectsPromptDraft,
        setUiNotice: vi.fn(),
        setVoiceDesignPromptDraft,
        setVoiceScriptDraft,
      })
    );

    const capturedArgs = useAiStudioPageSessionPersistenceMock.mock.calls[0]?.[0] as {
      applyEmptyProjectState: () => void;
    };

    act(() => {
      capturedArgs.applyEmptyProjectState();
    });

    expect(setMusicPromptDraft).toHaveBeenCalledWith("");
    expect(setMusicLyricsDraft).toHaveBeenCalledWith("");
    expect(setSoundEffectsPromptDraft).toHaveBeenCalledWith("");
    expect(setVoiceDesignPromptDraft).toHaveBeenCalledWith("");
    expect(setVoiceScriptDraft).toHaveBeenCalledWith("");
  });

  it("forwards the bootstrap project id to page session persistence before identity finishes", () => {
    renderHook(() =>
      useAiStudioPageProjectSessionRuntime({
        activeCreateAgentKind: "standard",
        activeCreatePulsePresetId: null,
        activeSessionPersistenceSessionId: "session-1",
        buildProjectWorkspaceSnapshot: vi.fn(() => createEmptyAiStudioSessionSnapshot()),
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
        hydrateFromSessionSnapshot: vi.fn((snapshot: AiStudioSessionSnapshot) =>
          createHydrationPayload(snapshot)
        ),
        persistedAgentRuntime: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        projectBootstrapId: "project-route-1",
        projectId: null,
        projectRouteRequested: true,
        pulseWorkflowSession: null,
        resetActiveProjectAgentConversation: vi.fn(),
        sessionPersistenceTitleOverride: null,
        setCreateSelectedCharacterId: vi.fn(),
        setCreateSelectedCharacterLookId: vi.fn(),
        setIsCreateCharacterModeEnabled: vi.fn(),
        setExpertEditSessionState: vi.fn(),
        setMusicPromptDraft: createNoopDraftSetter(),
        setMusicLyricsDraft: createNoopDraftSetter(),
        setSoundEffectsPromptDraft: createNoopDraftSetter(),
        setUiNotice: vi.fn(),
        setVoiceDesignPromptDraft: createNoopDraftSetter(),
        setVoiceScriptDraft: createNoopDraftSetter(),
      })
    );

    expect(useAiStudioPageSessionPersistenceMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        projectId: null,
        projectBootstrapId: "project-route-1",
        projectRouteRequested: true,
      })
    );
  });
});
