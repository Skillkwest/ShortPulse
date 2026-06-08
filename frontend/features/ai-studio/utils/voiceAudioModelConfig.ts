import {
  resolveRequiredAudioVoiceChangerModelId,
  resolveRequiredAudioVoiceDesignModelId,
  resolveRequiredAudioVoiceoverModelId,
} from "../../../lib/model-runtime/modelCatalog";

export type ElevenVoiceoverRequestConfig = {
  model_id: string;
  language_code: null;
  voice_settings: {
    stability: number;
    similarity_boost: number;
    speed: number;
    style: 0;
    use_speaker_boost: boolean;
  };
};

export const hardcodedVoiceoverModelId = resolveRequiredAudioVoiceoverModelId();
export const hardcodedVoiceoverLanguageCode = null;
export const hardcodedVoiceoverStyleValue = 0 as const;
export const hardcodedVoiceDesignModelId = resolveRequiredAudioVoiceDesignModelId();
export const hardcodedVoiceGenerationDefaults = {
  stability: 1,
  similarity_boost: 1,
  speed: 1,
  style: 0,
  use_speaker_boost: true,
} as const;
export const hardcodedVoiceOutputFormat = "mp3_44100_128";
export const hardcodedVoiceChangerNoiseReductionEnabled = false;
export const hardcodedVoiceChangerModel = resolveRequiredAudioVoiceChangerModelId();
export const hardcodedVoiceChangerInputFormat = "other";

const hardcodedVoiceChangerSpeakerBoostEnabled = true;

export const buildVoiceoverElevenV3RequestConfig = (): ElevenVoiceoverRequestConfig => ({
  model_id: hardcodedVoiceoverModelId,
  language_code: hardcodedVoiceoverLanguageCode,
  voice_settings: {
    stability: hardcodedVoiceGenerationDefaults.stability,
    similarity_boost: hardcodedVoiceGenerationDefaults.similarity_boost,
    speed: hardcodedVoiceGenerationDefaults.speed,
    style: hardcodedVoiceoverStyleValue,
    use_speaker_boost: hardcodedVoiceGenerationDefaults.use_speaker_boost,
  },
});

export const buildVoiceChangerRequestSettings = (): {
  stability: number;
  similarity_boost: number;
  speed: number;
  use_speaker_boost: boolean;
} => ({
  stability: hardcodedVoiceGenerationDefaults.stability,
  similarity_boost: hardcodedVoiceGenerationDefaults.similarity_boost,
  speed: hardcodedVoiceGenerationDefaults.speed,
  use_speaker_boost: hardcodedVoiceChangerSpeakerBoostEnabled,
});
