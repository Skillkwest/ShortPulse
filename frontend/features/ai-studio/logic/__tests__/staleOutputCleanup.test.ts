/**
 * Tests for stale output cleanup rules.
 * Guards timeout/fallback behavior for unresolved generation cards.
 */
import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import { evaluateStaleOutputCleanup, type OutputLifecycleMap } from "../staleOutputCleanup";

const BASE_TIME_MS = 1_700_000_000_000;

const makeOutput = (overrides: Partial<StudioOutput>): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "9:16",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "Submitting...",
  taskState: "pending",
  ...overrides,
});

const config = {
  loadingTimeoutMs: 3 * 60 * 1000,
  submitStartTimeoutMs: 12_000,
  autoFailedRetentionMs: 2 * 60 * 1000,
};

describe("evaluateStaleOutputCleanup", () => {
  it("flags generated loading outputs as stale after timeout", () => {
    const outputs = [makeOutput({ id: "out-stale" })];
    const lifecycle: OutputLifecycleMap = {
      "out-stale": { pendingSinceMs: BASE_TIME_MS - 12_000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toEqual(["out-stale"]);
    expect(result.submitStartTimeoutIds).toEqual(["out-stale"]);
    expect(result.nextLifecycle["out-stale"]?.pendingSinceMs).toBe(BASE_TIME_MS - 12_000);
  });

  it("does not stale-timeout generated loading outputs before submit-start timeout", () => {
    const outputs = [makeOutput({ id: "out-pending" })];
    const lifecycle: OutputLifecycleMap = {
      "out-pending": { pendingSinceMs: BASE_TIME_MS - 11_000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toHaveLength(0);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
  });

  it("does not stale-timeout outputs that already have a provider task id", () => {
    const outputs = [makeOutput({ id: "out-tasked", taskId: "req-123", taskState: "running" })];
    const lifecycle: OutputLifecycleMap = {
      "out-tasked": { pendingSinceMs: BASE_TIME_MS - 20 * 60 * 1000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toHaveLength(0);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.nextLifecycle["out-tasked"]).toBeUndefined();
  });

  it("does not track non-generated pending outputs", () => {
    const outputs = [makeOutput({ id: "library-1" })];
    const result = evaluateStaleOutputCleanup(outputs, {}, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toHaveLength(0);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.nextLifecycle).toEqual({});
  });

  it("keeps pending lifecycle only while output is unresolved", () => {
    const loadingOutput = makeOutput({ id: "out-progress" });
    const resolvedOutput = makeOutput({
      id: "out-progress",
      taskState: "success",
      previewUrl: "https://example.com/image.png",
    });

    const firstPass = evaluateStaleOutputCleanup([loadingOutput], {}, BASE_TIME_MS, config);
    const secondPass = evaluateStaleOutputCleanup(
      [resolvedOutput],
      firstPass.nextLifecycle,
      BASE_TIME_MS + 60_000,
      config
    );

    expect(firstPass.nextLifecycle["out-progress"]?.pendingSinceMs).toBe(BASE_TIME_MS);
    expect(secondPass.nextLifecycle["out-progress"]).toBeUndefined();
  });

  it("flags auto-failed outputs for removal after retention window", () => {
    const outputs = [makeOutput({ id: "out-failed", taskState: "fail", timestamp: "Timed out" })];
    const lifecycle: OutputLifecycleMap = {
      "out-failed": { autoFailedAtMs: BASE_TIME_MS - 2 * 60 * 1000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.removableIds).toEqual(["out-failed"]);
  });

  it("does not auto-remove failed outputs that have task ids", () => {
    const outputs = [
      makeOutput({
        id: "out-failed-tasked",
        taskState: "fail",
        taskId: "req-456",
        timestamp: "Timed out",
      }),
    ];
    const lifecycle: OutputLifecycleMap = {
      "out-failed-tasked": { autoFailedAtMs: BASE_TIME_MS - 10 * 60 * 1000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.removableIds).toHaveLength(0);
    expect(result.nextLifecycle["out-failed-tasked"]).toBeUndefined();
  });
});
