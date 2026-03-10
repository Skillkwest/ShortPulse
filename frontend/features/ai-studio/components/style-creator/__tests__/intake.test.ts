/**
 * Unit tests for styles-library intake fallback prompt sanitization.
 */
import { describe, expect, it } from "vitest";
import { normalizeStylePromptFallbackText } from "../intake";

describe("style-creator intake fallback prompt sanitization", () => {
  it("drops filename-like payloads", () => {
    expect(normalizeStylePromptFallbackText("Screenshot 2026-03-10 at 11.49.19 AM.png")).toBe("");
    expect(normalizeStylePromptFallbackText("IMG_4095.JPG")).toBe("");
    expect(normalizeStylePromptFallbackText("C:\\Users\\name\\Desktop\\style.webp")).toBe("");
  });

  it("drops file-url payloads", () => {
    expect(
      normalizeStylePromptFallbackText("file:///Users/name/Desktop/Screenshot%202026-03-10.png")
    ).toBe("");
  });

  it("keeps descriptive prompt text", () => {
    expect(
      normalizeStylePromptFallbackText("Muted cinematic lighting, low-saturation teal/orange grade")
    ).toBe("Muted cinematic lighting, low-saturation teal/orange grade");
  });
});
