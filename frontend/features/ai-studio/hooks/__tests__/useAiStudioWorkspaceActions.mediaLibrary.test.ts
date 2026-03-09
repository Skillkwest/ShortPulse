import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { StudioMode } from "../../types";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  selectedTool: "create",
  setSelectedTool: vi.fn(),
  setMode: asDispatch<StudioMode>(vi.fn()),
  setShowCreateTools: asDispatch<boolean>(vi.fn()),
  setVideoReferenceText: vi.fn(),
  setEditReferenceText: vi.fn(),
  setSharedPrompt: vi.fn(),
  setPromptOrigin: asDispatch<PromptOrigin>(vi.fn()),
  openModelModal: vi.fn(),
  closeModelModal: vi.fn(),
  setModel: vi.fn(),
  addCharacterReferences: vi.fn(),
  addOutputsFromFiles: vi.fn(),
  setActiveOutputId: asDispatch<string | null>(vi.fn()),
  ...overrides,
});

describe("useAiStudioWorkspaceActions media-library routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("opens the media-library tool panel by default", async () => {
    vi.resetModules();
    const { useAiStudioWorkspaceActions } = await import("../useAiStudioWorkspaceActions");

    const setSelectedTool = vi.fn();
    const setShowCreateTools = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioWorkspaceActions(
        createParams({
          setSelectedTool,
          setShowCreateTools: asDispatch<boolean>(setShowCreateTools),
        }) as Parameters<typeof useAiStudioWorkspaceActions>[0]
      )
    );

    act(() => {
      result.current.handleOpenMediaLibrary();
    });

    expect(result.current.isMediaLibraryPanelEnabled).toBe(true);
    expect(result.current.isMediaLibraryOpen).toBe(false);
    expect(setSelectedTool).toHaveBeenCalledWith("media-library");
    expect(setShowCreateTools).not.toHaveBeenCalled();
  });

  it("keeps modal fallback behavior when panel flag is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED", "false");
    vi.resetModules();
    const { useAiStudioWorkspaceActions } = await import("../useAiStudioWorkspaceActions");

    const setSelectedTool = vi.fn();
    const setShowCreateTools = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioWorkspaceActions(
        createParams({
          setSelectedTool,
          setShowCreateTools: asDispatch<boolean>(setShowCreateTools),
        }) as Parameters<typeof useAiStudioWorkspaceActions>[0]
      )
    );

    act(() => {
      result.current.handleOpenMediaLibrary();
    });

    expect(result.current.isMediaLibraryPanelEnabled).toBe(false);
    expect(result.current.isMediaLibraryOpen).toBe(true);
    expect(setShowCreateTools).toHaveBeenCalledWith(false);
    expect(setSelectedTool).not.toHaveBeenCalledWith("media-library");
  });
});
