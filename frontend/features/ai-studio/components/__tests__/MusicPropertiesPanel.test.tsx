/**
 * MusicPropertiesPanel rendering tests.
 * Verifies the dedicated Music workflow stays decoupled from generic Sound and Sound Effects.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MusicPropertiesPanel } from "../MusicPropertiesPanel";

describe("MusicPropertiesPanel", () => {
  it("renders the dedicated music workflow surface", () => {
    render(<MusicPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(screen.getByLabelText("Available music")).toBeInTheDocument();
    expect(screen.getByText("No music previews yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Generated tracks land in the Reference Grid first/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveAttribute(
      "placeholder",
      "Describe the song you want to generate: genre, pacing, instrumentation, vocal style, and where the cue should land in the edit."
    );
    expect(
      screen.getByRole("separator", {
        name: "Resize available music and composition sections",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Music duration in seconds" })).toHaveValue(30);
    expect(screen.getByRole("spinbutton", { name: "Music tempo in BPM" })).toHaveValue(112);
    expect(screen.getByRole("slider", { name: "Energy" })).toHaveValue("58");
    expect(screen.getByRole("combobox", { name: "Music output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
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
    fireEvent.change(screen.getByRole("spinbutton", { name: "Music duration in seconds" }), {
      target: { value: "42" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Music tempo in BPM" }), {
      target: { value: "124" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Energy" }), {
      target: { value: "81" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Vocal" }));
    fireEvent.click(screen.getByRole("button", { name: "Full Track" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Music output format" }), {
      target: { value: "wav_48000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(onGenerate).toHaveBeenCalledWith({
      text: "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
      durationSeconds: 42,
      bpm: 124,
      mode: "vocal",
      structure: "full-track",
      energyPercent: 81,
      outputFormat: "wav_48000",
      modelId: "music_v1",
    });
  });

  it("keeps generate available while generation is running", () => {
    render(<MusicPropertiesPanel isGenerating onGenerate={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Minimal synth bed with a bright branded tag." },
    });

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Generate" })).toHaveTextContent("Generate");
  });

  it("updates the energy readout locally", () => {
    render(<MusicPropertiesPanel />);

    const energySlider = screen.getByRole("slider", { name: "Energy" });
    fireEvent.change(energySlider, { target: { value: "81" } });

    expect(energySlider).toHaveValue("81");
    expect(screen.getByText("81%")).toBeInTheDocument();
  });
});
