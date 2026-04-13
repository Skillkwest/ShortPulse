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

  it("keeps the left sidebar shell flat while preserving the mode panel inset highlight", () => {
    const css = fs.readFileSync(expertEditCssPath, "utf8");
    const sidebarShell = extractRuleBlock(css, ".edit-expert-sidebar-shell");
    const modeRailPanel = extractRuleBlock(css, ".edit-expert-mode-rail-panel");
    const presetCard = extractRuleBlock(css, ".edit-expert-preset-toolbar-card");
    const layersTitleCard = extractRuleBlock(css, ".edit-expert-layers-toolbar-title-card");
    const layersCard = extractRuleBlock(css, ".edit-expert-layers-toolbar-card");

    expect(sidebarShell).toContain("border-radius: 0;");
    expect(sidebarShell).toContain("box-shadow: none;");
    expect(modeRailPanel).toContain("box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);");
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
});
