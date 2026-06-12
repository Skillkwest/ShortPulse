/**
 * AI Studio adaptive layout container contract tests.
 * Guards container-query ownership so zoom/split-screen constraints adapt by actual rail width.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readStyle = (fileName: string) =>
  fs.readFileSync(path.resolve(process.cwd(), "styles", fileName), "utf8");

describe("ai-studio adaptive layout container contract", () => {
  it("names the properties rail as the adaptive layout container", () => {
    const css = readStyle("ai-studio-layout.css");

    expect(css).toContain("container-name: ai-properties;");
    expect(css).toContain("container-type: inline-size;");
  });

  it("moves primary workflow responsive behavior onto the properties container", () => {
    expect(readStyle("ai-studio-create-composer-responsive.css")).toContain(
      "@container ai-properties (max-width: 900px)"
    );
    expect(readStyle("ai-studio-edit-expert.css")).toContain(
      "@container ai-properties (max-width: 980px)"
    );
    expect(readStyle("ai-studio-video-theme.css")).toContain(
      "@container ai-properties (max-width: 760px)"
    );
    expect(readStyle("ai-studio-sound-properties.css")).toContain(
      "@container ai-properties (max-width: 1100px)"
    );
  });

  it("keeps child sound workflows and libraries container-aware", () => {
    expect(readStyle("ai-studio-tts-properties.css")).toContain(
      "@container ai-properties (max-width: 1100px)"
    );
    expect(readStyle("ai-studio-music-properties.css")).toContain(
      "@container ai-properties (max-width: 1180px)"
    );
    expect(readStyle("ai-studio-sound-effects-properties.css")).toContain(
      "@container ai-properties (max-width: 720px)"
    );
    expect(readStyle("ai-studio-media-library-panel.css")).toContain(
      "@container ai-properties (max-width: 760px)"
    );
    expect(readStyle("character-manager-embedded.css")).toContain(
      "@container ai-properties (max-width: 1100px)"
    );
    expect(readStyle("elements-manager-embedded.css")).toContain(
      "@container ai-properties (max-width: 860px)"
    );
  });

  it("keeps the Video prompt composer column beside settings until the panel is genuinely compact", () => {
    const css = readStyle("ai-studio-video-theme.css");

    expect(css).toContain("grid-template-columns: minmax(280px, 0.46fr) minmax(0, 1.54fr);");
    expect(css).toContain("@container ai-properties (max-width: 760px)");
    expect(css).not.toContain("@container ai-properties (max-width: 1320px)");
  });
});
