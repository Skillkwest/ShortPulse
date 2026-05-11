/**
 * SoundPropertiesPanel rendering tests.
 * Verifies the top-level Sound route acts as a real workflow chooser.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SoundPropertiesPanel } from "../SoundPropertiesPanel";

describe("SoundPropertiesPanel", () => {
  it("renders the sound workflow hub instead of a fake inspector", () => {
    render(<SoundPropertiesPanel />);

    expect(screen.getByText("Sound Workflows")).toBeInTheDocument();
    expect(screen.getByText("Pick a sound lane")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Voice workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Music workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open SFX workflow" })).toBeInTheDocument();
    expect(screen.queryByText("Preview changes")).toBeNull();
    expect(screen.queryByText("Version log")).toBeNull();
  });

  it("routes into the selected sound workflow", () => {
    const onSelectTool = vi.fn();
    render(<SoundPropertiesPanel onSelectTool={onSelectTool} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Music workflow" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Voice workflow" }));
    fireEvent.click(screen.getByRole("button", { name: "Open SFX workflow" }));

    expect(onSelectTool).toHaveBeenNthCalledWith(1, "music");
    expect(onSelectTool).toHaveBeenNthCalledWith(2, "voices");
    expect(onSelectTool).toHaveBeenNthCalledWith(3, "sound-effects");
  });
});
