import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AiStudioSessionSnapshot } from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import { useAiStudioPageSessionPersistence } from "../useAiStudioPageSessionPersistence";
import { useAiStudioSessionPersistenceController } from "../useAiStudioSessionPersistenceController";
import type { ExpertEditSessionState } from "../../components/edit/expertEditSessionState";

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
  const expertEditSessionState: ExpertEditSessionState = {
    version: 2,
    layers: {
      layerIdCounter: 2,
      foundationLayerId: "layer-1",
      selectedLayerIndex: 0,
      layers: [],
    },
    markup: {
      strokes: [],
    },
    inpaint: {
      snapshot: { layers: [] },
    },
  };

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
        }) as AiStudioSessionSnapshot
    );
    const hydrateFromSessionSnapshot = vi.fn(
      (): AiStudioSessionHydrationPayload => ({
        workspace: {} as never,
        outputs: {} as never,
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
        },
        canvas: null,
      })
    );
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const hydrateFromSessionExpertEditSnapshot = vi.fn();
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
        expertEditSessionState,
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        hydrateFromSessionExpertEditSnapshot,
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
      expertEditSessionState,
    });

    params?.onPersistenceWarning?.("autosave warning");
    expect(setUiNotice).toHaveBeenCalledWith("autosave warning");
    expect(params?.hydrateFromSessionSnapshot).toBe(hydrateFromSessionSnapshot);
    expect(params?.hydrateFromSessionAgentSnapshot).toBe(hydrateFromSessionAgentSnapshot);
    expect(params?.hydrateFromSessionExpertEditSnapshot).toBe(hydrateFromSessionExpertEditSnapshot);
  });
});
