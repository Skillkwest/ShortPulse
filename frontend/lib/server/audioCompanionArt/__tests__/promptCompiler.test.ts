import { describe, expect, it } from "vitest";
import { compileAudioCompanionArtPrompt } from "../promptCompiler";

describe("audioCompanionArt promptCompiler", () => {
  it("builds branded voiceover companion art prompts", () => {
    const compiled = compileAudioCompanionArtPrompt({
      promptText: "A calm late-night monologue about missing home.",
      sourceMode: "voiceover",
      metadata: {
        voice_name: "Alice",
      },
    });

    expect(compiled.prompt).toContain(
      "Audio concept: A calm late-night monologue about missing home."
    );
    expect(compiled.prompt).toContain("Source mode: voiceover.");
    expect(compiled.prompt).toContain("Subtle performance character reference: Alice.");
    expect(compiled.prompt).toContain("Hard visual contract: image-only artwork.");
    expect(compiled.prompt).toContain("No readable text, fake text, pseudo-letters");
    expect(compiled.prompt).toContain("logos");
  });

  it("includes music-specific cues in branded companion-art prompts", () => {
    const compiled = compileAudioCompanionArtPrompt({
      promptText: "Neon city synthwave chase theme",
      sourceMode: "music",
      metadata: {
        tempo_bpm: 122,
        energy_percent: 84,
        structure: "cinematic",
        music_mode: "instrumental",
      },
    });

    expect(compiled.prompt).toContain("premium square companion artwork");
    expect(compiled.prompt).toContain("not literal album packaging");
    expect(compiled.prompt).not.toContain("premium album-cover art");
    expect(compiled.prompt).toContain("Tempo cue: 122 BPM.");
    expect(compiled.prompt).toContain("Energy cue: 84 percent.");
    expect(compiled.prompt).toContain("Arrangement cue: cinematic.");
    expect(compiled.prompt).toContain("Performance cue: instrumental.");
  });

  it("allows a runtime-owned style line override", () => {
    const compiled = compileAudioCompanionArtPrompt({
      promptText: "A haunted broadcast from the desert",
      sourceMode: "voiceover",
      styleLine: "Custom runtime style line.",
    });

    expect(compiled.prompt).toContain("Custom runtime style line.");
    expect(compiled.prompt).not.toContain("cinematic editorial illustration");
    expect(compiled.prompt).toContain("Hard visual contract: image-only artwork.");
    expect(compiled.prompt).toContain("Do not render any text from the audio concept or metadata.");
  });

  it("sanitizes stale runtime cover-art wording before generation", () => {
    const compiled = compileAudioCompanionArtPrompt({
      promptText: "",
      sourceMode: "music",
      styleLine:
        "Branded audio cover art style with premium album-cover composition and painted cover art.",
    });

    expect(compiled.prompt).toContain("Audio concept: Audio reference companion art");
    expect(compiled.prompt).toContain("Branded audio companion art style");
    expect(compiled.prompt).toContain("premium companion artwork composition");
    expect(compiled.prompt).toContain("painted companion art");
    expect(compiled.prompt).not.toContain("cover art style");
    expect(compiled.prompt).not.toContain("album-cover");
    expect(compiled.prompt).toContain(
      "Apply style language only as text-free visual treatment; ignore any request for typography, labels, logos, or symbolic marks."
    );
  });

  it("treats title-like prompt text as mood only and forbids label/icon artifacts", () => {
    const compiled = compileAudioCompanionArtPrompt({
      promptText: "TITLE: Neon Thick Loop - rap hip hop beats",
      sourceMode: "music",
      styleLine: "Custom style without restrictions.",
    });

    expect(compiled.prompt).toContain("Audio concept: TITLE: Neon Thick Loop - rap hip hop beats");
    expect(compiled.prompt).toContain(
      "Interpret the audio concept as mood, setting, subject, color, and texture only; never draw its words."
    );
    expect(compiled.prompt).toContain(
      "No readable text, fake text, pseudo-letters, numbers, captions, labels, stickers, badges, logos, brand marks, watermarks, signatures, typography, subtitles, UI, icons, symbols, glyphs, QR codes, barcodes, advisory labels, music-note icons, or waveform graphics."
    );
    expect(compiled.prompt).toContain(
      "Avoid poster, flyer, product packaging, record-label, and literal music-packaging layouts"
    );
  });
});
