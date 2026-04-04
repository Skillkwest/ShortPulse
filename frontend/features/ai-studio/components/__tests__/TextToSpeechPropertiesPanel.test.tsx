/**
 * Text to Speech properties panel tests.
 * Protects the structure of the TTS inspector surface.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextToSpeechPropertiesPanel } from "../TextToSpeechPropertiesPanel";

describe("TextToSpeechPropertiesPanel", () => {
  it("renders the Text to Speech editor shell", () => {
    render(<TextToSpeechPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Text to Speech" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Text input" })).toHaveAttribute(
      "maxLength",
      "5000"
    );
    expect(screen.getByText("0 / 5,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toHaveTextContent("15 credits");
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
});
