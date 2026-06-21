/**
 * AI Studio layout stylesheet contract tests.
 * Guards desktop shell scroll-lock rules so properties workflows keep overflow inside the panel rails.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutCssPath = path.resolve(process.cwd(), "styles/ai-studio-layout.css");
const propertiesCssPath = path.resolve(process.cwd(), "styles/ai-studio-properties.css");
const messagesCssPath = path.resolve(process.cwd(), "styles/components-messages.css");
const createComposerResponsiveCssPath = path.resolve(
  process.cwd(),
  "styles/ai-studio-create-composer-responsive.css"
);

const extractRuleBlock = (css: string, selector: string) => {
  const escapedSelector = selector
    .trim()
    .split(/\s+/)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const pattern = new RegExp(`(^|\\n)${escapedSelector} \\{[\\s\\S]*?\\n\\}`, "gm");
  const match = Array.from(css.matchAll(pattern)).at(-1);
  expect(match).not.toBeUndefined();
  return match?.[0] ?? "";
};

describe("ai-studio layout scroll behavior contract", () => {
  it("lets desktop properties workflows grow without clipping the main window", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain("@media (min-width: 1101px)");
    expect(css).toContain(
      'html:has(.ai-studio-page[data-selected-tool]:not([data-selected-tool="canvas"]))'
    );
    expect(css).toContain(
      'body:has(.ai-studio-page[data-selected-tool]:not([data-selected-tool="canvas"]))'
    );
    expect(css).toContain('.ai-studio-page[data-selected-tool]:not([data-selected-tool="canvas"])');
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("height: auto;");
    expect(css).toContain("overflow: visible;");
  });

  it("gives expert edit a stable resizable shell fallback without entry transition", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(".ai-shell.ai-shell-expert-edit");
    expect(css).toContain("grid-template-columns: minmax(860px, 1.28fr) minmax(0, 1fr);");
    expect(css).toContain(".ai-shell.ai-shell-resizable.ai-shell-expert-edit");
    expect(css).toContain("var(--ai-shell-left-width, minmax(860px, 1.28fr))");
    expect(css).toContain("transition: none;");
  });

  it("disables shell transition and sticky blur in dense performance sessions", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(
      ".ai-studio-page:has(.ai-shell.ai-shell-performance-dense) .ai-hero.panel.ai-amber-hero"
    );
    expect(css).toContain(".ai-shell.ai-shell-performance-dense.ai-shell-resizable");
    expect(css).toContain(
      ".ai-shell.ai-shell-performance-dense.ai-shell-resizable.ai-shell-expert-edit"
    );
    expect(css).toContain(
      ".ai-shell.ai-shell-performance-dense .reference-column .preview-column-header"
    );
    expect(css).toContain(".ai-shell.ai-shell-performance-dense .toolbar-create-children");
    expect(css).toContain(".ai-shell.ai-shell-performance-dense .toolbar-create-spacer");
    expect(css).toContain("will-change: auto;");
    expect(css).toContain("backdrop-filter: none;");
    expect(css).toContain("transition: none;");
  });

  it("lets canvas mode consume the full bottom edge of the fixed-height page", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain('.ai-studio-page[data-selected-tool="canvas"]');
    expect(css).toContain("--ai-page-pad-bottom: 0px;");
    expect(css).toContain("height: var(--app-fixed-height);");
    expect(css).toContain("overflow: hidden;");
  });

  it("lets workflow and library panels grow the full shell lower in the viewport", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");
    const propertiesCss = fs.readFileSync(propertiesCssPath, "utf8");
    const pageRule = extractRuleBlock(
      css,
      '.ai-studio-page[data-selected-tool]:not([data-selected-tool="canvas"])'
    );
    const propertiesRailRule = extractRuleBlock(
      css,
      '.ai-studio-page[data-selected-tool]:not([data-selected-tool="canvas"]) .panel.ai-panel.ai-properties'
    );
    const propertiesRule = extractRuleBlock(propertiesCss, ".ai-properties");
    const toolPropertiesRule = extractRuleBlock(propertiesCss, ".ai-properties .tool-properties");

    expect(pageRule).toContain("--ai-page-pad-bottom: 0px;");
    expect(pageRule).toContain("min-height: var(--app-fixed-height);");
    expect(propertiesRailRule).toContain("align-self: stretch;");
    expect(propertiesRailRule).toContain("min-height: var(--ai-shell-column-max-height);");
    expect(propertiesRailRule).toContain("height: 100%;");
    expect(propertiesRailRule).toContain("max-height: var(--ai-shell-column-max-height);");
    expect(propertiesRailRule).toContain("container-name: ai-properties;");
    expect(propertiesRule).toContain("display: flex;");
    expect(propertiesRule).toContain("flex-direction: column;");
    expect(toolPropertiesRule).toContain("flex: 1 1 auto;");
    expect(toolPropertiesRule).toContain("min-height: 0;");
    expect(toolPropertiesRule).toContain("width: 100%;");
    expect(css).toContain(".reference-column-sticky");
    expect(css).toContain("height: var(--ai-shell-column-max-height);");
    expect(css).toContain("max-height: var(--ai-shell-column-max-height);");
  });

  it("keeps Edit and Video outer properties rails structural instead of visual wrappers", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toMatch(
      /\.ai-studio-page\[data-selected-tool="edit"\]:not\(\[data-selected-tool="canvas"\]\)[\s\S]*?\.ai-studio-page\[data-selected-tool="video"\]:not\(\[data-selected-tool="canvas"\]\)[\s\S]*?\{\n {2}background: transparent;\n {2}padding: 0;\n\}/
    );
  });

  it("keeps AI Studio alerts from increasing the desktop create shell height", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");
    const messagesCss = fs.readFileSync(messagesCssPath, "utf8");
    const stackRule = extractRuleBlock(css, ".ai-studio-page .ai-alerts-stack");
    const viewportStackRule = extractRuleBlock(messagesCss, ".app-message-stack--viewport");
    const stackChildrenRule = extractRuleBlock(messagesCss, ".app-message-stack--viewport > *");
    const sharedErrorMessageRule = extractRuleBlock(messagesCss, ".app-message--error");
    const alertBannerRule = extractRuleBlock(css, ".ai-studio-page .ai-alert-banner");
    const alertErrorBannerRule = extractRuleBlock(css, ".ai-studio-page .ai-alert-banner--error");
    const alertActionsRule = extractRuleBlock(
      css,
      ".ai-studio-page .ai-alert-banner .app-message__actions"
    );
    const alertDismissRule = extractRuleBlock(
      css,
      ".ai-studio-page .ai-alert-banner .app-message__dismiss"
    );
    const groupedFailureRule = extractRuleBlock(css, ".ai-error-stack");
    const viewportMessageRule = extractRuleBlock(
      messagesCss,
      ".app-message-stack--viewport .app-message,\n.app-message-stack--viewport .ai-error-stack"
    );

    expect(viewportStackRule).toContain("position: fixed;");
    expect(viewportStackRule).toContain("width: auto;");
    expect(viewportStackRule).toContain("pointer-events: none;");
    expect(viewportStackRule).toContain("max-width: calc(");
    expect(viewportStackRule).toContain(
      "100vw - var(--app-message-stack-viewport-left, var(--spacing-16)) -"
    );
    expect(viewportStackRule).toContain("overflow-x: hidden;");
    expect(stackChildrenRule).toContain("pointer-events: auto;");
    expect(stackRule).toContain(
      "--app-message-stack-viewport-top: calc(var(--ai-page-pad-top) + 6px);"
    );
    expect(stackRule).toContain(
      "--app-message-stack-viewport-left: calc(var(--ai-rail-width) + 24px);"
    );
    expect(stackRule).toContain(
      "--app-message-stack-viewport-right: max(24px, env(safe-area-inset-right));"
    );
    expect(stackRule).toContain("--app-message-stack-viewport-z-index: 30;");
    expect(alertBannerRule).toContain("width: 100%;");
    expect(alertBannerRule).toContain("min-width: 0;");
    expect(alertBannerRule).toContain("margin: 0;");
    expect(alertActionsRule).toContain("flex: 0 0 auto;");
    expect(alertDismissRule).toContain("flex: 0 0 28px;");
    expect(alertDismissRule).toContain("width: 28px;");
    expect(sharedErrorMessageRule).toContain("--app-message-bg: #36191f;");
    expect(alertErrorBannerRule).toContain("background: #461818;");
    expect(groupedFailureRule).toContain("background: linear-gradient(180deg, #5f1414, #3e0e0e);");
    expect(viewportMessageRule).toContain("margin: 0;");
    expect(css).toContain("@media (max-width: 1100px)");
    expect(css).toMatch(
      /@media \(max-width: 1100px\) \{[\s\S]*?\.ai-studio-page\s+\.ai-alerts-stack \{[\s\S]*?position: static;/
    );
  });

  it("uses a shared zoom-safe right rail minimum across resizable AI Studio shells", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(".ai-shell.ai-shell-resizable");
    expect(css).toContain("minmax(var(--ai-shell-right-min-width, 440px), 1fr);");
    expect(css).toContain(".ai-shell.ai-shell-resizable.ai-shell-expert-edit");
    expect(css).toContain(".ai-shell.ai-shell-resizable.ai-shell-character-open");
    expect(css).toContain("--ai-shell-right-min-width: 440px;");
  });

  it("gives compact split mode its own right-rail-preserving CSS fallback", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(".ai-shell.ai-shell-mode-compact-split.ai-shell-resizable");
    expect(css).toContain("--ai-shell-right-min-width: 260px;");
    expect(css).toContain("var(--ai-shell-left-width, minmax(420px, 1fr))");
    expect(css).toContain("minmax(var(--ai-shell-right-min-width, 260px), 1fr);");
  });

  it("starts Create with a wider resizable left column fallback", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(".ai-shell.ai-shell-resizable.ai-shell-expert-create");
    expect(css).toContain("var(--ai-shell-left-width, minmax(920px, 1040px))");
  });

  it("keeps Create compact container styling below the desktop panel minimum", () => {
    const css = fs.readFileSync(createComposerResponsiveCssPath, "utf8");

    expect(css).toContain("@media (max-width: 900px)");
    expect(css).not.toContain("@container ai-properties (max-width: 900px)");
    expect(css).toContain("@container ai-properties (max-width: 759px)");
    expect(css).toMatch(
      /@container ai-properties \(max-width: 759px\) \{[\s\S]*?\.create-composer-character-mode-control \{[\s\S]*?width: 100%;/
    );
  });

  it("keeps the fixed left toolbar scrollable when browser zoom reduces vertical space", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(".ai-toolbar-floating");
    expect(css).toContain("overflow-x: hidden;");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("overscroll-behavior-y: contain;");
  });

  it("lets measured stacked shell mode escape desktop split and sticky height constraints", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(".ai-shell.ai-shell-mode-stacked");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain(".ai-shell.ai-shell-mode-stacked .ai-shell-divider");
    expect(css).toContain(".ai-shell.ai-shell-mode-stacked .reference-column-sticky");
    expect(css).toContain("max-height: none;");
    expect(css).toContain("overflow: visible;");
  });
});
