import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresetsPanelLoader } from "../PresetsPanelLoader";
import { reportAppError } from "../../../../lib/appErrorReporter";

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn().mockResolvedValue(undefined),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const buildPanelModule = (label = "Loaded Presets Panel") => ({
  UnifiedPresetsLibraryPanel: () => <div>{label}</div>,
});

describe("PresetsPanelLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the presets panel after the lazy module resolves", async () => {
    const deferred = createDeferred<ReturnType<typeof buildPanelModule>>();

    render(
      <PresetsPanelLoader
        promptPresets={[]}
        selectedPromptPresetId={null}
        loadPanel={() => deferred.promise}
      />
    );

    expect(screen.getByText("Loading panel...")).toBeInTheDocument();

    deferred.resolve(buildPanelModule());
    await waitFor(() => {
      expect(screen.getByText("Loaded Presets Panel")).toBeInTheDocument();
    });
  });

  it("shows retry UI and reloads after a lazy-load failure", async () => {
    const loadPanel = vi
      .fn()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValueOnce(buildPanelModule("Recovered Presets Panel"));

    render(
      <PresetsPanelLoader promptPresets={[]} selectedPromptPresetId={null} loadPanel={loadPanel} />
    );

    expect(await screen.findByText("We couldn't open Presets right now.")).toBeInTheDocument();
    expect(reportAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.ai_studio.presets_panel_load_failure",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Recovered Presets Panel")).toBeInTheDocument();
    expect(loadPanel).toHaveBeenCalledTimes(2);
  });

  it("shows timeout recovery UI when the lazy module stalls", async () => {
    vi.useFakeTimers();

    render(
      <PresetsPanelLoader
        promptPresets={[]}
        selectedPromptPresetId={null}
        timeoutMs={25}
        loadPanel={() => new Promise(() => undefined)}
      />
    );

    expect(screen.getByText("Loading panel...")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });

    expect(screen.getByText("Presets is taking longer than expected to open.")).toBeInTheDocument();
    expect(reportAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.ai_studio.presets_panel_load_timeout",
      })
    );
  });
});
