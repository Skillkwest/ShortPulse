import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleDefaultModelSubmission } from "../defaultHandlers";
import { handleImageModelSubmission } from "../imageHandlers";
import type { ImageSubmissionArgs } from "../types";
import { getModelConfig } from "../../../logic/modelRegistry";
import {
  submitOpenAiGptImage2,
  submitOpenAiGptImage2Edit,
} from "../../../../../lib/openAiImageClient";

const falClientMocks = vi.hoisted(() => ({
  submitFalSeedream: vi.fn(),
  submitFalSeedreamEdit: vi.fn(),
  submitFalSeedreamV5Lite: vi.fn(),
  submitFalSeedreamV5LiteEdit: vi.fn(),
  submitFalNanoBanana2: vi.fn(),
  submitFalNanoBananaPro: vi.fn(),
  submitFalNanoBanana2Edit: vi.fn(),
  submitFalNanoBananaProEdit: vi.fn(),
  submitFalFlux2Klein: vi.fn(),
}));

vi.mock("../../../../../lib/falClient", () => {
  const submitQueuedGenerationByModelId = vi.fn((modelId: string, payload: unknown) => {
    switch (modelId) {
      case "fal-ai/bytedance/seedream/v4.5/text-to-image":
        return falClientMocks.submitFalSeedream(payload);
      case "fal-ai/bytedance/seedream/v5/lite/text-to-image":
        return falClientMocks.submitFalSeedreamV5Lite(payload);
      case "fal-ai/nano-banana-2":
        return falClientMocks.submitFalNanoBanana2(payload);
      case "fal-ai/nano-banana-pro":
        return falClientMocks.submitFalNanoBananaPro(payload);
      case "fal-ai/bytedance/seedream/v4.5/edit":
        return falClientMocks.submitFalSeedreamEdit(payload);
      case "fal-ai/bytedance/seedream/v5/lite/edit":
        return falClientMocks.submitFalSeedreamV5LiteEdit(payload);
      case "fal-ai/nano-banana-2/edit":
        return falClientMocks.submitFalNanoBanana2Edit(payload);
      case "fal-ai/nano-banana-pro/edit":
        return falClientMocks.submitFalNanoBananaProEdit(payload);
      case "fal-ai/flux-2/klein/9b":
        return falClientMocks.submitFalFlux2Klein(payload);
      default:
        return Promise.reject(new Error(`Unhandled queued submit model ${modelId}`));
    }
  });
  return {
    submitQueuedGenerationByModelId,
  };
});

vi.mock("../../../../../lib/openAiImageClient", () => ({
  submitOpenAiGptImage2: vi.fn(),
  submitOpenAiGptImage2Edit: vi.fn(),
}));

const {
  submitFalSeedream,
  submitFalSeedreamEdit,
  submitFalSeedreamV5Lite,
  submitFalSeedreamV5LiteEdit,
  submitFalNanoBanana2,
  submitFalNanoBananaPro,
  submitFalNanoBanana2Edit,
  submitFalNanoBananaProEdit,
  submitFalFlux2Klein,
} = falClientMocks;

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
    vi.mocked(submitFalSeedreamV5Lite).mockResolvedValue({ request_id: "seedream-v5-lite-req" });
    vi.mocked(submitFalSeedreamV5LiteEdit).mockResolvedValue({
      request_id: "seedream-v5-lite-edit-req",
    });
    vi.mocked(submitFalNanoBanana2).mockResolvedValue({ request_id: "nano-2-req" });
    vi.mocked(submitFalNanoBananaPro).mockResolvedValue({ request_id: "nano-pro-req" });
    vi.mocked(submitFalNanoBanana2Edit).mockResolvedValue({ request_id: "nano-2-edit-req" });
    vi.mocked(submitFalNanoBananaProEdit).mockResolvedValue({ request_id: "nano-pro-edit-req" });
    vi.mocked(submitFalFlux2Klein).mockResolvedValue({ request_id: "flux2-klein-req" });
    vi.mocked(submitOpenAiGptImage2).mockResolvedValue({
      output: {
        provider: "openai-image",
        mode: "image",
        generationId: "openai-gen-1",
        mediaFileId: "media-openai-1",
        requestId: "openai-request-1",
        previewUrl: "https://cdn.test/openai-preview.png",
        resultUrls: ["https://cdn.test/openai-preview.png"],
        previewStoragePath: "user-1/generations/images/openai-preview.png",
        fullStoragePath: "user-1/generations/images/openai-full.png",
        mimeType: "image/png",
        modelId: "gpt-image-2",
        savedMediaIds: ["media-openai-1"],
      },
    });
    vi.mocked(submitOpenAiGptImage2Edit).mockResolvedValue({
      output: {
        provider: "openai-image",
        mode: "image",
        generationId: "openai-gen-1",
        mediaFileId: "media-openai-1",
        requestId: "openai-request-1",
        previewUrl: "https://cdn.test/openai-preview.png",
        resultUrls: ["https://cdn.test/openai-preview.png"],
        previewStoragePath: "user-1/generations/images/openai-preview.png",
        fullStoragePath: "user-1/generations/images/openai-full.png",
        mimeType: "image/png",
        modelId: "gpt-image-2",
        savedMediaIds: ["media-openai-1"],
      },
    });
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
        enable_safety_checker: true,
      })
    );
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "seedream-req",
      "fal-seedream",
      undefined,
      {
        request_id: "seedream-req",
      }
    );
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
    expect(payload?.enable_safety_checker).toBe(true);
  });

  it("sends aspect-locked auto_3K dimensions in Seedream 5 Lite text payload", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
      modelConfig: getModelConfig("fal-ai/bytedance/seedream/v5/lite/text-to-image"),
      aspect: "16:9",
      requestedResolution: "auto_3K",
    });

    await handleDefaultModelSubmission(args);

    const payload = vi.mocked(submitFalSeedreamV5Lite).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expectAspectLockedAutoSize(payload?.image_size, "16:9");
    expect(payload?.enable_safety_checker).toBe(true);
    expect(payload).not.toHaveProperty("output_format");
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "seedream-v5-lite-req",
      "fal-seedream-v5-lite",
      undefined,
      {
        request_id: "seedream-v5-lite-req",
      }
    );
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
        enable_safety_checker: true,
      })
    );
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "seedream-edit-req",
      "fal-seedream-edit",
      undefined,
      {
        request_id: "seedream-edit-req",
      }
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
    expect(payload?.enable_safety_checker).toBe(true);
  });

  it("sends aspect-locked auto_3K dimensions in Seedream 5 Lite edit payload", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/bytedance/seedream/v5/lite/edit",
      modelConfig: getModelConfig("fal-ai/bytedance/seedream/v5/lite/edit"),
      aspect: "9:16",
      requestedResolution: "auto_3K",
      preparedImageInputs: ["https://cdn.test/ref-1.png"],
    });

    await handleImageModelSubmission(args);

    const payload = vi.mocked(submitFalSeedreamV5LiteEdit).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expectAspectLockedAutoSize(payload?.image_size, "9:16");
    expect(payload?.enable_safety_checker).toBe(true);
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "seedream-v5-lite-edit-req",
      "fal-seedream-v5-lite-edit",
      undefined,
      {
        request_id: "seedream-v5-lite-edit-req",
      }
    );
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

  it("completes gpt-image-2 submissions immediately without starting polling", async () => {
    const completeGenerationImmediately = vi.fn();
    const args = makeArgs({
      finalModel: "gpt-image-2",
      modelConfig: getModelConfig("gpt-image-2"),
      aspect: "9:16",
      requestedResolution: "high",
      preparedImageInputs: [],
      falReferencePayload: {},
      generationReplay: { source: "reference-grid-reroll" },
      shortpulseContext: { surface: "ai-studio-create" },
      completeGenerationImmediately,
    });

    await handleDefaultModelSubmission(args);

    expect(submitOpenAiGptImage2).toHaveBeenCalledWith({
      prompt: "A polished portrait",
      size: "1024x1536",
      quality: "high",
      generation_replay: { source: "reference-grid-reroll" },
      shortpulse_context: { surface: "ai-studio-create" },
    });
    expect(completeGenerationImmediately).toHaveBeenCalledWith({
      provider: "openai-image",
      generationId: "openai-gen-1",
      requestId: "openai-request-1",
      previewUrl: "https://cdn.test/openai-preview.png",
      resultUrls: ["https://cdn.test/openai-preview.png"],
      previewStoragePath: "user-1/generations/images/openai-preview.png",
      fullStoragePath: "user-1/generations/images/openai-full.png",
      mimeType: "image/png",
      savedMediaIds: ["media-openai-1"],
    });
    expect(args.startPollingWithGeneration).not.toHaveBeenCalled();
  });

  it("routes gpt-image-2 reference-image edits through the OpenAI edit lane", async () => {
    const completeGenerationImmediately = vi.fn();
    const args = makeArgs({
      finalModel: "gpt-image-2",
      modelConfig: getModelConfig("gpt-image-2"),
      aspect: "16:9",
      requestedResolution: "medium",
      preparedImageInputs: ["https://cdn.test/ref-1.png", "https://cdn.test/ref-2.png"],
      falReferencePayload: {},
      shortpulseContext: { surface: "ai-studio-edit" },
      completeGenerationImmediately,
    });

    await handleDefaultModelSubmission(args);

    expect(submitOpenAiGptImage2Edit).toHaveBeenCalledWith({
      prompt: "A polished portrait",
      size: "1536x1024",
      quality: "medium",
      images: [
        { image_url: "https://cdn.test/ref-1.png" },
        { image_url: "https://cdn.test/ref-2.png" },
      ],
      shortpulse_context: { surface: "ai-studio-edit" },
    });
    expect(submitOpenAiGptImage2).not.toHaveBeenCalled();
    expect(completeGenerationImmediately).toHaveBeenCalledOnce();
    expect(args.startPollingWithGeneration).not.toHaveBeenCalled();
  });
});
