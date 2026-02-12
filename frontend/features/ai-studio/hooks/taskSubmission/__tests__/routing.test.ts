import { describe, expect, it } from "vitest";
import { resolveSubmissionHandlerRoute } from "../routing";

describe("resolveSubmissionHandlerRoute", () => {
  it("routes known video models to video handler", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/veo3.1")).toBe("video");
    expect(resolveSubmissionHandlerRoute("fal-ai/kling-video/v3/pro/image-to-video")).toBe("video");
    expect(resolveSubmissionHandlerRoute("fal-ai/sora-2/text-to-video/pro")).toBe("video");
  });

  it("routes known image/edit models to image handler", () => {
    expect(resolveSubmissionHandlerRoute("fal/flux-2")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal/flux-2/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/nano-banana-pro/edit")).toBe("image");
  });

  it("routes unknown and fallback models to default handler", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/kling-video/v3/pro/nonexistent")).toBe("default");
    expect(resolveSubmissionHandlerRoute("fal-ai/nano-banana")).toBe("default");
    expect(resolveSubmissionHandlerRoute("kei/gpt4o-image")).toBe("default");
    expect(resolveSubmissionHandlerRoute("custom/unknown-model")).toBe("default");
  });
});
