import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCharacterWorkflow } from "../useCharacterWorkflow";
import { maybePreprocessLocalImageFileForUpload } from "../../../../lib/adaptive-media/localTranscode";

vi.mock("../../../../lib/adaptive-media/localTranscode", () => ({
  maybePreprocessLocalImageFileForUpload: vi.fn(async (file: File) => file),
}));

vi.mock("../../logic/storage", () => ({
  characterStorage: {
    loadCharacter: vi.fn(async () => null),
    saveCharacter: vi.fn(async () => undefined),
  },
}));

vi.mock("../../logic/identity", async () => {
  const actual =
    await vi.importActual<typeof import("../../logic/identity")>("../../logic/identity");
  return {
    ...actual,
    checkIdentityCapabilities: vi.fn(async () => ({
      hasWebGpu: false,
      modelsAvailable: false,
      message: undefined,
    })),
  };
});

describe("useCharacterWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preprocesses uploaded reference images before storing preview urls", async () => {
    const processedFile = new File(["processed"], "processed.webp", { type: "image/webp" });
    vi.mocked(maybePreprocessLocalImageFileForUpload).mockResolvedValueOnce(processedFile);
    const createObjectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:processed-reference");

    const { result } = renderHook(() => useCharacterWorkflow());
    const rawFile = new File(["raw"], "reference.png", { type: "image/png" });

    act(() => {
      result.current.addReferences([rawFile]);
    });

    await waitFor(() => {
      expect(result.current.identity.references).toHaveLength(1);
    });

    expect(maybePreprocessLocalImageFileForUpload).toHaveBeenCalledWith(rawFile);
    expect(createObjectUrlSpy).toHaveBeenCalledWith(processedFile);
    expect(result.current.identity.references[0]).toMatchObject({
      url: "blob:processed-reference",
      name: "processed.webp",
      source: "upload",
    });

    createObjectUrlSpy.mockRestore();
  });
});
