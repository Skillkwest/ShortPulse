import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleDefaultModelSubmission } from "../defaultHandlers";
import { handleImageModelSubmission } from "../imageHandlers";
import type { ImageSubmissionArgs } from "../types";
import { getModelConfig } from "../../../logic/modelRegistry";
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
} from "../../../../../lib/model-runtime/falModelIds";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../../lib/model-runtime/openAiImage2";
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
      case FAL_SEEDREAM_45_TEXT_MODEL_ID:
        return falClientMocks.submitFalSeedream(payload);
      case FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID:
        return falClientMocks.submitFalSeedreamV5Lite(payload);
      case FAL_NANO_BANANA_2_MODEL_ID:
        return falClientMocks.submitFalNanoBanana2(payload);
      case FAL_NANO_BANANA_PRO_MODEL_ID:
        return falClientMocks.submitFalNanoBananaPro(payload);
      case FAL_SEEDREAM_45_EDIT_MODEL_ID:
        return falClientMocks.submitFalSeedreamEdit(payload);
      case FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID:
        return falClientMocks.submitFalSeedreamV5LiteEdit(payload);
      case FAL_NANO_BANANA_2_EDIT_MODEL_ID:
        return falClientMocks.submitFalNanoBanana2Edit(payload);
      case FAL_NANO_BANANA_PRO_EDIT_MODEL_ID:
        return falClientMocks.submitFalNanoBananaProEdit(payload);
      case FAL_FLUX_2_KLEIN_9B_MODEL_ID:
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
  finalModel: FAL_SEEDREAM_45_EDIT_MODEL_ID,
  cleanedPrompt: "A polished portrait",
  aspect: "5:4",
  requestedDurationSeconds: 8,
  requestedResolution: "model_default",
  requestedAudio: false,
  preparedImageInputs: ["https://cdn.test/ref.png"],
  modelConfig: getModelConfig(FAL_SEEDREAM_45_EDIT_MODEL_ID),
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
        modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
        savedMediaIds: ["media-openai-1"],
        saveState: "saved",
        saveError: null,
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
        modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
        savedMediaIds: ["media-openai-1"],
        saveState: "saved",
        saveError: null,
      },
    });
  });

  it("sends exact custom Seedream image_size for 5:4 text-to-image", async () => {
    const args = makeArgs({
      finalModel: FAL_SEEDREAM_45_TEXT_MODEL_ID,
      modelConfig: getModelConfig(FAL_SEEDREAM_45_TEXT_MODEL_ID),
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
      finalModel: FAL_SEEDREAM_45_TEXT_MODEL_ID,
      modelConfig: getModelConfig(FAL_SEEDREAM_45_TEXT_MODEL_ID),
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
      finalModel: FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
      modelConfig: getModelConfig(FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID),
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
      finalModel: FAL_SEEDREAM_45_EDIT_MODEL_ID,
      modelConfig: getModelConfig(FAL_SEEDREAM_45_EDIT_MODEL_ID),
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
      finalModel: FAL_SEEDREAM_45_EDIT_MODEL_ID,
      modelConfig: getModelConfig(FAL_SEEDREAM_45_EDIT_MODEL_ID),
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
      finalModel: FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
      modelConfig: getModelConfig(FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID),
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
      finalModel: FAL_SEEDREAM_45_EDIT_MODEL_ID,
      modelConfig: getModelConfig(FAL_SEEDREAM_45_EDIT_MODEL_ID),
      aspect: "16:9",
      requestedResolution: "auto_4K",
      preparedImageInputs: ["https://cdn.test/ref-landscape.png"],
    });
    const portraitArgs = makeArgs({
      finalModel: FAL_SEEDREAM_45_EDIT_MODEL_ID,
      modelConfig: getModelConfig(FAL_SEEDREAM_45_EDIT_MODEL_ID),
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
      finalModel: OPENAI_GPT_IMAGE_2_MODEL_ID,
      modelConfig: getModelConfig(OPENAI_GPT_IMAGE_2_MODEL_ID),
      aspect: "9:16",
      requestedResolution: "4K",
      preparedImageInputs: [],
      falReferencePayload: {},
      generationReplay: { source: "reference-grid-reroll" },
      workflowReload: { source: "workflow-reload-test" },
      shortpulseContext: { surface: "ai-studio-create" },
      completeGenerationImmediately,
    });

    await handleDefaultModelSubmission(args);

    expect(submitOpenAiGptImage2).toHaveBeenCalledWith({
      prompt: "A polished portrait",
      size: "1024x1536",
      quality: "high",
      generation_replay: { source: "reference-grid-reroll" },
      workflow_reload: { source: "workflow-reload-test" },
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
      saveState: "saved",
      saveError: null,
    });
    expect(args.startPollingWithGeneration).not.toHaveBeenCalled();
  });

  it("routes gpt-image-2 reference-image edits through the OpenAI edit lane", async () => {
    const completeGenerationImmediately = vi.fn();
    const args = makeArgs({
      finalModel: OPENAI_GPT_IMAGE_2_MODEL_ID,
      modelConfig: getModelConfig(OPENAI_GPT_IMAGE_2_MODEL_ID),
      aspect: "16:9",
      requestedResolution: "2K",
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

  it("routes gpt-image-2 internal-only inpaint refs through the OpenAI edit lane", async () => {
    const completeGenerationImmediately = vi.fn();
    const args = makeArgs({
      finalModel: OPENAI_GPT_IMAGE_2_MODEL_ID,
      modelConfig: getModelConfig(OPENAI_GPT_IMAGE_2_MODEL_ID),
      aspect: "1:1",
      requestedResolution: "2K",
      preparedImageInputs: [],
      falReferencePayload: {},
      inpaintOverride: {
        baseImageInput: "",
        maskInput: "",
        referenceImageInput: "",
        baseImageInternalMediaRef: {
          version: 1,
          kind: "storage_object",
          bucket: "media_library",
          storagePath: "user-1/base.png",
        },
        maskInternalMediaRef: {
          version: 1,
          kind: "storage_object",
          bucket: "media_library",
          storagePath: "user-1/mask.png",
        },
        referenceImageInternalMediaRef: null,
      },
      completeGenerationImmediately,
    });

    await handleDefaultModelSubmission(args);

    expect(submitOpenAiGptImage2Edit).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A polished portrait",
        size: "1024x1024",
        quality: "medium",
        images: [],
        shortpulse_internal_edit_media_refs: {
          base_image: {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/base.png",
          },
          mask_image: {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/mask.png",
          },
          reference_image: null,
        },
      })
    );
    expect(submitOpenAiGptImage2).not.toHaveBeenCalled();
    expect(completeGenerationImmediately).toHaveBeenCalledOnce();
  });

  it("preserves reference payloads for Nano Banana 2 text submissions", async () => {
    const args = makeArgs({
      finalModel: FAL_NANO_BANANA_2_MODEL_ID,
      modelConfig: getModelConfig(FAL_NANO_BANANA_2_MODEL_ID),
      falReferencePayload: {
        image_url: "https://cdn.test/character-primary.png",
        image_urls: ["https://cdn.test/character-primary.png", "https://cdn.test/look-2.png"],
      },
    });

    await handleDefaultModelSubmission(args);

    expect(submitFalNanoBanana2).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: "https://cdn.test/character-primary.png",
        image_urls: ["https://cdn.test/character-primary.png", "https://cdn.test/look-2.png"],
      })
    );
  });
});
