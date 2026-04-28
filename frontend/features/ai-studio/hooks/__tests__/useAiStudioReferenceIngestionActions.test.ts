import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioReferenceIngestionActions } from "../useAiStudioReferenceIngestionActions";
import type { StudioOutput } from "../../types";

const makeOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "A portrait reference",
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/flux/dev",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  previewUrl: "https://cdn.test/out-1.png",
  ...overrides,
});

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioReferenceIngestionActions>[0]> = {}
): Parameters<typeof useAiStudioReferenceIngestionActions>[0] => ({
  activeOutput: makeOutput(),
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/flux/dev",
  setOutputs: vi.fn(),
  updateOutputById: vi.fn(),
  setSharedPrompt: vi.fn(),
  setUiError: vi.fn(),
  ...overrides,
});

describe("useAiStudioReferenceIngestionActions", () => {
  it("does not use the active output as default agent image context", () => {
    const { result } = renderHook(() => useAiStudioReferenceIngestionActions(createParams()));

    expect(
      result.current.getAgentContext({
        lastAssistantMessage: "Upload your image to get the process started :)",
        selectedOverride: undefined,
        modeHint: "chat",
      })
    ).toEqual(
      expect.objectContaining({
        focusedSource: "agent-output",
        focusedReferenceId: null,
        selectedReferenceIds: [],
        media: [],
      })
    );
  });

  it("allows callers to opt into active output image context", () => {
    const { result } = renderHook(() => useAiStudioReferenceIngestionActions(createParams()));

    expect(
      result.current.getAgentContext({
        lastAssistantMessage: "Upload your image to get the process started :)",
        includeActiveOutput: true,
        modeHint: "chat",
      })
    ).toEqual(
      expect.objectContaining({
        focusedSource: "image",
        focusedReferenceId: "out-1",
        selectedReferenceIds: ["out-1"],
        media: [
          expect.objectContaining({
            id: "out-1",
            kind: "image",
            url: "https://cdn.test/out-1.png",
          }),
        ],
      })
    );
  });

  it("allows callers to explicitly clear selected image context", () => {
    const { result } = renderHook(() => useAiStudioReferenceIngestionActions(createParams()));

    expect(
      result.current.getAgentContext({
        lastAssistantMessage: "Previous assistant turn",
        selectedOverride: null,
      })
    ).toEqual(
      expect.objectContaining({
        focusedSource: "agent-output",
        focusedReferenceId: null,
        media: [],
        selectedReferenceIds: [],
        activePrompt: "Previous assistant turn",
      })
    );
  });
});
