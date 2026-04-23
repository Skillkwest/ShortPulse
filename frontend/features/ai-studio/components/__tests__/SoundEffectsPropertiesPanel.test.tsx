/**
 * SoundEffectsPropertiesPanel rendering tests.
 * Verifies the standalone Sound Effects workflow stays decoupled from Voices and generic Sound.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SoundEffectsPropertiesPanel } from "../SoundEffectsPropertiesPanel";

describe("SoundEffectsPropertiesPanel", () => {
  it("renders the dedicated sound effects workflow surface", () => {
    render(<SoundEffectsPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Sound Effects" })).toBeInTheDocument();
    expect(screen.getByLabelText("Available sound effects")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ Create New Sound Effect" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("No sound effects yet")).toBeInTheDocument();
    expect(screen.getByText("Generated sound effects will appear here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sound effect/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("separator", {
        name: "Resize available sound effects and prompt sections",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveAttribute(
      "placeholder",
      "Describe the sound effect you want to generate with detail, texture, space, and motion."
    );
    expect(screen.getByText("Generation settings")).toBeInTheDocument();
    expect(
      screen.queryByRole("spinbutton", { name: "Duration in seconds" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.queryByRole("slider", { name: "Prompt influence" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sound effect output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(
      screen.queryByText("Leave blank for auto duration. Manual duration supports 0.5s to 30s.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Generates a repeatable effect bed when enabled.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Higher values push the result closer to the written prompt.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("WAV export stays available for non-looping effects only.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByText("0 / 450")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("keeps the composer empty by default", () => {
    render(<SoundEffectsPropertiesPanel onGenerate={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("combobox", { name: "Sound effect output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("submits manual prompt settings without placeholder cards", () => {
    render(<SoundEffectsPropertiesPanel onGenerate={vi.fn()} />);

    const promptField = screen.getByRole("textbox", { name: "Sound effect prompt" });
    const outputFormat = screen.getByRole("combobox", { name: "Sound effect output format" });

    fireEvent.change(promptField, {
      target: { value: "Short vinyl crackle burst with a dusty hi-fi tail." },
    });
    fireEvent.change(outputFormat, { target: { value: "pcm_48000" } });

    expect(promptField).toHaveValue("Short vinyl crackle burst with a dusty hi-fi tail.");
    expect(outputFormat).toHaveValue("pcm_48000");
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("starts with the prompt section at its minimum default height", () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          width: 700,
          height: 900,
          right: 700,
          bottom: 900,
          toJSON: () => ({}),
        }) as DOMRect
    );

    render(<SoundEffectsPropertiesPanel />);

    expect(
      screen.getByRole("separator", {
        name: "Resize available sound effects and prompt sections",
      })
    ).toHaveAttribute("aria-valuenow", "71");

    rectSpy.mockRestore();
  });

  it("resizes the sound effects library and prompt sections when dragging the divider", () => {
    const { container } = render(<SoundEffectsPropertiesPanel />);

    const divider = screen.getByRole("separator", {
      name: "Resize available sound effects and prompt sections",
    });
    const splitContainer = container.querySelector(".sound-effects-properties-main") as HTMLElement;

    expect(splitContainer).toBeTruthy();
    Object.defineProperty(splitContainer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 700,
        height: 900,
        right: 700,
        bottom: 900,
        toJSON: () => ({}),
      }),
    });

    const before = Number(divider.getAttribute("aria-valuenow"));
    expect(Number.isFinite(before)).toBe(true);

    fireEvent.pointerDown(divider, {
      pointerId: 201,
      button: 0,
      clientY: 430,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(window, { pointerId: 201, clientY: 320 });
    fireEvent.pointerUp(window, { pointerId: 201, clientY: 320 });

    const after = Number(divider.getAttribute("aria-valuenow"));
    expect(after).toBeLessThan(before);
  });

  it("hides the sound effects library when the top pane is fully collapsed", () => {
    const { container } = render(<SoundEffectsPropertiesPanel />);

    const divider = screen.getByRole("separator", {
      name: "Resize available sound effects and prompt sections",
    });
    const splitContainer = container.querySelector(".sound-effects-properties-main") as HTMLElement;

    Object.defineProperty(splitContainer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 700,
        height: 900,
        right: 700,
        bottom: 900,
        toJSON: () => ({}),
      }),
    });

    fireEvent.keyDown(divider, { key: "Home" });

    expect(screen.queryByText("No sound effects yet")).not.toBeInTheDocument();
  });

  it("submits the mapped request payload when generate is clicked", () => {
    const onGenerate = vi.fn();
    render(<SoundEffectsPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Sound effect prompt" }), {
      target: { value: "Huge cinematic boom inside a vaulted cathedral, with a deep sub hit." },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Sound effect output format" }), {
      target: { value: "pcm_48000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(onGenerate).toHaveBeenCalledWith({
      text: "Huge cinematic boom inside a vaulted cathedral, with a deep sub hit.",
      durationSeconds: null,
      loop: false,
      outputFormat: "pcm_48000",
      modelId: "eleven_text_to_sound_v2",
    });
  });

  it("shows the loading label while generation is running", () => {
    render(<SoundEffectsPropertiesPanel isGenerating onGenerate={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByText("Generating…")).toBeInTheDocument();
  });
});
