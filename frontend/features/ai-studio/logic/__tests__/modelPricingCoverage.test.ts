/**
 * Exhaustive matrix coverage for model pricing outputs and rounding policy contracts.
 */

import { computeCostForModel } from "../pricing";
import { listModelConfigs } from "../modelRegistry";

const EXCEPTION_ROUNDING_MODEL_IDS = new Set([
  "fal-ai/flux-2/klein/9b",
  "fal-ai/bria/background/remove",
]);

const AUDIO_STRATEGIES = new Set([
  "kling-3-per-second",
  "veo-3-per-second",
  "seedance-1.5-per-second",
]);

const WEB_SEARCH_STRATEGIES = new Set(["nano-banana-2-per-image", "nano-banana-per-image"]);

const VOICE_CONTROL_STRATEGIES = new Set(["kling-3-per-second"]);

const dedupe = <T>(values: Array<T | undefined>): T[] =>
  Array.from(new Set(values.filter((value): value is T => value !== undefined)));

const withUndefinedFallback = <T>(values: T[]): Array<T | undefined> => {
  return values.length > 0 ? values : [undefined];
};

describe("model pricing coverage", () => {
  it("returns non-null policy-compliant costs across supported runtime settings", () => {
    const configs = listModelConfigs().filter((config) => Boolean(config.pricingStrategy));
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
      const tokenCases =
        config.pricingStrategy === "gpt41nano-per-token"
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
                  tokenCases.forEach((tokenCase) => {
                    caseCount += 1;
                    const estimate = computeCostForModel(config.id, {
                      aspect,
                      resolution,
                      durationSeconds,
                      audio,
                      webSearch,
                      voiceControl,
                      ...tokenCase,
                    });

                    if (!estimate) {
                      failures.push(`${config.id} => null cost`);
                      return;
                    }

                    if (estimate.credits <= 0) {
                      failures.push(`${config.id} => non-positive credits (${estimate.credits})`);
                    }

                    if (EXCEPTION_ROUNDING_MODEL_IDS.has(config.id)) {
                      if (estimate.credits !== estimate.rawCredits) {
                        failures.push(
                          `${config.id} => expected ceil-only rounding (${estimate.rawCredits} -> ${estimate.credits})`
                        );
                      }
                    } else if (estimate.credits % 5 !== 0) {
                      failures.push(
                        `${config.id} => expected nearest-5 credits (${estimate.credits})`
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

      matrixCounts[config.id] = caseCount;
    });

    expect(Object.values(matrixCounts).every((value) => value > 0)).toBe(true);
    if (failures.length) {
      throw new Error(`Pricing matrix failures:\n${failures.join("\n")}`);
    }
  });

  it("never applies nearest-5 quantization to exception models", () => {
    EXCEPTION_ROUNDING_MODEL_IDS.forEach((modelId) => {
      const estimate = computeCostForModel(modelId, { aspect: "4:3" });
      expect(estimate).not.toBeNull();
      expect(estimate?.credits).toBe(estimate?.rawCredits);
    });
  });
});
