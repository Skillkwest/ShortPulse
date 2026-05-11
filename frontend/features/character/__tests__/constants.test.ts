/**
 * Regression coverage for Character workflow default-model wiring.
 */
import { describe, expect, it } from "vitest";
import {
  characterModelOptions,
  defaultCharacterEditModel,
  defaultCharacterModel,
  defaultCharacterTextModel,
} from "../constants";

describe("character constants", () => {
  it("keeps character defaults aligned with the catalog-backed Seedream pair", () => {
    expect(defaultCharacterTextModel).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
    expect(defaultCharacterEditModel).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(defaultCharacterModel).toBe(defaultCharacterTextModel);
  });

  it("exposes the canonical character model options in the existing order", () => {
    expect(characterModelOptions.map((option) => option.value)).toEqual([
      defaultCharacterTextModel,
      defaultCharacterEditModel,
    ]);
  });
});
