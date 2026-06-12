/**
 * AI Studio layout stylesheet contract tests.
 * Guards desktop shell scroll-lock rules so properties workflows keep overflow inside the panel rails.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutCssPath = path.resolve(process.cwd(), "styles/ai-studio-layout.css");

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

  it("uses a shared zoom-safe right rail minimum across resizable AI Studio shells", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(".ai-shell.ai-shell-resizable");
    expect(css).toContain("minmax(var(--ai-shell-right-min-width, 440px), 1fr);");
    expect(css).toContain(".ai-shell.ai-shell-resizable.ai-shell-expert-edit");
    expect(css).toContain(".ai-shell.ai-shell-resizable.ai-shell-character-open");
    expect(css).toContain("--ai-shell-right-min-width: 440px;");
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
