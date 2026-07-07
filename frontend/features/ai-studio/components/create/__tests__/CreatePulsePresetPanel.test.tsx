/**
 * Create Pulse preset panel tests.
 * Verifies Pulse activation, saved custom pulse editing, and drag/drop pinning behavior.
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreatePulsePresetPanel } from "../CreatePulsePresetPanel";
import type { CreatePulsePresetId } from "../createPulsePresets";
import { CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS } from "../../../../../lib/model-runtime/createPulsePresetDomain";

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

describe("CreatePulsePresetPanel", () => {
  it("emphasizes the empty rail catalog action before a Pulse is active", () => {
    const { container } = render(
      <CreatePulsePresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        onActivePresetIdChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Empty pulse preset drop target" })
    ).toHaveTextContent("Choose from catalog");
    expect(container.querySelector(".create-composer-presets-card")).toHaveClass(
      "is-awaiting-pulse-selection"
    );
  });

  it("renders More Pulses in the AI Studio overlay layer instead of inside the rail", () => {
    const { container } = render(<CreatePulsePresetPanel />);

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));

    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });
    expect(pulsesSurface).toHaveClass("is-layered");
    expect(pulsesSurface.closest("#ai-studio-modal-layer-root")).not.toBeNull();
    expect(container.querySelector(".create-composer-presets-surface")).toBeNull();
    expect(pulsesSurface).toHaveStyle({
      top: "16px",
    });
  });

  it("holds the rail on a stable loading state until the live Pulse catalog is authoritative", () => {
    render(
      <CreatePulsePresetPanel
        isBuiltInCatalogLoading
        isBuiltInCatalogAuthoritative={false}
        selectedPresetIds={["image", "multi_shot"]}
        builtInDefinitions={CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS}
        onActivePresetIdChange={vi.fn()}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading pulses...");
    expect(screen.queryByRole("button", { name: "Video Prompt Magic preset" })).toBeNull();
    expect(screen.getByRole("button", { name: "More Pulses" })).toBeDisabled();
  });

  it("activates the selected pulse preset without mutating the visible composer", async () => {
    const onActivePresetIdChange = vi.fn();
    render(<CreatePulsePresetPanel onActivePresetIdChange={onActivePresetIdChange} />);

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
      <CreatePulsePresetPanel
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

  it("starts built-ins from the freshly loaded global catalog", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue(undefined);
    const refreshedDefinitions = [
      {
        ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
        label: "Admin Updated Video Prompt Magic",
        outputMode: "apply_prompt" as const,
        starterAssistantMessage: "Fresh admin starter.",
      },
    ];

    render(
      <CreatePulsePresetPanel
        builtInDefinitions={CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS}
        refreshBuiltInDefinitions={vi.fn(async () => refreshedDefinitions)}
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Video Prompt Magic preset" }));

    await waitFor(() => {
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "image",
          label: "Admin Updated Video Prompt Magic",
          outputMode: "apply_prompt",
          starterAssistantMessage: "Fresh admin starter.",
        }),
        expect.objectContaining({
          pulseSessionInstanceId: expect.any(String),
        })
      );
      expect(onActivePresetIdChange).toHaveBeenCalledWith(
        "image",
        expect.objectContaining({
          forceNewSession: true,
        })
      );
    });
  });

  it("blocks a stale built-in click when the refreshed global catalog no longer contains it", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn();

    render(
      <CreatePulsePresetPanel
        builtInDefinitions={CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS}
        refreshBuiltInDefinitions={vi.fn(async () => [CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[1]])}
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Video Prompt Magic preset" }));

    expect(
      await screen.findByText(
        "This built-in Pulse is no longer available. Reload the Pulse catalog and try again."
      )
    ).toBeInTheDocument();
    expect(onPresetStart).not.toHaveBeenCalled();
    expect(onActivePresetIdChange).not.toHaveBeenCalled();
  });

  it("drops retired built-in saved overrides from the catalog", () => {
    const onActivePresetIdChange = vi.fn();

    render(
      <CreatePulsePresetPanel
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
          {
            presetId: "legacy_prompt_modifier",
            label: "Legacy Prompt Modifier",
            description: "Retired legacy prompt modifier pulse.",
            systemInstructions: "Rewrite a pasted prompt.",
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
    expect(
      screen.queryByRole("button", { name: "Legacy Prompt Modifier preset" })
    ).not.toBeInTheDocument();
  });

  it("starts the built-in story builder workflow immediately on click", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue(undefined);

    render(
      <CreatePulsePresetPanel
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
      <CreatePulsePresetPanel
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

  it("does not start a new pulse while the initial activation is still busy", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn();

    render(
      <CreatePulsePresetPanel
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
        isActivationBusy
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    expect(onActivePresetIdChange).not.toHaveBeenCalled();
    expect(onPresetStart).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This Pulse is still finishing its response. You can switch after it completes."
    );
  });

  it("does not replace the active pulse while the current pulse is busy", async () => {
    const onActivePresetIdChange = vi.fn(() => "pulse-session-next");
    const onPresetStart = vi.fn().mockResolvedValue({ status: "started" as const });

    render(
      <CreatePulsePresetPanel
        activePresetId="image"
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
        isActivationBusy
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    expect(onPresetStart).not.toHaveBeenCalled();
    expect(onActivePresetIdChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This Pulse is still finishing its response. You can switch after it completes."
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
      <CreatePulsePresetPanel
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

  it("does not show a warning when kickoff is discarded as stale", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue({
      status: "failed",
      reason: "scope_discarded",
      message: "Pulse session changed before kickoff completed. Try again.",
    });

    render(
      <CreatePulsePresetPanel
        activePresetId="image"
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    await waitFor(() => {
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({ presetId: "story_builder" }),
        expect.objectContaining({
          pulseSessionInstanceId: expect.any(String),
          deferWorkflowSessionCommit: true,
        })
      );
    });

    expect(onActivePresetIdChange).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Pulse session changed before kickoff completed. Try again.")
    ).not.toBeInTheDocument();
  });

  it("does not activate a catalog Pulse when the rail is already full", async () => {
    const onActivePresetIdChange = vi.fn();
    const onSelectedPresetIdsChange = vi.fn().mockResolvedValue(true);

    render(
      <CreatePulsePresetPanel
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

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom 8" }));

    expect(onActivePresetIdChange).not.toHaveBeenCalled();
    expect(screen.getByText("Pulse preset panel is full (max 10).")).toBeInTheDocument();
  });

  it("does not restart kickoff when the active pulse preset is clicked again", async () => {
    const onActivePresetIdChange = vi.fn(() => null);
    const onPresetStart = vi.fn().mockResolvedValue(undefined);

    render(
      <CreatePulsePresetPanel
        activePresetId="image"
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Video Prompt Magic preset" }));

    await waitFor(() => {
      expect(onActivePresetIdChange).not.toHaveBeenCalled();
      expect(onPresetStart).not.toHaveBeenCalled();
    });
  });

  it("restarts kickoff when the active pulse has an empty unrecoverable session", async () => {
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue({ status: "started" as const });

    render(
      <CreatePulsePresetPanel
        activePresetId="image"
        onActivePresetIdChange={onActivePresetIdChange}
        onPresetStart={onPresetStart}
        shouldRestartActivePreset={(presetId) => presetId === "image"}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Video Prompt Magic preset" }));

    await waitFor(() => {
      expect(onPresetStart).toHaveBeenCalledWith(
        expect.objectContaining({ presetId: "image" }),
        expect.objectContaining({
          pulseSessionInstanceId: expect.any(String),
          deferWorkflowSessionCommit: true,
          allowInterruptCurrentPulse: false,
        })
      );
      expect(onActivePresetIdChange).toHaveBeenCalledWith(
        "image",
        expect.objectContaining({
          forceNewSession: true,
          preserveWorkflowSession: true,
          sessionInstanceIdOverride: expect.any(String),
        })
      );
    });
  });

  it("opens the Pulses surface and saves a custom preset override without hidden workflow metadata", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <CreatePulsePresetPanel
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
          pulseKind: "custom_gpt",
          createdAt: null,
          schemaVersion: 2,
        },
      ]);
    });
  });

  it("does not expose built-in preset editing from the Pulses surface", async () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <CreatePulsePresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[]}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));

    expect(
      screen.queryByRole("button", { name: "Edit DFY Story Builder preset" })
    ).not.toBeInTheDocument();
    expect(onSavedPresetsChange).not.toHaveBeenCalled();
  });

  it("keeps the Pulses editor open when saving fails", async () => {
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
      <CreatePulsePresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={savedPresets}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Storyboard preset" }));
    fireEvent.change(screen.getByLabelText("System instructions"), {
      target: { value: "Use only these visible instructions." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Unable to save this Pulse right now.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit pulse preset" })).toBeInTheDocument();
  });

  it("opens the Pulse Library modal from the Pulses surface", () => {
    const onOpenPresetsLibrary = vi.fn();

    render(<CreatePulsePresetPanel onOpenPresetsLibrary={onOpenPresetsLibrary} />);

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    fireEvent.click(screen.getByRole("button", { name: /pulse library/i }));

    expect(onOpenPresetsLibrary).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Pulses" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Pulse Library" })).not.toBeInTheDocument();
  });

  it("hides built-in ownership badges in the Pulses activation surface", () => {
    render(
      <CreatePulsePresetPanel
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

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });

    expect(within(pulsesSurface).queryByText("Built-in")).not.toBeInTheDocument();
    expect(within(pulsesSurface).queryByText("Custom")).not.toBeInTheDocument();
    expect(within(pulsesSurface).getByRole("button", { name: "Storyboard" })).toBeInTheDocument();
  });

  it("does not show panel Pulses inside the Pulses activation surface", () => {
    render(<CreatePulsePresetPanel activePresetId="image" />);

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });

    expect(
      within(pulsesSurface).queryByRole("button", { name: "Video Prompt Magic" })
    ).not.toBeInTheDocument();
    expect(
      within(pulsesSurface).queryByRole("button", { name: "Multi Sequence Video Prompt" })
    ).not.toBeInTheDocument();
    expect(within(pulsesSurface).getByRole("status")).toHaveTextContent(
      "All available Pulses are in the panel."
    );
  });

  it("renders custom and built-in Pulses inside one catalog grid", () => {
    render(
      <CreatePulsePresetPanel
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

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });

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

  it("marks editable custom Pulses so long names can reserve edit-button space", () => {
    const longPulseName = "Contract Pulse 292937 With A Very Long Name";

    render(
      <CreatePulsePresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={[
          {
            presetId: "custom_long_contract_pulse",
            label: longPulseName,
            description: null,
            systemInstructions: "Build a contract-ready pulse sequence.",
            pulseKind: "custom_gpt",
            createdAt: null,
            schemaVersion: 2,
          },
        ]}
        onSavedPresetsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });
    const longPulseButton = within(pulsesSurface).getByRole("button", { name: longPulseName });
    const longPulseItem = longPulseButton.closest(".create-composer-presets-chip-item");

    expect(longPulseItem).toHaveClass("is-editable");
    expect(longPulseItem).toHaveClass("is-custom");
    expect(
      within(pulsesSurface).getByRole("button", {
        name: `Edit ${longPulseName} preset`,
      })
    ).toBeInTheDocument();
  });

  it("hides pinned rail Pulses from the Pulses grid", () => {
    render(<CreatePulsePresetPanel />);

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });

    expect(
      within(pulsesSurface).queryByRole("button", { name: "Video Prompt Magic" })
    ).not.toBeInTheDocument();
    expect(
      within(pulsesSurface).queryByRole("button", { name: "Multi Sequence Video Prompt" })
    ).not.toBeInTheDocument();
    expect(
      within(pulsesSurface).queryByRole("button", { name: "DFY Story Builder" })
    ).not.toBeInTheDocument();
    expect(within(pulsesSurface).getByRole("status")).toHaveTextContent(
      "All available Pulses are in the panel."
    );
  });

  it("hides built-in Pulses from the catalog when the user has removed them", () => {
    render(
      <CreatePulsePresetPanel
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

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });

    expect(
      within(pulsesSurface).queryByRole("button", { name: "Video Prompt Magic" })
    ).not.toBeInTheDocument();
    expect(
      within(pulsesSurface).getByRole("button", { name: "Multi Sequence Video Prompt" })
    ).toBeInTheDocument();
  });

  it("keeps the Pulses editor limited to name and system instructions", () => {
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
      <CreatePulsePresetPanel
        selectedPresetIds={[]}
        onSelectedPresetIdsChange={vi.fn()}
        savedPresets={savedPresets}
        onSavedPresetsChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
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

  it("pins a preset from the Pulses surface into the panel via drag and drop", async () => {
    const onSelectedPresetIdsChange = vi.fn();
    const transfer = new MockDataTransfer();

    render(
      <CreatePulsePresetPanel
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

  it("moves a dragged Pulse from the Pulses surface into the panel only", async () => {
    const transfer = new MockDataTransfer();

    const StatefulPulsePanel = () => {
      const [selectedPresetIds, setSelectedPresetIds] = React.useState<CreatePulsePresetId[]>([
        "image",
      ]);
      return (
        <CreatePulsePresetPanel
          selectedPresetIds={selectedPresetIds}
          onSelectedPresetIdsChange={(nextPresetIds) => {
            setSelectedPresetIds(nextPresetIds);
            return true;
          }}
        />
      );
    };

    render(<StatefulPulsePanel />);

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });
    const panelDropzone = screen.getByLabelText("Pulse preset panel list");
    const surfacePulse = within(pulsesSurface).getByRole("button", {
      name: "Multi Sequence Video Prompt",
    });

    fireEvent.dragStart(surfacePulse, { dataTransfer: transfer });
    fireEvent.dragOver(panelDropzone, { dataTransfer: transfer });
    fireEvent.drop(panelDropzone, { dataTransfer: transfer });

    await waitFor(() => {
      expect(
        within(panelDropzone).getByRole("button", { name: "Multi Sequence Video Prompt preset" })
      ).toBeInTheDocument();
      expect(
        within(pulsesSurface).queryByRole("button", { name: "Multi Sequence Video Prompt" })
      ).not.toBeInTheDocument();
    });
  });

  it("moves a dragged Pulse from the panel back into the Pulses surface only", async () => {
    const transfer = new MockDataTransfer();

    const StatefulPulsePanel = () => {
      const [selectedPresetIds, setSelectedPresetIds] = React.useState<CreatePulsePresetId[]>([
        "image",
        "multi_shot",
      ]);
      return (
        <CreatePulsePresetPanel
          selectedPresetIds={selectedPresetIds}
          onSelectedPresetIdsChange={(nextPresetIds) => {
            setSelectedPresetIds(nextPresetIds);
            return true;
          }}
        />
      );
    };

    render(<StatefulPulsePanel />);

    fireEvent.click(screen.getByRole("button", { name: "More Pulses" }));
    const pulsesSurface = screen.getByRole("region", { name: "Pulses" });
    const panelDropzone = screen.getByLabelText("Pulse preset panel list");
    const panelPulse = within(panelDropzone).getByRole("button", {
      name: "Multi Sequence Video Prompt preset",
    });

    fireEvent.dragStart(panelPulse, { dataTransfer: transfer });
    fireEvent.dragOver(pulsesSurface, { dataTransfer: transfer });
    fireEvent.drop(pulsesSurface, { dataTransfer: transfer });

    await waitFor(() => {
      expect(
        within(panelDropzone).queryByRole("button", { name: "Multi Sequence Video Prompt preset" })
      ).not.toBeInTheDocument();
      expect(
        within(pulsesSurface).getByRole("button", { name: "Multi Sequence Video Prompt" })
      ).toBeInTheDocument();
    });
  });

  it("starts and pins a pulse from the Pulses surface", async () => {
    const onActivePresetIdChange = vi.fn();
    const onSelectedPresetIdsChange = vi.fn();
    const onPresetStart = vi.fn().mockResolvedValue(undefined);

    render(
      <CreatePulsePresetPanel
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
    });

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
    expect(onActivePresetIdChange).toHaveBeenCalledWith(
      "multi_shot",
      expect.objectContaining({
        forceNewSession: true,
        preserveWorkflowSession: true,
        sessionInstanceIdOverride: expect.any(String),
      })
    );
    expect(screen.queryByRole("region", { name: "Pulses" })).not.toBeInTheDocument();
  });

  it("surfaces Pulse rail save failures when pinning from the Pulses surface", async () => {
    const onSelectedPresetIdsChange = vi.fn().mockResolvedValue(false);
    const onActivePresetIdChange = vi.fn();
    const onPresetStart = vi.fn();

    render(
      <CreatePulsePresetPanel
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
