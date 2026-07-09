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
  pulseKind: "custom_gpt",
  runtimeMode: "custom_gpt",
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

const retiredPublicMetadataDefinition: PublicBuiltInDefinition = {
  ...publicPromptModifierDefinition,
  starterAssistantMessage: null,
  workflowStageHints: null,
};

const retiredServerMetadataDefinition: ServerBuiltInDefinition = {
  ...serverPromptModifierDefinition,
  starterAssistantMessage: null,
  workflowStageHints: null,
};

describe("Create Pulse built-in catalog normalization", () => {
  it("normalizes public built-ins without requiring starter metadata", () => {
    expect(
      normalizePublicBuiltInDefinitions([
        {
          ...publicPromptModifierDefinition,
          starterAssistantMessage: "  ",
        },
        publicPromptModifierDefinition,
      ])
    ).toEqual([retiredPublicMetadataDefinition]);
  });

  it("normalizes server built-ins without preserving starter metadata", () => {
    expect(
      normalizeServerBuiltInDefinitions([
        {
          ...serverPromptModifierDefinition,
          starterAssistantMessage: "",
        },
        serverPromptModifierDefinition,
      ])
    ).toEqual([retiredServerMetadataDefinition]);
  });

  it("normalizes stale non-seeded built-ins away from guided workflow metadata", () => {
    const staleGuidedPromptModifier = {
      ...serverPromptModifierDefinition,
      pulseKind: "guided_workflow" as const,
      runtimeMode: "workflow_gpt" as const,
      starterAssistantMessage: "Paste the prompt you want to modify.",
      workflowStageHints: ["Paste prompt"],
    };
    const normalizedPromptModifier = {
      ...retiredServerMetadataDefinition,
      pulseKind: "custom_gpt" as const,
      runtimeMode: "custom_gpt" as const,
    };

    expect(normalizeServerBuiltInDefinitions([staleGuidedPromptModifier])).toEqual([
      normalizedPromptModifier,
    ]);
    expect(normalizePublicBuiltInDefinitions([staleGuidedPromptModifier])).toEqual([
      normalizedPromptModifier,
    ]);
  });

  it("defaults missing publication status to published", () => {
    const legacyDefinition: Partial<ServerBuiltInDefinition> = {
      ...serverPromptModifierDefinition,
    };
    delete legacyDefinition.publicationStatus;

    expect(normalizeServerBuiltInDefinitions([legacyDefinition])).toEqual([
      retiredServerMetadataDefinition,
    ]);
  });

  it("preserves draft built-ins for admin normalization and filters them from runtime catalogs", () => {
    const draftDefinition = {
      ...serverPromptModifierDefinition,
      presetId: "draft_prompt_modifier",
      publicationStatus: "draft" as const,
    };

    const retiredDraftDefinition = {
      ...draftDefinition,
      starterAssistantMessage: null,
      workflowStageHints: null,
    };

    expect(normalizeServerBuiltInDefinitions([draftDefinition])).toEqual([retiredDraftDefinition]);
    expect(
      filterPublishedServerBuiltInDefinitions([serverPromptModifierDefinition, draftDefinition])
    ).toEqual([retiredServerMetadataDefinition]);
    expect(
      filterPublishedPublicBuiltInDefinitions([publicPromptModifierDefinition, draftDefinition])
    ).toEqual([retiredPublicMetadataDefinition]);
  });
});
