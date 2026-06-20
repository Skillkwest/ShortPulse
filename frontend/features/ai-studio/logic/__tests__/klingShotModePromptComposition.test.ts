/**
 * Kling hidden shot-mode prompt composition tests.
 * Locks the visible prompt budget below the worst-case hidden injection overhead.
 */
import { describe, expect, it } from "vitest";
import {
  KLING_SINGLE_PROMPT_MAX_CHARACTERS,
  composeHiddenShotModePrompt,
  resolveKlingSinglePromptVisibleCharacterLimit,
} from "../klingShotModePromptComposition";

describe("klingShotModePromptComposition", () => {
  it("uses the even 2,000 visible prompt limit for both shot modes", () => {
    const singleComposed = composeHiddenShotModePrompt({ prompt: "A", mode: "single" });
    const multiComposed = composeHiddenShotModePrompt({ prompt: "A", mode: "multi" });
    const singleOverhead = singleComposed.length - 1;
    const multiOverhead = multiComposed.length - 1;
    const reservedVisibleLimit =
      KLING_SINGLE_PROMPT_MAX_CHARACTERS - Math.max(singleOverhead, multiOverhead);

    expect(singleOverhead).toBe(200);
    expect(multiOverhead).toBe(177);
    expect(reservedVisibleLimit).toBe(2300);
    expect(resolveKlingSinglePromptVisibleCharacterLimit("single")).toBe(2000);
    expect(resolveKlingSinglePromptVisibleCharacterLimit("multi")).toBe(2000);
  });
});
