/**
 * SoundEffectsPropertiesPanel rendering tests.
 * Verifies the standalone Sound Effects workflow now uses the simplified single-surface composer.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolvePricingGridBilledCredits } from "../../../../lib/model-runtime/pricingGridBilledCredits";
import {
  hardcodedSoundEffectsModelId,
  SoundEffectsPropertiesPanel,
} from "../SoundEffectsPropertiesPanel";

describe("SoundEffectsPropertiesPanel", () => {
  it("renders the simplified sound effects workflow surface", () => {
    const { container } = render(<SoundEffectsPropertiesPanel />);

    expect(container.querySelector('[aria-label="Available sound effects"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Sound Effects" })).toBeInTheDocument();
    expect(screen.getByLabelText("Sound effects overview")).toBeInTheDocument();
    expect(
      screen.getByText("Impacts, transitions, ambience, and loopable audio accents.")
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("heading", { name: "Sound Effects" })
        .closest(".sound-effects-properties-script-actions-left")
        ?.closest(".sound-effects-properties-script-actions")
    ).not.toBeNull();
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
    expect(screen.getByRole("button", { name: "Sound effect duration" })).toHaveTextContent("Auto");
    expect(screen.getByText("Inspiration")).toBeInTheDocument();
    expect(screen.getByLabelText("Sound effect inspiration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cinematic boom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "vinyl crackle" })).toBeInTheDocument();
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

  it("supports a controlled prompt draft from page state", () => {
    const onPromptChange = vi.fn();
    const { rerender } = render(
      <SoundEffectsPropertiesPanel
        prompt="Short vinyl crackle burst."
        onPromptChange={onPromptChange}
      />
    );

    const promptField = screen.getByRole("textbox", { name: "Sound effect prompt" });
    expect(promptField).toHaveValue("Short vinyl crackle burst.");

    fireEvent.change(promptField, {
      target: { value: "Updated controlled sound effect draft." },
    });

    expect(onPromptChange).toHaveBeenCalledWith("Updated controlled sound effect draft.");

    rerender(
      <SoundEffectsPropertiesPanel
        prompt="Updated controlled sound effect draft."
        onPromptChange={onPromptChange}
      />
    );

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(
      "Updated controlled sound effect draft."
    );
  });

  it("supports a controlled duration draft from page state", () => {
    const onDurationChange = vi.fn();
    const { rerender } = render(
      <SoundEffectsPropertiesPanel durationSeconds={10} onDurationChange={onDurationChange} />
    );

    expect(screen.getByRole("button", { name: "Sound effect duration" })).toHaveTextContent("10s");

    fireEvent.click(screen.getByRole("button", { name: "Sound effect duration" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "30s" }));

    expect(onDurationChange).toHaveBeenCalledWith(30);

    rerender(
      <SoundEffectsPropertiesPanel durationSeconds={30} onDurationChange={onDurationChange} />
    );

    expect(screen.getByRole("button", { name: "Sound effect duration" })).toHaveTextContent("30s");
  });

  it("supports a controlled loop draft from page state", () => {
    const onLoopEnabledChange = vi.fn();

    render(
      <SoundEffectsPropertiesPanel loopEnabled={true} onLoopEnabledChange={onLoopEnabledChange} />
    );

    const loopSwitch = screen.getByRole("switch", { name: "Loop sound effect" });
    expect(loopSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(loopSwitch);

    expect(onLoopEnabledChange).toHaveBeenCalledWith(false);
  });

  it("keeps generate available when shared pricing is unavailable", () => {
    render(<SoundEffectsPropertiesPanel onGenerate={vi.fn()} pricingPolicyReady={false} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Sound effect prompt" }), {
      target: { value: "Layered whoosh with a clean sparkle tail." },
    });

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows balance context on the generate control without changing the command label", () => {
    render(<SoundEffectsPropertiesPanel onGenerate={vi.fn()} balanceCredits={10000} />);

    const generateButton = screen.getByRole("button", { name: "Generate" });

    expect(generateButton).toHaveAttribute("data-credit-confidence", "covered");
    expect(generateButton.getAttribute("title")).toContain("balance 10000 credits");
    expect(screen.getByText("Balance covers this run")).toBeInTheDocument();
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
      modelId: hardcodedSoundEffectsModelId,
      displayedBilledCredits: resolvePricingGridBilledCredits({
        modelId: hardcodedSoundEffectsModelId,
        params: {
          durationSeconds: null,
          generationCount: 1,
        },
      }),
      pricingPolicyReady: true,
    });
  });

  it("submits the selected explicit sound effect duration", () => {
    const onGenerate = vi.fn();
    render(<SoundEffectsPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Sound effect prompt" }), {
      target: { value: "Wide atmospheric wind gust with a trailing rooftop whistle." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sound effect duration" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "10s" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        durationSeconds: 10,
      })
    );
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

  it("appends authored inspiration prompts into the prompt", () => {
    render(<SoundEffectsPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "cinematic boom" }));

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(
      "Huge cinematic boom with a deep sub impact, long trailer-style decay, and a cavernous low-end tail that feels massive and dramatic."
    );
  });

  it("appends authored inspiration prompts through the controlled draft path", () => {
    const onPromptChange = vi.fn();
    const nextPrompt =
      "Base layer.\n\nWarm vinyl crackle bed with soft dusty texture, subtle needle noise, and an intimate lo-fi character without harsh distortion.";
    const { rerender } = render(
      <SoundEffectsPropertiesPanel prompt="Base layer." onPromptChange={onPromptChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "vinyl crackle" }));

    expect(onPromptChange).toHaveBeenCalledWith(nextPrompt);

    rerender(<SoundEffectsPropertiesPanel prompt={nextPrompt} onPromptChange={onPromptChange} />);

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(nextPrompt);
  });

  it("shows the inserted inspiration text when the panel is wired like the page runtime", () => {
    const Harness = () => {
      const [prompt, setPrompt] = React.useState("");

      return <SoundEffectsPropertiesPanel prompt={prompt} onPromptChange={setPrompt} />;
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "vinyl crackle" }));

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(
      "Warm vinyl crackle bed with soft dusty texture, subtle needle noise, and an intimate lo-fi character without harsh distortion."
    );
  });

  it("keeps chip clicks inserting prompt text through a real pointer sequence", () => {
    render(<SoundEffectsPropertiesPanel />);

    const chip = screen.getByRole("button", { name: "vinyl crackle" });

    fireEvent.pointerDown(chip, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 120,
    });
    fireEvent.pointerUp(chip, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 120,
    });
    fireEvent.click(chip);

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(
      "Warm vinyl crackle bed with soft dusty texture, subtle needle noise, and an intimate lo-fi character without harsh distortion."
    );
  });

  it("submits the authored inspiration prompt text after a chip click", () => {
    const onGenerate = vi.fn();

    render(<SoundEffectsPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("button", { name: "vinyl crackle" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Warm vinyl crackle bed with soft dusty texture, subtle needle noise, and an intimate lo-fi character without harsh distortion.",
      })
    );
  });

  it("fails closed when an inspiration prompt would exceed the SFX prompt budget", () => {
    render(<SoundEffectsPropertiesPanel prompt={"p".repeat(420)} />);

    fireEvent.click(screen.getByRole("button", { name: "glass shatter" }));

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(
      "p".repeat(420)
    );
    expect(
      screen.getByText("This inspiration will not fit. Shorten the prompt and try again.")
    ).toBeInTheDocument();
  });

  it("keeps prompt authoring controls interactive while generation is running", () => {
    render(<SoundEffectsPropertiesPanel isGenerating onGenerate={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Sound effect prompt" }), {
      target: { value: "Layered whoosh with a clean sparkle tail." },
    });

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).not.toHaveAttribute(
      "readonly"
    );
    fireEvent.click(screen.getByRole("button", { name: "cinematic boom" }));
    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(
      "Layered whoosh with a clean sparkle tail.\n\nHuge cinematic boom with a deep sub impact, long trailer-style decay, and a cavernous low-end tail that feels massive and dramatic."
    );

    fireEvent.click(screen.getByRole("switch", { name: "Loop sound effect" }));
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("button", { name: "Sound effect duration" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Generate" })).toHaveTextContent("Generate");
    expect(screen.getByRole("button", { name: "cinematic boom" })).toBeEnabled();
  });
});
