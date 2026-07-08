export const CREATE_PULSE_SEEDED_BUILT_IN_METADATA = [
  {
    presetId: "image",
    label: "Video Prompt Magic",
    description: "Guided single-shot video workflow from one reference image.",
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    artifactTarget: "video_prompt",
  },
  {
    presetId: "multi_shot",
    label: "Multi Sequence Video Prompt",
    description: "Guided multi-shot storyboard workflow from a text idea and optional references.",
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    artifactTarget: "video_prompt",
  },
  {
    presetId: "story_builder",
    label: "DFY Story Builder",
    description: "Guided story-circle workflow from a text seed and optional references.",
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    artifactTarget: "image_prompt",
  },
] as const;
