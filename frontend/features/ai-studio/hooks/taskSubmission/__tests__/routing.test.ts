import { describe, expect, it } from "vitest";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_EDIT_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
} from "../../../../../lib/model-runtime/falModelIds";
import {
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../../../lib/model-runtime/providerModelIds";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../../lib/model-runtime/openAiImage2";
import { resolveSubmissionHandlerRoute } from "../routing";

describe("resolveSubmissionHandlerRoute", () => {
  it("routes known video models to video handler", () => {
    expect(resolveSubmissionHandlerRoute(KIE_SEEDANCE_2_MODEL_ID)).toBe("video");
    expect(resolveSubmissionHandlerRoute(KIE_SEEDANCE_2_FAST_MODEL_ID)).toBe("video");
  });

  it("does not route retired Fal video models to the video handler", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/veo3.1")).toBe("unsupported");
    expect(resolveSubmissionHandlerRoute("fal-ai/veo3.1/image-to-video")).toBe("unsupported");
    expect(resolveSubmissionHandlerRoute("fal-ai/veo3.1/first-last-frame-to-video")).toBe(
      "unsupported"
    );
    expect(resolveSubmissionHandlerRoute("fal-ai/kling-video/v3/pro/text-to-video")).toBe(
      "unsupported"
    );
    expect(resolveSubmissionHandlerRoute("fal-ai/kling-video/v3/pro/image-to-video")).toBe(
      "unsupported"
    );
    expect(resolveSubmissionHandlerRoute("fal-ai/bytedance/seedance/v1.5/pro/text-to-video")).toBe(
      "unsupported"
    );
    expect(resolveSubmissionHandlerRoute("fal-ai/bytedance/seedance/v1.5/pro/image-to-video")).toBe(
      "unsupported"
    );
  });

  it("routes known image/edit models to image handler", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/bria/background/remove")).toBe("image");
    expect(resolveSubmissionHandlerRoute(FAL_FLUX_2_KLEIN_9B_MODEL_ID)).toBe("image");
    expect(resolveSubmissionHandlerRoute(FAL_SEEDREAM_45_EDIT_MODEL_ID)).toBe("image");
    expect(resolveSubmissionHandlerRoute(FAL_NANO_BANANA_2_EDIT_MODEL_ID)).toBe("image");
    expect(resolveSubmissionHandlerRoute(FAL_NANO_BANANA_PRO_EDIT_MODEL_ID)).toBe("image");
    expect(resolveSubmissionHandlerRoute(FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID)).toBe("image");
  });

  it("does not route disabled inpaint models to any submission handler", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/flux-pro/v1/fill")).toBe("unsupported");
    expect(resolveSubmissionHandlerRoute("fal-ai/flux-kontext-lora/inpaint")).toBe("unsupported");
  });

  it("only routes catalog models through supported AI Studio handlers", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/kling-video/v3/pro/nonexistent")).toBe(
      "unsupported"
    );
    expect(resolveSubmissionHandlerRoute(FAL_NANO_BANANA_2_MODEL_ID)).toBe("default");
    expect(resolveSubmissionHandlerRoute(OPENAI_GPT_IMAGE_2_MODEL_ID)).toBe("default");
    expect(resolveSubmissionHandlerRoute("legacy/provider-image")).toBe("unsupported");
    expect(resolveSubmissionHandlerRoute("custom/unknown-model")).toBe("unsupported");
  });
});
