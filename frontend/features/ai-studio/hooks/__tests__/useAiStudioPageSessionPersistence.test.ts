import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AiStudioSessionSnapshot } from "../../logic/sessionSnapshot";
import { useAiStudioPageSessionPersistence } from "../useAiStudioPageSessionPersistence";
import { useAiStudioSessionPersistenceController } from "../useAiStudioSessionPersistenceController";

vi.mock("../useAiStudioSessionPersistenceController", () => ({
  useAiStudioSessionPersistenceController: vi.fn(() => ({
    sessionId: "session-1",
    sessionSnapshot: null,
    sessionRestoreCandidate: {
      status: "idle",
      snapshot: null,
      source: null,
      error: null,
    },
    setSkipRestoreApplyForSessionId: vi.fn(),
  })),
}));

const mockedUseAiStudioSessionPersistenceController = vi.mocked(
  useAiStudioSessionPersistenceController
);

describe("useAiStudioPageSessionPersistence", () => {
  beforeEach(() => {
    mockedUseAiStudioSessionPersistenceController.mockClear();
  });

  it("passes the page-owned snapshot bridge into the shared persistence controller", () => {
    const buildSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshot =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshot["workspace"],
          outputs: {} as AiStudioSessionSnapshot["outputs"],
          agent: {} as AiStudioSessionSnapshot["agent"],
          canvas: args.canvasState,
        }) as AiStudioSessionSnapshot
    );
    const hydrateFromSessionSnapshot = vi.fn(() => ({
      workspace: {} as never,
      outputs: {} as never,
      agent: {
        messages: [],
        input: "",
        latestPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: false,
      },
      canvas: null,
    }));
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const hydrateSessionState = vi.fn();
    const setUiNotice = vi.fn();

    renderHook(() =>
      useAiStudioPageSessionPersistence({
        sessionId: "session-1",
        buildSessionSnapshot,
        agentMessages: [],
        agentInput: "plan next shot",
        latestAgentPrompt: "latest",
        promptOrigin: "manual",
        chatModeEnabled: true,
        canvasSessionState: {
          items: [],
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 0, y: 0, zoom: 1 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        },
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        hydrateSessionState,
        setUiNotice,
      })
    );

    expect(mockedUseAiStudioSessionPersistenceController).toHaveBeenCalledTimes(1);
    const params = mockedUseAiStudioSessionPersistenceController.mock.calls[0]?.[0];
    expect(params?.sessionId).toBe("session-1");

    params?.buildSessionSnapshot("session-2");
    expect(buildSessionSnapshot).toHaveBeenCalledWith({
      sessionId: "session-2",
      agentMessages: [],
      agentInput: "plan next shot",
      latestAgentPrompt: "latest",
      promptOrigin: "manual",
      chatModeEnabled: true,
      canvasState: {
        items: [],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 0, y: 0, zoom: 1 },
      },
    });

    const canvasPayload = {
      items: [],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    params?.hydrateFromSessionCanvasSnapshot(canvasPayload);
    expect(hydrateSessionState).toHaveBeenCalledWith(canvasPayload);

    params?.hydrateFromSessionCanvasSnapshot(null);
    expect(hydrateSessionState).toHaveBeenCalledTimes(1);

    params?.onPersistenceWarning?.("autosave warning");
    expect(setUiNotice).toHaveBeenCalledWith("autosave warning");
    expect(params?.hydrateFromSessionSnapshot).toBe(hydrateFromSessionSnapshot);
    expect(params?.hydrateFromSessionAgentSnapshot).toBe(hydrateFromSessionAgentSnapshot);
  });
});
