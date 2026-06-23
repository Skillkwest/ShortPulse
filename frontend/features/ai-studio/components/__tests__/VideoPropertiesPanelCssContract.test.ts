/**
 * Verifies the Video panel generate footer keeps requirement messages in a protected lane.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = path.resolve(process.cwd(), "styles/ai-studio-video-theme.css");

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

const expectRuleToContain = (css: string, selector: string, declaration: string) => {
  const matchingBody = readRuleBodies(css, selector).find((body) =>
    body.replace(/\s+/g, " ").includes(declaration)
  );
  expect(matchingBody, `${selector} should contain ${declaration}`).toBeTruthy();
};

describe("VideoPropertiesPanel generate footer CSS contract", () => {
  it("lets the inner left and right Video column shells own the full-height panel surfaces", () => {
    const css = readCss();

    [
      ".video-properties-panel",
      ".video-properties-panel .video-properties-workspace",
      ".video-properties-panel .video-properties-primary-column",
      ".video-properties-panel .video-properties-main-columns",
      ".video-properties-panel .video-properties-main-column--left",
      ".video-properties-panel .video-properties-main-column--right",
      ".video-properties-panel .video-setup-row-shell",
      ".video-properties-panel .video-direction-column-shell",
    ].forEach((selector) => {
      expectRuleToContain(css, selector, "height: 100%");
    });
    expectRuleToContain(
      css,
      ".video-properties-panel .video-properties-main-columns",
      "max-height: 100%"
    );
    expectRuleToContain(
      css,
      ".video-properties-panel .video-direction-column-shell",
      "max-height: 100%"
    );
    expectRuleToContain(
      css,
      ".video-properties-panel .video-direction-column-shell",
      "border-radius: 0"
    );
  });

  it("keeps summary, requirement messages, and actions in separate grid tracks", () => {
    const css = readCss();

    expectRuleToContain(css, ".video-properties-panel .video-right-generate-slot", "display: grid");
    expectRuleToContain(
      css,
      ".video-properties-panel .video-right-generate-slot",
      "grid-template-columns: minmax(112px, max-content) minmax(0, 1fr) max-content"
    );
    expectRuleToContain(
      css,
      ".video-properties-panel .video-generate-summary-panel",
      "grid-column: 1"
    );
    expectRuleToContain(
      css,
      ".video-properties-panel .video-inline-warning-bubble",
      "grid-column: 2"
    );
    expectRuleToContain(
      css,
      ".video-properties-panel .video-right-generate-actions",
      "grid-column: 3"
    );
  });

  it("keeps shared AppMessage body copy compact inside inline requirement bubbles", () => {
    const css = readCss();
    const selector = ".video-properties-panel .video-inline-warning-bubble .app-message__body";

    expectRuleToContain(css, selector, "font-size: inherit");
    expectRuleToContain(css, selector, "font-weight: inherit");
    expectRuleToContain(css, selector, "line-height: inherit");
    expectRuleToContain(css, selector, "text-align: inherit");
  });

  it("keeps Lip Sync empty image and audio drop-zone titles the same size", () => {
    const css = readCss();
    const selector =
      ".video-properties-panel .video-lip-sync-drop-row .reference-drop-content .reference-drop-title";

    expectRuleToContain(css, selector, "font-size: 12px");
  });
});
