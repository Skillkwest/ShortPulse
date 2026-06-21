/**
 * AI Studio text input caret contract tests.
 * Keeps decorative token mirrors from becoming the visible typing authority.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesDir = path.resolve(process.cwd(), "styles");

const readStyle = (filename: string) => fs.readFileSync(path.join(stylesDir, filename), "utf8");

const extractRuleBlock = (css: string, selector: string) => {
  const escapedSelector = selector
    .trim()
    .split(/\s+/)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const pattern = new RegExp(`(^|\\n)${escapedSelector} \\{[\\s\\S]*?\\n\\}`, "gm");
  const matches = Array.from(css.matchAll(pattern));
  const match = matches.at(-1);
  expect(match).toBeDefined();
  return match?.[0] ?? "";
};

describe("AI Studio text input caret contract", () => {
  it("keeps Voiceover script text native instead of mirrored through a transparent layer", () => {
    const css = readStyle("ai-studio-voices-properties.module.css");
    const voiceScriptInput = extractRuleBlock(
      css,
      ".bootstrapStyleScope:global(.voices-properties-script-input), .bootstrapStyleScope :global(.voices-properties-script-input)"
    );

    expect(css).not.toContain("voices-properties-script-highlight");
    expect(voiceScriptInput).toContain("color: #f5f9ff;");
    expect(voiceScriptInput).toContain("-webkit-text-fill-color: #f5f9ff;");
    expect(voiceScriptInput).not.toContain("color: transparent;");
    expect(voiceScriptInput).not.toContain("-webkit-text-fill-color: transparent;");
  });

  it("keeps Video token mirrors decorative while the textarea text remains visible", () => {
    const css = readStyle("ai-studio-video-theme.css");
    const plainTokenSegment = extractRuleBlock(
      css,
      ".video-properties-panel .prompt-enhanced-wrapper .prompt-token-highlight-segment"
    );

    expect(plainTokenSegment).toContain("color: transparent;");
    expect(css).not.toContain(
      ".prompt-enhanced-wrapper.has-token-highlight\n  .enhanced-prompt-input:not(:placeholder-shown) {\n  color: transparent;"
    );
  });

  it("keeps Expert Edit token mirrors decorative while the textarea text remains visible", () => {
    const css = readStyle("ai-studio-edit-expert.css");
    const promptInput = extractRuleBlock(
      css,
      ".edit-expert-prompt-shell .edit-expert-prompt-input"
    );
    const promptMirrorSegment = extractRuleBlock(css, ".edit-expert-prompt-highlight-segment");

    expect(promptMirrorSegment).toContain("color: transparent;");
    expect(promptInput).toContain("color: #f5f9ff;");
    expect(promptInput).not.toContain("color: transparent;");
  });
});
