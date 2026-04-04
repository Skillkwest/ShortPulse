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
    render(<SoundPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Sound Properties" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Track" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Voice" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "SFX" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview sound" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview changes" })).toBeInTheDocument();
    expect(screen.getByText("Version log")).toBeInTheDocument();
  });

  it("switches the panel copy when the sound mode changes", () => {
    render(<SoundPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice" }));

    expect(screen.getByText("Voice focus")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview sound" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warm" })).toBeInTheDocument();
  });
});
