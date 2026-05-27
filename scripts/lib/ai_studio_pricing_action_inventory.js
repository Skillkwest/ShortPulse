// Canonical AI Studio pricing action inventory for phase-1 wiring work.
// This is intentionally curated instead of inferred so it can capture
// product decisions like billable-vs-helper classification explicitly.

const phase1Actions = [
  {
    id: "ai_studio_core_generate",
    classification: "billable_shared_policy",
    surface: "AI Studio core generate / regenerate",
    trigger:
      "Primary generate buttons across create, edit, image, and video flows",
    modelIdSource:
      "Selected model plus create/edit coercion via useAiStudioViewModel and useAiStudioGenerationController",
    pricingDisplaySource:
      "useAiStudioViewModel -> clientPricingDisplay.ts -> computeCostForModel(...).credits",
    submitPath:
      "useAiStudioGenerationController -> useAiStudioTaskSubmission -> dispatchSubmissionByRoute",
    serverDebitPath:
      "Provider submit routes charge via chargeGenerationRequest on the server",
    references: [
      "frontend/features/ai-studio/hooks/useAiStudioViewModel.ts",
      "frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts",
      "frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts",
      "frontend/features/ai-studio/hooks/taskSubmission/routeDispatch.ts",
    ],
  },
  {
    id: "standard_create_primary_submit",
    classification: "billable_shared_policy",
    surface: "Standard create primary submit",
    trigger:
      "Primary create button in Standard Create when the create/text lane hands off to image generation",
    modelIdSource:
      "AI Studio selected create model resolved through shared view-model and controller",
    pricingDisplaySource:
      "promptReferenceGenerateCostCredits ?? currentCostCredits from useAiStudioViewModel",
    submitPath:
      "useStandardCreatePrimarySubmit -> handleGenerate -> useAiStudioGenerationController",
    serverDebitPath:
      "Delegates to the same server billing path as core AI Studio generation",
    references: [
      "frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts",
      "frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts",
    ],
  },
  {
    id: "standard_create_inline_generate",
    classification: "billable_shared_policy",
    surface: "Standard create inline generate",
    trigger: "Inline generate affordance in standard create runtime",
    modelIdSource:
      "AI Studio selected create model resolved through shared generation controller",
    pricingDisplaySource:
      "promptReferenceGenerateCostCredits ?? currentCostCredits from useAiStudioViewModel",
    submitPath:
      "useStandardCreateInlineGenerate -> handleGenerate -> useAiStudioGenerationController",
    serverDebitPath:
      "Delegates to the same server billing path as core AI Studio generation",
    references: [
      "frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreateInlineGenerate.ts",
      "frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts",
    ],
  },
  {
    id: "agent_output_generate",
    classification: "billable_shared_policy",
    surface: "Agent output generate",
    trigger: "Generate from agent-output prompt bubbles",
    modelIdSource:
      "Selected workflow tool and current model in AI Studio shell",
    pricingDisplaySource:
      "promptReferenceGenerateCostCredits ?? currentCostCredits from useAiStudioViewModel",
    submitPath:
      "useAiStudioAgentOutputGenerationBridge -> handleGenerate -> useAiStudioGenerationController",
    serverDebitPath:
      "Delegates to the same server billing path as core AI Studio generation",
    references: [
      "frontend/features/ai-studio/hooks/useAiStudioAgentOutputGenerationBridge.ts",
      "frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts",
    ],
  },
  {
    id: "pulse_artifact_generate",
    classification: "billable_shared_policy",
    surface: "Pulse artifact generate",
    trigger: "Generate from completed Pulse artifact prompts",
    modelIdSource: "Pulse artifact target + active AI Studio selected model",
    pricingDisplaySource:
      "resolvePulseArtifactCostOverrideCredits using shared current/prompt-reference credits",
    submitPath:
      "usePulseCreatePrimarySubmit -> handleGenerate -> useAiStudioGenerationController",
    serverDebitPath:
      "Delegates to the same server billing path as core AI Studio generation",
    references: [
      "frontend/features/ai-studio/hooks/pulseCreateRuntime/usePulseCreatePrimarySubmit.ts",
      "frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts",
    ],
  },
  {
    id: "music_generate",
    classification: "billable_shared_policy",
    surface: "Music properties panel",
    trigger: "Generate music button",
    modelIdSource:
      "resolveRequiredAudioMusicModelId() via MusicPropertiesPanel",
    pricingDisplaySource: "MusicPropertiesPanel -> clientPricingDisplay.ts",
    submitPath: "useAiStudioAudioGeneration -> /api/elevenlabs/music",
    serverDebitPath: "/api/elevenlabs/music -> chargeGenerationRequest",
    references: [
      "frontend/features/ai-studio/components/MusicPropertiesPanel.tsx",
      "frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts",
      "frontend/pages/api/elevenlabs/music.ts",
    ],
  },
  {
    id: "sound_effects_generate",
    classification: "billable_shared_policy",
    surface: "Sound effects properties panel",
    trigger: "Generate sound effect button",
    modelIdSource:
      "resolveRequiredAudioSoundEffectsModelId() via SoundEffectsPropertiesPanel",
    pricingDisplaySource:
      "SoundEffectsPropertiesPanel -> clientPricingDisplay.ts",
    submitPath: "useAiStudioAudioGeneration -> /api/elevenlabs/sound-effects",
    serverDebitPath: "/api/elevenlabs/sound-effects -> chargeGenerationRequest",
    references: [
      "frontend/features/ai-studio/components/SoundEffectsPropertiesPanel.tsx",
      "frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts",
      "frontend/pages/api/elevenlabs/sound-effects.ts",
    ],
  },
  {
    id: "voiceover_generate",
    classification: "billable_shared_policy",
    surface: "Voices properties panel (voiceover mode)",
    trigger: "Generate voiceover button",
    modelIdSource:
      "request.config.model_id with voiceover defaults in VoicesPropertiesPanel",
    pricingDisplaySource: "VoicesPropertiesPanel -> clientPricingDisplay.ts",
    submitPath: "useAiStudioAudioGeneration -> /api/elevenlabs/text-to-speech",
    serverDebitPath:
      "/api/elevenlabs/text-to-speech -> chargeGenerationRequest",
    references: [
      "frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx",
      "frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts",
      "frontend/pages/api/elevenlabs/text-to-speech.ts",
    ],
  },
  {
    id: "voice_changer_generate",
    classification: "billable_shared_policy",
    surface: "Voices properties panel (voice changer mode)",
    trigger: "Generate voice changer button",
    modelIdSource:
      "request.modelId in VoicesPropertiesPanel voice-changer flow",
    pricingDisplaySource: "VoicesPropertiesPanel -> clientPricingDisplay.ts",
    submitPath:
      "useAiStudioAudioGeneration -> /api/elevenlabs/speech-to-speech",
    serverDebitPath:
      "/api/elevenlabs/speech-to-speech -> chargeGenerationRequest",
    references: [
      "frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx",
      "frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts",
      "frontend/pages/api/elevenlabs/speech-to-speech.ts",
    ],
  },
];

const explicitExclusions = [
  {
    id: "style_extraction",
    classification: "non_billable_helper",
    surface: "Style extraction",
    trigger: "Style extraction helper actions",
    modelIdSource: "Helper flow only",
    pricingDisplaySource: "No billable credit display",
    submitPath: "/api/ai/extract-style",
    serverDebitPath: "No chargeGenerationRequest path",
    references: [
      "frontend/features/ai-studio/logic/styleExtraction.ts",
      "frontend/pages/api/ai/extract-style.ts",
    ],
  },
  {
    id: "voice_design_preview",
    classification: "non_billable_helper",
    surface: "Voice design preview",
    trigger: "Preview designed voice from VoicesPropertiesPanel",
    modelIdSource: "Voice design helper flow only",
    pricingDisplaySource: "No billable credit display",
    submitPath: "/api/elevenlabs/text-to-voice/design",
    serverDebitPath: "No chargeGenerationRequest path",
    references: [
      "frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx",
      "frontend/pages/api/elevenlabs/text-to-voice/design.ts",
    ],
  },
  {
    id: "voice_design_create",
    classification: "non_billable_helper",
    surface: "Create designed voice",
    trigger: "Save/create designed voice from VoicesPropertiesPanel",
    modelIdSource: "Voice creation helper flow only",
    pricingDisplaySource: "No billable credit display",
    submitPath: "/api/elevenlabs/text-to-voice/create",
    serverDebitPath: "No chargeGenerationRequest path",
    references: [
      "frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx",
      "frontend/pages/api/elevenlabs/text-to-voice/create.ts",
    ],
  },
  {
    id: "voice_clone",
    classification: "non_billable_helper",
    surface: "Clone voice",
    trigger: "Voice clone helper actions",
    modelIdSource: "Voice helper flow only",
    pricingDisplaySource: "No billable credit display",
    submitPath: "/api/elevenlabs/voices/clone",
    serverDebitPath: "No chargeGenerationRequest path",
    references: [
      "frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx",
      "frontend/pages/api/elevenlabs/voices/clone.ts",
    ],
  },
];

module.exports = {
  phase1Actions,
  explicitExclusions,
};
