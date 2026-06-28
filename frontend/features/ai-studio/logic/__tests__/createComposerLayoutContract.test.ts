/**
 * Create composer layout stylesheet contract tests.
 * Guards the desktop bottom-alignment between the chat toggle, inline generate,
 * prompt shell, and shared Styles control.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const createComposerLayoutCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-composer-layout.css"
);
const createComposerChatCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-composer-chat.css"
);
const createComposerControlsCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-composer-controls.css"
);
const createComposerPresetsCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-composer-presets.css"
);
const prefabsAgentCssPath = path.resolve(process.cwd(), "styles/prefabs-agent.css");
const createComposerTokensCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-composer.tokens.css"
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

describe("create composer layout contract", () => {
  it("keeps the active Pulse workspace as a desktop two-column flex row", () => {
    const css = fs.readFileSync(createComposerTokensCssPath, "utf8");
    const pulseColumns = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-panel-shell, .create-composer-panel .create-composer-pulse-columns"
    );

    expect(pulseColumns).toContain("display: flex;");
    expect(pulseColumns).toContain("flex-direction: row;");
    expect(css).toContain("--create-composer-left-rail-width: 236px;");
  });

  it("keeps Pulse visual surfaces on the two column wrappers", () => {
    const css = fs.readFileSync(createComposerTokensCssPath, "utf8");
    const createPropertiesRail = extractRuleBlock(
      css,
      '.ai-studio-page[data-selected-tool="create"]:not([data-selected-tool="canvas"]) .panel.ai-panel.ai-properties'
    );
    const pulseRoot = extractRuleBlock(css, ".create-composer-panel.is-pulse-rail-active");
    const pulseWorkspace = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-pulse-columns"
    );
    const pulseColumns = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-pulse-columns > .create-composer-left-panel, .create-composer-panel .create-composer-pulse-columns > .create-composer-right-panel"
    );
    const pulseInnerColumns = extractRuleBlock(
      css,
      ".create-composer-panel.is-pulse-rail-active .create-composer-left-panel-inner, .create-composer-panel.is-pulse-rail-active .create-composer-right-panel-inner"
    );

    expect(createPropertiesRail).toContain("background: transparent;");
    expect(createPropertiesRail).toContain("padding: 0;");
    expect(pulseRoot).toContain("background: transparent;");
    expect(pulseRoot).toContain("box-shadow: none;");
    expect(pulseRoot).toContain("overflow: hidden;");
    expect(pulseWorkspace).toContain("background: transparent;");
    expect(pulseWorkspace).toContain("box-shadow: none;");
    expect(pulseColumns).toContain("align-self: stretch;");
    expect(pulseColumns).toContain("height: 100%;");
    expect(pulseColumns).toContain("min-height: 0;");
    expect(pulseColumns).toContain("border: 0;");
    expect(pulseColumns).toContain("border-radius: 0;");
    expect(pulseColumns).toContain("background: #131518;");
    expect(pulseColumns).toContain("box-shadow: none;");
    expect(pulseInnerColumns).toContain("padding: 0;");
    expect(pulseInnerColumns).toContain("background: transparent;");
  });

  it("bottom-aligns the composer row columns on desktop", () => {
    const css = fs.readFileSync(createComposerLayoutCssPath, "utf8");
    const composerRow = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .step2-input-row.agent-composer-row"
    );
    const leadingColumn = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-leading"
    );
    const inputShell = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-input-shell"
    );
    const postInputActions = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-post-input-actions"
    );
    const inlineActions = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-row .agent-inline-actions"
    );
    const stylesControl = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-leading .edit-expert-styles-control"
    );
    const stylesButton = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-leading .edit-expert-styles-btn"
    );
    const trailingColumn = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-trailing-column"
    );
    const trailingStack = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-trailing-stack"
    );
    const tokensCss = fs.readFileSync(createComposerTokensCssPath, "utf8");
    const controlsCss = fs.readFileSync(createComposerControlsCssPath, "utf8");
    const bottomBlock = extractRuleBlock(controlsCss, ".create-composer-bottom-block");

    expect(tokensCss).toContain("--create-composer-inline-gutter: clamp(9px, 2.05vw, 25px);");
    expect(tokensCss).toContain("--create-composer-bottom-block-offset: 4px;");
    expect(bottomBlock).toContain("margin-top: var(--create-composer-bottom-block-offset);");
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
      extractRuleBlock(
        css,
        ".create-composer-panel .create-composer-prompt-step .agent-composer-row"
      )
    ).toContain("margin-bottom: 14px;");
  });

  it("anchors the Create composer in a bottom overlay lane above chat history", () => {
    const css = fs.readFileSync(createComposerChatCssPath, "utf8");
    const overlayZone = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .create-composer-chat-composer-overlay-zone"
    );
    const baseLayer = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .create-composer-chat-composer-base-layer"
    );
    const overlay = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .create-composer-chat-composer-overlay"
    );
    const chatSpacer = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-chat-inline-spacer.create-composer-chat-spacer"
    );
    const expandedOverlayZone = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .create-composer-chat-composer-overlay-zone.is-composer-expanded .create-composer-chat-composer-base-layer"
    );

    expect(overlayZone).toContain("position: relative;");
    expect(overlayZone).toContain("padding-bottom: calc(");
    expect(overlayZone).toContain("var(--create-composer-chat-composer-overlay-reserve)");
    expect(overlayZone).toContain("var(--create-composer-chat-composer-overlay-bottom-offset)");
    expect(baseLayer).toContain("z-index: 1;");
    expect(baseLayer).not.toContain("transition:");
    expect(overlay).toContain("position: absolute;");
    expect(overlay).toContain(
      "bottom: var(--create-composer-chat-composer-overlay-bottom-offset);"
    );
    expect(overlay).toContain("z-index: 9;");
    expect(chatSpacer).toContain("min-height: 18px;");
    expect(expandedOverlayZone).toContain("filter: blur(6px);");
  });

  it("keeps the active Pulse history composer in a bottom flow lane", () => {
    const css = fs.readFileSync(createComposerChatCssPath, "utf8");
    const activePulseFlowShell = extractRuleBlock(
      css,
      ".create-composer-panel.is-pulse-rail-active:not(.create-composer-panel--no-history) .create-composer-flow-shell"
    );
    const activePulseMessages = extractRuleBlock(
      css,
      ".create-composer-panel.is-pulse-rail-active .create-composer-prompt-step .agent-messages"
    );

    expect(activePulseFlowShell).toContain("flex: 1 1 auto;");
    expect(activePulseFlowShell).toContain("min-height: 0;");
    expect(activePulseMessages).toContain("flex: 1 1 auto;");
    expect(activePulseMessages).toContain("max-height: none;");
    expect(activePulseMessages).toContain("overflow-y: auto;");
  });

  it("keeps functional spinners animated inside the motion-flat properties rail", () => {
    const css = fs.readFileSync(aiStudioPropertiesCssPath, "utf8");

    expect(css).toContain('*:not([class*="spinner"]):not([class*="loading-spinner"])');
    expect(css).toContain("animation: none !important;");
  });

  it("keeps the shared agent send button as a centered flex box with a real spinner box", () => {
    const css = fs.readFileSync(prefabsAgentCssPath, "utf8");
    const sendButton = extractRuleBlock(css, ".agent-send-prefab");
    const spinner = extractRuleBlock(css, ".agent-send-spinner");

    expect(sendButton).toContain("display: inline-flex;");
    expect(sendButton).toContain("align-items: center;");
    expect(sendButton).toContain("justify-content: center;");
    expect(spinner).toContain("display: block;");
    expect(spinner).toContain("flex: 0 0 16px;");
    expect(spinner).toContain("width: 16px;");
    expect(spinner).toContain("height: 16px;");
  });

  it("renders pulse guided assistant responses as transparent instructional text", () => {
    const css = fs.readFileSync(createComposerChatCssPath, "utf8");
    const pulseBubble = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-message.agent-assistant.agent-message--pulse-guided"
    );
    const pulseLead = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-message.agent-assistant.agent-message--pulse-guided .agent-message-rich-lead"
    );
    const pulseParagraph = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-message.agent-assistant.agent-message--pulse-guided .agent-message-rich-paragraph"
    );
    expect(pulseBubble).toContain("border-color: transparent;");
    expect(pulseBubble).toContain("background: transparent;");
    expect(pulseBubble).toContain("box-shadow: none;");
    expect(pulseBubble).toContain("color: #25a9bf !important;");
    expect(pulseLead).toContain("color: #25a9bf !important;");
    expect(pulseLead).toContain("font-weight: 500;");
    expect(pulseParagraph).toContain("color: #25a9bf !important;");
    expect(pulseParagraph).toContain("font-weight: 400;");
  });

  it("keeps latest Standard assistant replies on the brand blue color", () => {
    const css = fs.readFileSync(createComposerChatCssPath, "utf8");
    const latestAssistantOnly = extractRuleBlock(
      css,
      ".create-composer-panel .create-composer-prompt-step .agent-chat-panel--latest-assistant-only .agent-message.agent-assistant .tiny"
    );

    expect(latestAssistantOnly).toContain("color: #25a9bf !important;");
    expect(latestAssistantOnly).toContain("font-weight: 400;");
  });

  it("uses brand blue for the inactive Pulse rail title and icon only before activation", () => {
    const css = fs.readFileSync(createComposerPresetsCssPath, "utf8");
    const inactivePulseRailTitle = extractRuleBlock(
      css,
      ".create-composer-presets-card.is-awaiting-pulse-selection .create-composer-presets-title, .create-composer-presets-card.is-awaiting-pulse-selection .create-composer-presets-title-icon"
    );

    expect(inactivePulseRailTitle).toContain("color: var(--color-teal);");
  });

  it("truncates editable More Pulses chip labels before the edit button", () => {
    const css = fs.readFileSync(createComposerPresetsCssPath, "utf8");
    const editableChip = extractRuleBlock(
      css,
      ".create-composer-presets-chip-item.is-editable .create-composer-presets-chip"
    );
    const chipLabel = extractRuleBlock(css, ".create-composer-presets-chip-label");

    expect(editableChip).toContain("padding-right: 36px;");
    expect(chipLabel).toContain("overflow: hidden;");
    expect(chipLabel).toContain("text-overflow: ellipsis;");
    expect(chipLabel).toContain("white-space: nowrap;");
  });

  it("keeps user bubble body copy at the same font size as Standard assistant replies", () => {
    const css = fs.readFileSync(createComposerChatCssPath, "utf8");
    const userBodyCopyPattern =
      /\.create-composer-panel\s+\.create-composer-prompt-step\s+\.agent-message\.agent-user\s+\.agent-message-rich-option-description\s*\{[\s\S]*?font-size:\s*14px;/m;
    const assistantBodyCopyPattern =
      /\.create-composer-panel\s+\.create-composer-prompt-step\s+\.agent-message\.agent-assistant:not\(\.agent-intro\):not\(\.agent-thinking-message\):not\(\s*\.agent-message--pulse-guided\s*\)\s+\.agent-message-rich-option-description\s*\{[\s\S]*?font-size:\s*14px;/m;

    expect(css).toMatch(userBodyCopyPattern);
    expect(css).toMatch(assistantBodyCopyPattern);
  });

  it("matches the collapsed empty prompt height to the adjacent create control columns", () => {
    const composerCss = fs.readFileSync(createComposerLayoutCssPath, "utf8");
    const controlsCss = fs.readFileSync(createComposerControlsCssPath, "utf8");
    const tokensCss = fs.readFileSync(createComposerTokensCssPath, "utf8");
    const inputShell = extractRuleBlock(
      composerCss,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-input-shell .agent-input-prefab"
    );
    const inputSurface = extractRuleBlock(
      composerCss,
      ".create-composer-panel .create-composer-prompt-step .agent-input-prefab"
    );
    const inputField = extractRuleBlock(
      composerCss,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-input-shell .agent-input-prefab-field"
    );
    const chatToggleShell = extractRuleBlock(
      composerCss,
      ".create-composer-panel .create-composer-prompt-step .agent-composer-row .agent-chat-mode-row.agent-chat-mode-toggle-shell"
    );
    const controlsRow = extractRuleBlock(controlsCss, ".create-composer-controls-row");

    expect(tokensCss).toContain("--create-composer-agent-input-min-height: 68px;");
    expect(tokensCss).toContain("--create-composer-agent-input-max-height: 520px;");
    expect(tokensCss).toContain("--create-composer-chat-composer-overlay-reserve: 126px;");
    expect(tokensCss).toContain("--create-composer-chat-composer-overlay-bottom-offset: 22px;");
    expect(tokensCss).toContain("--create-composer-agent-input-bg: #25292f;");
    expect(inputShell).toContain("min-height: var(--create-composer-agent-input-min-height);");
    expect(inputShell).toContain("overflow: hidden;");
    expect(inputSurface).toContain("background: var(--create-composer-agent-input-bg);");
    expect(inputField).toContain("transition: height 60ms cubic-bezier(0.22, 0.61, 0.36, 1);");
    expect(chatToggleShell).toContain("min-height: var(--create-composer-agent-input-min-height);");
    expect(controlsRow).toContain("margin-top: 6px;");
  });

  it("centers the no-history composer shell until conversation history naturally fills the column", () => {
    const tokensCss = fs.readFileSync(createComposerTokensCssPath, "utf8");
    const emptyStateShell = extractRuleBlock(
      tokensCss,
      ".create-composer-panel--no-history .create-composer-empty-state-shell"
    );
    const topSpacer = extractRuleBlock(
      tokensCss,
      ".create-composer-panel--no-history .create-composer-empty-preview-frame"
    );
    const centerStack = extractRuleBlock(
      tokensCss,
      ".create-composer-panel--no-history .create-composer-empty-center-stack"
    );
    const bottomBlock = extractRuleBlock(
      tokensCss,
      ".create-composer-panel--no-history .create-composer-bottom-block"
    );

    expect(emptyStateShell).toContain("grid-template-rows: minmax(0, 1fr) auto minmax(0, 1fr);");
    expect(emptyStateShell).toContain("align-items: stretch;");
    expect(topSpacer).toContain("height: 100%;");
    expect(topSpacer).toContain("max-height: 190px;");
    expect(centerStack).toContain("grid-template-rows: auto auto auto;");
    expect(centerStack).toContain("align-self: center;");
    expect(bottomBlock).toContain("min-height: 0;");
  });
});
