import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioSessionRestoreCandidate } from "../useAiStudioSessionRestoreCandidate";

const loadCandidateMock = vi.fn();

vi.mock("../../logic/sessionRestoreCandidate", () => ({
  loadAiStudioSessionRestoreCandidate: (...args: unknown[]) => loadCandidateMock(...args),
}));

describe("useAiStudioSessionRestoreCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays idle when disabled", () => {
    const { result } = renderHook(() =>
      useAiStudioSessionRestoreCandidate({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        enabled: false,
      })
    );

    expect(result.current.status).toBe("idle");
    expect(loadCandidateMock).not.toHaveBeenCalled();
  });

  it("loads candidate when enabled", async () => {
    loadCandidateMock.mockResolvedValue({
      snapshot: {
        schemaVersion: 1,
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        updatedAt: "2026-03-02T00:00:00.000Z",
        workspace: {},
        outputs: {},
        agent: {},
      },
      source: "local",
    });

    const { result } = renderHook(() =>
      useAiStudioSessionRestoreCandidate({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.source).toBe("local");
    expect(loadCandidateMock).toHaveBeenCalledWith({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      remoteEnabled: false,
    });
  });
});
