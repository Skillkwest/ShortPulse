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
  taskBackedLoadingTimeoutMs: 12 * 60 * 1000,
  queueWaitTimeoutMs: 20 * 60 * 1000,
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
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
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
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
  });

  it("flags task-backed outputs only after task-backed timeout", () => {
    const outputs = [makeOutput({ id: "out-tasked", taskId: "req-123", taskState: "running" })];
    const lifecycle: OutputLifecycleMap = {
      "out-tasked": { pendingSinceMs: BASE_TIME_MS - 20 * 60 * 1000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toEqual(["out-tasked"]);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.taskBackedTimeoutIds).toEqual(["out-tasked"]);
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
    expect(result.nextLifecycle["out-tasked"]?.pendingSinceMs).toBe(BASE_TIME_MS - 20 * 60 * 1000);
  });

  it("does not stale-timeout task-backed outputs before task-backed timeout budget", () => {
    const outputs = [
      makeOutput({ id: "out-tasked-fresh", taskId: "req-123", taskState: "running" }),
    ];
    const lifecycle: OutputLifecycleMap = {
      "out-tasked-fresh": { pendingSinceMs: BASE_TIME_MS - 11 * 60 * 1000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toHaveLength(0);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.taskBackedTimeoutIds).toHaveLength(0);
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
  });

  it("does not treat success without preview as stale loading", () => {
    const outputs = [
      makeOutput({
        id: "out-success-no-preview",
        taskId: "req-success-no-preview",
        taskState: "success",
      }),
    ];
    const lifecycle: OutputLifecycleMap = {
      "out-success-no-preview": { pendingSinceMs: BASE_TIME_MS - 20 * 60 * 1000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toHaveLength(0);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.taskBackedTimeoutIds).toHaveLength(0);
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
    expect(result.nextLifecycle["out-success-no-preview"]).toBeUndefined();
  });

  it("does not track non-generated pending outputs", () => {
    const outputs = [makeOutput({ id: "library-1" })];
    const result = evaluateStaleOutputCleanup(outputs, {}, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toHaveLength(0);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
    expect(result.nextLifecycle).toEqual({});
  });

  it("tracks generated placeholders by mediaSource even when id does not use out-* prefix", () => {
    const outputs = [makeOutput({ id: "generation-db-1", mediaSource: "generated" })];
    const lifecycle: OutputLifecycleMap = {
      "generation-db-1": { pendingSinceMs: BASE_TIME_MS - 12_000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toEqual(["generation-db-1"]);
    expect(result.submitStartTimeoutIds).toEqual(["generation-db-1"]);
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
  });

  it("does not submit-start timeout queued outputs while waiting for dispatch", () => {
    const outputs = [makeOutput({ id: "out-queued", queueState: "queued" })];
    const lifecycle: OutputLifecycleMap = {
      "out-queued": { pendingSinceMs: BASE_TIME_MS - 12_000 },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toHaveLength(0);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
  });

  it("fails queued outputs only after queue wait timeout", () => {
    const outputs = [makeOutput({ id: "out-queued-stale", queueState: "queued" })];
    const lifecycle: OutputLifecycleMap = {
      "out-queued-stale": { pendingSinceMs: BASE_TIME_MS - config.queueWaitTimeoutMs },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toEqual(["out-queued-stale"]);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.queueWaitTimeoutIds).toEqual(["out-queued-stale"]);
  });

  it("treats generationId-without-taskId as queued wait even when queueState is missing", () => {
    const outputs = [
      makeOutput({
        id: "out-queued-legacy",
        generationId: "gen-legacy-queued",
        queueState: undefined,
      }),
    ];
    const lifecycle: OutputLifecycleMap = {
      "out-queued-legacy": { pendingSinceMs: BASE_TIME_MS - config.submitStartTimeoutMs },
    };

    const result = evaluateStaleOutputCleanup(outputs, lifecycle, BASE_TIME_MS, config);

    expect(result.staleLoadingIds).toHaveLength(0);
    expect(result.submitStartTimeoutIds).toHaveLength(0);
    expect(result.queueWaitTimeoutIds).toHaveLength(0);
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
