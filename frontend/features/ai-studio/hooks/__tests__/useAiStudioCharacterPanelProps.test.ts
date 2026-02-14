import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CharacterIdentity } from "../../../character/types";
import { useAiStudioCharacterPanelProps } from "../useAiStudioCharacterPanelProps";

const createIdentity = (references: CharacterIdentity["references"] = []): CharacterIdentity => ({
  id: "char-1",
  name: "Character",
  embedding: null,
  embeddingStatus: "ready",
  identityToken: "token-1",
  quality: { acceptedRefs: references.length, rejectedRefs: 0, variance: 0 },
  references,
  createdAt: "2026-02-14T00:00:00.000Z",
});

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioCharacterPanelProps>[0]> = {}
): Parameters<typeof useAiStudioCharacterPanelProps>[0] => ({
  identity: createIdentity(),
  characterAspect: "1:1",
  characterModelId: "fal/flux-2-pro",
  characterEngine: "fal-edge",
  characterPrompt: "Prompt",
  characterPoseId: null,
  isBuildingIdentity: false,
  isCharacterGenerating: false,
  characterHasWebGpu: true,
  characterModelsAvailable: true,
  characterCapabilityMessage: undefined,
  setCharacterPrompt: vi.fn(),
  setCharacterAspect: vi.fn(),
  setCharacterModelId: vi.fn(),
  setCharacterEngine: vi.fn(),
  setCharacterPoseId: vi.fn(),
  addCharacterReferences: vi.fn(),
  removeCharacterReference: vi.fn(),
  buildCharacterIdentity: vi.fn(async () => undefined),
  generateCharacter: vi.fn(async () => undefined),
  triggerFilePicker: vi.fn(),
  ...overrides,
});

describe("useAiStudioCharacterPanelProps", () => {
  it("derives canBuildIdentity from reference count", () => {
    const { result, rerender } = renderHook(
      ({ references }: { references: CharacterIdentity["references"] }) =>
        useAiStudioCharacterPanelProps(
          createParams({
            identity: createIdentity(references),
          })
        ),
      { initialProps: { references: [] as CharacterIdentity["references"] } }
    );

    expect(result.current.canBuildIdentity).toBe(false);

    rerender({
      references: [{ id: "ref-1", url: "https://example.com/ref.png", source: "upload" }],
    });
    expect(result.current.canBuildIdentity).toBe(true);
  });

  it("routes model + generate actions to workflow handlers", () => {
    const setCharacterModelId = vi.fn();
    const generateCharacter = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useAiStudioCharacterPanelProps(
        createParams({
          setCharacterModelId,
          generateCharacter,
        })
      )
    );

    result.current.onModelChange("fal/flux-2-pro/edit");
    result.current.onGenerate();

    expect(setCharacterModelId).toHaveBeenCalledWith("fal/flux-2-pro/edit");
    expect(generateCharacter).toHaveBeenCalledTimes(1);
  });
});
