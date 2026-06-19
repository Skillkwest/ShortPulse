/**
 * AI Studio adaptive layout container contract tests.
 * Guards container-query ownership so zoom/split-screen constraints adapt by actual rail width.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readStyle = (fileName: string) =>
  fs.readFileSync(path.resolve(process.cwd(), "styles", fileName), "utf8");

type ResponsiveSurfaceContract = {
  label: string;
  fileName: string;
  containerBreakpoints?: number[];
  fluidGridPattern?: string;
};

const responsiveSurfaceContracts: ResponsiveSurfaceContract[] = [
  {
    label: "Create",
    fileName: "ai-studio-create-composer-responsive.css",
    containerBreakpoints: [759],
  },
  {
    label: "Edit",
    fileName: "ai-studio-edit-expert.css",
    containerBreakpoints: [760],
  },
  {
    label: "Video",
    fileName: "ai-studio-video-theme.css",
    containerBreakpoints: [760],
  },
  {
    label: "Sound",
    fileName: "ai-studio-sound-properties.css",
    containerBreakpoints: [1100, 760],
  },
  {
    label: "Sound Voice",
    fileName: "ai-studio-voices-properties.css",
    containerBreakpoints: [720],
  },
  {
    label: "Sound Text To Speech",
    fileName: "ai-studio-tts-properties.css",
    containerBreakpoints: [1100, 760],
  },
  {
    label: "Sound Music",
    fileName: "ai-studio-music-properties.css",
    containerBreakpoints: [1180, 720],
  },
  {
    label: "Sound Effects",
    fileName: "ai-studio-sound-effects-properties.css",
    containerBreakpoints: [720],
  },
  {
    label: "Media Library",
    fileName: "ai-studio-media-library-panel.css",
    containerBreakpoints: [760],
  },
  {
    label: "Characters",
    fileName: "character-manager-embedded.css",
    containerBreakpoints: [1100, 860],
  },
  {
    label: "Elements",
    fileName: "elements-manager-embedded.css",
    containerBreakpoints: [860, 640],
  },
  {
    label: "Styles",
    fileName: "ai-studio-styles-library.module.css",
    fluidGridPattern: "grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));",
  },
  {
    label: "Presets",
    fileName: "ai-studio-presets-library.css",
    fluidGridPattern: "grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));",
  },
  {
    label: "Pulse Presets",
    fileName: "ai-studio-pulse-presets-library.css",
    fluidGridPattern: "grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));",
  },
];

const approvedExplicitColumnPlacements = [
  {
    fileName: "ai-studio-create-composer-output-generate.css",
    selector:
      ".create-composer-panel .create-composer-prompt-step .agent-message.agent-assistant.agent-message--with-output-generate .agent-output-bubble-controls",
    column: "2",
  },
  {
    fileName: "ai-studio-edit-expert.css",
    selector: ".edit-expert-primary-column",
    column: "2",
  },
  {
    fileName: "ai-studio-music-properties.css",
    selector: ".music-properties-topbar-center",
    column: "2",
  },
  {
    fileName: "ai-studio-video-theme.css",
    selector: ".video-properties-panel .video-right-generate-actions",
    column: "3",
  },
  {
    fileName: "ai-studio-video-theme.css",
    selector: ".video-properties-panel .video-inline-warning-bubble",
    column: "2",
  },
] as const;

const styleFilesForExplicitColumnAudit = fs
  .readdirSync(path.resolve(process.cwd(), "styles"))
  .filter(
    (fileName) =>
      fileName.endsWith(".css") &&
      (fileName.startsWith("ai-studio-") || fileName.endsWith("-embedded.css"))
  )
  .sort();

const normalizeSelector = (selector: string) => selector.trim().replace(/\s+/g, " ");

const extractRuleBlock = (css: string, selector: string) => {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
  return css.match(pattern)?.[1] ?? "";
};

const getExplicitColumnPlacements = (fileName: string) => {
  const css = readStyle(fileName);
  const placements: Array<{ fileName: string; selector: string; column: string }> = [];
  const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(css)) !== null) {
    const columnMatch = match[2].match(/grid-column:\s*([23])\s*;/);
    if (!columnMatch) continue;
    placements.push({
      fileName,
      selector: normalizeSelector(match[1]),
      column: columnMatch[1],
    });
  }

  return placements;
};

describe("ai-studio adaptive layout container contract", () => {
  it("names the properties rail as the adaptive layout container", () => {
    const css = readStyle("ai-studio-layout.css");

    expect(css).toContain("container-name: ai-properties;");
    expect(css).toContain("container-type: inline-size;");
  });

  it.each(responsiveSurfaceContracts)(
    "keeps $label responsive behavior covered by the panel contract",
    ({ fileName, containerBreakpoints, fluidGridPattern }) => {
      const css = readStyle(fileName);

      for (const breakpoint of containerBreakpoints ?? []) {
        expect(css).toContain(`@container ai-properties (max-width: ${breakpoint}px)`);
      }

      if (fluidGridPattern) {
        expect(css).toContain(fluidGridPattern);
      }
    }
  );

  it("keeps explicit grid column placements intentional across AI Studio panels", () => {
    const actualPlacements = styleFilesForExplicitColumnAudit.flatMap(getExplicitColumnPlacements);

    expect(actualPlacements).toEqual([...approvedExplicitColumnPlacements]);
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

  it("keeps busy music and sound effects composers interactive", () => {
    const musicCss = readStyle("ai-studio-music-properties.css");
    const soundEffectsCss = readStyle("ai-studio-sound-effects-properties.css");
    const musicBusyRule = extractRuleBlock(musicCss, '.music-properties-panel[aria-busy="true"]');
    const soundEffectsBusyRule = extractRuleBlock(
      soundEffectsCss,
      '.sound-effects-properties-panel[aria-busy="true"]'
    );

    expect(musicBusyRule).toContain("pointer-events: auto;");
    expect(soundEffectsBusyRule).toContain("pointer-events: auto;");
  });

  it("keeps the Video prompt composer column beside settings until the panel is genuinely compact", () => {
    const css = readStyle("ai-studio-video-theme.css");

    expect(css).toContain("grid-template-columns: minmax(280px, 0.46fr) minmax(0, 1.54fr);");
    expect(css).toContain("@container ai-properties (max-width: 760px)");
    expect(css).not.toContain("@container ai-properties (max-width: 1320px)");
  });
});
