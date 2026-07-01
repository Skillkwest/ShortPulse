/**
 * Tests AI Studio runtime remount scope decisions.
 */
import { describe, expect, it } from "vitest";
import {
  PENDING_PROJECT_RUNTIME_SCOPE_KEY,
  STANDALONE_RUNTIME_SCOPE_KEY,
  resolveAiStudioRuntimeScopeKey,
} from "../aiStudioRuntimeScopeKey";

describe("resolveAiStudioRuntimeScopeKey", () => {
  it("uses the standalone scope outside project routes", () => {
    expect(
      resolveAiStudioRuntimeScopeKey({
        previousScopeKey: "project:existing",
        projectId: null,
        projectRouteRequested: false,
        projectStatus: "idle",
        requestedProjectId: null,
      })
    ).toBe(STANDALONE_RUNTIME_SCOPE_KEY);
  });

  it("uses the resolved project id when project identity is ready", () => {
    expect(
      resolveAiStudioRuntimeScopeKey({
        previousScopeKey: PENDING_PROJECT_RUNTIME_SCOPE_KEY,
        projectId: "11111111-1111-4111-8111-111111111111",
        projectRouteRequested: true,
        projectStatus: "ready",
        requestedProjectId: "11111111-1111-4111-8111-111111111111",
      })
    ).toBe("project:11111111-1111-4111-8111-111111111111");
  });

  it("preserves the last resolved project scope during transient project loading", () => {
    expect(
      resolveAiStudioRuntimeScopeKey({
        previousScopeKey: "project:11111111-1111-4111-8111-111111111111",
        projectId: null,
        projectRouteRequested: true,
        projectStatus: "loading",
        requestedProjectId: "11111111-1111-4111-8111-111111111111",
      })
    ).toBe("project:11111111-1111-4111-8111-111111111111");
  });

  it("does not preserve a prior project scope while a different project is loading", () => {
    expect(
      resolveAiStudioRuntimeScopeKey({
        previousScopeKey: "project:11111111-1111-4111-8111-111111111111",
        projectId: null,
        projectRouteRequested: true,
        projectStatus: "loading",
        requestedProjectId: "22222222-2222-4222-8222-222222222222",
      })
    ).toBe(PENDING_PROJECT_RUNTIME_SCOPE_KEY);
  });

  it("uses the pending project scope on initial project bootstrap", () => {
    expect(
      resolveAiStudioRuntimeScopeKey({
        previousScopeKey: null,
        projectId: null,
        projectRouteRequested: true,
        projectStatus: "loading",
        requestedProjectId: "11111111-1111-4111-8111-111111111111",
      })
    ).toBe(PENDING_PROJECT_RUNTIME_SCOPE_KEY);
  });

  it("does not preserve stale project runtime after project identity errors", () => {
    expect(
      resolveAiStudioRuntimeScopeKey({
        previousScopeKey: "project:11111111-1111-4111-8111-111111111111",
        projectId: null,
        projectRouteRequested: true,
        projectStatus: "error",
        requestedProjectId: "11111111-1111-4111-8111-111111111111",
      })
    ).toBe(PENDING_PROJECT_RUNTIME_SCOPE_KEY);
  });
});
