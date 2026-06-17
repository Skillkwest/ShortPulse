/**
 * Expert Edit layout stylesheet contract tests.
 * Guards the left-rail spacing/shadow cleanup and the full-height shell behavior.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const expertEditCssPath = path.resolve(process.cwd(), "styles/ai-studio-edit-expert.css");

const extractRuleBlock = (css: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\n)${escapedSelector} \\{[\\s\\S]*?\\n\\}`, "m");
  const match = css.match(pattern);
  expect(match).not.toBeNull();
  return match?.[0] ?? "";
};

describe("expert edit layout contract", () => {
  it("uses a uniform vertical gap across the left sidebar stack", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const sidebarShell = extractRuleBlock(css, ".edit-expert-sidebar-shell");
    const modeToPresets = extractRuleBlock(
      css,
      ".edit-expert-mode-rail-panel + .edit-expert-preset-toolbar-card"
    );
    const presetsToLayers = extractRuleBlock(
      css,
      ".edit-expert-preset-toolbar-card + .edit-expert-layers-toolbar--sidebar"
    );
    const layersToUtilities = extractRuleBlock(
      css,
      ".edit-expert-layers-toolbar--sidebar + .edit-expert-utility-actions"
    );
    const utilityActions = extractRuleBlock(css, ".edit-expert-utility-actions");

    expect(sidebarShell).toContain("gap: 24px;");
    expect(modeToPresets).toContain("margin-top: 0;");
    expect(presetsToLayers).toContain("margin-top: 0;");
    expect(layersToUtilities).toContain("margin-top: 0;");
    expect(utilityActions).toContain("padding: 0;");
  });

  it("animates the sidebar mode panel and layers body instead of snapping them open and closed", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const modeShell = extractRuleBlock(css, ".edit-expert-sidebar-mode-panel-shell");
    const collapsedModeShell = extractRuleBlock(
      css,
      ".edit-expert-sidebar-mode-panel-shell.is-collapsed"
    );
    const modeShellInner = extractRuleBlock(css, ".edit-expert-sidebar-mode-panel-shell-inner");
    const layersListShell = extractRuleBlock(css, ".edit-expert-layers-toolbar-list-shell");
    const collapsedLayersListShell = extractRuleBlock(
      css,
      ".edit-expert-layers-toolbar-list-shell.is-collapsed"
    );
    const layersListTransition = extractRuleBlock(
      css,
      ".edit-expert-layers-toolbar-list-shell .edit-expert-layers-toolbar-list-content"
    );

    expect(modeShell).toContain("grid-template-rows: 1fr;");
    expect(modeShell).toContain("grid-template-rows 240ms cubic-bezier(0.22, 0.61, 0.36, 1)");
    expect(collapsedModeShell).toContain("grid-template-rows: 0fr;");
    expect(collapsedModeShell).toContain(
      "margin-bottom: calc(-1 * var(--edit-expert-sidebar-stack-gap));"
    );
    expect(modeShellInner).toContain("overflow: hidden;");
    expect(modeShellInner).toContain("transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)");
    expect(layersListShell).toContain("grid-template-rows: 1fr;");
    expect(layersListShell).toContain(
      "transition: grid-template-rows 240ms cubic-bezier(0.22, 0.61, 0.36, 1);"
    );
    expect(collapsedLayersListShell).toContain("grid-template-rows: 0fr;");
    expect(layersListTransition).toContain("overflow: hidden;");
    expect(layersListTransition).toContain("transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)");
  });

  it("keeps the layer delete affordance centered while hover and focus turn it red", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const deleteButton = extractRuleBlock(css, ".edit-expert-layer-delete-btn");
    const deleteButtonHover = extractRuleBlock(css, ".edit-expert-layer-delete-btn:hover");
    const deleteButtonFocus = extractRuleBlock(css, ".edit-expert-layer-delete-btn:focus-visible");
    const deleteButtonActive = extractRuleBlock(css, ".edit-expert-layer-delete-btn:active");

    expect(deleteButton).toContain("position: static;");
    expect(deleteButton).toContain("flex: 0 0 auto;");
    expect(deleteButton).toContain("transform: none;");
    expect(deleteButtonHover).toContain("border-color: rgba(231, 76, 76, 0.72);");
    expect(deleteButtonHover).toContain("background: rgba(231, 76, 76, 0.18);");
    expect(deleteButtonHover).toContain("color: rgba(255, 117, 117, 0.98);");
    expect(deleteButtonHover).toContain("transform: none;");
    expect(deleteButtonFocus).toContain("transform: none;");
    expect(deleteButtonActive).toContain("transform: none;");
  });

  it("keeps the left sidebar shell flat while giving every left-rail card the shared shadow", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const sidebarShell = extractRuleBlock(css, ".edit-expert-sidebar-shell");
    const modeRailPanel = extractRuleBlock(css, ".edit-expert-mode-rail-panel");
    const presetCard = extractRuleBlock(css, ".edit-expert-preset-toolbar-card");
    const layersTitleCard = extractRuleBlock(css, ".edit-expert-layers-toolbar-title-card");
    const layersCard = extractRuleBlock(css, ".edit-expert-layers-toolbar-card");

    expect(sidebarShell).toContain("border-radius: 0;");
    expect(sidebarShell).toContain("box-shadow: none;");
    expect(modeRailPanel).toContain("0 12px 28px var(--edit-expert-neutral-shadow)");
    expect(modeRailPanel).toContain("inset 0 1px 0 rgba(255, 255, 255, 0.03)");
    expect(presetCard).toContain("box-shadow: 0 12px 28px var(--edit-expert-neutral-shadow);");
    expect(layersTitleCard).toContain("box-shadow: 0 12px 28px var(--edit-expert-neutral-shadow);");
    expect(layersCard).toContain("box-shadow: 0 12px 28px var(--edit-expert-neutral-shadow);");
  });

  it("lets the expert edit center column fill the available lane", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const mainStage = extractRuleBlock(css, ".edit-expert-main-stage");
    const presetToolbar = extractRuleBlock(css, ".edit-expert-preset-toolbar");
    const sidebarShell = extractRuleBlock(css, ".edit-expert-sidebar-shell");
    const primaryColumn = extractRuleBlock(css, ".edit-expert-primary-column");
    const primaryColumnShell = extractRuleBlock(css, ".edit-expert-primary-column-shell");
    const centerColumnWrappers = extractRuleBlock(
      css,
      ".edit-expert-primary-column > .edit-expert-column-wrapper--center"
    );
    const postStageWrapper = extractRuleBlock(
      css,
      ".edit-expert-primary-column > .edit-expert-post-stage-wrapper"
    );
    const primaryStageShell = extractRuleBlock(css, ".edit-expert-primary-stage-shell");
    const stageCameraLayer = extractRuleBlock(css, ".edit-expert-markup-viewport");
    const inlineStageCameraLayer = extractRuleBlock(
      css,
      ".edit-expert-primary-stage-shell .edit-expert-stage-camera-layer"
    );
    const secondaryRow = extractRuleBlock(css, ".edit-expert-secondary-row");

    expect(css).toContain(".edit-expert-main-stage");
    expect(css).not.toContain("backdrop-filter: blur(10px);");
    expect(mainStage).toContain("margin: 0;");
    expect(mainStage).toContain("justify-items: start;");
    expect(mainStage).toContain("min-height: 0;");
    expect(mainStage).toContain("height: 100%;");
    expect(mainStage).toContain("max-height: 100%;");
    expect(css).toContain("align-items: stretch;");
    expect(css).toContain("flex: 1 1 auto;");
    expect(presetToolbar).toContain("align-self: stretch;");
    expect(presetToolbar).toContain("height: 100%;");
    expect(sidebarShell).toContain("flex: 1 1 auto;");
    expect(sidebarShell).toContain("min-height: 0;");
    expect(sidebarShell).toContain("height: 100%;");
    expect(primaryColumn).toContain("width: 100%;");
    expect(primaryColumn).toContain("align-items: stretch;");
    expect(primaryColumn).toContain("align-self: stretch;");
    expect(primaryColumn).toContain("justify-self: start;");
    expect(primaryColumn).toContain("min-height: 0;");
    expect(primaryColumn).toContain("height: 100%;");
    expect(primaryColumn).toContain("max-height: 100%;");
    expect(primaryColumnShell).toContain("width: 100%;");
    expect(primaryColumnShell).toContain("max-width: none;");
    expect(primaryColumnShell).toContain("display: flex;");
    expect(primaryColumnShell).toContain("align-items: stretch;");
    expect(primaryColumnShell).toContain("align-self: stretch;");
    expect(primaryColumnShell).toContain("border-radius: 0;");
    expect(primaryColumnShell).toContain("flex: 1 1 auto;");
    expect(primaryColumnShell).toContain("min-height: 0;");
    expect(primaryColumnShell).toContain("height: 100%;");
    expect(centerColumnWrappers).toContain("align-self: stretch;");
    expect(centerColumnWrappers).not.toContain("align-items: stretch;");
    expect(postStageWrapper).toContain("align-items: stretch;");
    expect(primaryStageShell).toContain("width: 100%;");
    expect(primaryStageShell).toContain("flex: 1 1 auto;");
    expect(primaryStageShell).toContain("align-items: center;");
    expect(primaryStageShell).toContain("justify-content: center;");
    expect(stageCameraLayer).toContain("justify-content: center;");
    expect(inlineStageCameraLayer).toContain("align-items: center;");
    expect(inlineStageCameraLayer).toContain("justify-content: center;");
    expect(inlineStageCameraLayer).not.toContain("flex-start");
    expect(secondaryRow).toContain("max-width: 100%;");
  });

  it("does not create an implicit second grid column when the edit layout stacks", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");

    expect(css).toContain("@container ai-properties (max-width: 760px)");
    expect(css).not.toContain("@container ai-properties (max-width: 980px)");
    expect(css).toContain(".edit-expert-preset-toolbar,\n  .edit-expert-primary-column");
    expect(css).toContain("grid-column: 1;");
    expect(css).toContain(".edit-expert-primary-column {\n    grid-row: 2;");
  });

  it("bottom-docks the edit control deck inside the center column", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const postStageWrapper = extractRuleBlock(css, ".edit-expert-post-stage-wrapper");
    const overlayZone = extractRuleBlock(css, ".edit-expert-post-stage-overlay-zone");
    const baseLayer = extractRuleBlock(css, ".edit-expert-post-stage-base-layer");
    const expandedOverlayZone = extractRuleBlock(
      css,
      ".edit-expert-post-stage-overlay-zone.is-composer-expanded .edit-expert-post-stage-base-layer"
    );
    const expandedStageShell = extractRuleBlock(
      css,
      ".edit-expert-primary-column-shell.is-composer-expanded .edit-expert-primary-stage-shell"
    );
    const composerOverlay = extractRuleBlock(css, ".edit-expert-post-stage-composer-overlay");
    const bottomRow = extractRuleBlock(css, ".edit-expert-bottom-row");
    const promptRow = extractRuleBlock(css, ".edit-expert-prompt-row");
    const promptInput = extractRuleBlock(
      css,
      ".edit-expert-prompt-shell .edit-expert-prompt-input"
    );

    expect(postStageWrapper).toContain("width: 100%;");
    expect(postStageWrapper).toContain("margin-top: auto;");
    expect(postStageWrapper).toContain("flex: 0 0 auto;");
    expect(overlayZone).toContain("position: relative;");
    expect(overlayZone).toContain("max-width: 100%;");
    expect(overlayZone).toContain("padding-bottom: var(--edit-expert-post-stage-overlay-reserve);");
    expect(baseLayer).toContain("z-index: 1;");
    expect(expandedOverlayZone).toContain("filter: blur(6px);");
    expect(expandedStageShell).toContain("filter: blur(6px);");
    expect(composerOverlay).toContain("position: absolute;");
    expect(composerOverlay).toContain("bottom: 0;");
    expect(composerOverlay).toContain("z-index: 9;");
    expect(bottomRow).toContain("min-height: var(--edit-expert-prompt-input-min-height);");
    expect(promptRow).toContain("min-height: var(--edit-expert-prompt-input-min-height);");
    expect(promptInput).toContain("transition: height 120ms cubic-bezier(0.22, 0.61, 0.36, 1);");
  });
});
