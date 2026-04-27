/**
 * Expert Create composer layout stylesheet contract tests.
 * Guards the desktop bottom-alignment between the chat toggle, inline generate,
 * prompt shell, and shared Styles control.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const createExpertComposerCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-expert-composer.css"
);
const createExpertChatCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-expert-chat.css"
);
const createExpertControlsCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-expert-controls.css"
);
const createExpertTokensCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-expert.tokens.css"
);
const aiStudioPropertiesCssPath = path.resolve(process.cwd(), "styles/ai-studio-properties.css");

const extractRuleBlock = (css: string, selector: string) => {
  const escapedSelector = selector
    .trim()
    .split(/\s+/)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const pattern = new RegExp(`(^|\\n)${escapedSelector} \\{[\\s\\S]*?\\n\\}`, "gm");
  const matches = Array.from(css.matchAll(pattern));
  const match = matches.at(-1);
  expect(match).not.toBeUndefined();
  return match?.[0] ?? "";
};

describe("create expert composer layout contract", () => {
  it("bottom-aligns the composer row columns on desktop", () => {
    const css = fs.readFileSync(createExpertComposerCssPath, "utf8");
    const composerRow = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .step2-input-row.agent-composer-row"
    );
    const leadingColumn = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-leading"
    );
    const inputShell = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-input-shell"
    );
    const postInputActions = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-post-input-actions"
    );
    const inlineActions = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-row .agent-inline-actions"
    );
    const stylesControl = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-leading .edit-expert-styles-control"
    );
    const stylesButton = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-leading .edit-expert-styles-btn"
    );
    const trailingColumn = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-trailing-column"
    );
    const trailingStack = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-trailing-stack"
    );
    const tokensCss = fs.readFileSync(createExpertTokensCssPath, "utf8");
    const controlsCss = fs.readFileSync(createExpertControlsCssPath, "utf8");
    const bottomBlock = extractRuleBlock(controlsCss, ".create-expert-bottom-block");

    expect(tokensCss).toContain("--create-expert-inline-gutter: clamp(9px, 2.05vw, 25px);");
    expect(tokensCss).toContain("--create-expert-bottom-block-offset: 4px;");
    expect(bottomBlock).toContain("margin-top: var(--create-expert-bottom-block-offset);");
    expect(composerRow).toContain("align-items: flex-end;");
    expect(leadingColumn).toContain("align-self: flex-end;");
    expect(inputShell).toContain("align-self: flex-end;");
    expect(postInputActions).toContain("align-items: flex-end;");
    expect(postInputActions).toContain("align-self: flex-end;");
    expect(inlineActions).toContain("align-items: flex-end;");
    expect(inlineActions).toContain("align-self: flex-end;");
    expect(stylesControl).toContain("transform: none;");
    expect(stylesControl).toContain("width: 62px;");
    expect(stylesButton).toContain("height: 62px;");
    expect(trailingColumn).toContain("flex-direction: column;");
    expect(trailingColumn).toContain("gap: 8px;");
    expect(trailingStack).toContain("flex-direction: column;");
    expect(
      extractRuleBlock(css, ".create-expert-panel .create-expert-prompt-step .agent-composer-row")
    ).toContain("margin-bottom: 14px;");
  });

  it("anchors the expert create composer in a bottom overlay lane above chat history", () => {
    const css = fs.readFileSync(createExpertChatCssPath, "utf8");
    const overlayZone = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .create-expert-chat-composer-overlay-zone"
    );
    const baseLayer = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .create-expert-chat-composer-base-layer"
    );
    const overlay = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .create-expert-chat-composer-overlay"
    );
    const chatSpacer = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-chat-inline-spacer.create-expert-chat-spacer"
    );
    const expandedOverlayZone = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .create-expert-chat-composer-overlay-zone.is-composer-expanded .create-expert-chat-composer-base-layer"
    );

    expect(overlayZone).toContain("position: relative;");
    expect(overlayZone).toContain("padding-bottom: calc(");
    expect(overlayZone).toContain("var(--create-expert-chat-composer-overlay-reserve)");
    expect(overlayZone).toContain("var(--create-expert-chat-composer-overlay-bottom-offset)");
    expect(baseLayer).toContain("z-index: 1;");
    expect(baseLayer).not.toContain("transition:");
    expect(overlay).toContain("position: absolute;");
    expect(overlay).toContain("bottom: var(--create-expert-chat-composer-overlay-bottom-offset);");
    expect(overlay).toContain("z-index: 9;");
    expect(chatSpacer).toContain("min-height: 18px;");
    expect(expandedOverlayZone).toContain("filter: blur(6px);");
  });

  it("keeps functional spinners animated inside the motion-flat properties rail", () => {
    const css = fs.readFileSync(aiStudioPropertiesCssPath, "utf8");

    expect(css).toContain('*:not([class*="spinner"]):not([class*="loading-spinner"])');
    expect(css).toContain("animation: none !important;");
  });

  it("renders pulse guided assistant responses as transparent instructional text", () => {
    const css = fs.readFileSync(createExpertChatCssPath, "utf8");
    const pulseBubble = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-message.agent-assistant.agent-message--pulse-guided"
    );
    const pulseLead = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-message.agent-assistant.agent-message--pulse-guided .agent-message-rich-lead"
    );
    const pulseParagraph = extractRuleBlock(
      css,
      ".create-expert-panel .create-expert-prompt-step .agent-message.agent-assistant.agent-message--pulse-guided .agent-message-rich-paragraph"
    );

    expect(pulseBubble).toContain("border-color: transparent;");
    expect(pulseBubble).toContain("background: transparent;");
    expect(pulseBubble).toContain("box-shadow: none;");
    expect(pulseLead).toContain("font-weight: 750;");
    expect(pulseParagraph).toContain("font-weight: 700;");
  });

  it("matches the collapsed empty prompt height to the adjacent create control columns", () => {
    const composerCss = fs.readFileSync(createExpertComposerCssPath, "utf8");
    const controlsCss = fs.readFileSync(createExpertControlsCssPath, "utf8");
    const tokensCss = fs.readFileSync(createExpertTokensCssPath, "utf8");
    const inputShell = extractRuleBlock(
      composerCss,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-input-shell .agent-input-prefab"
    );
    const inputSurface = extractRuleBlock(
      composerCss,
      ".create-expert-panel .create-expert-prompt-step .agent-input-prefab"
    );
    const inputField = extractRuleBlock(
      composerCss,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-input-shell .agent-input-prefab-field"
    );
    const chatToggleShell = extractRuleBlock(
      composerCss,
      ".create-expert-panel .create-expert-prompt-step .agent-composer-row .agent-chat-mode-row.agent-chat-mode-toggle-shell"
    );
    const controlsRow = extractRuleBlock(controlsCss, ".create-expert-controls-row");

    expect(tokensCss).toContain("--create-expert-agent-input-min-height: 64px;");
    expect(tokensCss).toContain("--create-expert-agent-input-max-height: 520px;");
    expect(tokensCss).toContain("--create-expert-chat-composer-overlay-reserve: 126px;");
    expect(tokensCss).toContain("--create-expert-chat-composer-overlay-bottom-offset: 22px;");
    expect(tokensCss).toContain("--create-expert-agent-input-bg: #25292f;");
    expect(inputShell).toContain("min-height: var(--create-expert-agent-input-min-height);");
    expect(inputShell).toContain("overflow: hidden;");
    expect(inputSurface).toContain("background: var(--create-expert-agent-input-bg);");
    expect(inputField).toContain("transition: height 60ms cubic-bezier(0.22, 0.61, 0.36, 1);");
    expect(chatToggleShell).toContain("min-height: 64px;");
    expect(controlsRow).toContain("margin-top: 6px;");
  });
});
