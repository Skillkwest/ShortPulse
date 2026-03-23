/**
 * AI Studio layout stylesheet contract tests.
 * Guards desktop shell scroll-lock rules so properties workflows keep overflow inside the panel rails.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutCssPath = path.resolve(process.cwd(), "styles/ai-studio-layout.css");

describe("ai-studio layout scroll lock contract", () => {
  it("keeps desktop properties workflows locked to the shell instead of the main window", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain("@media (min-width: 1101px)");
    expect(css).toContain('html:has(.ai-studio-page[data-selected-tool="create"])');
    expect(css).toContain('html:has(.ai-studio-page[data-selected-tool="video"])');
    expect(css).toContain('html:has(.ai-studio-page[data-selected-tool="character"])');
    expect(css).toContain('.ai-studio-page[data-selected-tool="create"]');
    expect(css).toContain('.ai-studio-page[data-selected-tool="video"]');
    expect(css).toContain('.ai-studio-page[data-selected-tool="character"]');
    expect(css).toContain("height: var(--app-fixed-height);");
    expect(css).toContain("overflow: hidden;");
  });

  it("gives expert edit a stable resizable shell fallback without entry transition", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toContain(".ai-shell.ai-shell-expert-edit");
    expect(css).toContain("grid-template-columns: minmax(930px, 1.28fr) minmax(0, 1fr);");
    expect(css).toContain(".ai-shell.ai-shell-resizable.ai-shell-expert-edit");
    expect(css).toContain("var(--ai-shell-left-width, minmax(930px, 1.28fr))");
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
});
