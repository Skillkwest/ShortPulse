import { describe, expect, it } from "vitest";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_EDIT_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
  FAL_SEEDREAM_45_TEXT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "../falModelIds";

describe("falModelIds", () => {
  it("exports the canonical active Fal image picker model ids", () => {
    expect(FAL_FLUX_2_KLEIN_9B_MODEL_ID).toBe("fal-ai/flux-2/klein/9b");
    expect(FAL_NANO_BANANA_2_MODEL_ID).toBe("fal-ai/nano-banana-2");
    expect(FAL_NANO_BANANA_2_EDIT_MODEL_ID).toBe("fal-ai/nano-banana-2/edit");
    expect(FAL_NANO_BANANA_PRO_MODEL_ID).toBe("fal-ai/nano-banana-pro");
    expect(FAL_NANO_BANANA_PRO_EDIT_MODEL_ID).toBe("fal-ai/nano-banana-pro/edit");
    expect(FAL_SEEDREAM_45_TEXT_MODEL_ID).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
    expect(FAL_SEEDREAM_45_EDIT_MODEL_ID).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID).toBe(
      "fal-ai/bytedance/seedream/v5/lite/text-to-image"
    );
    expect(FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID).toBe("fal-ai/bytedance/seedream/v5/lite/edit");
  });
});
