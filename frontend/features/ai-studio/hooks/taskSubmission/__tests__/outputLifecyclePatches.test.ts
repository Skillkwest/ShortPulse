/**
 * Unit coverage for shared output lifecycle patch helpers in submission flow.
 */
import { describe, expect, it } from "vitest";
import {
  applyDispatchedSubmissionPatch,
  applySubmissionFailureToOutputs,
} from "../outputLifecyclePatches";
import type { StudioOutput } from "../../../types";

const makeOutput = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "out-1",
    mode: "image",
    status: "ready",
    taskState: "pending",
    timestamp: "Submitting...",
    provider: "fal",
    ...overrides,
  }) as unknown as StudioOutput;

describe("outputLifecyclePatches", () => {
  it("applies standardized submit-time failure patch", () => {
    const outputs = [makeOutput(), makeOutput({ id: "out-2" })];
    const next = applySubmissionFailureToOutputs(outputs, "out-1", {
      timestamp: "Missing image",
      errorMessage: "Missing",
      errorMessageShort: "Missing",
      errorDetail: "Missing",
    });

    expect(next[0]?.taskState).toBe("fail");
    expect(next[0]?.status).toBe("ready");
    expect(next[0]?.timestamp).toBe("Missing image");
    expect(next[0]?.errorDetail).toBe("Missing");
    expect(next[1]?.id).toBe("out-2");
  });

  it("applies dispatched patch after provider handoff", () => {
    const item = makeOutput();

    const next = applyDispatchedSubmissionPatch({
      item,
      patch: {},
      provider: "fal",
      taskId: "req-1",
    });

    expect(next.taskId).toBe("req-1");
    expect(next.generationTraceId).toBe("req-1");
    expect(next.taskState).toBe("running");
    expect(next.queueState).toBe("dispatched");
  });
});
