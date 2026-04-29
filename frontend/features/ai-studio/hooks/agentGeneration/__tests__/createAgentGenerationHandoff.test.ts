import { describe, expect, it, vi } from "vitest";
import { resolveCreateAgentGenerationHandoff } from "../createAgentGenerationHandoff";

describe("resolveCreateAgentGenerationHandoff", () => {
  it("keeps Standard agent capture wired through chat mode", () => {
    const onStandardAgentCaptureResult = vi.fn();

    expect(
      resolveCreateAgentGenerationHandoff({
        expertCreateMode: "standard",
        chatModeEnabled: true,
        onStandardAgentCaptureResult,
      })
    ).toEqual({
      usesAgentLane: true,
      onAgentCaptureResult: onStandardAgentCaptureResult,
    });

    expect(
      resolveCreateAgentGenerationHandoff({
        expertCreateMode: "standard",
        chatModeEnabled: false,
        onStandardAgentCaptureResult,
      })
    ).toEqual({
      usesAgentLane: false,
      onAgentCaptureResult: onStandardAgentCaptureResult,
    });
  });

  it("keeps Pulse generation handoff from mutating Standard prompt references", () => {
    const onStandardAgentCaptureResult = vi.fn();

    expect(
      resolveCreateAgentGenerationHandoff({
        expertCreateMode: "pulse",
        chatModeEnabled: false,
        onStandardAgentCaptureResult,
      })
    ).toEqual({
      usesAgentLane: true,
      onAgentCaptureResult: undefined,
    });
  });
});
