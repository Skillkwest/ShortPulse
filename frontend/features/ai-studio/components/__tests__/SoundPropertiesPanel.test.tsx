/**
 * SoundPropertiesPanel rendering tests.
 * Verifies the new audio inspector shell exposes the core control groups.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SoundPropertiesPanel } from "../SoundPropertiesPanel";

describe("SoundPropertiesPanel", () => {
  it("renders the core audio inspector controls", () => {
    const { container } = render(<SoundPropertiesPanel />);

    expect(screen.getByText("Sound Properties")).toBeInTheDocument();
    expect(container.querySelector('[role="tab"][aria-label="Track"]')).not.toBeNull();
    expect(container.querySelector('[role="tab"][aria-label="Voice"]')).not.toBeNull();
    expect(container.querySelector('[role="tab"][aria-label="SFX"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Preview sound"]')).not.toBeNull();
    expect(screen.getByText("Preview changes")).toBeInTheDocument();
    expect(screen.getByText("Version log")).toBeInTheDocument();
  }, 20000);

  it("switches the panel copy when the sound mode changes", () => {
    const { container } = render(<SoundPropertiesPanel />);

    const voiceTab = container.querySelector('[role="tab"][aria-label="Voice"]');
    expect(voiceTab).not.toBeNull();
    fireEvent.click(voiceTab as HTMLElement);

    expect(screen.getByText("Voice focus")).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Preview sound"]')).not.toBeNull();
    expect(screen.getByText("Warm")).toBeInTheDocument();
  });
});
