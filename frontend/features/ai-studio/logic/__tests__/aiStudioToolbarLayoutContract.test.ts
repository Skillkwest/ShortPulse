/**
 * AI Studio toolbar stylesheet contract tests.
 * Guards primary workflow button hover-leave behavior so inactive buttons do not flash accent rings.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const aiStudioLayoutCssPath = path.resolve(process.cwd(), "styles/ai-studio-layout.css");

const extractRuleBlockAfter = (css: string, selectorStart: string) => {
  const startIndex = css.indexOf(selectorStart);
  expect(startIndex).toBeGreaterThanOrEqual(0);

  const blockStart = css.indexOf("{", startIndex);
  expect(blockStart).toBeGreaterThanOrEqual(0);

  const blockEnd = css.indexOf("\n}", blockStart);
  expect(blockEnd).toBeGreaterThanOrEqual(0);

  return css.slice(startIndex, blockEnd + 2);
};

const extractTransitionDeclaration = (ruleBlock: string) => {
  const match = ruleBlock.match(/transition:\s*([\s\S]*?);/);
  expect(match).not.toBeNull();
  return match?.[1] ?? "";
};

describe("AI Studio toolbar layout contract", () => {
  it("does not animate inactive primary workflow borders or shadows after hover leaves", () => {
    const css = fs.readFileSync(aiStudioLayoutCssPath, "utf8");
    const inactivePrimaryRule = extractRuleBlockAfter(
      css,
      ".ai-toolbar[data-primary-active]\n  .toolbar-item:is("
    );
    const transition = extractTransitionDeclaration(inactivePrimaryRule);

    expect(inactivePrimaryRule).toContain('[data-tool-id="create"]');
    expect(inactivePrimaryRule).toContain('[data-tool-id="video"]');
    expect(inactivePrimaryRule).toContain('[data-tool-id="sound"]');
    expect(inactivePrimaryRule).toContain('[data-tool-id="edit"]');
    expect(inactivePrimaryRule).toContain(":not(.is-active):not(:hover):not(:focus-visible)");
    expect(inactivePrimaryRule).toContain("box-shadow: none;");
    expect(transition).toContain("background-color 0.15s ease");
    expect(transition).toContain("color 0.15s ease");
    expect(transition).toContain("transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)");
    expect(transition).not.toContain("all");
    expect(transition).not.toContain("border");
    expect(transition).not.toContain("box-shadow");
  });
});
