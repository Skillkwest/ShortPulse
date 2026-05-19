import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutCssPath = path.resolve(process.cwd(), "styles/ai-studio-layout.css");
const propertiesCssPath = path.resolve(process.cwd(), "styles/ai-studio-properties.css");
const characterEmbeddedCssPath = path.resolve(
  process.cwd(),
  "styles/character-manager-embedded.css"
);

describe("character panel layout contract", () => {
  it("gives the Character properties rail the same bounded shell-height contract as Elements", () => {
    const css = fs.readFileSync(layoutCssPath, "utf8");

    expect(css).toMatch(
      /\.ai-studio-page\[data-selected-tool="character"\] \.panel\.ai-panel\.ai-properties,[\s\S]*?align-self: stretch;[\s\S]*?min-height: var\(--ai-shell-column-max-height\);[\s\S]*?height: 100%;/
    );
    expect(css).toMatch(
      /\.ai-studio-page\[data-selected-tool="character"\] \.panel\.ai-panel\.ai-properties,[\s\S]*?background: transparent;[\s\S]*?padding: 0;/
    );
    expect(css).toMatch(
      /\.ai-studio-page\[data-selected-tool="character"\] \.panel\.ai-panel\.ai-properties,[\s\S]*?min-height: var\(--ai-shell-column-max-height\);[\s\S]*?max-height: var\(--ai-shell-column-max-height\);/
    );
  });

  it("pins the Character split host as the active flex child under the properties rail", () => {
    const css = fs.readFileSync(propertiesCssPath, "utf8");

    expect(css).toContain(".ai-properties > .character-panel-root {");
    expect(css).toContain("overflow: hidden;");
    expect(css).toContain(".ai-properties > .character-panel-root > .character-panel-split-host {");
    expect(css).toContain("flex: 1 1 auto;");
    expect(css).toContain("min-height: 0;");
  });

  it("keeps the Character top workspace bounded so the lower media library remains reachable", () => {
    const css = fs.readFileSync(characterEmbeddedCssPath, "utf8");

    expect(css).toContain(".character-panel-workspace {");
    expect(css).toContain("height: 100%;");
    expect(css).toContain("overflow: hidden;");
    expect(css).toContain(".character-panel-library-workspace {");
    expect(css).toContain(".character-panel-editor-column-panel {");
    expect(css).toContain("overflow: auto;");
    expect(css).toContain("overscroll-behavior-y: contain;");
  });

  it("stacks the Character library and profile into one top-column flow", () => {
    const css = fs.readFileSync(characterEmbeddedCssPath, "utf8");

    expect(css).toContain(".character-panel-library-workspace {");
    expect(css).toContain("display: flex;");
    expect(css).toContain("flex-direction: column;");
    expect(css).toContain(".character-panel-library-column {");
    expect(css).toContain("flex: 0 0 auto;");
    expect(css).toContain(".character-panel-editor-column {");
    expect(css).toContain("flex: 1 1 auto;");
  });

  it("places the profile description in the lower content row beside the reference drop zones", () => {
    const css = fs.readFileSync(characterEmbeddedCssPath, "utf8");

    expect(css).toContain(".character-panel-workspace .character-panel-preset-content-grid {");
    expect(css).toContain("grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);");
    expect(css).toContain('grid-template-areas: "description references";');
    expect(css).toContain(".character-panel-workspace .character-panel-preset-description-column,");
    expect(css).toContain(
      ".character-panel-workspace .character-panel-preset-description-column {"
    );
    expect(css).toContain("grid-area: description;");
    expect(css).toContain(".character-panel-workspace .character-panel-preset-references-column {");
    expect(css).toContain("grid-area: references;");
  });

  it("matches the name and description surfaces to the tab tray fill color", () => {
    const css = fs.readFileSync(characterEmbeddedCssPath, "utf8");

    expect(css).toContain("--character-panel-tab-tray-bg: rgba(14, 15, 19, 0.72);");
    expect(css).toContain(".character-panel-workspace .character-name-input {");
    expect(css).toContain("background: var(--character-panel-tab-tray-bg);");
    expect(css).toContain(".character-panel-workspace .character-description-text-container {");
  });

  it("flattens the editor shell so the profile does not render as a card inside a card", () => {
    const css = fs.readFileSync(characterEmbeddedCssPath, "utf8");

    expect(css).toContain(".character-panel-editor-column-panel {");
    expect(css).toContain("border: 0;");
    expect(css).toContain("background: transparent;");
    expect(css).toContain("border-radius: 0;");
  });

  it("keeps the top Characters header row unwrapped by a separate card shell", () => {
    const css = fs.readFileSync(characterEmbeddedCssPath, "utf8");

    expect(css).toContain(".character-panel-library-workspace {");
    expect(css).toContain("gap: 0;");
    expect(css).toContain(".character-panel-library-column {");
    expect(css).toContain("border: 0;");
    expect(css).toContain("background: transparent;");
  });
});
