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
      expect(onActivePresetIdChange).toHaveBeenCalledWith(
        "multi_shot",
        expect.objectContaining({
          forceNewSession: true,
          sessionInstanceIdOverride: expect.any(String),
        })
      );
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
            artifactTarget: "video_prompt",
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
      expect(onActivePresetIdChange).toHaveBeenCalledWith(
        "image",
        expect.objectContaining({
          forceNewSession: true,
          preserveWorkflowSession: true,
          sessionInstanceIdOverride: expect.any(String),
        })
      );
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "image",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({
          pulseSessionInstanceId: expect.any(String),
          deferWorkflowSessionCommit: true,
        })
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
            artifactTarget: "text_artifact",
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
      expect(onActivePresetIdChange).toHaveBeenCalledWith(
        "story_builder",
        expect.objectContaining({
          forceNewSession: true,
          preserveWorkflowSession: true,
          sessionInstanceIdOverride: expect.any(String),
        })
      );
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "story_builder",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({
          pulseSessionInstanceId: expect.any(String),
          deferWorkflowSessionCommit: true,
        })
      );
    });
  });

  it("claims pulse ownership only after starting an activate-and-start preset", async () => {
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
      expect(onActivePresetIdChange).toHaveBeenCalledWith(
        "story_builder",
        expect.objectContaining({
          forceNewSession: true,
          preserveWorkflowSession: true,
          sessionInstanceIdOverride: expect.any(String),
        })
      );
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "story_builder",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({
          pulseSessionInstanceId: expect.any(String),
          deferWorkflowSessionCommit: true,
        })
      );
    });

    expect(observedActivePresetIds).toEqual([undefined]);
    expect(onPresetStart.mock.invocationCallOrder[0]).toBeLessThan(
      onActivePresetIdChange.mock.invocationCallOrder[0]
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

  it("keeps the previous active pulse when replacement kickoff fails", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue({
      status: "failed",
      reason: "transport_error",
      message: "Unable to start replacement Pulse.",
    });

    render(
      <CreateExpertPresetPanel
        activePresetId="image"
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    expect(await screen.findByText("Unable to start replacement Pulse.")).toBeInTheDocument();
    expect(onPresetStart).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: "story_builder" }),
      expect.objectContaining({
        pulseSessionInstanceId: expect.any(String),
        deferWorkflowSessionCommit: true,
      })
    );
    expect(onActivePresetIdChange).not.toHaveBeenCalled();
  });

  it("does not activate a catalog Pulse when the rail is already full", async () => {
    const onActivePresetIdChange = vi.fn();
    const onSelectedPresetIdsChange = vi.fn().mockResolvedValue(true);

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[
          "image",
          "multi_shot",
          "story_builder",
          "pulse_custom_1",
          "pulse_custom_2",
          "pulse_custom_3",
          "pulse_custom_4",
          "pulse_custom_5",
          "pulse_custom_6",
          "pulse_custom_7",
        ]}
        onSelectedPresetIdsChange={onSelectedPresetIdsChange}
        savedPresets={[
          {
            presetId: "pulse_custom_1",
            label: "Custom 1",
            description: null,
            systemInstructions: "One",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
          {
            presetId: "pulse_custom_2",
            label: "Custom 2",
            description: null,
            systemInstructions: "Two",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
          {
            presetId: "pulse_custom_3",
            label: "Custom 3",
            description: null,
            systemInstructions: "Three",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
          {
            presetId: "pulse_custom_4",
            label: "Custom 4",
            description: null,
            systemInstructions: "Four",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
          {
            presetId: "pulse_custom_5",
            label: "Custom 5",
            description: null,
            systemInstructions: "Five",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
          {
            presetId: "pulse_custom_6",
            label: "Custom 6",
            description: null,
            systemInstructions: "Six",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
          {
            presetId: "pulse_custom_7",
            label: "Custom 7",
            description: null,
            systemInstructions: "Seven",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
          {
            presetId: "pulse_custom_8",
            label: "Custom 8",
            description: null,
            systemInstructions: "Eight",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
        onActivePresetIdChange={onActivePresetIdChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom 8" }));

    expect(onActivePresetIdChange).not.toHaveBeenCalled();
    expect(screen.getByText("Pulse preset panel is full (max 10).")).toBeInTheDocument();
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
      expect(onActivePresetIdChange).toHaveBeenCalledWith(
        "image",
        expect.objectContaining({
          forceNewSession: true,
          preserveWorkflowSession: true,
          sessionInstanceIdOverride: expect.any(String),
        })
      );
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "image",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({
          pulseSessionInstanceId: expect.any(String),
          deferWorkflowSessionCommit: true,
        })
      );
    });
  });

  it("opens the Pulse Catalog surface and saves a custom preset override without hidden workflow metadata", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
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
          pulseKind: "custom_gpt",
          createdAt: null,
          schemaVersion: 2,
        },
      ]);
    });
  });

  it("does not expose built-in preset editing from the Pulse Catalog surface", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[]}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));

    expect(
      screen.queryByRole("button", { name: "Edit DFY Story Builder preset" })
    ).not.toBeInTheDocument();
    expect(onSavedPresetsChange).not.toHaveBeenCalled();
  });

  it("keeps the Pulse Catalog editor open when saving fails", async () => {
    const onSavedPresetsChange = vi.fn().mockResolvedValue(false);
    const savedPresets = [
      {
        presetId: "custom_storyboard",
        label: "Storyboard",
        description: null,
        systemInstructions: "Build a storyboard-ready pulse sequence.",
        pulseKind: "custom_gpt" as const,
        createdAt: null,
        schemaVersion: 2,
      },
    ];

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={savedPresets}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Storyboard preset" }));
    fireEvent.change(screen.getByLabelText("System instructions"), {
      target: { value: "Use only these visible instructions." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Unable to save this Pulse right now.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit pulse preset" })).toBeInTheDocument();
  });

  it("opens the Pulse Library modal from the Pulse Catalog surface", () => {
    const onOpenPresetsLibrary = vi.fn();

    render(<CreateExpertPresetPanel onOpenPresetsLibrary={onOpenPresetsLibrary} />);

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: /pulse library/i }));

    expect(onOpenPresetsLibrary).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Pulse Catalog" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Pulse Library" })).not.toBeInTheDocument();
  });

  it("hides built-in ownership badges in the Pulse Catalog activation surface", () => {
    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[
          {
            presetId: "custom_storyboard",
            label: "Storyboard",
            description: null,
            systemInstructions: "Build a storyboard-ready pulse sequence.",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulse Catalog" });

    expect(within(pulsesSurface).queryByText("Built-in")).not.toBeInTheDocument();
    expect(within(pulsesSurface).getByText("Custom")).toBeInTheDocument();
  });

  it("renders custom and built-in Pulses inside one catalog grid", () => {
    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[
          {
            presetId: "custom_storyboard",
            label: "Storyboard",
            description: null,
            systemInstructions: "Build a storyboard-ready pulse sequence.",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulse Catalog" });

    expect(within(pulsesSurface).queryByText("Custom Pulses")).not.toBeInTheDocument();
    expect(within(pulsesSurface).queryByText("Built-in Guided Workflows")).not.toBeInTheDocument();
    expect(
      within(pulsesSurface).getByRole("list", { name: "Pulse catalog presets" })
    ).toBeInTheDocument();
    expect(within(pulsesSurface).getByRole("button", { name: "Storyboard" })).toBeInTheDocument();
    expect(
      within(pulsesSurface).getByRole("button", { name: "Multi Sequence Video Prompt" })
    ).toBeInTheDocument();
  });

  it("hides built-in Pulses from the catalog when the user has removed them", () => {
    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[
          {
            presetId: "image",
            label: "Video Prompt Magic",
            description: "Guided single-shot video workflow from one reference image.",
            systemInstructions: "Hidden built-in pulse.",
            createdAt: null,
            schemaVersion: 2,
            isHidden: true,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulse Catalog" });

    expect(
      within(pulsesSurface).queryByRole("button", { name: "Video Prompt Magic" })
    ).not.toBeInTheDocument();
    expect(
      within(pulsesSurface).getByRole("button", { name: "Multi Sequence Video Prompt" })
    ).toBeInTheDocument();
  });

  it("keeps the Pulse Catalog editor limited to name and system instructions", () => {
    const savedPresets = [
      {
        presetId: "custom_storyboard",
        label: "Storyboard",
        description: null,
        systemInstructions: "Build a storyboard-ready pulse sequence.",
        pulseKind: "custom_gpt" as const,
        createdAt: null,
        schemaVersion: 2,
      },
    ];

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={savedPresets}
        onSavedPresetsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Storyboard preset" }));

    expect(screen.getByLabelText("System instructions")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pulse type")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show advanced settings" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Starter assistant message")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow Stage Labels")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role & Goal")).not.toBeInTheDocument();
  });

  it("pins a preset from the Pulse Catalog surface into the panel via drag and drop", async () => {
    const onSelectedPresetIdsChange = vi.fn();
    const transfer = new MockDataTransfer();

    render(
      <CreateExpertPresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={onSelectedPresetIdsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    const surfaceChip = screen.getByRole("button", { name: "Multi Sequence Video Prompt" });
    const panelDropzone = screen.getByLabelText("Pulse preset panel list");

    fireEvent.dragStart(surfaceChip, { dataTransfer: transfer });
    fireEvent.dragOver(panelDropzone, { dataTransfer: transfer });
    fireEvent.drop(panelDropzone, { dataTransfer: transfer });

    await waitFor(() => {
      expect(onSelectedPresetIdsChange).toHaveBeenCalledWith(["multi_shot"]);
    });
  });

  it("activates and pins a pulse directly from the Pulse Catalog surface", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Multi Sequence Video Prompt" }));

    await waitFor(() => {
      expect(onSelectedPresetIdsChange).toHaveBeenCalledWith(["multi_shot"]);
      expect(onActivePresetIdChange).toHaveBeenCalledWith(
        "multi_shot",
        expect.objectContaining({
          forceNewSession: true,
          preserveWorkflowSession: true,
          sessionInstanceIdOverride: expect.any(String),
        })
      );
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "multi_shot",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
        }),
        expect.objectContaining({
          pulseSessionInstanceId: expect.any(String),
          deferWorkflowSessionCommit: true,
        })
      );
    });

    expect(screen.queryByRole("region", { name: "Pulse Catalog" })).not.toBeInTheDocument();
  });

  it("surfaces Pulse rail save failures when pinning from the Pulse Catalog surface", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Pulse Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Multi Sequence Video Prompt" }));

    expect(await screen.findByText("Unable to save the Pulse rail right now.")).toBeInTheDocument();
    expect(onActivePresetIdChange).not.toHaveBeenCalled();
    expect(onPresetStart).not.toHaveBeenCalled();
  });
});
