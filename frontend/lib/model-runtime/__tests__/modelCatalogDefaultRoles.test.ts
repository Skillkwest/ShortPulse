import { describe, expect, it } from "vitest";
import { KIE_SEEDANCE_2_FAST_MODEL_ID, KIE_SEEDANCE_2_MODEL_ID } from "../providerModelIds";
import {
  getModelCatalogEntry,
  getModelDefaultRoles,
  type ModelDefaultRole,
  resolveAiStudioTextPromptModelId,
  resolveAudioMusicModelId,
  resolveAudioSoundEffectsModelId,
  resolveAudioVoiceChangerModelId,
  resolveAudioVoiceDesignModelId,
  resolveAudioVoiceoverModelId,
  resolveCreateCharacterModeStartupModelId,
  resolveCreateStartupModelId,
  resolveEditStartupModelId,
  resolveModelIdForDefaultRole,
  resolveStyleExtractionFallbackVisionModelId,
  resolveStyleExtractionVisionModelId,
  resolveStudioAgentDefaultModelId,
  resolveStudioAgentDefaultVisionModelId,
} from "../modelCatalog";

describe("modelCatalog default roles", () => {
  it("uses active Seedance 2 labels for the canonical Kie model ids", () => {
    expect(getModelCatalogEntry(KIE_SEEDANCE_2_MODEL_ID)?.label).toBe("Seedance 2");
    expect(getModelCatalogEntry(KIE_SEEDANCE_2_FAST_MODEL_ID)?.label).toBe("Seedance 2 Fast");
  });

  it("resolves canonical audio and helper default model ids", () => {
    expect(resolveCreateStartupModelId()).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
    expect(resolveCreateCharacterModeStartupModelId()).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(resolveEditStartupModelId()).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(resolveAudioMusicModelId()).toBe("music_v1");
    expect(resolveAudioSoundEffectsModelId()).toBe("eleven_text_to_sound_v2");
    expect(resolveAudioVoiceoverModelId()).toBe("eleven_v3");
    expect(resolveAudioVoiceChangerModelId()).toBe("eleven_multilingual_sts_v2");
    expect(resolveAudioVoiceDesignModelId()).toBe("eleven_multilingual_ttv_v2");
    expect(resolveAiStudioTextPromptModelId()).toBe("gpt-5.5");
    expect(resolveStudioAgentDefaultModelId()).toBe("gpt-5.5");
    expect(resolveStudioAgentDefaultVisionModelId()).toBe("gpt-5.5");
    expect(resolveStyleExtractionVisionModelId()).toBe("gpt-5.4-mini");
    expect(resolveStyleExtractionFallbackVisionModelId()).toBe("gpt-5.4");
  });

  it("keeps default roles attached to the resolved models", () => {
    const expectations: Array<[ModelDefaultRole, string]> = [
      ["create-startup", "fal-ai/bytedance/seedream/v4.5/text-to-image"],
      ["create-character-mode-startup", "fal-ai/bytedance/seedream/v4.5/edit"],
      ["edit-startup", "fal-ai/bytedance/seedream/v4.5/edit"],
      ["audio-music", "music_v1"],
      ["audio-sfx", "eleven_text_to_sound_v2"],
      ["audio-voiceover", "eleven_v3"],
      ["audio-voice-changer", "eleven_multilingual_sts_v2"],
      ["audio-voice-design", "eleven_multilingual_ttv_v2"],
      ["ai-studio-text-prompt", "gpt-5.5"],
      ["studio-agent-chat", "gpt-5.5"],
      ["studio-agent-vision", "gpt-5.5"],
      ["style-extraction-vision", "gpt-5.4-mini"],
      ["style-extraction-fallback", "gpt-5.4"],
    ];

    for (const [role, modelId] of expectations) {
      expect(resolveModelIdForDefaultRole(role)).toBe(modelId);
      expect(getModelDefaultRoles(modelId)).toContain(role);
    }
  });
});
