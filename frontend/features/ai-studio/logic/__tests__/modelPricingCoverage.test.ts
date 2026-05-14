/**
 * Exhaustive matrix coverage for model pricing outputs and rounding policy contracts.
 */

import { computeCostForModel } from "../pricing";
import { listPricingModelConfigs } from "../modelRegistry";
import {
  OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD,
  OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS,
  resolveOpenAiGptImage2InputImageUsd,
} from "../../../../lib/model-runtime/openAiImage2";

const AUDIO_STRATEGIES = new Set([
  "kling-3-per-second",
  "veo-3-per-second",
  "seedance-2-per-second",
  "seedance-2-fast-per-second",
]);

const TEXT_CHARACTER_STRATEGIES = new Set(["elevenlabs-text-to-speech-per-kchar"]);

const SOURCE_DURATION_STRATEGIES = new Set(["elevenlabs-voice-changer-per-minute"]);

const WEB_SEARCH_STRATEGIES = new Set(["nano-banana-2-per-image", "nano-banana-per-image"]);

const VOICE_CONTROL_STRATEGIES = new Set(["kling-3-per-second"]);

const dedupe = <T>(values: Array<T | undefined>): T[] =>
  Array.from(new Set(values.filter((value): value is T => value !== undefined)));

const withUndefinedFallback = <T>(values: T[]): Array<T | undefined> => {
  return values.length > 0 ? values : [undefined];
};

describe("model pricing coverage", () => {
  it("returns non-null policy-compliant costs across supported runtime settings", () => {
    const configs = listPricingModelConfigs();
    const failures: string[] = [];
    const matrixCounts: Record<string, number> = {};

    configs.forEach((config) => {
      const aspects = dedupe([config.defaultAspect, ...(config.allowedAspects ?? [])]);
      const resolutions = dedupe([config.defaultResolution, ...(config.allowedResolutions ?? [])]);
      const durations = dedupe([config.defaultDurationSeconds, ...(config.allowedDurations ?? [])]);
      const audioValues = AUDIO_STRATEGIES.has(config.pricingStrategy)
        ? [config.defaultAudio ?? true, !(config.defaultAudio ?? true)]
        : [undefined];
      const webSearchValues = WEB_SEARCH_STRATEGIES.has(config.pricingStrategy)
        ? [false, true]
        : [undefined];
      const voiceControlValues = VOICE_CONTROL_STRATEGIES.has(config.pricingStrategy)
        ? [false, true]
        : [undefined];
      const textCharacterValues = TEXT_CHARACTER_STRATEGIES.has(config.pricingStrategy)
        ? [1000]
        : [undefined];
      const sourceDurationValues = SOURCE_DURATION_STRATEGIES.has(config.pricingStrategy)
        ? [60]
        : [undefined];
      const tokenCases =
        config.pricingStrategy === "openai-text-token"
          ? [{ inputTokens: 500, outputTokens: 700 }]
          : [{}];

      const aspectMatrix = withUndefinedFallback(aspects);
      const resolutionMatrix = withUndefinedFallback(resolutions);
      const durationMatrix = withUndefinedFallback(durations);
      let caseCount = 0;

      aspectMatrix.forEach((aspect) => {
        resolutionMatrix.forEach((resolution) => {
          durationMatrix.forEach((durationSeconds) => {
            audioValues.forEach((audio) => {
              webSearchValues.forEach((webSearch) => {
                voiceControlValues.forEach((voiceControl) => {
                  textCharacterValues.forEach((textCharacters) => {
                    sourceDurationValues.forEach((sourceDurationSeconds) => {
                      tokenCases.forEach((tokenCase) => {
                        caseCount += 1;
                        const estimate = computeCostForModel(config.id, {
                          aspect,
                          resolution,
                          durationSeconds,
                          audio,
                          webSearch,
                          voiceControl,
                          textCharacters,
                          sourceDurationSeconds,
                          ...tokenCase,
                        });

                        if (!estimate) {
                          failures.push(`${config.id} => null cost`);
                          return;
                        }

                        if (estimate.credits <= 0) {
                          failures.push(
                            `${config.id} => non-positive credits (${estimate.credits})`
                          );
                        }

                        if (estimate.rawCredits > estimate.credits) {
                          failures.push(
                            `${config.id} => raw credits exceed billed (${estimate.rawCredits} > ${estimate.credits})`
                          );
                        }

                        if (Math.abs(estimate.usd - estimate.credits * 0.01) > 1e-9) {
                          failures.push(
                            `${config.id} => billed usd mismatch (${estimate.usd} vs ${estimate.credits * 0.01})`
                          );
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });

      matrixCounts[config.id] = caseCount;
    });

    expect(Object.values(matrixCounts).every((value) => value > 0)).toBe(true);
    if (failures.length) {
      throw new Error(`Pricing matrix failures:\n${failures.join("\n")}`);
    }
  });

  it("does not apply global round-nearest quantization by default", () => {
    listPricingModelConfigs().forEach((config) => {
      const estimate = computeCostForModel(config.id, {
        aspect: "4:3",
        ...(config.pricingStrategy === "openai-text-token"
          ? { inputTokens: 500, outputTokens: 700 }
          : {}),
        ...(TEXT_CHARACTER_STRATEGIES.has(config.pricingStrategy) ? { textCharacters: 1000 } : {}),
        ...(SOURCE_DURATION_STRATEGIES.has(config.pricingStrategy)
          ? { sourceDurationSeconds: 60 }
          : {}),
      });
      expect(estimate).not.toBeNull();
      expect(estimate?.credits).toBe(estimate?.rawCredits);
    });
  });

  it("uses the gpt-image-2 size matrix and quality tiers for raw pricing", () => {
    const squareLow = computeCostForModel("gpt-image-2", {
      aspect: "1:1",
      resolution: "low",
    });
    const portraitHigh = computeCostForModel("gpt-image-2", {
      aspect: "9:16",
      resolution: "high",
      generationCount: 2,
    });
    const landscapeFallback = computeCostForModel("gpt-image-2", {
      aspect: "16:9",
      resolution: "not-a-tier",
    });

    expect(squareLow?.usdRaw).toBeCloseTo(OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD["1024x1024"].low);
    expect(squareLow?.width).toBe(OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS["1024x1024"].width);
    expect(squareLow?.height).toBe(OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS["1024x1024"].height);

    expect(portraitHigh?.usdRaw).toBeCloseTo(
      OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD["1024x1536"].high * 2
    );
    expect(portraitHigh?.width).toBe(OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS["1024x1536"].width);
    expect(portraitHigh?.height).toBe(OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS["1024x1536"].height);

    expect(landscapeFallback?.usdRaw).toBeCloseTo(
      OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD["1536x1024"].medium
    );
    expect(landscapeFallback?.width).toBe(OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS["1536x1024"].width);
    expect(landscapeFallback?.height).toBe(
      OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS["1536x1024"].height
    );
  });

  it("adds deterministic GPT Image 2 edit input-image surcharges", () => {
    const editEstimate = computeCostForModel("gpt-image-2", {
      aspect: "1:1",
      resolution: "medium",
      inputImageCount: 2,
      inputFidelity: "high",
      maskPresent: true,
    });

    expect(editEstimate?.usdRaw).toBeCloseTo(
      OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD["1024x1024"].medium +
        resolveOpenAiGptImage2InputImageUsd({
          size: "1024x1024",
          inputFidelity: "high",
        }) *
          2 +
        resolveOpenAiGptImage2InputImageUsd({
          size: "1024x1024",
          inputFidelity: "low",
        })
    );
  });
});
