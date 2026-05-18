/**
 * SoundEffectsPropertiesPanel rendering tests.
 * Verifies the standalone Sound Effects workflow now uses the simplified single-surface composer.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SoundEffectsPropertiesPanel } from "../SoundEffectsPropertiesPanel";

describe("SoundEffectsPropertiesPanel", () => {
  it("renders the simplified sound effects workflow surface", () => {
    const { container } = render(<SoundEffectsPropertiesPanel />);

    expect(container.querySelector('[aria-label="Available sound effects"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Sound Effects" })).toBeInTheDocument();
    expect(screen.queryByText("No sound effects yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Generated sound effects will appear here.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Sound effect prompt")).toHaveAttribute(
      "placeholder",
      "Describe the sound effect you want to generate with detail, texture, space, and motion."
    );
    expect(
      screen.getByRole("separator", {
        name: "Resize sound effects spacer and composition sections",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.queryByLabelText("Sound effect output format")).not.toBeInTheDocument();
    expect(screen.queryByText("MP3")).not.toBeInTheDocument();
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(screen.getByText("Inspiration")).toBeInTheDocument();
    expect(screen.getByLabelText("Sound effect inspiration")).toBeInTheDocument();
    expect(container.querySelector(".sound-effects-properties-divider-wrap")).not.toBeNull();
    expect(container.querySelector(".sound-effects-properties-divider")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Scroll inspiration left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll inspiration right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByText("0 / 450")).toBeInTheDocument();
    expect(
      container
        .querySelector(".sound-effects-properties-inspiration-header")
        ?.contains(screen.getByText("0 / 450"))
    ).toBe(true);
  }, 20000);

  it("keeps the composer empty by default", () => {
    render(<SoundEffectsPropertiesPanel onGenerate={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("enables generate after entering a prompt", () => {
    render(<SoundEffectsPropertiesPanel onGenerate={vi.fn()} />);

    const promptField = screen.getByRole("textbox", { name: "Sound effect prompt" });

    fireEvent.change(promptField, {
      target: { value: "Short vinyl crackle burst with a dusty hi-fi tail." },
    });

    expect(promptField).toHaveValue("Short vinyl crackle burst with a dusty hi-fi tail.");
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("keeps generate available when shared pricing is unavailable", () => {
    render(<SoundEffectsPropertiesPanel onGenerate={vi.fn()} pricingPolicyReady={false} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Sound effect prompt" }), {
      target: { value: "Layered whoosh with a clean sparkle tail." },
    });

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("submits the mapped request payload with hardcoded mp3 output", () => {
    const onGenerate = vi.fn();
    render(<SoundEffectsPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Sound effect prompt" }), {
      target: { value: "Huge cinematic boom inside a vaulted cathedral, with a deep sub hit." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(onGenerate).toHaveBeenCalledWith({
      text: "Huge cinematic boom inside a vaulted cathedral, with a deep sub hit.",
      durationSeconds: null,
      loop: false,
      outputFormat: "mp3_44100_128",
      modelId: "eleven_text_to_sound_v2",
      displayedBilledCredits: 2,
    });
  });

  it("includes loop when enabled before generate", () => {
    const onGenerate = vi.fn();
    render(<SoundEffectsPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Sound effect prompt" }), {
      target: { value: "Wide atmospheric wind gust with a trailing rooftop whistle." },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Loop sound effect" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        loop: true,
        outputFormat: "mp3_44100_128",
      })
    );
  });

  it("appends inspiration chips into the prompt", () => {
    render(<SoundEffectsPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "cinematic boom" }));

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(
      "cinematic boom"
    );
  });

  it("keeps generate enabled while generation is running", () => {
    render(<SoundEffectsPropertiesPanel isGenerating onGenerate={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Sound effect prompt" }), {
      target: { value: "Layered whoosh with a clean sparkle tail." },
    });

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveAttribute(
      "readonly"
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Generate" })).toHaveTextContent("Generating...");
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "cinematic boom" })).toBeDisabled();
  });
});
