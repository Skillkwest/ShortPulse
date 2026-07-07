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
        /Manage your Pulse catalog here\. Custom and built-in Pulses share the same grid\./
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new pulse" })).toBeInTheDocument();
  });

  it("shows custom ownership text and ShortPulse favicon markers for built-in pulse tiles", () => {
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
    expect(screen.getAllByLabelText("Built-in Pulse").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("img", { name: "Built-in Pulse" })[0]?.querySelector("img")
    ).toHaveAttribute("src", expect.stringContaining("Fav.png"));
    expect(
      screen
        .getAllByRole("img", { name: "Built-in Pulse" })[0]
        ?.compareDocumentPosition(screen.getByText("Video Prompt Magic"))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("filters Pulse tiles by search query", () => {
    render(
      <PulsePresetsLibraryPanel
        searchQuery="storyboard"
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

    expect(screen.getByText("Storyboard")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create new pulse" })).not.toBeInTheDocument();
  });

  it("shows an empty search state when no Pulses match", () => {
    render(
      <PulsePresetsLibraryPanel
        searchQuery="no matching pulse"
        savedPresets={[]}
        onSavedPresetsChange={vi.fn()}
      />
    );

    expect(screen.getByText("No Pulses match this search.")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Custom Pulse instruction guide")).toBeInTheDocument();
    expect(screen.getByText("What the Pulse helps with")).toBeInTheDocument();
    expect(screen.getByText("What it should ask before answering")).toBeInTheDocument();
    expect(
      screen.getByText("What kind of finished response or artifact it should produce")
    ).toBeInTheDocument();
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

  it("opens read-only details instead of the editor for a built-in pulse preset", () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Inspect pulse preset tile: Video Prompt Magic" })
    );

    expect(screen.getByRole("dialog", { name: "Video Prompt Magic details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Video Prompt Magic" })).toBeInTheDocument();
    const promptViewer = screen.getByLabelText("Prompt") as HTMLTextAreaElement;
    expect(promptViewer.value).toContain("Single-Shot Video Prompt");
    expect(promptViewer).toHaveAttribute("readonly");
    expect(
      screen.queryByText(/Inspecting here does not activate this Pulse\./)
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Built-in guided workflow")).not.toBeInTheDocument();
    expect(screen.queryByText("Starts with")).not.toBeInTheDocument();
    expect(screen.queryByText("Workflow")).not.toBeInTheDocument();
    expect(screen.queryByText("Produces")).not.toBeInTheDocument();
    expect(screen.queryByText("Runtime")).not.toBeInTheDocument();
    expect(screen.queryByText("Activation")).not.toBeInTheDocument();
    expect(screen.queryByText("Artifact Target")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duplicate to custom" })).not.toBeInTheDocument();
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

  it("hides a built-in pulse from the user's library instead of deleting it globally", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete pulse preset: Video Prompt Magic" })
    );
    expect(
      screen.getByText("This does not delete the shared built-in for other users.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onSavedPresetsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          presetId: "image",
          label: "Video Prompt Magic",
          isHidden: true,
        }),
      ]);
    });
  });
});
