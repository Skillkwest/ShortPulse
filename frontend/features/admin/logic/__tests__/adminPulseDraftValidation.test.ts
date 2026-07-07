import { describe, expect, it } from "vitest";
import {
  isPulseDraftBlank,
  isPulseDraftPersistable,
  resolvePulseDraftValidationIssue,
} from "../adminPulseDraftValidation";

const buildDraft = (overrides: Partial<Parameters<typeof isPulseDraftPersistable>[0]> = {}) => ({
  label: "Prompt Modifier",
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

  it("requires titles before admin save", () => {
    const draft = buildDraft({ label: "   " });

    expect(isPulseDraftPersistable(draft)).toBe(false);
    expect(resolvePulseDraftValidationIssue(draft)).toBe("Title is required.");
  });

  it("requires prompts before admin save", () => {
    const draft = buildDraft({ systemInstructions: "   " });

    expect(isPulseDraftPersistable(draft)).toBe(false);
    expect(resolvePulseDraftValidationIssue(draft)).toBe("Prompt is required.");
  });
});
