/**
 * Verifies the Expert Edit stage CSS keeps pixel clipping separate from transform chrome.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = path.resolve(process.cwd(), "styles/ai-studio-edit-expert.css");

const readCss = () => fs.readFileSync(cssPath, "utf8");

const readRuleBody = (css: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!match?.[1]) {
    throw new Error(`Missing CSS rule for ${selector}.`);
  }
  return match[1];
};

const expectRuleToContain = (css: string, selector: string, declaration: string) => {
  expect(readRuleBody(css, selector).replace(/\s+/g, " ")).toContain(declaration);
};

const expectRuleNotToClip = (css: string, selector: string) => {
  const body = readRuleBody(css, selector);
  expect(body).not.toMatch(/overflow\s*:\s*(hidden|clip)/);
  expect(body).not.toMatch(/contain\s*:\s*paint/);
  expect(body).not.toMatch(/clip-path\s*:/);
  expect(body).not.toMatch(/mask(?:-image)?\s*:/);
};

describe("Expert Edit transform chrome CSS contract", () => {
  it("clips render pixels without clipping transform chrome hosts", () => {
    const css = readCss();

    expectRuleToContain(css, ".edit-expert-stage-render-clip", "overflow: hidden");
    expectRuleToContain(css, ".edit-expert-primary-composition-surface", "overflow: hidden");
    expectRuleToContain(css, ".edit-expert-primary-canvas-frame-stack", "pointer-events: auto");
    expectRuleToContain(css, ".edit-expert-transform-chrome-layer", "overflow: visible");
    expectRuleToContain(css, ".edit-expert-transform-chrome-frame", "overflow: visible");

    expectRuleNotToClip(css, ".edit-expert-primary-stage-shell");
    expectRuleNotToClip(css, ".edit-expert-markup-modal-stage");
    expectRuleNotToClip(css, ".edit-expert-markup-viewport");
    expectRuleNotToClip(css, ".edit-expert-transform-chrome-layer");
    expectRuleNotToClip(css, ".edit-expert-transform-chrome-frame");
  });
});
