import { describe, expect, it } from "vitest";
import {
  normalizeCreatePulseBuiltInPresetDefinitions as normalizePublicBuiltInDefinitions,
  type CreatePulseBuiltInPresetDefinition as PublicBuiltInDefinition,
} from "../createPulsePresetDomain";
import {
  normalizeCreatePulseBuiltInPresetDefinitions as normalizeServerBuiltInDefinitions,
  type CreatePulseBuiltInPresetDefinition as ServerBuiltInDefinition,
} from "../createPulseBuiltIns";

const publicPromptModifierDefinition: PublicBuiltInDefinition = {
  presetId: "prompt_modifier",
  label: "Prompt Modifier",
  description: "Modify prompts.",
  pulseKind: "guided_workflow",
  runtimeMode: "workflow_gpt",
  activationMode: "activate_and_start",
  outputMode: "chat_reply",
  memoryPolicy: "session",
  starterAssistantMessage: "Paste the prompt you want to modify.",
  workflowStageHints: ["Paste prompt"],
  artifactTarget: "video_prompt",
  schemaVersion: 2,
};

const serverPromptModifierDefinition: ServerBuiltInDefinition = {
  ...publicPromptModifierDefinition,
  systemInstructions: "Ask for a source prompt, then return a cleaner version.",
};

describe("Create Pulse built-in catalog normalization", () => {
  it("drops public built-in rows without starter messages", () => {
    expect(
      normalizePublicBuiltInDefinitions([
        {
          ...publicPromptModifierDefinition,
          starterAssistantMessage: "  ",
        },
        publicPromptModifierDefinition,
      ])
    ).toEqual([publicPromptModifierDefinition]);
  });

  it("drops server built-in rows without starter messages", () => {
    expect(
      normalizeServerBuiltInDefinitions([
        {
          ...serverPromptModifierDefinition,
          starterAssistantMessage: "",
        },
        serverPromptModifierDefinition,
      ])
    ).toEqual([serverPromptModifierDefinition]);
  });
});
