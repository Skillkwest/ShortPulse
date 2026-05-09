/**
 * MusicPropertiesPanel rendering tests.
 * Verifies the dedicated Music workflow stays decoupled from generic Sound and Sound Effects.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MusicPropertiesPanel } from "../MusicPropertiesPanel";

describe("MusicPropertiesPanel", () => {
  it("renders the music mode toggle instead of the retired preview area", () => {
    render(<MusicPropertiesPanel />);

    expect(screen.getByRole("tablist", { name: "Music composition modes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Standard" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Custom" })).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByText("No music previews yet")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveAttribute(
      "placeholder",
      "Describe the song you want to generate: genre, pacing, instrumentation, vocal style, and where the cue should land in the edit."
    );
    expect(
      screen.getByRole("separator", {
        name: "Resize music mode and composition sections",
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Music inspiration")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Music inspiration").closest(".music-properties-script-input-shell")
    ).toHaveClass("music-properties-script-input-shell--with-inspiration");
    expect(screen.getByRole("button", { name: "passionate vocals" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "lofi hip hop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll inspiration left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll inspiration right" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Music defaults")).toBeNull();
    expect(screen.getByRole("button", { name: "Generate music" })).toBeDisabled();
  });

  it("enables generation when the user writes a music prompt", () => {
    render(<MusicPropertiesPanel onGenerate={() => undefined} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value:
          "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
      },
    });

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending."
    );
    expect(screen.getByRole("button", { name: "Generate music" })).toBeEnabled();
  });

  it("switches between simple and custom composer modes", () => {
    render(<MusicPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));

    expect(screen.getByRole("tab", { name: "Custom" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Custom music composer")).toBeInTheDocument();
    expect(screen.getByText("Song style and vibe")).toBeInTheDocument();
    expect(screen.getByText("Lyrics")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveAttribute(
      "placeholder",
      "Describe the song style, production direction, instrumentation, vocal feel, and emotional arc."
    );
    expect(screen.getByRole("textbox", { name: "Song lyrics" })).toHaveAttribute(
      "placeholder",
      "Write lyrics, hooks, section ideas, ad-libs, or line-by-line structure here."
    );
    expect(
      screen.queryByRole("separator", {
        name: "Resize song style and lyrics sections",
      })
    ).toBeNull();
    expect(screen.getByLabelText("Music inspiration")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Music inspiration").closest(".music-properties-script-input-shell")
    ).toHaveClass("music-properties-script-input-shell--custom-prompt");
    expect(screen.getByRole("button", { name: "Scroll inspiration left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll inspiration right" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Singer" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Music defaults")).toBeInTheDocument();
    expect(screen.queryByText("MP3")).toBeNull();
    expect(screen.queryByText("Auto")).toBeNull();
    expect(screen.queryByLabelText("Custom mode note")).toBeNull();
  });

  it("submits the provider-facing music request shape", () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value:
          "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    expect(onGenerate).toHaveBeenCalledWith({
      text: "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
      durationSeconds: 30,
      bpm: 112,
      mode: "instrumental",
      structure: "loop",
      energyPercent: 58,
      outputFormat: "mp3_44100_128",
      modelId: "music_v1",
    });
  });

  it("submits vocal mode when singer is enabled in custom mode", () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    fireEvent.click(screen.getByRole("switch", { name: "Singer" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value: "Melodic club anthem with a strong topline and a clean chorus payoff.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "vocal",
      })
    );
  });

  it("appends inspiration chips into the prompt in simple mode", () => {
    render(<MusicPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "gabber" }));

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue("gabber");
  });

  it("disables generate while generation is running", () => {
    render(<MusicPropertiesPanel isGenerating onGenerate={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Minimal synth bed with a bright branded tag." },
    });

    expect(screen.getByRole("button", { name: "Generating music" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generating music" })).toHaveTextContent(
      "Generating..."
    );
  });

  it("keeps the prompt counter in sync locally", () => {
    render(<MusicPropertiesPanel />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Minimal synth bed" },
    });

    expect(screen.getByText("17 / 800")).toBeInTheDocument();
  });
});
