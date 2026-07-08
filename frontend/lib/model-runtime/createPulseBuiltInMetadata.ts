export const VIDEO_PROMPT_MAGIC_STARTER_MESSAGE = "Upload your image to get the process started :)";

export const MULTI_SEQUENCE_VIDEO_PROMPT_STARTER_MESSAGE =
  "Step 1 — Concept: Tell me the video idea, action arc, or scene you want to build. You can attach reference images now or later if you want visual continuity.";

export const STORY_BUILDER_STARTER_MESSAGE =
  "**Step 1 — Story seed.** Tell me the character, premise, mood, or moment you want to build from. Reference images are optional if you want me to preserve specific character looks.";

export const VIDEO_PROMPT_MAGIC_STAGE_HINTS = [
  "Image Gate",
  "Camera Motion",
  "Action Selection",
  "Dialogue",
  "Final Prompt",
] as const;

export const MULTI_SEQUENCE_VIDEO_PROMPT_STAGE_HINTS = [
  "Concept Intake",
  "Reference Intake",
  "Action Arc",
  "Dialog",
  "Storyboard Build",
  "Final Prompt",
] as const;

export const STORY_BUILDER_STAGE_HINTS = [
  "Story Seed",
  "Character Notes",
  "Plot Seed",
  "Runtime",
  "Scene Review",
  "Image Prompts",
  "Dialogue Story",
] as const;

export const CREATE_PULSE_SEEDED_BUILT_IN_METADATA = [
  {
    presetId: "image",
    label: "Video Prompt Magic",
    description: "Guided single-shot video workflow from one reference image.",
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    starterAssistantMessage: VIDEO_PROMPT_MAGIC_STARTER_MESSAGE,
    workflowStageHints: VIDEO_PROMPT_MAGIC_STAGE_HINTS,
    artifactTarget: "video_prompt",
  },
  {
    presetId: "multi_shot",
    label: "Multi Sequence Video Prompt",
    description: "Guided multi-shot storyboard workflow from a text idea and optional references.",
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    starterAssistantMessage: MULTI_SEQUENCE_VIDEO_PROMPT_STARTER_MESSAGE,
    workflowStageHints: MULTI_SEQUENCE_VIDEO_PROMPT_STAGE_HINTS,
    artifactTarget: "video_prompt",
  },
  {
    presetId: "story_builder",
    label: "DFY Story Builder",
    description: "Guided story-circle workflow from a text seed and optional references.",
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    starterAssistantMessage: STORY_BUILDER_STARTER_MESSAGE,
    workflowStageHints: STORY_BUILDER_STAGE_HINTS,
    artifactTarget: "image_prompt",
  },
] as const;
