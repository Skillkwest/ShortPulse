/**
 * Submission payload contract matrix for AI Studio generation models.
 * Ensures each registered non-text model routes through the expected handler path
 * and carries required aspect/resolution/duration/audio/reference fields.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listModelConfigs, getModelConfig } from "../../../logic/modelRegistry";
import { getModelApiContract } from "../../../logic/modelApiContracts";
import {
  FAL_OMNIHUMAN_V15_MODEL_ID,
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
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
} from "../../../../../lib/model-runtime/providerModelIds";
import {
  handleDefaultModelSubmission,
  resolveDefaultSubmissionAdapterKey,
} from "../defaultHandlers";
import { handleImageModelSubmission, resolveImageSubmissionAdapterKey } from "../imageHandlers";
import { handleVideoModelSubmission, resolveVideoSubmissionAdapterKey } from "../videoHandlers";
import {
  createEmptyLipSyncAudioState,
  createReadyLipSyncAudioState,
} from "../../../logic/lipSyncAudioState";
import { resolveSubmissionHandlerRoute } from "../routing";
import type { ImageSubmissionArgs, VideoSubmissionArgs } from "../types";

const falClientMocks = vi.hoisted(() => ({
  submitFalBriaBackgroundRemove: vi.fn(),
  submitFalFlux2Klein: vi.fn(),
  submitFalOmniHuman: vi.fn(),
  submitFalNanoBanana2: vi.fn(),
  submitFalNanoBanana2Edit: vi.fn(),
  submitFalNanoBananaPro: vi.fn(),
  submitFalNanoBananaProEdit: vi.fn(),
  submitFalSeedream: vi.fn(),
  submitFalSeedreamEdit: vi.fn(),
  submitFalSeedreamV5Lite: vi.fn(),
  submitFalSeedreamV5LiteEdit: vi.fn(),
  submitKieGptImage2: vi.fn(),
  submitKieGptImage2Edit: vi.fn(),
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
      case "fal-ai/bria/background/remove":
        return falClientMocks.submitFalBriaBackgroundRemove(payload);
      case FAL_FLUX_2_KLEIN_9B_MODEL_ID:
        return falClientMocks.submitFalFlux2Klein(payload);
      case FAL_OMNIHUMAN_V15_MODEL_ID:
        return falClientMocks.submitFalOmniHuman(payload);
      case FAL_SEEDREAM_45_EDIT_MODEL_ID:
        return falClientMocks.submitFalSeedreamEdit(payload);
      case FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID:
        return falClientMocks.submitFalSeedreamV5LiteEdit(payload);
      case FAL_NANO_BANANA_2_EDIT_MODEL_ID:
        return falClientMocks.submitFalNanoBanana2Edit(payload);
      case FAL_NANO_BANANA_PRO_EDIT_MODEL_ID:
        return falClientMocks.submitFalNanoBananaProEdit(payload);
      case KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID:
        return falClientMocks.submitKieGptImage2(payload);
      case KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID:
        return falClientMocks.submitKieGptImage2Edit(payload);
      default:
        return Promise.reject(new Error(`Unhandled queued submit model ${modelId}`));
    }
  });
  return {
    submitQueuedGenerationByModelId,
  };
});

const {
  submitFalBriaBackgroundRemove,
  submitFalFlux2Klein,
  submitFalOmniHuman,
  submitFalNanoBanana2,
  submitFalNanoBanana2Edit,
  submitFalNanoBananaPro,
  submitFalNanoBananaProEdit,
  submitFalSeedream,
  submitFalSeedreamEdit,
  submitFalSeedreamV5Lite,
  submitFalSeedreamV5LiteEdit,
  submitKieGptImage2,
  submitKieGptImage2Edit,
} = falClientMocks;

type Route = "default" | "image" | "video";
type CaseConfig = {
  route: Route;
  submitName: string;
  requestedResolution?: string;
  expectsAudioField?: boolean;
  expectedSafetyChecker?: boolean;
  expectedSafetyTolerance?: "5" | 5;
  expectedReferenceField?:
    | "image_urls"
    | "input_urls"
    | "image_url"
    | "start_image_url"
    | "first_last_frame_urls"
    | "none";
};

const CASES: Record<string, CaseConfig> = {
  "fal-ai/bria/background/remove": {
    route: "image",
    submitName: "submitFalBriaBackgroundRemove",
    expectedReferenceField: "image_url",
  },
  [FAL_FLUX_2_KLEIN_9B_MODEL_ID]: {
    route: "image",
    submitName: "submitFalFlux2Klein",
    expectedSafetyChecker: false,
    expectedReferenceField: "none",
  },
  [FAL_OMNIHUMAN_V15_MODEL_ID]: {
    route: "video",
    submitName: "submitFalOmniHuman",
    requestedResolution: "720p",
    expectedReferenceField: "image_url",
  },
  [FAL_NANO_BANANA_PRO_MODEL_ID]: {
    route: "default",
    submitName: "submitFalNanoBananaPro",
    requestedResolution: "4K",
    expectedReferenceField: "none",
  },
  [FAL_NANO_BANANA_2_MODEL_ID]: {
    route: "default",
    submitName: "submitFalNanoBanana2",
    requestedResolution: "0.5K",
    expectedReferenceField: "none",
  },
  [FAL_NANO_BANANA_PRO_EDIT_MODEL_ID]: {
    route: "image",
    submitName: "submitFalNanoBananaProEdit",
    requestedResolution: "4K",
    expectedReferenceField: "image_urls",
  },
  [FAL_NANO_BANANA_2_EDIT_MODEL_ID]: {
    route: "image",
    submitName: "submitFalNanoBanana2Edit",
    requestedResolution: "0.5K",
    expectedReferenceField: "image_urls",
  },
  [FAL_SEEDREAM_45_TEXT_MODEL_ID]: {
    route: "default",
    submitName: "submitFalSeedream",
    requestedResolution: "auto_4K",
    expectedSafetyChecker: true,
    expectedReferenceField: "none",
  },
  [FAL_SEEDREAM_45_EDIT_MODEL_ID]: {
    route: "image",
    submitName: "submitFalSeedreamEdit",
    requestedResolution: "auto_4K",
    expectedSafetyChecker: true,
    expectedReferenceField: "image_urls",
  },
  [FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID]: {
    route: "default",
    submitName: "submitFalSeedreamV5Lite",
    requestedResolution: "auto_3K",
    expectedSafetyChecker: true,
    expectedReferenceField: "none",
  },
  [FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID]: {
    route: "image",
    submitName: "submitFalSeedreamV5LiteEdit",
    requestedResolution: "auto_3K",
    expectedSafetyChecker: true,
    expectedReferenceField: "image_urls",
  },
  [KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID]: {
    route: "default",
    submitName: "submitKieGptImage2",
    requestedResolution: "4K",
    expectedSafetyChecker: false,
    expectedSafetyTolerance: 5,
    expectedReferenceField: "none",
  },
  [KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID]: {
    route: "image",
    submitName: "submitKieGptImage2Edit",
    requestedResolution: "4K",
    expectedSafetyChecker: false,
    expectedSafetyTolerance: 5,
    expectedReferenceField: "input_urls",
  },
};

const parseAspectRatio = (aspect: string): number => {
  const [w, h] = aspect.split(":");
  return Number(w) / Number(h);
};

const seedreamAspect = "16:9";

const makeImageArgs = (
  modelId: string,
  requestedResolution: string | undefined
): ImageSubmissionArgs => ({
  id: "out-1",
  finalModel: modelId,
  cleanedPrompt: "Prompt payload check",
  aspect: seedreamAspect,
  requestedDurationSeconds: 8,
  requestedResolution,
  requestedAudio: true,
  preparedImageInputs: ["https://cdn.test/ref-1.png", "https://cdn.test/ref-2.png"],
  modelConfig: getModelConfig(modelId),
  notifyGenerationFailure: vi.fn(),
  updateOutputById: vi.fn(),
  startPollingWithGeneration: vi.fn(),
  shortpulseContext: {
    surface: "ai-studio-test",
    workspace_runtime_key: "session:matrix-session",
  },
  falReferencePayload: {
    image_url: "https://cdn.test/ref-1.png",
    image_urls: ["https://cdn.test/ref-1.png", "https://cdn.test/ref-2.png"],
  },
});

const makeVideoArgs = (
  modelId: string,
  requestedResolution: string | undefined
): VideoSubmissionArgs => {
  const isLipSync = modelId === FAL_OMNIHUMAN_V15_MODEL_ID;
  return {
    ...makeImageArgs(modelId, requestedResolution),
    preparedImageInputs: isLipSync
      ? ["https://v3.fal.media/files/lip-sync/ref-1.png"]
      : ["https://cdn.test/ref-1.png", "https://cdn.test/ref-2.png"],
    rawImageInputs: isLipSync ? ["https://v3.fal.media/files/lip-sync/ref-1.png"] : undefined,
    videoReferenceMode: isLipSync ? "lip-sync" : "standard",
    videoReferenceImageUrl: "https://cdn.test/ref-1.png",
    motionReferenceVideoUrl: null,
    lipSyncAudio: isLipSync
      ? createReadyLipSyncAudioState({
          url: "https://v3.fal.media/files/lip-sync/voice.mp3",
          durationMs: 8_000,
          sourceKind: "library",
        })
      : createEmptyLipSyncAudioState(),
    lipSyncTurboMode: false,
    videoCameraFixed: false,
    klingCfgScale: 0.5,
    klingMultiPrompts: [],
    klingElements: [],
  };
};

const submitSpyByName = {
  submitFalBriaBackgroundRemove: vi.mocked(submitFalBriaBackgroundRemove),
  submitFalFlux2Klein: vi.mocked(submitFalFlux2Klein),
  submitFalOmniHuman: vi.mocked(submitFalOmniHuman),
  submitFalNanoBanana2: vi.mocked(submitFalNanoBanana2),
  submitFalNanoBanana2Edit: vi.mocked(submitFalNanoBanana2Edit),
  submitFalNanoBananaPro: vi.mocked(submitFalNanoBananaPro),
  submitFalNanoBananaProEdit: vi.mocked(submitFalNanoBananaProEdit),
  submitFalSeedream: vi.mocked(submitFalSeedream),
  submitFalSeedreamEdit: vi.mocked(submitFalSeedreamEdit),
  submitFalSeedreamV5Lite: vi.mocked(submitFalSeedreamV5Lite),
  submitFalSeedreamV5LiteEdit: vi.mocked(submitFalSeedreamV5LiteEdit),
  submitKieGptImage2: vi.mocked(submitKieGptImage2),
  submitKieGptImage2Edit: vi.mocked(submitKieGptImage2Edit),
} as const;

const resetFalSubmitMocks = () => {
  Object.values(submitSpyByName).forEach((spy, index) => {
    spy.mockReset();
    spy.mockResolvedValue({ request_id: `req-${index + 1}` });
  });
};

describe("task submission payload matrix", () => {
  it("keeps manifest submission adapter metadata aligned with runtime registries", () => {
    const runtimeResolverByRoute = {
      default: resolveDefaultSubmissionAdapterKey,
      image: resolveImageSubmissionAdapterKey,
      video: resolveVideoSubmissionAdapterKey,
    } as const;

    const runtimeModels = listModelConfigs().filter((config) =>
      config.surfaces.includes("runtime")
    );

    for (const config of runtimeModels) {
      const route = config.submitHandler;
      if (route !== "default" && route !== "image" && route !== "video") continue;
      const manifestKey = config.submissionAdapterKey ?? null;
      expect(
        manifestKey,
        `${config.id} should declare submissionAdapterKey for ${route} handler`
      ).toBeTruthy();
      expect(runtimeResolverByRoute[route](config.id)).toBe(manifestKey);
    }
  });

  beforeEach(() => {
    resetFalSubmitMocks();
    process.env.NEXT_PUBLIC_AI_STUDIO_GENERATION_SAFETY_LEVEL = "off";
  });

  it("keeps matrix coverage in sync with every non-text model in model registry", () => {
    const generationModelIds = listModelConfigs()
      .filter(
        (config) =>
          config.mediaType !== "text" &&
          (config.provider === "fal" ||
            config.id === KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID ||
            config.id === KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID) &&
          config.lifecycle === "active" &&
          config.surfaces.includes("runtime")
      )
      .map((config) => config.id)
      .sort();
    expect(Object.keys(CASES).sort()).toEqual(generationModelIds);
  });

  it.each(Object.entries(CASES))(
    "routes %s through the expected submit path with required payload fields",
    async (modelId, config) => {
      const contract = getModelApiContract(modelId);
      expect(contract).not.toBeNull();
      expect(resolveSubmissionHandlerRoute(modelId)).toBe(config.route);

      if (config.route === "default") {
        await handleDefaultModelSubmission(makeImageArgs(modelId, config.requestedResolution));
      } else if (config.route === "image") {
        const handled = await handleImageModelSubmission(
          makeImageArgs(modelId, config.requestedResolution)
        );
        expect(handled).toBe(true);
      } else {
        const handled = await handleVideoModelSubmission(
          makeVideoArgs(modelId, config.requestedResolution)
        );
        expect(handled).toBe(true);
      }

      const submitSpy = submitSpyByName[config.submitName as keyof typeof submitSpyByName];
      expect(submitSpy).toHaveBeenCalledTimes(1);
      const payload = submitSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload).toBeDefined();
      expect(payload.shortpulse_context).toEqual(
        expect.objectContaining({
          surface: "ai-studio-test",
          workspace_runtime_key: "session:matrix-session",
        })
      );

      if (contract?.submitAspectField === "image_size") {
        expect(payload.image_size).toBeDefined();
        expect(payload.aspect_ratio).toBeUndefined();
      }
      if (contract?.submitAspectField === "aspect_ratio") {
        expect(payload.aspect_ratio).toBeDefined();
      }

      if (
        modelId.includes("seedream") &&
        config.requestedResolution &&
        ["auto_2K", "auto_3K", "auto_4K"].includes(config.requestedResolution)
      ) {
        expect(typeof payload.image_size).toBe("object");
        const imageSize = payload.image_size as { width: number; height: number };
        expect(
          Math.abs(imageSize.width / imageSize.height - parseAspectRatio(seedreamAspect))
        ).toBeLessThanOrEqual(0.02);
      }

      const expectsResolutionField =
        Boolean(contract?.allowedResolutions?.length && contract.allowedResolutions.length > 1) &&
        contract?.submitAspectField === "aspect_ratio";
      if (expectsResolutionField) {
        expect(payload.resolution).toBeDefined();
      }

      if (config.route === "video" && modelId !== FAL_OMNIHUMAN_V15_MODEL_ID) {
        expect(payload.duration).toBeDefined();
      }

      if (config.expectsAudioField) {
        expect(payload.generate_audio).toBeDefined();
      } else if (config.route === "video") {
        expect(payload.generate_audio).toBeUndefined();
      }

      if (config.expectedReferenceField === "image_urls") {
        expect(Array.isArray(payload.image_urls)).toBe(true);
      } else if (config.expectedReferenceField === "input_urls") {
        expect(Array.isArray(payload.input_urls)).toBe(true);
      } else if (config.expectedReferenceField === "image_url") {
        expect(typeof payload.image_url).toBe("string");
      } else if (config.expectedReferenceField === "start_image_url") {
        expect(typeof payload.start_image_url).toBe("string");
      } else if (config.expectedReferenceField === "first_last_frame_urls") {
        expect(typeof payload.first_frame_url).toBe("string");
        expect(typeof payload.last_frame_url).toBe("string");
      }
      if (modelId === "fal-ai/bria/background/remove") {
        expect(typeof payload.image_url).toBe("string");
        expect(payload.prompt).toBeUndefined();
      }
      if (modelId === FAL_OMNIHUMAN_V15_MODEL_ID) {
        expect(typeof payload.audio_url).toBe("string");
        expect(payload.duration).toBeUndefined();
        expect(payload.generate_audio).toBeUndefined();
      }

      if (typeof config.expectedSafetyChecker === "boolean") {
        expect(payload.enable_safety_checker).toBe(config.expectedSafetyChecker);
      }
      if (config.expectedSafetyTolerance) {
        expect(payload.safety_tolerance).toBe(config.expectedSafetyTolerance);
      }
    }
  );
});
