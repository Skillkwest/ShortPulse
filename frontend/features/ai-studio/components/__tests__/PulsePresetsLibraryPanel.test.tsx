/**
 * PulsePresetsLibraryPanel tests.
 * Verifies the shared Pulse panel supports custom create/edit/delete flows.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulsePresetsLibraryPanel } from "../PulsePresetsLibraryPanel";

describe("PulsePresetsLibraryPanel", () => {
  it("renders the pulse presets library header", () => {
    render(<PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={() => undefined} />);

    expect(screen.getByText("Pulse Library")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Manage custom Pulses here\. Built-in guided workflows are shared globally and edited from the Admin Agent Instructions guided-workflows section\./
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Custom Pulses")).toBeInTheDocument();
    expect(screen.getByText("Built-in Guided Workflows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new pulse" })).toBeInTheDocument();
  });

  it("shows custom ownership without built-in pills in the library tiles", () => {
    render(
      <PulsePresetsLibraryPanel
        savedPresets={[
          {
            presetId: "custom_storyboard",
            label: "Storyboard",
            description: null,
            systemInstructions: "Build a storyboard-ready pulse sequence.",
            createdAt: null,
            schemaVersion: 2,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
      />
    );

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.queryByText("Built-in")).not.toBeInTheDocument();
  });

  it("creates a new shared custom pulse preset", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new pulse" }));
    expect(screen.getByRole("heading", { name: "Create New Pulse" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "Storyboard" },
    });
    fireEvent.change(screen.getByLabelText("System Instructions"), {
      target: { value: "Build a storyboard-ready pulse sequence." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(onSavedPresetsChange).toHaveBeenCalledTimes(1);
      expect(onSavedPresetsChange.mock.calls[0]?.[0]).toEqual([
        expect.objectContaining({
          label: "Storyboard",
          systemInstructions: "Build a storyboard-ready pulse sequence.",
          pulseKind: "custom_gpt",
          schemaVersion: 2,
        }),
      ]);
    });
  });

  it("keeps pulse authoring limited to name and system instructions", () => {
    render(<PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Create new pulse" }));

    expect(screen.getByLabelText("System Instructions")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pulse Type")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Activate it later from the Create Pulse rail or Pulse Catalog/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show advanced settings" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Starter Assistant Message")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow Stage Labels")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role & Goal")).not.toBeInTheDocument();
  });

  it("does not open the editor for a built-in pulse preset", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Inspect pulse preset tile: Video Prompt Magic" })
    );

    expect(screen.queryByRole("heading", { name: "Edit Preset" })).not.toBeInTheDocument();
    expect(onSavedPresetsChange).not.toHaveBeenCalled();
  });

  it("clears hidden custom pulse metadata when saving from the simple editor", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel
        savedPresets={[
          {
            presetId: "pulse_storyboard",
            label: "Storyboard",
            description: "Old hidden description.",
            systemInstructions: "Old instructions.",
            pulseKind: "custom_gpt",
            runtimeMode: "custom_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Old hidden starter.",
            workflowStageHints: ["Old", "Hidden", "Hints"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            createdAt: null,
            schemaVersion: 2,
          },
        ]}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Inspect pulse preset tile: Storyboard" }));
    fireEvent.change(screen.getByLabelText("System Instructions"), {
      target: { value: "Use only these visible instructions." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSavedPresetsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          presetId: "pulse_storyboard",
          description: null,
          systemInstructions: "Use only these visible instructions.",
          pulseKind: "custom_gpt",
          schemaVersion: 2,
        }),
      ]);
    });
  });

  it("keeps the editor open and shows an error when Pulse save fails", async () => {
    const onSavedPresetsChange = vi.fn().mockResolvedValue(false);

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new pulse" }));
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "Storyboard" },
    });
    fireEvent.change(screen.getByLabelText("System Instructions"), {
      target: { value: "Build a storyboard-ready pulse sequence." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Unable to save this Pulse right now.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create New Pulse" })).toBeInTheDocument();
  });

  it("deletes a shared custom pulse preset", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel
        savedPresets={[
          {
            presetId: "pulse_storyboard",
            label: "Storyboard",
            description: null,
            systemInstructions: "Build a storyboard-ready pulse sequence.",
            createdAt: null,
            schemaVersion: 2,
          },
        ]}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete pulse preset: Storyboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onSavedPresetsChange).toHaveBeenCalledWith([]);
    });
  });
});
