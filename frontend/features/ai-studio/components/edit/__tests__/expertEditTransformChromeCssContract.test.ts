/**
 * Verifies the Expert Edit stage CSS keeps pixel clipping separate from transform chrome.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = path.resolve(process.cwd(), "styles/ai-studio-edit-expert.css");

const readCss = () => fs.readFileSync(cssPath, "utf8");

const readRuleBodies = (css: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "gm"))];
  const bodies = matches.map((match) => match[1]).filter(Boolean);
  if (bodies.length === 0) {
    throw new Error(`Missing CSS rule for ${selector}.`);
  }
  return bodies;
};

const readRuleBody = (css: string, selector: string) => {
  const [body] = readRuleBodies(css, selector);
  return body;
};

const expectRuleToContain = (css: string, selector: string, declaration: string) => {
  const matchingBody = readRuleBodies(css, selector).find((body) =>
    body.replace(/\s+/g, " ").includes(declaration)
  );
  expect(matchingBody, `${selector} should contain ${declaration}`).toBeTruthy();
};

const expectRuleNotToClip = (css: string, selector: string) => {
  const body = readRuleBodies(css, selector).join("\n");
  expect(body).not.toMatch(/overflow\s*:\s*(hidden|clip)/);
  expect(body).not.toMatch(/contain\s*:\s*paint/);
  expect(body).not.toMatch(/clip-path\s*:/);
  expect(body).not.toMatch(/mask(?:-image)?\s*:/);
};

describe("Expert Edit transform chrome CSS contract", () => {
  it("clips render pixels and chrome to the stage shell without clipping chrome hosts", () => {
    const css = readCss();

    expectRuleToContain(css, ".edit-expert-primary-stage-shell", "overflow: hidden");
    expectRuleToContain(css, ".edit-expert-stage-render-clip", "overflow: hidden");
    expectRuleToContain(css, ".edit-expert-primary-composition-surface", "overflow: hidden");
    expectRuleToContain(css, ".edit-expert-primary-canvas-frame-stack", "pointer-events: auto");
    expectRuleToContain(css, ".edit-expert-transform-chrome-layer", "overflow: visible");
    expectRuleToContain(css, ".edit-expert-transform-chrome-frame", "overflow: visible");

    expectRuleNotToClip(css, ".edit-expert-markup-modal-stage");
    expectRuleNotToClip(css, ".edit-expert-markup-viewport");
    expectRuleNotToClip(css, ".edit-expert-transform-chrome-layer");
    expectRuleNotToClip(css, ".edit-expert-transform-chrome-frame");
  });

  it("keeps transform handles visually counter-scaled against layer scale", () => {
    const css = readCss();

    expectRuleToContain(
      css,
      ".edit-expert-primary-layer-selection-overlay",
      "--edit-expert-transform-handle-counter-scale: 1"
    );
    expect(readRuleBody(css, ".edit-expert-primary-layer-selection-handle.is-corner-nw")).toContain(
      "scale(var(--edit-expert-transform-handle-counter-scale))"
    );
    expect(readRuleBody(css, ".edit-expert-primary-layer-selection-handle.is-corner-ne")).toContain(
      "scale(var(--edit-expert-transform-handle-counter-scale))"
    );
    expect(readRuleBody(css, ".edit-expert-primary-layer-selection-handle.is-corner-se")).toContain(
      "scale(var(--edit-expert-transform-handle-counter-scale))"
    );
    expect(readRuleBody(css, ".edit-expert-primary-layer-selection-handle.is-corner-sw")).toContain(
      "scale(var(--edit-expert-transform-handle-counter-scale))"
    );
  });
});
