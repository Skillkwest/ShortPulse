import { describe, expect, it } from "vitest";
import {
  CONCURRENT_GENERATION_CAP_MESSAGE,
  MAX_CONCURRENT_GENERATIONS,
  countInFlightGenerations,
  isOutputGenerationInFlight,
} from "../concurrentGenerationCap";

describe("concurrentGenerationCap", () => {
  it("treats pending and running outputs as in flight", () => {
    expect(isOutputGenerationInFlight({ taskState: "pending" })).toBe(true);
    expect(isOutputGenerationInFlight({ taskState: "running" })).toBe(true);
    expect(isOutputGenerationInFlight({ taskState: "success" })).toBe(false);
    expect(isOutputGenerationInFlight({ taskState: "fail" })).toBe(false);
    expect(isOutputGenerationInFlight({ taskState: undefined })).toBe(false);
  });

  it("counts unique in-flight outputs across combined collections", () => {
    const count = countInFlightGenerations([
      { id: "out-1", taskState: "pending" },
      { id: "out-2", taskState: "running" },
      { id: "out-2", taskState: "running" },
      { id: "out-3", taskState: "success" },
      { id: "out-4", taskState: "fail" },
      { id: "out-5", taskState: undefined },
    ]);

    expect(count).toBe(2);
  });

  it("exports the user-facing concurrent generation cap contract", () => {
    expect(MAX_CONCURRENT_GENERATIONS).toBe(4);
    expect(CONCURRENT_GENERATION_CAP_MESSAGE).toContain("4 max concurrent generations");
  });
});
