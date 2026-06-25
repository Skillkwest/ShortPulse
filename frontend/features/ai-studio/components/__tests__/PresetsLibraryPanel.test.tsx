import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PresetsLibraryPanel } from "../PresetsLibraryPanel";
import {
  EDIT_PRESET_CUSTOM_PRESET_IDS,
  createDeletedPresetOverride,
  type ExpertEditResolvedPreset,
} from "../edit/expertEditPresets";

const PRESETS: ExpertEditResolvedPreset[] = [
  {
    presetId: "selfie",
    label: "Selfie",
    prompt: "Use a selfie perspective.",
    isCustom: false,
    hasOverride: false,
  },
  {
    presetId: "custom_1",
    label: "Custom 1",
    prompt: "Use the custom prompt.",
    isCustom: true,
    hasOverride: false,
  },
  {
    presetId: "custom_2",
    label: "Custom 2",
    prompt: "Use the custom prompt.",
    isCustom: true,
    hasOverride: false,
  },
  {
    presetId: "custom_3",
    label: "Custom 3",
    prompt: "Use the custom prompt.",
    isCustom: true,
    hasOverride: false,
  },
];

describe("PresetsLibraryPanel", () => {
  it("does not show a custom pill for custom presets", () => {
    render(<PresetsLibraryPanel presets={PRESETS} selectedPresetId={null} />);

    expect(screen.queryByText(/^Custom$/)).not.toBeInTheDocument();
  });

  it("shows the ShortPulse favicon marker for system presets", () => {
    render(<PresetsLibraryPanel presets={PRESETS} selectedPresetId={null} />);

    expect(screen.getByLabelText("Built-in preset")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Built-in preset" }).querySelector("img")
    ).toHaveAttribute("src", expect.stringContaining("Fav.png"));
  });

  it("does not show a custom pill when a custom preset has a saved override", () => {
    render(
      <PresetsLibraryPanel
        presets={[
          {
            presetId: "custom_1",
            label: "My Saved Custom",
            prompt: "My saved custom prompt.",
            isCustom: true,
            hasOverride: true,
          },
        ]}
        selectedPresetId={null}
      />
    );

    expect(screen.queryByText(/^Custom$/)).not.toBeInTheDocument();
  });

  it("opens the edit modal when a preset card is clicked", () => {
    const onSelectPreset = vi.fn();

    render(
      <PresetsLibraryPanel
        presets={PRESETS}
        selectedPresetId={null}
        onSelectPreset={onSelectPreset}
        onSavePresetOverride={vi.fn().mockResolvedValue(true)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit preset tile: Custom 1" }));

    expect(onSelectPreset).toHaveBeenCalledWith("custom_1");
    expect(screen.getByRole("dialog", { name: "Edit Custom 1 preset" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Custom 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Use the custom prompt.")).toBeInTheDocument();
  });

  it("opens the requested custom preset editor and consumes the request", () => {
    const onSelectPreset = vi.fn();
    const onOpenPresetEditRequestConsumed = vi.fn();

    render(
      <PresetsLibraryPanel
        presets={PRESETS}
        selectedPresetId={null}
        openPresetEditRequest={{ presetId: "custom_2", requestId: 1 }}
        onOpenPresetEditRequestConsumed={onOpenPresetEditRequestConsumed}
        onSelectPreset={onSelectPreset}
        onSavePresetOverride={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(onOpenPresetEditRequestConsumed).toHaveBeenCalledTimes(1);
    expect(onSelectPreset).toHaveBeenCalledWith("custom_2");
    expect(screen.getByRole("dialog", { name: "Edit Custom 2 preset" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Custom 2")).toBeInTheDocument();
  });

  it("opens and closes delete confirmation modal from the tile delete action", () => {
    render(<PresetsLibraryPanel presets={PRESETS} selectedPresetId={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete preset: Custom 1" }));
    expect(screen.getByRole("dialog", { name: "Delete this preset?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete this preset?" })).not.toBeInTheDocument();
  });

  it("confirms delete and saves deleted tombstone override", async () => {
    const onSavePresetOverride = vi.fn().mockResolvedValue(true);
    const onSelectPreset = vi.fn();

    render(
      <PresetsLibraryPanel
        presets={PRESETS}
        selectedPresetId="custom_1"
        onSelectPreset={onSelectPreset}
        onSavePresetOverride={onSavePresetOverride}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete preset: Custom 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onSavePresetOverride).toHaveBeenCalledWith("custom_1", createDeletedPresetOverride());
    });
    expect(onSelectPreset).toHaveBeenCalledWith(null);
  });

  it("allows deleting a built-in preset through a tombstone override", async () => {
    const onSavePresetOverride = vi.fn().mockResolvedValue(true);

    render(
      <PresetsLibraryPanel
        presets={PRESETS}
        selectedPresetId={null}
        onSavePresetOverride={onSavePresetOverride}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete preset: Selfie" }));
    expect(
      screen.getByText("This does not delete the shared built-in for other users.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onSavePresetOverride).toHaveBeenCalledWith("selfie", createDeletedPresetOverride());
    });
  });

  it("opens create modal from the Create New Preset tile and saves to the next custom preset", async () => {
    const onSavePresetOverride = vi.fn().mockResolvedValue(true);

    render(
      <PresetsLibraryPanel
        presets={PRESETS}
        selectedPresetId={null}
        onSavePresetOverride={onSavePresetOverride}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new preset" }));
    expect(screen.getByRole("dialog", { name: "Create Custom 4 preset" })).toBeInTheDocument();
    expect(screen.queryByText("Set the preset name and prompt text.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "Action Detail" },
    });
    fireEvent.change(screen.getByLabelText("Preset Prompt"), {
      target: { value: "Create an energetic action portrait with directional motion." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(onSavePresetOverride).toHaveBeenCalledWith("custom_4", {
        label: "Action Detail",
        prompt: "Create an energetic action portrait with directional motion.",
      });
    });
  });

  it("saves edited preset name + prompt and closes modal", async () => {
    const onSavePresetOverride = vi.fn().mockResolvedValue(true);

    render(
      <PresetsLibraryPanel
        presets={PRESETS}
        selectedPresetId={null}
        onSavePresetOverride={onSavePresetOverride}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit preset tile: Custom 1" }));
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "Selfie Edited" },
    });
    fireEvent.change(screen.getByLabelText("Preset Prompt"), {
      target: { value: "Use the edited preset prompt." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSavePresetOverride).toHaveBeenCalledWith("custom_1", {
        label: "Selfie Edited",
        prompt: "Use the edited preset prompt.",
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Edit Custom 1 preset" })
      ).not.toBeInTheDocument();
    });
  });

  it("shows validation feedback when name or prompt is empty", async () => {
    render(
      <PresetsLibraryPanel
        presets={PRESETS}
        selectedPresetId={null}
        onSavePresetOverride={vi.fn().mockResolvedValue(true)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit preset tile: Custom 1" }));
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Preset name and prompt are required.")).toBeInTheDocument();
    });
  });

  it("hides the create tile when all custom preset slots are already visible", () => {
    const presetsWithAllCustomSlots: ExpertEditResolvedPreset[] = EDIT_PRESET_CUSTOM_PRESET_IDS.map(
      (presetId, index) => ({
        presetId,
        label: `Custom ${index + 1}`,
        prompt: "Saved custom preset prompt.",
        isCustom: true,
        hasOverride: true,
      })
    );

    render(<PresetsLibraryPanel presets={presetsWithAllCustomSlots} selectedPresetId={null} />);

    expect(screen.queryByRole("button", { name: "Create new preset" })).not.toBeInTheDocument();
  });
});
