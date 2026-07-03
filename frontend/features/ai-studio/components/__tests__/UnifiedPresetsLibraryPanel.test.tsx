import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiedPresetsLibraryPanel } from "../UnifiedPresetsLibraryPanel";
import type { ExpertEditResolvedPreset } from "../edit/expertEditPresets";
import type { CreatePulsePreferenceRuntimeValue } from "../create/createPulsePreferenceRuntime";

const restoreDeletedBuiltInPresetIdsMock = vi.hoisted(() => vi.fn(async () => true));
const useCreatePulsePreferenceRuntimeMock = vi.hoisted(() => vi.fn());

const createPulseRuntimeMockValue = (
  overrides: Partial<CreatePulsePreferenceRuntimeValue> = {}
): CreatePulsePreferenceRuntimeValue => ({
  ...buildPulseRuntimeMockValue(),
  ...overrides,
});

const buildPulseRuntimeMockValue = (): CreatePulsePreferenceRuntimeValue => ({
  presetPanelIds: [],
  savedPresets: [],
  deletedBuiltInPresetIds: ["image"],
  builtInDefinitions: [],
  builtInDefinitionsLoading: false,
  builtInDefinitionsError: null,
  builtInDefinitionsSource: "control_plane" as const,
  builtInDefinitionsDegraded: false,
  builtInDefinitionsAuthoritative: true,
  refreshBuiltInDefinitions: vi.fn(async () => []),
  setPresetPanelIds: vi.fn(async () => true),
  setSavedPresets: vi.fn(async () => true),
  restoreDeletedBuiltInPresetIds: restoreDeletedBuiltInPresetIdsMock,
});

vi.mock("../create/CreatePulsePreferenceProvider", () => ({
  CreatePulsePreferenceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCreatePulsePreferenceRuntime: () => useCreatePulsePreferenceRuntimeMock(),
}));

vi.mock("../PulsePresetsLibraryPanel", () => ({
  PulsePresetsLibraryPanel: ({ searchQuery }: { searchQuery?: string }) => (
    <div data-testid="pulse-presets-library-panel" data-search-query={searchQuery ?? ""} />
  ),
}));

describe("UnifiedPresetsLibraryPanel", () => {
  beforeEach(() => {
    restoreDeletedBuiltInPresetIdsMock.mockClear();
    useCreatePulsePreferenceRuntimeMock.mockReturnValue(createPulseRuntimeMockValue());
  });

  it("restores prompt and Pulse built-ins from one confirmation action", async () => {
    vi.useFakeTimers();
    const restorePromptBuiltIns = vi.fn(async () => true);

    try {
      render(
        <UnifiedPresetsLibraryPanel
          promptPresets={[]}
          selectedPromptPresetId={null}
          onRestorePromptBuiltIns={restorePromptBuiltIns}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /restore built-ins/i }));

      screen.getByRole("dialog", { name: /restore built-ins/i });
      fireEvent.click(screen.getByRole("button", { name: /^restore$/i }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(restorePromptBuiltIns).toHaveBeenCalledTimes(1);
      expect(restoreDeletedBuiltInPresetIdsMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Built-ins restored.")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2_200);
      });
      expect(screen.getByText("Built-ins restored.").closest(".app-message")).toHaveClass(
        "is-fading"
      );

      act(() => {
        vi.advanceTimersByTime(260);
      });
      expect(screen.queryByText("Built-ins restored.")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes a prompt preset edit request into the prompt presets editor", () => {
    const promptPresets: ExpertEditResolvedPreset[] = [
      {
        presetId: "custom_1",
        label: "Custom 1",
        prompt: "Use the first custom prompt.",
        isCustom: true,
        hasOverride: false,
      },
    ];
    const onSelectPromptPreset = vi.fn();
    const onOpenPromptPresetEditRequestConsumed = vi.fn();

    render(
      <UnifiedPresetsLibraryPanel
        promptPresets={promptPresets}
        selectedPromptPresetId={null}
        openPromptPresetEditRequest={{ presetId: "custom_1", requestId: 1 }}
        onOpenPromptPresetEditRequestConsumed={onOpenPromptPresetEditRequestConsumed}
        onSelectPromptPreset={onSelectPromptPreset}
        onSavePromptPresetOverride={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(onOpenPromptPresetEditRequestConsumed).toHaveBeenCalledTimes(1);
    expect(onSelectPromptPreset).toHaveBeenCalledWith("custom_1");
    expect(screen.getByRole("dialog", { name: "Edit Custom 1 preset" })).toBeInTheDocument();
  });

  it("filters prompt presets from the tab-row search input", () => {
    const promptPresets: ExpertEditResolvedPreset[] = [
      {
        presetId: "selfie",
        label: "Selfie",
        prompt: "Use a selfie perspective.",
        isCustom: false,
        hasOverride: false,
      },
      {
        presetId: "drone_view",
        label: "Drone View",
        prompt: "Use a high aerial perspective.",
        isCustom: false,
        hasOverride: false,
      },
    ];

    render(
      <UnifiedPresetsLibraryPanel promptPresets={promptPresets} selectedPromptPresetId={null} />
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search presets" }), {
      target: { value: "drone" },
    });

    expect(screen.getByText("Drone View")).toBeInTheDocument();
    expect(screen.queryByText("Selfie")).not.toBeInTheDocument();
    expect(screen.getByTestId("pulse-presets-library-panel")).toHaveAttribute(
      "data-search-query",
      "drone"
    );
  });

  it("shows a quiet Pulse catalog status when built-ins are using fallback definitions", () => {
    useCreatePulsePreferenceRuntimeMock.mockReturnValue(
      createPulseRuntimeMockValue({
        builtInDefinitionsSource: "seed",
        builtInDefinitionsDegraded: true,
        builtInDefinitionsAuthoritative: false,
      })
    );

    render(<UnifiedPresetsLibraryPanel promptPresets={[]} selectedPromptPresetId={null} />);

    expect(
      screen.getByText(
        "Pulse built-ins are showing the seeded fallback until the admin catalog reloads."
      )
    ).toBeInTheDocument();
  });
});
