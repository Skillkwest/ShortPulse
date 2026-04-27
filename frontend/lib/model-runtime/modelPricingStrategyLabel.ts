import type { PricingStrategyId } from "./pricingTypes";

export const getAdminPricingStrategyLabel = (
  modelId: string,
  pricingStrategy: PricingStrategyId
): string => {
  switch (pricingStrategy) {
    case "elevenlabs-music-per-minute":
    case "elevenlabs-voice-changer-per-minute":
      return "Per minute";
    case "elevenlabs-sound-effect":
      return "Per generated sound";
    case "elevenlabs-text-to-speech-per-kchar":
      return "Per 1K characters";
    case "fal-per-mp":
      return "Per megapixel";
    case "fal-economy-image-per-mp":
      return modelId === "fal-ai/bria/background/remove" ? "Per image" : "Per megapixel";
    case "fal-fill-per-mp":
    case "fal-flux-kontext-inpaint-per-mp":
      return "Per output megapixel";
    case "gpt-image-2-per-image":
    case "google-nano-banana-per-image":
    case "nano-banana-per-image":
    case "nano-banana-2-per-image":
    case "seedream-5-lite-per-image":
      return "Per image";
    case "seedream-per-image":
      return "Per image (4K costs more)";
    case "gpt41nano-per-token":
      return "Per token";
    case "veo-3-per-second":
    case "kling-3-per-second":
    case "seedance-1.5-per-second":
    case "seedance-2-per-second":
    case "seedance-2-fast-per-second":
      return "Per output second";
    default: {
      const neverStrategy: never = pricingStrategy;
      return neverStrategy;
    }
  }
};
