import { describe, expect, it } from "vitest";
import { resolveSubmissionHandlerRoute } from "../routing";

describe("resolveSubmissionHandlerRoute", () => {
  it("routes known video models to video handler", () => {
    expect(resolveSubmissionHandlerRoute("kie-ai/seedance-2")).toBe("video");
    expect(resolveSubmissionHandlerRoute("kie-ai/seedance-2-fast")).toBe("video");
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
    expect(resolveSubmissionHandlerRoute("fal-ai/flux-2/klein/9b")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/bytedance/seedream/v4.5/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/nano-banana-2/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/nano-banana-pro/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/bytedance/seedream/v5/lite/edit")).toBe("image");
    expect(resolveSubmissionHandlerRoute("fal-ai/flux-pro/v1/fill")).toBe("image");
  });

  it("only routes catalog models through supported AI Studio handlers", () => {
    expect(resolveSubmissionHandlerRoute("fal-ai/kling-video/v3/pro/nonexistent")).toBe(
      "unsupported"
    );
    expect(resolveSubmissionHandlerRoute("fal-ai/nano-banana")).toBe("default");
    expect(resolveSubmissionHandlerRoute("gpt-image-2")).toBe("default");
    expect(resolveSubmissionHandlerRoute("legacy/provider-image")).toBe("unsupported");
    expect(resolveSubmissionHandlerRoute("custom/unknown-model")).toBe("unsupported");
  });
});
