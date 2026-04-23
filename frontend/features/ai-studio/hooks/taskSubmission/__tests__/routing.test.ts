import { describe, expect, it } from "vitest";
import { resolveSubmissionHandlerRoute } from "../routing";

describe("resolveSubmissionHandlerRoute", () => {
  it("routes known video models to video handler", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/veo3.1")).toBe("video");
    expect(resolveSubmissionHandlerRoute("fal-ai/kling-video/v3/pro/image-to-video")).toBe("video");
    expect(resolveSubmissionHandlerRoute("kie-ai/seedance-2")).toBe("video");
    expect(resolveSubmissionHandlerRoute("kie-ai/seedance-2-fast")).toBe("video");
  });

  it("routes known image/edit models to image handler", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/bria/background/remove")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/flux-2/klein/9b")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/bytedance/seedream/v4.5/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/nano-banana-2/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/nano-banana-pro/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/bytedance/seedream/v5/lite/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/flux-pro/v1/fill")).toBe("image");
  });

  it("routes unknown and fallback models to default handler", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/kling-video/v3/pro/nonexistent")).toBe("default");
    expect(resolveSubmissionHandlerRoute("fal-ai/nano-banana")).toBe("default");
    expect(resolveSubmissionHandlerRoute("legacy/provider-image")).toBe("default");
    expect(resolveSubmissionHandlerRoute("custom/unknown-model")).toBe("default");
  });
});
