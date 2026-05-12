import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaPromptModalCrud } from "../useMediaPromptModalCrud";
import { ensureSupabaseQueryClient } from "../../../../lib/supabaseClient";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: vi.fn(),
}));

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);

type PromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: "text" | "image" | "video";
  source: "manual" | "ai_studio" | "agent";
  created_at: string;
  updated_at: string;
};

const makePrompt = (overrides: Partial<PromptRow> = {}): PromptRow => ({
  id: "prompt-1",
  title: "Prompt One",
  prompt_text: "old text",
  mode: "text",
  source: "manual",
  created_at: "2026-02-14T00:00:00.000Z",
  updated_at: "2026-02-14T00:00:00.000Z",
  ...overrides,
});

describe("useMediaPromptModalCrud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: () => ({
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
        update: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    } as never);
  });

  it("opens and closes the prompt modal while resetting edit state", () => {
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [prompts, setPrompts] = useState<PromptRow[]>([makePrompt()]);
      const [selectedIds, setSelectedIds] = useState<string[]>([]);
      const [pageError, setPageError] = useState<string | null>(null);
      const promptModal = useMediaPromptModalCrud<PromptRow>({
        getErrorMessage,
        logMediaEvent,
        setPageError,
        setPrompts,
        setSelectedIds,
      });
      return { pageError, promptModal, prompts, selectedIds };
    });

    act(() => {
      result.current.promptModal.openPromptModal(makePrompt());
      result.current.promptModal.handlePromptEditChange("new text");
      result.current.promptModal.closePromptModal();
    });

    expect(result.current.promptModal.focusedPrompt).toBeNull();
    expect(result.current.promptModal.promptEditValue).toBe("");
    expect(result.current.promptModal.promptModalError).toBeNull();
  });

  it("saves prompt edits and updates prompt state", async () => {
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [prompts, setPrompts] = useState<PromptRow[]>([makePrompt()]);
      const [selectedIds, setSelectedIds] = useState<string[]>([]);
      const [pageError, setPageError] = useState<string | null>(null);
      const promptModal = useMediaPromptModalCrud<PromptRow>({
        getErrorMessage,
        logMediaEvent,
        setPageError,
        setPrompts,
        setSelectedIds,
      });
      return { pageError, promptModal, prompts, selectedIds };
    });

    act(() => {
      result.current.promptModal.openPromptModal(makePrompt());
      result.current.promptModal.handlePromptEditChange("refined prompt text");
    });

    await act(async () => {
      await result.current.promptModal.savePromptEdits();
    });

    expect(result.current.prompts[0]?.prompt_text).toBe("refined prompt text");
    expect(result.current.promptModal.focusedPrompt?.prompt_text).toBe("refined prompt text");
    expect(logMediaEvent).toHaveBeenCalledWith("edit", "media_prompt", "prompt-1", {
      updated_fields: ["prompt_text"],
    });
  });

  it("deletes a prompt and clears selected state", async () => {
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [prompts, setPrompts] = useState<PromptRow[]>([
        makePrompt({ id: "prompt-1" }),
        makePrompt({ id: "prompt-2", title: "Prompt Two" }),
      ]);
      const [selectedIds, setSelectedIds] = useState<string[]>(["prompt-1", "prompt-2"]);
      const [pageError, setPageError] = useState<string | null>(null);
      const promptModal = useMediaPromptModalCrud<PromptRow>({
        getErrorMessage,
        logMediaEvent,
        setPageError,
        setPrompts,
        setSelectedIds,
      });
      return { pageError, promptModal, prompts, selectedIds };
    });

    act(() => {
      result.current.promptModal.openPromptModal(makePrompt({ id: "prompt-1" }));
    });

    await act(async () => {
      await result.current.promptModal.deletePrompt(makePrompt({ id: "prompt-1" }), {
        fromPromptModal: true,
      });
    });

    expect(result.current.prompts.map((prompt) => prompt.id)).toEqual(["prompt-2"]);
    expect(result.current.selectedIds).toEqual(["prompt-2"]);
    expect(result.current.promptModal.focusedPrompt).toBeNull();
    expect(logMediaEvent).toHaveBeenCalledWith("delete", "media_prompt", "prompt-1");
  });

  it("keeps local prompt state stable when deleting a prompt not present in local state", async () => {
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);
    const seededPrompts = [makePrompt({ id: "prompt-1" })];
    const seededSelectedIds = ["prompt-1"];

    const { result } = renderHook(() => {
      const [prompts, setPrompts] = useState<PromptRow[]>(seededPrompts);
      const [selectedIds, setSelectedIds] = useState<string[]>(seededSelectedIds);
      const [pageError, setPageError] = useState<string | null>(null);
      const promptModal = useMediaPromptModalCrud<PromptRow>({
        getErrorMessage,
        logMediaEvent,
        setPageError,
        setPrompts,
        setSelectedIds,
      });
      return { pageError, promptModal, prompts, selectedIds };
    });

    await act(async () => {
      await result.current.promptModal.deletePrompt(makePrompt({ id: "missing-prompt" }), {
        fromPromptModal: true,
      });
    });

    expect(result.current.prompts).toBe(seededPrompts);
    expect(result.current.selectedIds).toBe(seededSelectedIds);
  });

  it("keeps local prompt list stable when saving edits for a prompt absent from local state", async () => {
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);
    const seededPrompts = [makePrompt({ id: "prompt-1" })];

    const { result } = renderHook(() => {
      const [prompts, setPrompts] = useState<PromptRow[]>(seededPrompts);
      const [selectedIds, setSelectedIds] = useState<string[]>([]);
      const [pageError, setPageError] = useState<string | null>(null);
      const promptModal = useMediaPromptModalCrud<PromptRow>({
        getErrorMessage,
        logMediaEvent,
        setPageError,
        setPrompts,
        setSelectedIds,
      });
      return { pageError, promptModal, prompts, selectedIds };
    });

    act(() => {
      result.current.promptModal.openPromptModal(makePrompt({ id: "missing-prompt" }));
      result.current.promptModal.handlePromptEditChange("refined prompt text");
    });

    await act(async () => {
      await result.current.promptModal.savePromptEdits();
    });

    expect(result.current.prompts).toBe(seededPrompts);
    expect(logMediaEvent).toHaveBeenCalledWith("edit", "media_prompt", "missing-prompt", {
      updated_fields: ["prompt_text"],
    });
  });
});
