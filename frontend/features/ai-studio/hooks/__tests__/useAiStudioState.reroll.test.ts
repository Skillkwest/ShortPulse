/**
 * Verifies reroll replay behavior stays strict, decoupled, and submit-path scoped.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioState } from "../useAiStudioState";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";

const submitTaskMock = vi.fn();
const findOutputByIdMock = vi.fn<(id: string) => StudioOutput | null>(() => null);

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../useAiStudioReferenceSelectionState", () => ({
  useAiStudioReferenceSelectionState: () => ({
    selectedTool: "create",
    setSelectedTool: vi.fn(),
    showCreateTools: true,
    setShowCreateTools: vi.fn(),
    videoReferenceImageUrl: null,
    motionReferenceVideoUrl: null,
    setMotionReferenceVideoUrl: vi.fn(),
    useReferenceImageIndicator: false,
    setUseReferenceImageIndicator: vi.fn(),
    detailOutputId: null,
    setDetailOutputId: vi.fn(),
    referenceImageUrl: null,
    setReferenceImageUrl: vi.fn(),
    extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
    setExtraImageUrl: vi.fn(),
    clearReferenceImages: vi.fn(),
    toggleReferenceIndicator: vi.fn(),
    resolveReferenceInputsForTool: vi.fn(() => []),
    isModelModalOpen: false,
    modelModalAnchor: null,
    modelModalContext: null,
    setIsModelModalOpen: vi.fn(),
    setModelModalAnchor: vi.fn(),
    openModelModal: vi.fn(),
    closeModelModal: vi.fn(),
  }),
}));

vi.mock("../useAiStudioWorkflowSettings", () => ({
  useAiStudioWorkflowSettings: () => ({
    hasPendingWorkflowRestore: false,
  }),
}));

vi.mock("../useAiStudioStateEffects", () => ({
  useAiStudioStateEffects: () => undefined,
}));

vi.mock("../useAiStudioOutputLifecycle", () => ({
  useAiStudioOutputLifecycle: () => ({
    updateOutputById: vi.fn(),
    findOutputById: findOutputByIdMock,
    deleteOutput: vi.fn(),
    notifyGenerationFailure: vi.fn(),
    updateOutputPrompt: vi.fn(),
  }),
}));

vi.mock("../useAiStudioPersistenceActions", () => ({
  useAiStudioPersistenceActions: () => ({
    markOutputSaved: vi.fn(),
    markOutputSaveFailed: vi.fn(),
    ensureGenerationRecord: vi.fn(async () => null),
    persistMediaUrls: vi.fn(async () => ({ mediaFileIds: [], errors: [], delivery: null })),
    saveActiveOutput: vi.fn(),
    saveReferenceToLibrary: vi.fn(),
    savePromptReference: vi.fn(),
    savePromptToLibrary: vi.fn(),
  }),
}));

vi.mock("../useAiStudioTaskOrchestration", () => ({
  useAiStudioTaskOrchestration: () => ({
    submitTask: submitTaskMock,
    onReferenceOutputMediaLoaded: vi.fn(),
    retryOutputStatus: vi.fn(),
  }),
}));

vi.mock("../useAiStudioGenerationPromptComposer", () => ({
  useAiStudioGenerationPromptComposer: () => ({
    generateOutput: vi.fn(),
    regenerateOutput: vi.fn(),
  }),
}));

const makeGeneratedImageOutput = (
  id: string,
  overrides: Partial<StudioOutput> = {}
): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "Now",
  mediaSource: "generated",
  ...overrides,
});

describe("useAiStudioState rerollOutputFromReplay", () => {
  beforeEach(() => {
    submitTaskMock.mockReset();
    findOutputByIdMock.mockReset();
    vi.mocked(addBreadcrumb).mockReset();
  });

  it("submits reroll using replay overrides when replay is valid", () => {
    findOutputByIdMock.mockReturnValue(
      makeGeneratedImageOutput("out-reroll-valid", {
        generationReplay: {
          version: 1,
          mode: "image",
          submitTool: "edit",
          modelId: "fal-ai/bytedance/seedream/v4.5/edit",
          displayPrompt: "Visible prompt",
          submissionPrompt: "Submission prompt with hidden context",
          aspect: "9:16",
          imageResolution: "auto_4K",
          referenceInputs: ["https://cdn.test/prepared-ref.png"],
          capturedAt: "2026-02-26T00:00:00.000Z",
        },
      })
    );

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.rerollOutputFromReplay(" out-reroll-valid ");
    });

    expect(submitTaskMock).toHaveBeenCalledWith(
      "Submission prompt with hidden context",
      ["https://cdn.test/prepared-ref.png"],
      {
        modeOverride: "image",
        selectedToolOverride: "edit",
        displayPromptOverride: "Visible prompt",
        characterContextOverride: undefined,
        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/edit",
        aspectOverride: "9:16",
        imageResolutionOverride: "auto_4K",
      }
    );
    expect(vi.mocked(addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "reroll_started",
      })
    );
  });

  it("shows notice and blocks submit when replay snapshot is missing", () => {
    findOutputByIdMock.mockReturnValue(
      makeGeneratedImageOutput("out-reroll-missing-replay", {
        generationReplay: undefined,
      })
    );

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.rerollOutputFromReplay("out-reroll-missing-replay");
    });

    expect(submitTaskMock).not.toHaveBeenCalled();
    expect(result.current.uiNotice).toBe(
      "Re-roll is unavailable because original generation settings are missing."
    );
    expect(vi.mocked(addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "reroll_blocked_missing_or_invalid_replay",
      })
    );
  });

  it("shows notice and blocks submit when replay references are local-only URLs", () => {
    findOutputByIdMock.mockReturnValue(
      makeGeneratedImageOutput("out-reroll-local-ref", {
        generationReplay: {
          version: 1,
          mode: "image",
          submitTool: "edit",
          modelId: "fal-ai/bytedance/seedream/v4.5/edit",
          displayPrompt: "Visible prompt",
          submissionPrompt: "Submission prompt",
          aspect: "9:16",
          imageResolution: "auto_4K",
          referenceInputs: ["blob:local-preview-reference"],
          capturedAt: "2026-02-26T00:00:00.000Z",
        },
      })
    );

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.rerollOutputFromReplay("out-reroll-local-ref");
    });

    expect(submitTaskMock).not.toHaveBeenCalled();
    expect(result.current.uiNotice).toBe(
      "Re-roll is unavailable because original reference media are no longer accessible."
    );
    expect(vi.mocked(addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "reroll_blocked_missing_or_invalid_replay",
        data: expect.objectContaining({
          reason: "local_reference",
        }),
      })
    );
  });
});
