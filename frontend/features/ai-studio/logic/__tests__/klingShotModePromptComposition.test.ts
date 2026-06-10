/**
 * Kling hidden shot-mode prompt composition tests.
 * Locks the visible prompt budget to the worst-case hidden injection overhead.
 */
import { describe, expect, it } from "vitest";
import {
  KLING_SINGLE_PROMPT_MAX_CHARACTERS,
  composeHiddenShotModePrompt,
  resolveKlingSinglePromptVisibleCharacterLimit,
} from "../klingShotModePromptComposition";

describe("klingShotModePromptComposition", () => {
  it("reserves the largest hidden shot-mode injection for both visible prompt limits", () => {
    const singleComposed = composeHiddenShotModePrompt({ prompt: "A", mode: "single" });
    const multiComposed = composeHiddenShotModePrompt({ prompt: "A", mode: "multi" });
    const singleOverhead = singleComposed.length - 1;
    const multiOverhead = multiComposed.length - 1;
    const reservedVisibleLimit =
      KLING_SINGLE_PROMPT_MAX_CHARACTERS - Math.max(singleOverhead, multiOverhead);

    expect(singleOverhead).toBe(214);
    expect(multiOverhead).toBe(177);
    expect(reservedVisibleLimit).toBe(2286);
    expect(resolveKlingSinglePromptVisibleCharacterLimit("single")).toBe(reservedVisibleLimit);
    expect(resolveKlingSinglePromptVisibleCharacterLimit("multi")).toBe(reservedVisibleLimit);
  });
});
