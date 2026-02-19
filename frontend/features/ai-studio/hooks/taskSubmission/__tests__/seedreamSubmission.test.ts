import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleDefaultModelSubmission } from "../defaultHandlers";
import { handleImageModelSubmission } from "../imageHandlers";
import type { ImageSubmissionArgs } from "../types";
import { getModelConfig } from "../../../logic/modelRegistry";
import {
  submitFalSeedream,
  submitFalSeedreamEdit,
  submitFalNanoBanana,
  submitFalNanoBananaPro,
  submitFalNanoBananaEdit,
  submitFalNanoBananaProEdit,
  submitFalFlux2,
  submitFalFlux2Klein,
  submitFalFlux2Edit,
  submitFalFlux2Pro,
  submitFalFlux2ProEdit,
} from "../../../../../lib/falClient";

vi.mock("../../../../../lib/falClient", () => ({
  submitFalSeedream: vi.fn(),
  submitFalSeedreamEdit: vi.fn(),
  submitFalNanoBanana: vi.fn(),
  submitFalNanoBananaPro: vi.fn(),
  submitFalNanoBananaEdit: vi.fn(),
  submitFalNanoBananaProEdit: vi.fn(),
  submitFalFlux2: vi.fn(),
  submitFalFlux2Klein: vi.fn(),
  submitFalFlux2Edit: vi.fn(),
  submitFalFlux2Pro: vi.fn(),
  submitFalFlux2ProEdit: vi.fn(),
}));

const makeArgs = (overrides: Partial<ImageSubmissionArgs> = {}): ImageSubmissionArgs => ({
  id: "out-1",
  finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
  cleanedPrompt: "A polished portrait",
  aspect: "5:4",
  requestedDurationSeconds: 8,
  requestedResolution: "model_default",
  requestedAudio: false,
  preparedImageInputs: ["https://cdn.test/ref.png"],
  modelConfig: getModelConfig("fal-ai/bytedance/seedream/v4.5/edit"),
  notifyGenerationFailure: vi.fn(),
  updateOutputById: vi.fn(),
  startPollingWithGeneration: vi.fn(),
  falReferencePayload: {},
  ...overrides,
});

describe("Seedream submission payloads", () => {
  const parseAspect = (aspect: string): number => {
    const [widthToken, heightToken] = aspect.split(":");
    return Number(widthToken) / Number(heightToken);
  };

  const expectAspectLockedAutoSize = (imageSize: unknown, aspect: string) => {
    expect(typeof imageSize).toBe("object");
    expect(imageSize).not.toBeNull();
    if (!imageSize || typeof imageSize !== "object") return;
    const width = (imageSize as { width?: number }).width;
    const height = (imageSize as { height?: number }).height;
    expect(typeof width).toBe("number");
    expect(typeof height).toBe("number");
    if (typeof width !== "number" || typeof height !== "number") return;
    expect(width).toBeGreaterThanOrEqual(256);
    expect(width).toBeLessThanOrEqual(4096);
    expect(height).toBeGreaterThanOrEqual(256);
    expect(height).toBeLessThanOrEqual(4096);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
    expect(Math.abs(width / height - parseAspect(aspect))).toBeLessThanOrEqual(0.02);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(submitFalSeedream).mockResolvedValue({ request_id: "seedream-req" });
    vi.mocked(submitFalSeedreamEdit).mockResolvedValue({ request_id: "seedream-edit-req" });
    vi.mocked(submitFalNanoBanana).mockResolvedValue({ request_id: "nano-req" });
    vi.mocked(submitFalNanoBananaPro).mockResolvedValue({ request_id: "nano-pro-req" });
    vi.mocked(submitFalNanoBananaEdit).mockResolvedValue({ request_id: "nano-edit-req" });
    vi.mocked(submitFalNanoBananaProEdit).mockResolvedValue({ request_id: "nano-pro-edit-req" });
    vi.mocked(submitFalFlux2).mockResolvedValue({ request_id: "flux2-req" });
    vi.mocked(submitFalFlux2Klein).mockResolvedValue({ request_id: "flux2-klein-req" });
    vi.mocked(submitFalFlux2Edit).mockResolvedValue({ request_id: "flux2-edit-req" });
    vi.mocked(submitFalFlux2Pro).mockResolvedValue({ request_id: "flux2-pro-req" });
    vi.mocked(submitFalFlux2ProEdit).mockResolvedValue({ request_id: "flux2-pro-edit-req" });
  });

  it("sends exact custom Seedream image_size for 5:4 text-to-image", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      modelConfig: getModelConfig("fal-ai/bytedance/seedream/v4.5/text-to-image"),
    });

    await handleDefaultModelSubmission(args);

    expect(submitFalSeedream).toHaveBeenCalledWith(
      expect.objectContaining({
        image_size: { width: 2400, height: 1920 },
      })
    );
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith("seedream-req", "fal-seedream");
  });

  it("sends aspect-locked auto_4K dimensions in text-to-image payload", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      modelConfig: getModelConfig("fal-ai/bytedance/seedream/v4.5/text-to-image"),
      aspect: "16:9",
      requestedResolution: "auto_4K",
    });

    await handleDefaultModelSubmission(args);

    const payload = vi.mocked(submitFalSeedream).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expectAspectLockedAutoSize(payload?.image_size, "16:9");
  });

  it("sends exact custom Seedream image_size for 5:4 edit payload", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
      modelConfig: getModelConfig("fal-ai/bytedance/seedream/v4.5/edit"),
      preparedImageInputs: ["https://cdn.test/ref-1.png"],
    });

    const handled = await handleImageModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitFalSeedreamEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        image_size: { width: 2400, height: 1920 },
      })
    );
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "seedream-edit-req",
      "fal-seedream"
    );
  });

  it("sends aspect-locked auto_2K dimensions in edit payload", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
      modelConfig: getModelConfig("fal-ai/bytedance/seedream/v4.5/edit"),
      aspect: "9:16",
      requestedResolution: "auto_2K",
      preparedImageInputs: ["https://cdn.test/ref-1.png"],
    });

    await handleImageModelSubmission(args);

    const payload = vi.mocked(submitFalSeedreamEdit).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expectAspectLockedAutoSize(payload?.image_size, "9:16");
  });

  it("keeps orientation aligned for Seedream edit auto_4K across landscape and portrait", async () => {
    const landscapeArgs = makeArgs({
      finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
      modelConfig: getModelConfig("fal-ai/bytedance/seedream/v4.5/edit"),
      aspect: "16:9",
      requestedResolution: "auto_4K",
      preparedImageInputs: ["https://cdn.test/ref-landscape.png"],
    });
    const portraitArgs = makeArgs({
      finalModel: "fal-ai/bytedance/seedream/v4.5/edit",
      modelConfig: getModelConfig("fal-ai/bytedance/seedream/v4.5/edit"),
      aspect: "9:16",
      requestedResolution: "auto_4K",
      preparedImageInputs: ["https://cdn.test/ref-portrait.png"],
    });

    await handleImageModelSubmission(landscapeArgs);
    await handleImageModelSubmission(portraitArgs);

    const landscapePayload = vi.mocked(submitFalSeedreamEdit).mock.calls[0]?.[0];
    const portraitPayload = vi.mocked(submitFalSeedreamEdit).mock.calls[1]?.[0];

    expectAspectLockedAutoSize(landscapePayload?.image_size, "16:9");
    expectAspectLockedAutoSize(portraitPayload?.image_size, "9:16");
  });
});
