/**
 * PulsePresetsLibraryPanel tests.
 * Verifies the shared Pulse panel supports custom create/edit/delete flows.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulsePresetsLibraryPanel } from "../PulsePresetsLibraryPanel";

describe("PulsePresetsLibraryPanel", () => {
  it("renders the pulse presets library header", () => {
    render(<PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={() => undefined} />);

    expect(screen.getByText("Pulse Presets Library")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new pulse preset" })).toBeInTheDocument();
  });

  it("creates a new shared custom pulse preset", () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new pulse preset" }));
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "Storyboard" },
    });
    fireEvent.change(screen.getByLabelText("System Instructions"), {
      target: { value: "Build a storyboard-ready pulse sequence." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onSavedPresetsChange).toHaveBeenCalledTimes(1);
    expect(onSavedPresetsChange.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        label: "Storyboard",
        systemInstructions: "Build a storyboard-ready pulse sequence.",
        runtimeMode: "prompt_editor",
        activationMode: "activate_only",
      }),
    ]);
  });

  it("applies a workflow template when creating a new pulse preset", () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new pulse preset" }));
    fireEvent.click(screen.getByRole("button", { name: "Multi Sequence Video Workflow" }));
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "My Multi Sequence Pulse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onSavedPresetsChange).toHaveBeenCalledTimes(1);
    expect(onSavedPresetsChange.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        label: "My Multi Sequence Pulse",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage:
          "Step 1 - Upload: Please upload the image you want to base the scene on.",
        workflowStageHints: [
          "Image Intake",
          "Action Arc",
          "Dialog",
          "Storyboard Build",
          "Final Prompt",
        ],
        outputMode: "chat_reply",
      }),
    ]);
  });

  it("saves workflow stage labels for custom workflow pulses", () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new pulse preset" }));
    fireEvent.change(screen.getByLabelText("Runtime Mode"), {
      target: { value: "workflow_gpt" },
    });
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "Guided Video Pulse" },
    });
    fireEvent.change(screen.getByLabelText("Workflow Instructions"), {
      target: { value: "Guide the user through a short video workflow." },
    });
    fireEvent.change(screen.getByLabelText("Workflow Stage Labels"), {
      target: { value: "Image Gate\nCamera Motion\nAction\nFinal Prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onSavedPresetsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        label: "Guided Video Pulse",
        workflowStageHints: ["Image Gate", "Camera Motion", "Action", "Final Prompt"],
      }),
    ]);
  });

  it("switches workflow labels when runtime mode is workflow gpt", () => {
    render(<PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Create new pulse preset" }));
    fireEvent.change(screen.getByLabelText("Runtime Mode"), {
      target: { value: "workflow_gpt" },
    });

    expect(screen.getByLabelText("Workflow Instructions")).toBeInTheDocument();
    expect(screen.getByLabelText("Exact First Assistant Message")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow authoring checklist")).toBeInTheDocument();
  });

  it("composes workflow instructions from structured workflow builder fields", () => {
    render(<PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Create new pulse preset" }));
    fireEvent.change(screen.getByLabelText("Runtime Mode"), {
      target: { value: "workflow_gpt" },
    });
    fireEvent.change(screen.getByLabelText("Role & Goal"), {
      target: { value: "Turn one uploaded image into a guided ad-video workflow." },
    });
    fireEvent.change(screen.getByLabelText("Step Flow"), {
      target: { value: "1. Ask for the image.\n2. Ask for the hook.\n3. Ask for the CTA." },
    });
    fireEvent.change(screen.getByLabelText("Final Output Shape"), {
      target: { value: "Return one final prompt block with hook, sequence, and CTA." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Compose Workflow Instructions" }));

    const instructionsField = screen.getByLabelText("Workflow Instructions") as HTMLTextAreaElement;
    expect(instructionsField.value).toContain("ROLE & GOAL");
    expect(instructionsField.value).toContain("FINAL OUTPUT SHAPE");
  });

  it("clicking a built-in pulse preset opens edit and saves a personal override", () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel savedPresets={[]} onSavedPresetsChange={onSavedPresetsChange} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Inspect pulse preset tile: Video Prompt Magic" })
    );
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "Image Director" },
    });
    fireEvent.change(screen.getByLabelText("Workflow Instructions"), {
      target: { value: "Lead with a single polished hero image and one unmistakable visual hook." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSavedPresetsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        presetId: "image",
        label: "Image Director",
        systemInstructions:
          "Lead with a single polished hero image and one unmistakable visual hook.",
      }),
    ]);
  });

  it("deletes a shared custom pulse preset", () => {
    const onSavedPresetsChange = vi.fn();

    render(
      <PulsePresetsLibraryPanel
        savedPresets={[
          {
            presetId: "pulse_storyboard",
            label: "Storyboard",
            description: null,
            systemInstructions: "Build a storyboard-ready pulse sequence.",
            runtimeMode: "prompt_editor",
            activationMode: "activate_only",
            starterAssistantMessage: null,
            outputMode: "apply_prompt",
            memoryPolicy: "session",
            createdAt: null,
          },
        ]}
        onSavedPresetsChange={onSavedPresetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete pulse preset: Storyboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(onSavedPresetsChange).toHaveBeenCalledWith([]);
  });
});
