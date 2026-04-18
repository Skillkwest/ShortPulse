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
    expect(screen.getByRole("button", { name: "+ Create New Sound Effect" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cathedral boom sound effect/i })
    ).toBeInTheDocument();
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
    expect(screen.getByRole("spinbutton", { name: "Duration in seconds" })).toHaveValue(null);
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("slider", { name: "Prompt influence" })).toHaveValue("30");
    expect(screen.getByRole("combobox", { name: "Sound effect output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByText("0 / 450")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("loads a library card into the prompt composer and settings rail", () => {
    render(<SoundEffectsPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: /neon alarm loop sound effect/i }));

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue(
      "Seamless futuristic alarm pulse with a neon synth bite, short metallic tick, and a steady loop-friendly rhythm."
    );
    expect(screen.getByRole("spinbutton", { name: "Duration in seconds" })).toHaveValue(2.5);
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("slider", { name: "Prompt influence" })).toHaveValue("54");
    expect(screen.getByRole("combobox", { name: "Sound effect output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("clears the prompt and resets settings when creating a new sound effect", () => {
    render(<SoundEffectsPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: /cathedral boom sound effect/i }));
    fireEvent.click(screen.getByRole("button", { name: "+ Create New Sound Effect" }));

    expect(screen.getByRole("textbox", { name: "Sound effect prompt" })).toHaveValue("");
    expect(screen.getByRole("spinbutton", { name: "Duration in seconds" })).toHaveValue(null);
    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("slider", { name: "Prompt influence" })).toHaveValue("30");
    expect(screen.getByRole("combobox", { name: "Sound effect output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("forces looping exports back to mp3 when wav is selected", () => {
    render(<SoundEffectsPropertiesPanel />);

    const outputFormat = screen.getByRole("combobox", { name: "Sound effect output format" });
    fireEvent.change(outputFormat, { target: { value: "wav_48000" } });
    expect(outputFormat).toHaveValue("wav_48000");

    fireEvent.click(screen.getByRole("switch", { name: "Loop sound effect" }));

    expect(screen.getByRole("switch", { name: "Loop sound effect" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(outputFormat).toHaveValue("mp3_44100_128");
    expect(screen.getByRole("option", { name: "WAV (48kHz)" })).toBeDisabled();
  });

  it("updates the prompt influence readout locally", () => {
    render(<SoundEffectsPropertiesPanel />);

    const promptInfluenceSlider = screen.getByRole("slider", { name: "Prompt influence" });
    fireEvent.change(promptInfluenceSlider, { target: { value: "62" } });

    expect(promptInfluenceSlider).toHaveValue("62");
    expect(screen.getByText("0.62")).toBeInTheDocument();
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
    ).toHaveAttribute("aria-valuenow", "73");

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

    expect(
      screen.queryByRole("button", { name: "+ Create New Sound Effect" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cathedral boom sound effect/i })
    ).not.toBeInTheDocument();
  });
});
