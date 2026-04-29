/**
 * Create Pulse preset panel tests.
 * Verifies Pulse activation, saved custom pulse editing, and drag/drop pinning behavior.
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateExpertPresetPanel } from "../CreateExpertPresetPanel";

class MockDataTransfer implements DataTransfer {
  dropEffect: "none" | "copy" | "link" | "move" = "none";
  effectAllowed: DataTransfer["effectAllowed"] = "all";
  files = [] as unknown as FileList;
  items = [] as unknown as DataTransferItemList;
  types: string[] = [];
  private readonly store = new Map<string, string>();

  clearData(format?: string): void {
    if (format) {
      this.store.delete(format);
      this.types = this.types.filter((entry) => entry !== format);
      return;
    }
    this.store.clear();
    this.types = [];
  }

  getData(format: string): string {
    return this.store.get(format) ?? "";
  }

  setData(format: string, data: string): void {
    this.store.set(format, data);
    if (!this.types.includes(format)) {
      this.types.push(format);
    }
  }

  setDragImage(): void {}

  addElement(): void {}
}

describe("CreateExpertPresetPanel", () => {
  it("activates the selected pulse preset without mutating the visible composer", async () => {
    const onActivePresetIdChange = vi.fn();
    render(<CreateExpertPresetPanel onActivePresetIdChange={onActivePresetIdChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Multi Sequence Video Prompt preset" }));

    await waitFor(() => {
      expect(onActivePresetIdChange).toHaveBeenCalledWith("multi_shot", {
        forceNewSession: true,
      });
    });
  });

  it("starts workflow pulses immediately when activation mode is activate and start", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateExpertPresetPanel
        savedPresets={[
          {
            presetId: "image",
            label: "Video Prompt Magic",
            description: "Guided single-shot workflow pulse.",
            systemInstructions: "Ask for camera motion, then action, then dialogue.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your image to get the process started :)",
            outputMode: "chat_reply",
            memoryPolicy: "session",
            createdAt: null,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Video Prompt Magic preset" }));

    await waitFor(() => {
      expect(onActivePresetIdChange).toHaveBeenCalledWith("image", {
        forceNewSession: true,
      });
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "image",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({ pulseSessionInstanceId: null })
      );
    });
  });

  it("drops retired built-in saved overrides from the catalog", () => {
    const onActivePresetIdChange = vi.fn();

    render(
      <CreateExpertPresetPanel
        savedPresets={[
          {
            presetId: "single_shot",
            label: "Single-shot",
            description: "Retired pulse override.",
            systemInstructions: "Guide the user through story beats and camera planning.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: null,
            outputMode: "chat_reply",
            memoryPolicy: "session",
            createdAt: null,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
        onActivePresetIdChange={onActivePresetIdChange}
      />
    );

    expect(screen.queryByRole("button", { name: "Single-shot preset" })).not.toBeInTheDocument();
  });

  it("starts the built-in story builder workflow immediately on click", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateExpertPresetPanel
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    await waitFor(() => {
      expect(onActivePresetIdChange).toHaveBeenCalledWith("story_builder", {
        forceNewSession: true,
      });
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "story_builder",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({ pulseSessionInstanceId: null })
      );
    });
  });

  it("claims pulse ownership before starting an activate-and-start preset", async () => {
    const onActivePresetIdChange = vi.fn();
    const observedActivePresetIds: Array<string | null | undefined> = [];
    const onPresetStart = vi.fn().mockImplementation(async () => {
      observedActivePresetIds.push(onActivePresetIdChange.mock.calls.at(-1)?.[0]);
      return undefined;
    });

    render(
      <CreateExpertPresetPanel
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    await waitFor(() => {
      expect(onActivePresetIdChange).toHaveBeenCalledWith("story_builder", {
        forceNewSession: true,
      });
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "story_builder",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({ pulseSessionInstanceId: null })
      );
    });

    expect(observedActivePresetIds).toEqual(["story_builder"]);
    expect(onActivePresetIdChange.mock.invocationCallOrder[0]).toBeLessThan(
      onPresetStart.mock.invocationCallOrder[0]
    );
  });

  it("does not switch active ownership while pulse activation is busy", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn();

    render(
      <CreateExpertPresetPanel
        activePresetId="image"
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
        isActivationBusy
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    expect(onActivePresetIdChange).not.toHaveBeenCalled();
    expect(onPresetStart).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Wait for the current Pulse step to finish before switching."
    );
  });

  it("retries kickoff when the active pulse preset is clicked again", async () => {
    const onActivePresetIdChange = vi.fn(() => null);
    const onPresetStart = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateExpertPresetPanel
        activePresetId="image"
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Video Prompt Magic preset" }));

    await waitFor(() => {
      expect(onActivePresetIdChange).toHaveBeenCalledWith("image", {
        forceNewSession: true,
      });
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "image",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({ pulseSessionInstanceId: null })
      );
    });
  });

  it("opens the Pulses surface and saves a custom preset override", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <CreateExpertPresetPanel
        savedPresets={[
          {
            presetId: "pulse_storyboard",
            label: "Storyboard",
            description: "Old hidden description.",
            systemInstructions:
              "Map the concept as a visual storyboard with scene intent for each beat.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Old hidden starter.",
            workflowStageHints: ["Old", "Hidden", "Hints"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            createdAt: null,
          },
        ]}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Storyboard preset" }));
    fireEvent.change(screen.getByLabelText("Preset name"), {
      target: { value: "Hook Builder" },
    });
    fireEvent.change(screen.getByLabelText("System instructions"), {
      target: { value: "Start with a fast visual hook and one unmistakable product payoff." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSavedPresetsChange).toHaveBeenCalledWith([
        {
          presetId: "pulse_storyboard",
          label: "Hook Builder",
          description: null,
          systemInstructions: "Start with a fast visual hook and one unmistakable product payoff.",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          starterAssistantMessage: null,
          workflowStageHints: null,
          outputMode: "chat_reply",
          memoryPolicy: "session",
          createdAt: null,
        },
      ]);
    });
  });

  it("edits a built-in preset from the Pulses surface as a saved override", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[]}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit DFY Story Builder preset" }));
    fireEvent.change(screen.getByLabelText("Preset name"), {
      target: { value: "DFY Story Director" },
    });
    fireEvent.change(screen.getByLabelText("System instructions"), {
      target: { value: "Open with a fast paid-social visual hook and a clean benefit reveal." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSavedPresetsChange).toHaveBeenCalledWith([
        {
          presetId: "story_builder",
          label: "DFY Story Director",
          description: null,
          systemInstructions:
            "Open with a fast paid-social visual hook and a clean benefit reveal.",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          starterAssistantMessage: null,
          workflowStageHints: null,
          outputMode: "chat_reply",
          memoryPolicy: "session",
          createdAt: expect.any(String),
        },
      ]);
    });
  });

  it("keeps the More Pulses editor open when saving fails", async () => {
    const onSavedPresetsChange = vi.fn().mockResolvedValue(false);

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[]}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Video Prompt Magic preset" }));
    fireEvent.change(screen.getByLabelText("System instructions"), {
      target: { value: "Use only these visible instructions." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Unable to save this Pulse right now.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit pulse preset" })).toBeInTheDocument();
  });

  it("opens the Pulse Library modal from the More Pulses surface", () => {
    const onOpenPresetsLibrary = vi.fn();

    render(<CreateExpertPresetPanel onOpenPresetsLibrary={onOpenPresetsLibrary} />);

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: /pulse library/i }));

    expect(onOpenPresetsLibrary).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Pulses" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Pulses" })).not.toBeInTheDocument();
  });

  it("hides built-in ownership badges in the More Pulses activation surface", () => {
    render(
      <CreateExpertPresetPanel
        savedPresets={[
          {
            presetId: "custom_storyboard",
            label: "Storyboard",
            description: null,
            systemInstructions: "Build a storyboard-ready pulse sequence.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: null,
            outputMode: "chat_reply",
            memoryPolicy: "session",
            createdAt: null,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });

    expect(within(pulsesSurface).queryByText("Built-in")).not.toBeInTheDocument();
    expect(within(pulsesSurface).getByText("Custom")).toBeInTheDocument();
  });

  it("keeps the More Pulses editor limited to name and system instructions", () => {
    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[]}
        onSavedPresetsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Video Prompt Magic preset" }));

    expect(screen.getByLabelText("System instructions")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show advanced settings" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Starter assistant message")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow Stage Labels")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role & Goal")).not.toBeInTheDocument();
  });

  it("pins a preset from the Pulses surface into the panel via drag and drop", async () => {
    const onSelectedPresetIdsChange = vi.fn();
    const transfer = new MockDataTransfer();

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={onSelectedPresetIdsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const surfaceChip = screen.getByRole("button", { name: "Multi Sequence Video Prompt" });
    const panelDropzone = screen.getByLabelText("Pulse preset panel list");

    fireEvent.dragStart(surfaceChip, { dataTransfer: transfer });
    fireEvent.dragOver(panelDropzone, { dataTransfer: transfer });
    fireEvent.drop(panelDropzone, { dataTransfer: transfer });

    await waitFor(() => {
      expect(onSelectedPresetIdsChange).toHaveBeenCalledWith(["multi_shot"]);
    });
  });

  it("activates and pins a pulse directly from the More Pulses surface", async () => {
    const onActivePresetIdChange = vi.fn();
    const onSelectedPresetIdsChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={onSelectedPresetIdsChange}
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: "Multi Sequence Video Prompt" }));

    await waitFor(() => {
      expect(onSelectedPresetIdsChange).toHaveBeenCalledWith(["multi_shot"]);
      expect(onActivePresetIdChange).toHaveBeenCalledWith("multi_shot", {
        forceNewSession: true,
      });
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "multi_shot",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({ pulseSessionInstanceId: null })
      );
    });

    expect(screen.queryByRole("region", { name: "Pulses" })).not.toBeInTheDocument();
  });

  it("surfaces Pulse rail save failures when pinning from the More Pulses surface", async () => {
    const onSelectedPresetIdsChange = vi.fn().mockResolvedValue(false);
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn();

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={onSelectedPresetIdsChange}
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: "Multi Sequence Video Prompt" }));

    expect(await screen.findByText("Unable to save the Pulse rail right now.")).toBeInTheDocument();
    expect(onActivePresetIdChange).not.toHaveBeenCalled();
    expect(onPresetStart).not.toHaveBeenCalled();
  });
});
