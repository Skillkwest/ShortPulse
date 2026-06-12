import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiedPresetsLibraryPanel } from "../UnifiedPresetsLibraryPanel";

const restoreDeletedBuiltInPresetIdsMock = vi.hoisted(() => vi.fn(async () => true));

vi.mock("../create/CreatePulsePreferenceProvider", () => ({
  CreatePulsePreferenceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCreatePulsePreferenceRuntime: () => ({
    presetPanelIds: [],
    savedPresets: [],
    deletedBuiltInPresetIds: ["image"],
    builtInDefinitions: [],
    builtInDefinitionsLoading: false,
    builtInDefinitionsAuthoritative: true,
    refreshBuiltInDefinitions: vi.fn(async () => []),
    setPresetPanelIds: vi.fn(async () => true),
    setSavedPresets: vi.fn(async () => true),
    restoreDeletedBuiltInPresetIds: restoreDeletedBuiltInPresetIdsMock,
  }),
}));

vi.mock("../PulsePresetsLibraryPanel", () => ({
  PulsePresetsLibraryPanel: () => <div data-testid="pulse-presets-library-panel" />,
}));

describe("UnifiedPresetsLibraryPanel", () => {
  beforeEach(() => {
    restoreDeletedBuiltInPresetIdsMock.mockClear();
  });

  it("restores prompt and Pulse built-ins from one confirmation action", async () => {
    const restorePromptBuiltIns = vi.fn(async () => true);

    render(
      <UnifiedPresetsLibraryPanel
        promptPresets={[]}
        selectedPromptPresetId={null}
        onRestorePromptBuiltIns={restorePromptBuiltIns}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /restore built-ins/i }));

    await screen.findByRole("dialog", { name: /restore built-ins/i });
    fireEvent.click(screen.getByRole("button", { name: /^restore$/i }));

    await waitFor(() => {
      expect(restorePromptBuiltIns).toHaveBeenCalledTimes(1);
      expect(restoreDeletedBuiltInPresetIdsMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Built-ins restored.")).toBeInTheDocument();
  });
});
