/**
 * VoiceChangerPropertiesPanel rendering tests.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { VoiceChangerPropertiesPanel } from "../VoiceChangerPropertiesPanel";

describe("VoiceChangerPropertiesPanel", () => {
  it("renders the dedicated workflow shell", () => {
    render(<VoiceChangerPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Voice Changer" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Replace Voice" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("textbox", { name: "Transformation notes" })).toBeInTheDocument();
    expect(screen.getByText("Transform setup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transform voice" })).toBeInTheDocument();
  });

  it("switches modes independently within the voice changer panel", async () => {
    render(<VoiceChangerPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Match Delivery" }));

    expect(screen.getByRole("tab", { name: "Match Delivery" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(
      screen.getByPlaceholderText(/keeping the original cadence and phrasing/i)
    ).toBeInTheDocument();
  });
});
