import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PresetsLibraryPanel } from "../PresetsLibraryPanel";
import type { ExpertEditResolvedPreset } from "../edit/expertEditPresets";

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
];

describe("PresetsLibraryPanel", () => {
  it("shows the custom pill for a default custom preset", () => {
    const { container } = render(<PresetsLibraryPanel presets={PRESETS} selectedPresetId={null} />);

    expect(container.querySelector(".presets-library-custom-pill")).toBeTruthy();
  });

  it("hides the custom pill when a custom preset has a saved override", () => {
    const { container } = render(
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

    expect(container.querySelector(".presets-library-custom-pill")).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: "Edit preset tile: Selfie" }));

    expect(onSelectPreset).toHaveBeenCalledWith("selfie");
    expect(screen.getByRole("dialog", { name: "Edit Selfie preset" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Selfie")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Use a selfie perspective.")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Edit preset tile: Selfie" }));
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "Selfie Edited" },
    });
    fireEvent.change(screen.getByLabelText("Preset Prompt"), {
      target: { value: "Use the edited preset prompt." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSavePresetOverride).toHaveBeenCalledWith("selfie", {
        label: "Selfie Edited",
        prompt: "Use the edited preset prompt.",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit Selfie preset" })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Edit preset tile: Selfie" }));
    fireEvent.change(screen.getByLabelText("Preset Name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Preset name and prompt are required.")).toBeInTheDocument();
    });
  });
});
