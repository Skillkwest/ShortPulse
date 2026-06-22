import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATE_PULSE_CUSTOM_AUTHORING_KIND,
  CREATE_PULSE_SCHEMA_VERSION,
  createCreatePulseCustomSavedPreset,
  resolveCreatePulseBuiltInPresetDefinitions,
  resolveCreatePulsePresetById,
} from "../../../components/create/createPulsePresets";
import { useCreatePulsePresetPageRuntime } from "../useCreatePulsePresetPageRuntime";

const useCreatePulseBuiltInCatalogMock = vi.hoisted(() => vi.fn());

vi.mock("../../useCreatePulseBuiltInCatalog", () => ({
  useCreatePulseBuiltInCatalog: (...args: unknown[]) => useCreatePulseBuiltInCatalogMock(...args),
}));

const createParams = (
  overrides: Partial<Parameters<typeof useCreatePulsePresetPageRuntime>[0]> = {}
): Parameters<typeof useCreatePulsePresetPageRuntime>[0] => ({
  selectedTool: "create",
  expertCreateMode: "pulse",
  activeCreatePulsePresetId: "story_builder",
  pulseSessionInstanceId: "pulse-session-1",
  pulseWorkflowSession: null,
  getAgentContext: vi.fn(() => ({})),
  clearPulseRuntime: vi.fn(),
  clearPulsePrompt: vi.fn(),
  handleExpertCreateModeChange: vi.fn(),
  handleActiveCreatePulsePresetIdChange: vi.fn(),
  ...overrides,
});

describe("useCreatePulsePresetPageRuntime", () => {
  beforeEach(() => {
    useCreatePulseBuiltInCatalogMock.mockReturnValue({
      builtInDefinitions: resolveCreatePulseBuiltInPresetDefinitions(),
      loading: false,
      error: null,
      source: "control_plane",
      degraded: false,
      isAuthoritative: true,
      refresh: vi.fn(),
    });
  });

  it("warms the Pulse built-in catalog while Standard Create is mounted", () => {
    renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          expertCreateMode: "standard",
          activeCreatePulsePresetId: null,
          pulseSessionInstanceId: null,
        })
      )
    );

    expect(useCreatePulseBuiltInCatalogMock).toHaveBeenLastCalledWith({
      enabled: true,
    });
  });

  it("recovers a restored built-in Pulse snapshot from the active preset id", () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(createParams({ clearPulseRuntime, clearPulsePrompt }))
    );

    expect(result.current.hasActivePulseSession).toBe(true);
    expect(result.current.activeCreatePulsePresetSnapshot?.presetId).toBe("story_builder");
    expect(clearPulseRuntime).not.toHaveBeenCalled();
    expect(clearPulsePrompt).not.toHaveBeenCalled();
  });

  it("builds Pulse agent context from a restored built-in Pulse snapshot", () => {
    const getAgentContext = vi.fn(() => ({}));
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(createParams({ getAgentContext }))
    );

    const context = result.current.pulseCreateAgentContextResolver({
      lastAssistantMessage: null,
    });

    expect(context.pulse?.presetId).toBe("story_builder");
    expect(context.pulse?.runtimeMode).toBe("workflow_gpt");
    expect(context.pulse?.source).toBe("builtin");
    expect(context.pulse?.instructions).toBe("");
  });

  it("recovers a restored custom Pulse snapshot from saved presets", () => {
    const getAgentContext = vi.fn(() => ({}));
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          activeCreatePulsePresetId: "pulse_custom_video",
          getAgentContext,
          savedPresets: [
            {
              presetId: "pulse_custom_video",
              label: "Custom Video Pulse",
              description: "Guided custom video prompt.",
              systemInstructions: "Guide the user through a custom video prompt workflow.",
              pulseKind: "custom_gpt",
              createdAt: "2026-05-01T00:00:00.000Z",
              schemaVersion: CREATE_PULSE_SCHEMA_VERSION,
            },
          ],
        })
      )
    );

    const context = result.current.pulseCreateAgentContextResolver({
      lastAssistantMessage: null,
    });

    expect(result.current.activeCreatePulsePresetSnapshot?.presetId).toBe("pulse_custom_video");
    expect(context.pulse?.presetId).toBe("pulse_custom_video");
    expect(context.pulse?.runtimeMode).toBeUndefined();
    expect(context.pulse?.artifactTarget).toBeUndefined();
    expect(context.pulse?.source).toBe("custom");
  });

  it("surfaces a pending Pulse snapshot for startup UI before session ownership commits", () => {
    const customPreset = createCreatePulseCustomSavedPreset({
      presetId: "pulse_custom_video",
      label: "Custom Video Pulse",
      description: "Guided custom video prompt.",
      systemInstructions: "Guide the user through a custom video prompt workflow.",
      createdAt: "2026-05-01T00:00:00.000Z",
    });
    const resolvedCustomPreset = resolveCreatePulsePresetById("pulse_custom_video", [customPreset]);
    if (!resolvedCustomPreset) {
      throw new Error("Expected custom Pulse preset to resolve for test.");
    }
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          activeCreatePulsePresetId: null,
          pulseSessionInstanceId: null,
          savedPresets: [customPreset],
        })
      )
    );

    act(() => {
      result.current.setPendingCreatePulsePresetSnapshot(resolvedCustomPreset);
    });

    expect(result.current.hasActivePulseSession).toBe(false);
    expect(result.current.isPulseStartupPending).toBe(true);
    expect(result.current.displayCreatePulsePresetId).toBe("pulse_custom_video");
    expect(result.current.displayCreatePulsePresetSnapshot?.label).toBe("Custom Video Pulse");
  });

  it("keeps a pending Pulse activation current after leaving the Create tool", () => {
    const customPreset = createCreatePulseCustomSavedPreset({
      presetId: "pulse_custom_video",
      label: "Custom Video Pulse",
      description: "Guided custom video prompt.",
      systemInstructions: "Guide the user through a custom video prompt workflow.",
      createdAt: "2026-05-01T00:00:00.000Z",
    });
    const resolvedCustomPreset = resolveCreatePulsePresetById("pulse_custom_video", [customPreset]);
    const handleExpertCreateModeChange = vi.fn();
    const { result, rerender } = renderHook(
      (params: Parameters<typeof useCreatePulsePresetPageRuntime>[0]) =>
        useCreatePulsePresetPageRuntime(params),
      {
        initialProps: createParams({
          activeCreatePulsePresetId: null,
          pulseSessionInstanceId: null,
          savedPresets: [customPreset],
          handleExpertCreateModeChange,
        }),
      }
    );

    let activation: ReturnType<typeof result.current.beginPulseActivation> | undefined;
    if (!resolvedCustomPreset) {
      throw new Error("Expected custom preset to resolve.");
    }
    act(() => {
      activation = result.current.beginPulseActivation(resolvedCustomPreset);
    });

    expect(result.current.isPulseStartupPending).toBe(true);
    expect(activation?.isCurrent()).toBe(true);

    rerender(
      createParams({
        selectedTool: "presets",
        activeCreatePulsePresetId: null,
        pulseSessionInstanceId: null,
        savedPresets: [customPreset],
        handleExpertCreateModeChange,
      })
    );

    expect(handleExpertCreateModeChange).not.toHaveBeenCalled();
    expect(activation?.isCurrent()).toBe(true);
  });

  it("allows a pending Pulse startup to survive leaving Create and a later Pulse restart", () => {
    const customPreset = createCreatePulseCustomSavedPreset({
      presetId: "pulse_custom_video",
      label: "Custom Video Pulse",
      description: "Guided custom video prompt.",
      systemInstructions: "Guide the user through a custom video prompt workflow.",
      createdAt: "2026-05-01T00:00:00.000Z",
    });
    const resolvedCustomPreset = resolveCreatePulsePresetById("pulse_custom_video", [customPreset]);
    if (!resolvedCustomPreset) {
      throw new Error("Expected custom Pulse preset to resolve for test.");
    }
    const handleExpertCreateModeChange = vi.fn();
    const { result, rerender } = renderHook(
      (params: Parameters<typeof useCreatePulsePresetPageRuntime>[0]) =>
        useCreatePulsePresetPageRuntime(params),
      {
        initialProps: createParams({
          activeCreatePulsePresetId: null,
          pulseSessionInstanceId: null,
          savedPresets: [customPreset],
          handleExpertCreateModeChange,
        }),
      }
    );

    let firstActivation: ReturnType<typeof result.current.beginPulseActivation> | undefined;
    act(() => {
      firstActivation = result.current.beginPulseActivation(resolvedCustomPreset);
    });

    rerender(
      createParams({
        selectedTool: "edit",
        activeCreatePulsePresetId: null,
        pulseSessionInstanceId: null,
        savedPresets: [customPreset],
        handleExpertCreateModeChange,
      })
    );

    expect(handleExpertCreateModeChange).not.toHaveBeenCalled();
    expect(firstActivation?.isCurrent()).toBe(true);

    rerender(
      createParams({
        selectedTool: "create",
        activeCreatePulsePresetId: null,
        pulseSessionInstanceId: null,
        savedPresets: [customPreset],
        handleExpertCreateModeChange,
      })
    );

    expect(result.current.isPulseStartupPending).toBe(true);
    expect(result.current.displayCreatePulsePresetId).toBe("pulse_custom_video");

    rerender(
      createParams({
        activeCreatePulsePresetId: null,
        pulseSessionInstanceId: null,
        savedPresets: [customPreset],
        handleExpertCreateModeChange,
      })
    );

    let secondActivation: ReturnType<typeof result.current.beginPulseActivation> | undefined;
    act(() => {
      secondActivation = result.current.beginPulseActivation(resolvedCustomPreset);
    });

    expect(secondActivation?.isCurrent()).toBe(true);
    expect(result.current.isPulseStartupPending).toBe(true);
    expect(result.current.displayCreatePulsePresetId).toBe("pulse_custom_video");
  });

  it("ignores stale activation cleanup after a newer Pulse startup begins", () => {
    const firstPreset = resolveCreatePulsePresetById(
      "story_builder",
      [],
      resolveCreatePulseBuiltInPresetDefinitions()
    );
    const secondPreset = resolveCreatePulsePresetById(
      "multi_shot",
      [],
      resolveCreatePulseBuiltInPresetDefinitions()
    );
    if (!firstPreset || !secondPreset) {
      throw new Error("Expected built-in Pulse presets to resolve for test.");
    }
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          activeCreatePulsePresetId: null,
          pulseSessionInstanceId: null,
        })
      )
    );

    let firstActivation: ReturnType<typeof result.current.beginPulseActivation> | undefined;
    let secondActivation: ReturnType<typeof result.current.beginPulseActivation> | undefined;

    act(() => {
      firstActivation = result.current.beginPulseActivation(firstPreset);
      secondActivation = result.current.beginPulseActivation(secondPreset);
      firstActivation?.restoreSnapshot(firstPreset);
      firstActivation?.clearPending();
    });

    expect(secondActivation?.isCurrent()).toBe(true);
    expect(result.current.displayCreatePulsePresetId).toBe("multi_shot");
    expect(result.current.displayCreatePulsePresetSnapshot?.presetId).toBe("multi_shot");
    expect(result.current.isPulseStartupPending).toBe(true);
  });

  it("clears unknown restored Pulse runtimes that cannot resolve a preset snapshot", async () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          activeCreatePulsePresetId: "unknown_restored_pulse",
          clearPulseRuntime,
          clearPulsePrompt,
        })
      )
    );

    await waitFor(() => {
      expect(clearPulseRuntime).toHaveBeenCalledTimes(1);
      expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
    });
  });

  it("waits for saved Pulse catalog loading before clearing unknown restored Pulse runtimes", async () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    const { rerender } = renderHook(
      (params: Parameters<typeof useCreatePulsePresetPageRuntime>[0]) =>
        useCreatePulsePresetPageRuntime(params),
      {
        initialProps: createParams({
          activeCreatePulsePresetId: "pulse_custom_pending",
          clearPulseRuntime,
          clearPulsePrompt,
          isSavedPresetCatalogReady: false,
        }),
      }
    );

    await Promise.resolve();

    expect(clearPulseRuntime).not.toHaveBeenCalled();
    expect(clearPulsePrompt).not.toHaveBeenCalled();

    rerender(
      createParams({
        activeCreatePulsePresetId: "pulse_custom_pending",
        clearPulseRuntime,
        clearPulsePrompt,
        isSavedPresetCatalogReady: true,
      })
    );

    await waitFor(() => {
      expect(clearPulseRuntime).toHaveBeenCalledTimes(1);
      expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
    });
  });

  it("fails closed on an unresolved built-in Pulse runtime while the catalog is non-authoritative", async () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    useCreatePulseBuiltInCatalogMock.mockReturnValue({
      builtInDefinitions: resolveCreatePulseBuiltInPresetDefinitions(),
      loading: false,
      error: "Unable to load Pulse built-ins.",
      source: "seed",
      degraded: true,
      isAuthoritative: false,
      refresh: vi.fn(),
    });

    renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          activeCreatePulsePresetId: "drifted_builtin_id",
          clearPulseRuntime,
          clearPulsePrompt,
        })
      )
    );

    await waitFor(() => {
      expect(clearPulseRuntime).toHaveBeenCalledTimes(1);
      expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
    });
  });

  it("fails closed on a restored built-in Pulse runtime when only stale local built-ins remain", async () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    useCreatePulseBuiltInCatalogMock.mockReturnValue({
      builtInDefinitions: resolveCreatePulseBuiltInPresetDefinitions(),
      loading: false,
      error: "network down",
      source: "control_plane",
      degraded: false,
      isAuthoritative: false,
      refresh: vi.fn(),
    });

    renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          activeCreatePulsePresetId: "story_builder",
          clearPulseRuntime,
          clearPulsePrompt,
        })
      )
    );

    await waitFor(() => {
      expect(clearPulseRuntime).toHaveBeenCalledTimes(1);
      expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
    });
  });

  it("clears Pulse prompt state when clearing the page Pulse runtime", () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(createParams({ clearPulseRuntime, clearPulsePrompt }))
    );
    clearPulseRuntime.mockClear();
    clearPulsePrompt.mockClear();

    act(() => {
      result.current.clearPulseRuntimeForPage();
    });

    expect(clearPulseRuntime).toHaveBeenCalledTimes(1);
    expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
  });

  it("keeps Pulse prompt state when switching back to Standard mode", () => {
    const clearPulsePrompt = vi.fn();
    const handleExpertCreateModeChange = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({ clearPulsePrompt, handleExpertCreateModeChange })
      )
    );
    clearPulsePrompt.mockClear();

    act(() => {
      result.current.handleExpertCreateModeChangeForPage("standard");
    });

    expect(clearPulsePrompt).not.toHaveBeenCalled();
    expect(handleExpertCreateModeChange).toHaveBeenCalledWith("standard");
  });

  it("keeps Pulse mode active when the user leaves the Create tool", async () => {
    const clearPulsePrompt = vi.fn();
    const handleExpertCreateModeChange = vi.fn();

    renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          selectedTool: "presets",
          clearPulsePrompt,
          handleExpertCreateModeChange,
        })
      )
    );

    await Promise.resolve();

    expect(clearPulsePrompt).not.toHaveBeenCalled();
    expect(handleExpertCreateModeChange).not.toHaveBeenCalled();
  });

  it("clears Pulse prompt state when changing or deactivating the active Pulse", () => {
    const clearPulsePrompt = vi.fn();
    const handleActiveCreatePulsePresetIdChange = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({ clearPulsePrompt, handleActiveCreatePulsePresetIdChange })
      )
    );
    clearPulsePrompt.mockClear();

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage("multi_shot");
    });
    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage(null);
    });

    expect(clearPulsePrompt).toHaveBeenCalledTimes(2);
    expect(handleActiveCreatePulsePresetIdChange).toHaveBeenNthCalledWith(
      1,
      "multi_shot",
      undefined
    );
    expect(handleActiveCreatePulsePresetIdChange).toHaveBeenNthCalledWith(2, null, undefined);
  });

  it("allows late Pulse ownership commits after leaving Create while Pulse mode stays active", () => {
    const clearPulsePrompt = vi.fn();
    const handleActiveCreatePulsePresetIdChange = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({
          selectedTool: "edit",
          clearPulsePrompt,
          handleActiveCreatePulsePresetIdChange,
        })
      )
    );

    let returnValue: string | null | void = undefined;
    act(() => {
      returnValue = result.current.handleActiveCreatePulsePresetIdChangeForPage("multi_shot", {
        forceNewSession: true,
        sessionInstanceIdOverride: "pulse-session-late",
        preserveWorkflowSession: true,
      });
    });

    expect(returnValue).toBeUndefined();
    expect(handleActiveCreatePulsePresetIdChange).toHaveBeenCalledWith(
      "multi_shot",
      expect.objectContaining({
        forceNewSession: true,
        sessionInstanceIdOverride: "pulse-session-late",
        preserveWorkflowSession: true,
      })
    );
  });

  it("keeps a live built-in Pulse session through tool switches while the catalog reloads", async () => {
    const clearPulseRuntime = vi.fn();
    const clearPulsePrompt = vi.fn();
    const liveBuiltInPreset = resolveCreatePulsePresetById(
      "image",
      [],
      resolveCreatePulseBuiltInPresetDefinitions()
    );
    if (!liveBuiltInPreset) {
      throw new Error("Expected built-in Pulse preset to resolve for test.");
    }
    useCreatePulseBuiltInCatalogMock.mockReturnValue({
      builtInDefinitions: resolveCreatePulseBuiltInPresetDefinitions(),
      loading: false,
      error: "catalog temporarily unavailable",
      source: "seed",
      degraded: true,
      isAuthoritative: false,
      refresh: vi.fn(),
    });
    const { result, rerender } = renderHook(
      (params: Parameters<typeof useCreatePulsePresetPageRuntime>[0]) =>
        useCreatePulsePresetPageRuntime(params),
      {
        initialProps: createParams({
          activeCreatePulsePresetId: null,
          pulseSessionInstanceId: null,
          clearPulseRuntime,
          clearPulsePrompt,
        }),
      }
    );

    act(() => {
      result.current.beginPulseActivation(liveBuiltInPreset);
    });
    rerender(
      createParams({
        activeCreatePulsePresetId: "image",
        pulseSessionInstanceId: "pulse-session-image",
        clearPulseRuntime,
        clearPulsePrompt,
      })
    );
    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage("image", {
        forceNewSession: true,
        sessionInstanceIdOverride: "pulse-session-image",
        preserveWorkflowSession: true,
      });
    });
    rerender(
      createParams({
        selectedTool: "presets",
        activeCreatePulsePresetId: "image",
        pulseSessionInstanceId: "pulse-session-image",
        clearPulseRuntime,
        clearPulsePrompt,
      })
    );
    rerender(
      createParams({
        selectedTool: "create",
        activeCreatePulsePresetId: "image",
        pulseSessionInstanceId: "pulse-session-image",
        clearPulseRuntime,
        clearPulsePrompt,
      })
    );
    await Promise.resolve();

    expect(result.current.hasActivePulseSession).toBe(true);
    expect(result.current.activeCreatePulsePresetSnapshot?.presetId).toBe("image");
    expect(
      result.current.pulseCreateAgentContextResolver({ lastAssistantMessage: null }).pulse
    ).toMatchObject({
      presetId: "image",
      runtimeMode: "workflow_gpt",
      source: "builtin",
    });
    expect(clearPulseRuntime).not.toHaveBeenCalled();
    expect(clearPulsePrompt).not.toHaveBeenCalled();
  });

  it("preserves Pulse prompt state when reselecting the current active Pulse", () => {
    const clearPulsePrompt = vi.fn();
    const handleActiveCreatePulsePresetIdChange = vi.fn();
    const { result } = renderHook(() =>
      useCreatePulsePresetPageRuntime(
        createParams({ clearPulsePrompt, handleActiveCreatePulsePresetIdChange })
      )
    );
    clearPulsePrompt.mockClear();

    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage("story_builder");
    });

    expect(clearPulsePrompt).not.toHaveBeenCalled();
    expect(handleActiveCreatePulsePresetIdChange).toHaveBeenCalledWith("story_builder", undefined);
  });

  it("preserves the staged snapshot when committing a started Pulse session", () => {
    const clearPulsePrompt = vi.fn();
    const customPreset = {
      presetId: "pulse_custom_video",
      label: "Custom Video Pulse",
      description: null,
      systemInstructions: "Guide a custom video workflow.",
      pulseKind: CREATE_PULSE_CUSTOM_AUTHORING_KIND,
      runtimeMode: "custom_gpt" as const,
      activationMode: "activate_and_start" as const,
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply" as const,
      memoryPolicy: "session" as const,
      schemaVersion: CREATE_PULSE_SCHEMA_VERSION,
      isCustom: true,
      isBuiltIn: false,
      isEditable: true,
      hasUserOverride: true,
    };
    const { result, rerender } = renderHook(
      (params: Parameters<typeof useCreatePulsePresetPageRuntime>[0]) =>
        useCreatePulsePresetPageRuntime(params),
      {
        initialProps: createParams({ clearPulsePrompt }),
      }
    );

    act(() => {
      result.current.setActiveCreatePulsePresetSnapshot(customPreset);
    });
    clearPulsePrompt.mockClear();
    act(() => {
      result.current.handleActiveCreatePulsePresetIdChangeForPage("pulse_custom_video", {
        forceNewSession: true,
        sessionInstanceIdOverride: "pulse-session-2",
        preserveWorkflowSession: true,
      });
    });
    rerender(
      createParams({
        activeCreatePulsePresetId: "pulse_custom_video",
        pulseSessionInstanceId: "pulse-session-2",
        clearPulsePrompt,
      })
    );

    expect(result.current.activeCreatePulsePresetSnapshot?.presetId).toBe("pulse_custom_video");
    expect(clearPulsePrompt).toHaveBeenCalledTimes(1);
  });
});
