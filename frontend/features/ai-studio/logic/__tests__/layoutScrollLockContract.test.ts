/**
 * AI Studio layout stylesheet contract tests.
 * Guards desktop shell scroll-lock rules so properties workflows keep overflow inside the panel rails.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutCssPath = path.resolve(process.cwd(), "styles/ai-studio-layout.css");
const messagesCssPath = path.resolve(process.cwd(), "styles/components-messages.css");

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
    expect(css).toContain('html:has(.ai-studio-page[data-selected-tool="create"])');
    expect(css).toContain('html:has(.ai-studio-page[data-selected-tool="video"])');
    expect(css).toContain('html:has(.ai-studio-page[data-selected-tool="character"])');
    expect(css).toContain('.ai-studio-page[data-selected-tool="create"]');
    expect(css).toContain('.ai-studio-page[data-selected-tool="video"]');
    expect(css).toContain('.ai-studio-page[data-selected-tool="character"]');
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

  it("lets create mode grow the full shell lower in the viewport", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(
      '.ai-studio-page[data-selected-tool="create"] {\n  --ai-page-pad-bottom: 0px;\n}'
    );
    expect(css).toContain(".reference-column-sticky");
    expect(css).toContain("height: var(--ai-shell-column-max-height);");
    expect(css).toContain("max-height: var(--ai-shell-column-max-height);");
  });

  it("keeps AI Studio alerts from increasing the desktop create shell height", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");
    const messagesCss = fs.readFileSync(messagesCssPath, "utf8");
    const stackRule = extractRuleBlock(css, ".ai-studio-page .ai-alerts-stack");
    const viewportStackRule = extractRuleBlock(messagesCss, ".app-message-stack--viewport");
    const stackChildrenRule = extractRuleBlock(messagesCss, ".app-message-stack--viewport > *");
    const alertBannerRule = extractRuleBlock(css, ".ai-studio-page .ai-alert-banner");
    const viewportMessageRule = extractRuleBlock(
      messagesCss,
      ".app-message-stack--viewport .app-message,\n.app-message-stack--viewport .ai-error-stack"
    );

    expect(viewportStackRule).toContain("position: fixed;");
    expect(viewportStackRule).toContain("pointer-events: none;");
    expect(stackChildrenRule).toContain("pointer-events: auto;");
    expect(stackRule).toContain(
      "--app-message-stack-viewport-top: calc(var(--ai-page-pad-top) + 6px);"
    );
    expect(stackRule).toContain(
      "--app-message-stack-viewport-left: calc(var(--ai-rail-width) + 24px);"
    );
    expect(stackRule).toContain("--app-message-stack-viewport-z-index: 30;");
    expect(alertBannerRule).toContain("margin: 0;");
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
