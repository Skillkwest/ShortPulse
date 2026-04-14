/**
 * Text to Speech properties panel tests.
 * Protects the structure of the TTS inspector surface.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetSharedVoicesGridStore } from "../../hooks/useSharedVoicesGrid";
import { TextToSpeechPropertiesPanel } from "../TextToSpeechPropertiesPanel";

describe("TextToSpeechPropertiesPanel", () => {
  beforeEach(() => {
    resetSharedVoicesGridStore();
  });

  it("renders the Text to Speech editor shell", () => {
    render(<TextToSpeechPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Text to Speech" })).toBeInTheDocument();
    expect(screen.getByLabelText("Available voices")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /harbor voice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play harbor sample/i })).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize text input and prompt sections" })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Text input" })).toHaveAttribute(
      "maxLength",
      "5000"
    );
    expect(screen.getByText("0 / 5,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toHaveTextContent("Generate");
    expect(screen.getByRole("button", { name: "Generate" })).toHaveTextContent("15");
    expect(screen.getByRole("button", { name: "Voice" })).toBeInTheDocument();
    expect(screen.getByText("Darian")).toBeInTheDocument();
    expect(screen.getByText("Warm Grounded Storyteller")).toBeInTheDocument();
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Language override" })).toHaveValue("auto");
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "MP3 · 44.1 kHz · 128 kbps (Default)" })
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Output format" })).toHaveValue("mp3_44100_128");
  });

  it("enables Generate when text is present", async () => {
    render(<TextToSpeechPropertiesPanel />);

    const input = screen.getByRole("textbox", { name: "Text input" });
    const button = screen.getByRole("button", { name: "Generate" });

    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "Hello world" } });

    expect(button).toBeEnabled();
    expect(screen.getByText("11 / 5,000")).toBeInTheDocument();
  });

  it("uses the shared voices grid state from the voices workflow", () => {
    render(<TextToSpeechPropertiesPanel />);

    const harborVoiceButton = screen.getByRole("button", { name: /harbor voice/i });
    const solsticeVoiceButton = screen.getByRole("button", { name: /solstice voice/i });

    expect(harborVoiceButton).toHaveAttribute("aria-pressed", "true");
    expect(solsticeVoiceButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(solsticeVoiceButton);

    expect(solsticeVoiceButton).toHaveAttribute("aria-pressed", "true");
    expect(harborVoiceButton).toHaveAttribute("aria-pressed", "false");
  });
});
