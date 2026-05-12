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

    expect(compiled.modelId).toBe("gpt-image-2");
    expect(compiled.size).toBe("1024x1024");
    expect(compiled.quality).toBe("low");
    expect(compiled.prompt).toContain(
      "Audio concept: A calm late-night monologue about missing home."
    );
    expect(compiled.prompt).toContain("Source mode: voiceover.");
    expect(compiled.prompt).toContain("Subtle performance character reference: Alice.");
    expect(compiled.prompt).toContain("no text, no logos");
  });

  it("includes music-specific cues in branded album-cover prompts", () => {
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

    expect(compiled.prompt).toContain(
      "Treat this like premium album-cover art inspired by the track mood."
    );
    expect(compiled.prompt).toContain("Tempo cue: 122 BPM.");
    expect(compiled.prompt).toContain("Energy cue: 84 percent.");
    expect(compiled.prompt).toContain("Arrangement cue: cinematic.");
    expect(compiled.prompt).toContain("Performance cue: instrumental.");
  });
});
