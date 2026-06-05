import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioShellRuntime } from "../useAiStudioShellRuntime";
import type { AiStudioPageBaseRuntime } from "../useAiStudioPageBaseRuntime";

vi.mock("../useAiStudioProjectRouteRecovery", () => ({
  useAiStudioProjectRouteRecovery: () => undefined,
}));

const createBaseRuntime = (): AiStudioPageBaseRuntime =>
  ({
    closeModelModal: vi.fn(),
    expertCreateMode: "standard",
    isModelModalOpen: false,
    isCreateCharacterModeEnabled: false,
    localSessionTitleOverride: null,
    modelModalContext: null,
    project: {
      id: "project-1",
      title: "Project One",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    projectErrorKind: null,
    projectId: "project-1",
    projectRouteRequested: true,
    projectStatus: "ready",
    requestedProjectId: "project-1",
    router: {
      query: { projectId: "project-1" },
      push: vi.fn(async () => true),
      replace: vi.fn(async () => true),
    },
    sessionId: "session-1",
    setIsProjectsModalOpen: vi.fn(),
    setSelectedToolWithEditIntentReset: vi.fn(),
    setSessionTitleOverrideState: vi.fn(),
    setShowCreateTools: vi.fn(),
    setUiError: vi.fn(),
    selectedTool: "create",
    trackUiEvent: vi.fn(),
    updateProjectTitle: vi.fn(async (value: string) => ({
      id: "project-1",
      title: value,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    })),
    resolveIsCharacterModeEnabledForTool: vi.fn(() => false),
    resolveSelectedCharacterIdForTool: vi.fn(() => null),
  }) as unknown as AiStudioPageBaseRuntime;

describe("useAiStudioShellRuntime", () => {
  it("opens the studio once project bootstrap settles even before autosave-readiness proof matches", () => {
    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base: createBaseRuntime(),
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: false,
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    expect(result.current.shouldGateProjectBootstrap).toBe(false);
  });

  it("keeps the entry gate closed while restore is not yet settled", () => {
    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base: createBaseRuntime(),
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: false,
        projectBootstrapApplied: false,
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    expect(result.current.shouldGateProjectBootstrap).toBe(true);
    expect(result.current.projectEntryPhase).toBe("restoring-workspace");
  });

  it("reports interrupted project modal navigation when the router cancels the push", async () => {
    const base = createBaseRuntime();
    const push = vi.fn(async () => false);
    base.router.push = push;

    const { result } = renderHook(() =>
      useAiStudioShellRuntime({
        base,
        sessionRestoreCandidate: {
          status: "ready",
          result: "found_snapshot",
          snapshot: null,
          source: "project",
          error: null,
          retry: vi.fn(),
        },
        projectBootstrapSettled: true,
        projectBootstrapApplied: true,
        filteredModelOptions: [],
        resolveModelPickerCredits: vi.fn(() => null),
        handleSelectModelFromModal: vi.fn(),
      })
    );

    await expect(result.current.handleSelectProjectFromModal("project-2")).rejects.toThrow(
      "Project open was interrupted. Try again."
    );
    expect(push).toHaveBeenCalledWith({
      pathname: "/ai-studio",
      query: { projectId: "project-2" },
    });
  });
});
