/**
 * Verifies the Presets Library keeps the same minimal scrollbar treatment as right-rail panels.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readCss = (fileName: string) =>
  fs.readFileSync(path.resolve(process.cwd(), "styles", fileName), "utf8");

const readRuleBody = (css: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "m"));
  if (!match?.[1]) {
    throw new Error(`Missing CSS rule for ${selector}.`);
  }
  return match[1].replace(/\s+/g, " ");
};

const expectThinScrollbarContainer = (css: string, selector: string) => {
  const body = readRuleBody(css, selector);
  expect(body).toContain("scrollbar-gutter: stable both-edges");
  expect(body).toContain("scrollbar-width: thin");
  expect(body).toContain("scrollbar-color: rgba(201, 205, 214, 0.2) transparent");
};

const expectFourPixelWebkitScrollbar = (css: string, selector: string) => {
  const body = readRuleBody(css, `${selector}::-webkit-scrollbar`);
  expect(body).toContain("width: 4px");
  expect(body).toContain("height: 4px");
};

describe("Presets Library scrollbar CSS contract", () => {
  it("keeps unified and prompt preset scrollbars minimal", () => {
    const css = readCss("ai-studio-presets-library.css");

    expectThinScrollbarContainer(css, ".merged-presets-library-body");
    expectFourPixelWebkitScrollbar(css, ".merged-presets-library-body");
    expectThinScrollbarContainer(css, ".presets-library-scroll");
    expectFourPixelWebkitScrollbar(css, ".presets-library-scroll");
  });

  it("keeps pulse preset scrollbars minimal", () => {
    const css = readCss("ai-studio-pulse-presets-library.css");

    expectThinScrollbarContainer(css, ".pulse-presets-library-scroll");
    expectFourPixelWebkitScrollbar(css, ".pulse-presets-library-scroll");
  });
});
