import { describe, expect, it } from "vitest";
import {
  isPulseDraftBlank,
  isPulseDraftPersistable,
  resolvePulseDraftValidationIssue,
} from "../adminPulseDraftValidation";

const buildDraft = (overrides: Partial<Parameters<typeof isPulseDraftPersistable>[0]> = {}) => ({
  presetId: "prompt_modifier",
  label: "Prompt Modifier",
  description: "Modify prompts.",
  starterAssistantMessage: "Paste the prompt you want to modify.",
  workflowStageHints: "",
  artifactTarget: "text_artifact",
  systemInstructions: "Ask for the source prompt, then return a cleaner version.",
  ...overrides,
});

describe("adminPulseDraftValidation", () => {
  it("accepts publishable built-in Pulse drafts", () => {
    const draft = buildDraft();

    expect(isPulseDraftBlank(draft)).toBe(false);
    expect(isPulseDraftPersistable(draft)).toBe(true);
    expect(resolvePulseDraftValidationIssue(draft)).toBeNull();
  });

  it("rejects unsafe preset ids before they can enter runtime namespaces", () => {
    const draft = buildDraft({ presetId: "Prompt Modifier" });

    expect(isPulseDraftPersistable(draft)).toBe(false);
    expect(resolvePulseDraftValidationIssue(draft)).toContain("must not contain spaces or colons");
  });

  it("rejects retired preset ids before admin save", () => {
    const draft = buildDraft({ presetId: "legacy_prompt_modifier" });

    expect(isPulseDraftPersistable(draft)).toBe(false);
    expect(resolvePulseDraftValidationIssue(draft)).toBe(
      "This preset id is retired. Choose a new safe preset id for this built-in Pulse."
    );
  });

  it("requires starter messages so kickoff has a deterministic visible prompt", () => {
    const draft = buildDraft({ starterAssistantMessage: "   " });

    expect(isPulseDraftPersistable(draft)).toBe(false);
    expect(resolvePulseDraftValidationIssue(draft)).toBe(
      "Starter assistant message is required so the Pulse can always show a kickoff step."
    );
  });
});
