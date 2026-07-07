import { describe, expect, it } from "vitest";
import {
  filterPublishedCreatePulseBuiltInPresetDefinitions as filterPublishedPublicBuiltInDefinitions,
  normalizeCreatePulseBuiltInPresetDefinitions as normalizePublicBuiltInDefinitions,
  type CreatePulseBuiltInPresetDefinition as PublicBuiltInDefinition,
} from "../createPulsePresetDomain";
import {
  filterPublishedCreatePulseBuiltInPresetDefinitions as filterPublishedServerBuiltInDefinitions,
  normalizeCreatePulseBuiltInPresetDefinitions as normalizeServerBuiltInDefinitions,
  type CreatePulseBuiltInPresetDefinition as ServerBuiltInDefinition,
} from "../createPulseBuiltIns";

const publicPromptModifierDefinition: PublicBuiltInDefinition = {
  presetId: "prompt_modifier",
  label: "Prompt Modifier",
  description: "Modify prompts.",
  systemInstructions: "",
  pulseKind: "guided_workflow",
  runtimeMode: "workflow_gpt",
  activationMode: "activate_and_start",
  outputMode: "chat_reply",
  memoryPolicy: "session",
  starterAssistantMessage: "Paste the prompt you want to modify.",
  workflowStageHints: ["Paste prompt"],
  artifactTarget: "video_prompt",
  schemaVersion: 2,
  publicationStatus: "published",
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

  it("defaults missing publication status to published", () => {
    const legacyDefinition: Partial<ServerBuiltInDefinition> = {
      ...serverPromptModifierDefinition,
    };
    delete legacyDefinition.publicationStatus;

    expect(normalizeServerBuiltInDefinitions([legacyDefinition])).toEqual([
      serverPromptModifierDefinition,
    ]);
  });

  it("preserves draft built-ins for admin normalization and filters them from runtime catalogs", () => {
    const draftDefinition = {
      ...serverPromptModifierDefinition,
      presetId: "draft_prompt_modifier",
      publicationStatus: "draft" as const,
    };

    expect(normalizeServerBuiltInDefinitions([draftDefinition])).toEqual([draftDefinition]);
    expect(
      filterPublishedServerBuiltInDefinitions([serverPromptModifierDefinition, draftDefinition])
    ).toEqual([serverPromptModifierDefinition]);
    expect(
      filterPublishedPublicBuiltInDefinitions([publicPromptModifierDefinition, draftDefinition])
    ).toEqual([publicPromptModifierDefinition]);
  });
});
