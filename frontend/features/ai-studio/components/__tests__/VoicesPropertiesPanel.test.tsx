/**
 * VoicesPropertiesPanel rendering tests.
 * Verifies the dedicated Voices workflow shell renders independently from TTS.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetSharedVoicesGridStore } from "../../hooks/useSharedVoicesGrid";
import {
  buildVoiceoverElevenV3RequestConfig,
  VoicesPropertiesPanel,
} from "../VoicesPropertiesPanel";

describe("VoicesPropertiesPanel", () => {
  beforeEach(() => {
    resetSharedVoicesGridStore();
  });

  it("renders the dedicated voices workflow surface", () => {
    render(<VoicesPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Voices" })).toBeInTheDocument();
    expect(screen.getByLabelText("Available voices")).toBeInTheDocument();
    expect(screen.queryByText("Available voices")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Create New Voice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /harbor voice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play harbor sample/i })).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize available voices and prompt sections" })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Voice script" })).toHaveAttribute(
      "placeholder",
      "Paste or write the script that will be spoken with this voice."
    );
    expect(screen.getByRole("button", { name: "+ Create New Voice" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Harbor Blueprint")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Voice generation prompt" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create Voice from prompt" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Generated voice preview")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play generated voice preview" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save voice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(screen.getByText("Voice mode")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Voice mode" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Voice Changer" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByLabelText("Voice shaping")).toBeInTheDocument();
    expect(screen.getByText("Voice shaping")).toBeInTheDocument();
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover language override" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Voiceover output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.queryByText("Create method")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference audio")).not.toBeInTheDocument();
    expect(screen.queryByText("Design setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Create mode uses the fixed 11v3 model.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice Design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Instant Voice Clone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice Remixing" })).not.toBeInTheDocument();
  });

  it("keeps the create mode guidance in the right rail until the create panel opens", () => {
    render(<VoicesPropertiesPanel />);

    const scriptField = screen.getByRole("textbox", {
      name: "Voice script",
    });

    expect(scriptField).toHaveValue("");
    expect(scriptField).toHaveAttribute("maxLength", "5000");
    expect(screen.getByText("0 / 5,000")).toBeInTheDocument();
    expect(screen.queryByText("Design setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Create mode uses the fixed 11v3 model.")).not.toBeInTheDocument();
    expect(screen.queryByText("Design model")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview text")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Design model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Preview text mode" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Voice shaping")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Voiceover output format" })).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Voice generation prompt" })
    ).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Harbor Blueprint")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();
  });

  it("uses the top create button as the entry point to the create panel", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const voiceNameField = screen.getByDisplayValue("Harbor Blueprint");
    expect(voiceNameField).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Create new voice")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Voice generation prompt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Voice from prompt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save voice" })).toBeInTheDocument();
    expect(screen.getByLabelText("Voice shaping")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Voiceover output format" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();
  });

  it("switches the right rail between create and edit voice modes", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    expect(screen.getByRole("tab", { name: "Voice Changer" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByRole("textbox", { name: "Voice script" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Voice changer source drop zone")).toBeInTheDocument();
    expect(screen.getByText("Drop a source clip")).toBeInTheDocument();
    expect(screen.getByText(/Drag one audio or video file/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByLabelText("Voice changer shaping")).toBeInTheDocument();
    expect(screen.getByLabelText("Voice changer settings")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /noise reduction/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("combobox", { name: "Voice changer output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.queryByText("Input format")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voice changer input format" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice shaping")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover output format" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Voice generation prompt" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create Voice from prompt" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /speaker boost/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Voice changer model" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Voiceover" }));

    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Voice shaping")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Voiceover output format" })).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Voice generation prompt" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();
  });

  it("stages one local video source in the voice changer drop zone", () => {
    const { container } = render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["video"], "demo-clip.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(screen.getByText("demo-clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("Video source")).toBeInTheDocument();
    expect(screen.getByText(/ready for conversion/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("accepts an internal reference-grid video drop in voice changer mode", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const dataTransfer = {
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-url",
        "text/reference-render-url",
      ],
      files: [],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-123",
            "text/reference-url": "https://cdn.shortpulse.test/renders/shot-01.mp4",
            "text/reference-render-url": "https://cdn.shortpulse.test/renders/shot-01.mp4",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    expect(screen.getByText("shot-01.mp4")).toBeInTheDocument();
    expect(screen.getByText("Reference Grid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("uses the voiceover shaping controls only", () => {
    render(<VoicesPropertiesPanel />);

    expect(screen.getByText("Speed")).toBeInTheDocument();
    expect(screen.getByText("1.00x")).toBeInTheDocument();
    expect(screen.getByText("Stability")).toBeInTheDocument();
    expect(screen.getByText("0.50")).toBeInTheDocument();
    expect(screen.getByText("Similarity boost")).toBeInTheDocument();
    expect(screen.getByText("0.75")).toBeInTheDocument();
    expect(screen.queryByText("Style exaggeration")).not.toBeInTheDocument();
    expect(screen.queryByText("Similarity")).not.toBeInTheDocument();
    expect(screen.queryByText("Speaker boost")).not.toBeInTheDocument();
  });

  it("lets voiceover sliders move locally and updates the readout", () => {
    render(<VoicesPropertiesPanel />);

    const speedSlider = screen.getByRole("slider", { name: "Speed" });
    fireEvent.change(speedSlider, { target: { value: "80" } });

    expect(speedSlider).toHaveValue("80");
    expect(screen.getByText("1.30x")).toBeInTheDocument();
  });

  it("hard-codes the correct Eleven v3 voiceover request defaults", () => {
    expect(
      buildVoiceoverElevenV3RequestConfig({
        speed: 50,
        stability: 50,
        similarityBoost: 75,
      })
    ).toEqual({
      model_id: "eleven_v3",
      language_code: null,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1,
        style: 0,
      },
    });
  });

  it("lets voice changer sliders move locally and keeps their peach-mode values", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const speedSlider = screen.getByRole("slider", { name: "Speed" });
    fireEvent.change(speedSlider, { target: { value: "72" } });

    expect(speedSlider).toHaveValue("72");
    expect(screen.getByText("1.08x")).toBeInTheDocument();
  });

  it("keeps voiceover and voice changer slider values decoupled across mode switches", () => {
    render(<VoicesPropertiesPanel />);

    const voiceoverSpeedSlider = screen.getByRole("slider", { name: "Speed" });
    fireEvent.change(voiceoverSpeedSlider, { target: { value: "80" } });
    expect(voiceoverSpeedSlider).toHaveValue("80");
    expect(screen.getByText("1.30x")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const voiceChangerSpeedSlider = screen.getByRole("slider", { name: "Speed" });
    expect(voiceChangerSpeedSlider).toHaveValue("64");
    expect(screen.getByText("0.96x")).toBeInTheDocument();

    fireEvent.change(voiceChangerSpeedSlider, { target: { value: "72" } });
    expect(voiceChangerSpeedSlider).toHaveValue("72");
    expect(screen.getByText("1.08x")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Voiceover" }));

    const voiceoverSpeedSliderAfterReturn = screen.getByRole("slider", { name: "Speed" });
    expect(voiceoverSpeedSliderAfterReturn).toHaveValue("80");
    expect(screen.getByText("1.30x")).toBeInTheDocument();
  });

  it("saves a voice into the local voices grid from the create rail", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    fireEvent.change(screen.getByDisplayValue("Harbor Blueprint"), {
      target: { value: "Lantern" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Voice generation prompt" }), {
      target: { value: "Measured documentary narrator with a warm, grounded cadence." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save voice" }));
    fireEvent.click(screen.getByRole("button", { name: "Close and save voice" }));

    expect(screen.getByRole("button", { name: /lantern voice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lantern voice/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("closes and saves the create panel from the top-right close button", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));
    fireEvent.change(screen.getByDisplayValue("Harbor Blueprint"), {
      target: { value: "Beacon" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Voice generation prompt" }), {
      target: { value: "Clear, bright guide voice with a polished documentary tone." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Close and save voice" }));

    expect(screen.queryByLabelText("Create new voice")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beacon voice/i })).toBeInTheDocument();
  });

  it("overwrites the prompt text when dropping a prompt into the create-side prompt box", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const promptField = screen.getByRole("textbox", { name: "Voice generation prompt" });
    fireEvent.change(promptField, {
      target: { value: "Original prompt that should be replaced." },
    });
    expect(promptField).toHaveValue("Original prompt that should be replaced.");

    const dataTransfer = {
      types: ["text/prompt"],
      getData: (type: string) =>
        type === "text/prompt" ? "Deep dramatic baritone for trailers and cinematic reveals." : "",
      dropEffect: "none",
    };

    fireEvent.dragOver(promptField, { dataTransfer });
    fireEvent.drop(promptField, { dataTransfer });

    expect(promptField).toHaveValue("Deep dramatic baritone for trailers and cinematic reveals.");
  });

  it("overwrites the text-to-speech script when dropping text into the main script box", () => {
    render(<VoicesPropertiesPanel />);

    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    fireEvent.change(scriptField, {
      target: { value: "Original script that should be replaced." },
    });
    expect(scriptField).toHaveValue("Original script that should be replaced.");

    const dataTransfer = {
      types: ["text/prompt"],
      getData: (type: string) =>
        type === "text/prompt" ? "Deep dramatic baritone for trailers and cinematic reveals." : "",
      dropEffect: "none",
    };

    fireEvent.dragOver(scriptField, { dataTransfer });
    fireEvent.drop(scriptField, { dataTransfer });

    expect(scriptField).toHaveValue("Deep dramatic baritone for trailers and cinematic reveals.");
  });

  it("keeps the voice prompt and voice script fully decoupled", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const promptField = screen.getByRole("textbox", { name: "Voice generation prompt" });
    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    const createVoiceButton = screen.getByRole("button", { name: "Create Voice from prompt" });
    const saveVoiceButton = screen.getByRole("button", { name: "Save voice" });
    const generateButton = screen.getByRole("button", { name: "Generate" });

    fireEvent.change(promptField, {
      target: { value: "Prompt-only text for generating a new voice." },
    });

    expect(promptField).toHaveValue("Prompt-only text for generating a new voice.");
    expect(scriptField).toHaveValue("");
    expect(createVoiceButton).toBeEnabled();
    expect(saveVoiceButton).toBeEnabled();
    expect(generateButton).toBeDisabled();

    fireEvent.change(scriptField, {
      target: { value: "Script-only text for speech output." },
    });

    expect(promptField).toHaveValue("Prompt-only text for generating a new voice.");
    expect(scriptField).toHaveValue("Script-only text for speech output.");
    expect(createVoiceButton).toBeEnabled();
    expect(saveVoiceButton).toBeEnabled();
    expect(generateButton).toBeEnabled();

    fireEvent.change(promptField, {
      target: { value: "" },
    });

    expect(promptField).toHaveValue("");
    expect(scriptField).toHaveValue("Script-only text for speech output.");
    expect(createVoiceButton).toBeDisabled();
    expect(saveVoiceButton).toBeDisabled();
    expect(generateButton).toBeEnabled();
  });

  it("resizes the voice list and prompt sections when dragging the divider", () => {
    const { container } = render(<VoicesPropertiesPanel />);

    const divider = screen.getByRole("separator", {
      name: "Resize available voices and prompt sections",
    });
    const splitContainer = container.querySelector(".voices-properties-main") as HTMLElement;

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
      pointerId: 101,
      button: 0,
      clientY: 430,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(window, { pointerId: 101, clientY: 320 });
    fireEvent.pointerUp(window, { pointerId: 101, clientY: 320 });

    const after = Number(divider.getAttribute("aria-valuenow"));
    expect(after).toBeLessThan(before);
  });

  it("hides the voices grid and top create button when the top pane is fully collapsed", () => {
    const { container } = render(<VoicesPropertiesPanel />);

    const divider = screen.getByRole("separator", {
      name: "Resize available voices and prompt sections",
    });
    const splitContainer = container.querySelector(".voices-properties-main") as HTMLElement;

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

    expect(screen.queryByRole("button", { name: "+ Create New Voice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /harbor voice/i })).not.toBeInTheDocument();
  });
});
