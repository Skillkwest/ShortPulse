import { act, fireEvent, render, screen } from "@testing-library/react";
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
});
