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
      ".edit-expert-layers-toolbar-list-shell .edit-expert-layers-toolbar-list"
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

  it("lets the expert edit stage shell fill the available inner column area", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");

    expect(css).toContain(".edit-expert-main-stage");
    expect(css).toContain("align-items: stretch;");
    expect(css).toContain("flex: 1 1 auto;");
    expect(css).toContain(".edit-expert-primary-column");
    expect(css).toContain("width: 100%;");
    expect(css).toContain("align-self: stretch;");
    expect(css).toContain(".edit-expert-primary-column-shell");
    expect(css).toContain("height: 100%;");
  });

  it("anchors the prompt composer in a bottom overlay lane above the post-stage tools", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const overlayZone = extractRuleBlock(css, ".edit-expert-post-stage-overlay-zone");
    const baseLayer = extractRuleBlock(css, ".edit-expert-post-stage-base-layer");
    const composerOverlay = extractRuleBlock(css, ".edit-expert-post-stage-composer-overlay");
    const bottomRow = extractRuleBlock(css, ".edit-expert-bottom-row");
    const promptRow = extractRuleBlock(css, ".edit-expert-prompt-row");

    expect(overlayZone).toContain("position: relative;");
    expect(overlayZone).toContain("padding-bottom: var(--edit-expert-post-stage-overlay-reserve);");
    expect(baseLayer).toContain("z-index: 1;");
    expect(composerOverlay).toContain("position: absolute;");
    expect(composerOverlay).toContain("bottom: 0;");
    expect(composerOverlay).toContain("z-index: 9;");
    expect(bottomRow).toContain("min-height: var(--edit-expert-prompt-input-min-height);");
    expect(promptRow).toContain("min-height: var(--edit-expert-prompt-input-min-height);");
  });
});
