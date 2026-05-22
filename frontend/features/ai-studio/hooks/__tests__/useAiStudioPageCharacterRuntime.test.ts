import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioPageCharacterRuntime } from "../useAiStudioPageCharacterRuntime";

vi.mock("../useAiStudioCharacterModeLifecycle", () => ({
  useAiStudioCharacterModeLifecycle: () => ({
    characterOptions: [],
    selectedCharacterId: "",
    setSelectedCharacterId: vi.fn(),
    isCharacterOptionsLoading: false,
    refreshCharacterOptions: vi.fn(),
    loadCharacterSnapshot: vi.fn(),
    resolveCharacterOptionById: vi.fn(() => null),
  }),
}));

vi.mock("../useAiStudioCreateCharacterLookState", () => ({
  useAiStudioCreateCharacterLookState: () => ({
    handleCreateCharacterSelection: vi.fn(),
    loadCreateCharacterLookOptions: vi.fn(),
    selectedCreateCharacterLookLabel: null,
  }),
}));

vi.mock("../useAiStudioCharacterModeController", () => ({
  useAiStudioCharacterModeController: () => ({
    refreshCharacterModeInjectionBundleForSubmission: vi.fn(),
    resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
    trackCharacterModeFallback: vi.fn(),
  }),
}));

describe("useAiStudioPageCharacterRuntime", () => {
  it("treats Create Character Mode as disabled while Pulse mode is active", () => {
    const { result } = renderHook(() =>
      useAiStudioPageCharacterRuntime({
        createCharacterModeInjectionBundle: null,
        createSelectedCharacterLookId: "",
        editCharacterModeInjectionBundle: null,
        editSelectedCharacterId: "",
        expertCreateMode: "pulse",
        isCreateCharacterBundleLoading: false,
        isCreateCharacterModeEnabled: true,
        isEditCharacterBundleLoading: false,
        isEditCharacterModeEnabled: false,
        projectId: null,
        projectRouteRequested: false,
        selectedTool: "create",
        setCharacterCreateRequestKey: vi.fn(),
        setCreateCharacterModeInjectionBundle: vi.fn(),
        setCreateSelectedCharacterLookId: vi.fn(),
        setEditCharacterModeInjectionBundle: vi.fn(),
        setElementCreateRequestKey: vi.fn(),
        setIsCreateCharacterBundleLoading: vi.fn(),
        setIsEditCharacterBundleLoading: vi.fn(),
        setSelectedToolWithEditIntentReset: vi.fn(),
        setUiError: vi.fn(),
        trackCharacterModeEvent: vi.fn(),
      })
    );

    expect(result.current.resolveIsCharacterModeEnabledForTool("create")).toBe(false);
    expect(result.current.resolveIsCharacterModeEnabledForTool("text")).toBe(false);
  });

  it("preserves Create Character Mode behavior in Standard mode", () => {
    const { result } = renderHook(() =>
      useAiStudioPageCharacterRuntime({
        createCharacterModeInjectionBundle: null,
        createSelectedCharacterLookId: "",
        editCharacterModeInjectionBundle: null,
        editSelectedCharacterId: "",
        expertCreateMode: "standard",
        isCreateCharacterBundleLoading: false,
        isCreateCharacterModeEnabled: true,
        isEditCharacterBundleLoading: false,
        isEditCharacterModeEnabled: false,
        projectId: null,
        projectRouteRequested: false,
        selectedTool: "create",
        setCharacterCreateRequestKey: vi.fn(),
        setCreateCharacterModeInjectionBundle: vi.fn(),
        setCreateSelectedCharacterLookId: vi.fn(),
        setEditCharacterModeInjectionBundle: vi.fn(),
        setElementCreateRequestKey: vi.fn(),
        setIsCreateCharacterBundleLoading: vi.fn(),
        setIsEditCharacterBundleLoading: vi.fn(),
        setSelectedToolWithEditIntentReset: vi.fn(),
        setUiError: vi.fn(),
        trackCharacterModeEvent: vi.fn(),
      })
    );

    expect(result.current.resolveIsCharacterModeEnabledForTool("create")).toBe(true);
    expect(result.current.resolveIsCharacterModeEnabledForTool("text")).toBe(true);
  });

  it("opens Characters for both create and library entry actions", () => {
    const setSelectedToolWithEditIntentReset = vi.fn();
    const setCharacterCreateRequestKey = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioPageCharacterRuntime({
        createCharacterModeInjectionBundle: null,
        createSelectedCharacterLookId: "",
        editCharacterModeInjectionBundle: null,
        editSelectedCharacterId: "",
        expertCreateMode: "standard",
        isCreateCharacterBundleLoading: false,
        isCreateCharacterModeEnabled: true,
        isEditCharacterBundleLoading: false,
        isEditCharacterModeEnabled: false,
        projectId: null,
        projectRouteRequested: false,
        selectedTool: "create",
        setCharacterCreateRequestKey,
        setCreateCharacterModeInjectionBundle: vi.fn(),
        setCreateSelectedCharacterLookId: vi.fn(),
        setEditCharacterModeInjectionBundle: vi.fn(),
        setElementCreateRequestKey: vi.fn(),
        setIsCreateCharacterBundleLoading: vi.fn(),
        setIsEditCharacterBundleLoading: vi.fn(),
        setSelectedToolWithEditIntentReset,
        setUiError: vi.fn(),
        trackCharacterModeEvent: vi.fn(),
      })
    );

    act(() => {
      result.current.handleOpenCharacterCreate();
    });
    act(() => {
      result.current.handleOpenCharacterLibrary();
    });

    expect(setSelectedToolWithEditIntentReset).toHaveBeenNthCalledWith(1, "character");
    expect(setSelectedToolWithEditIntentReset).toHaveBeenNthCalledWith(2, "character");
    expect(setCharacterCreateRequestKey).toHaveBeenCalledTimes(1);
    expect(setCharacterCreateRequestKey.mock.calls[0]?.[0](4)).toBe(5);
  });
});
