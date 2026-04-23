import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreatePulsePresetPanelPreference } from "../useCreatePulsePresetPanelPreference";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

const buildExpectedPromptEditorPulse = ({
  presetId,
  label,
  systemInstructions,
  createdAt,
}: {
  presetId: string;
  label: string;
  systemInstructions: string;
  createdAt: string | null;
}) => ({
  presetId,
  label,
  description: null,
  systemInstructions,
  runtimeMode: "prompt_editor" as const,
  activationMode: "activate_only" as const,
  starterAssistantMessage: null,
  outputMode: "apply_prompt" as const,
  memoryPolicy: "session" as const,
  workflowStageHints: null,
  createdAt,
});

describe("useCreatePulsePresetPanelPreference", () => {
  beforeEach(() => {
    vi.mocked(ensureSupabaseQueryClient).mockReset();
    vi.mocked(readSupabaseUserId).mockReset();
    window.localStorage.clear();
  });

  it("migrates legacy local custom-slot overrides into saved pulses", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.create_pulse_preset_panel_ids",
      JSON.stringify(["single_shot", "custom_1"])
    );
    window.localStorage.setItem(
      "shortpulse.ai_studio.create_pulse_custom_presets",
      JSON.stringify({
        custom_1: {
          label: "Storyboard",
          prompt: "Build a storyboard-ready pulse sequence.",
        },
      })
    );

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

    const { result } = renderHook(() => useCreatePulsePresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.presetPanelIds).toEqual(["single_shot", "custom_1"]);
    expect(result.current.savedPresets).toEqual([
      buildExpectedPromptEditorPulse({
        presetId: "custom_1",
        label: "Storyboard",
        systemInstructions: "Build a storyboard-ready pulse sequence.",
        createdAt: null,
      }),
    ]);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("normalizes remote pulse preferences without backfilling on mount", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        ai_studio_create_pulse_panel_ids: ["pulse_custom", "image", "missing", "image"],
        ai_studio_saved_pulses: [
          {
            presetId: "pulse_custom",
            label: "UGC Director",
            systemInstructions: "Direct the concept like a native UGC performance ad.",
            createdAt: "2026-04-20T00:00:00.000Z",
          },
          {
            presetId: "image",
            label: "Invalid Built-in Collision",
            systemInstructions: "Should be ignored.",
            createdAt: "2026-04-20T00:00:00.000Z",
          },
        ],
      },
      error: null,
    });

    vi.mocked(readSupabaseUserId).mockResolvedValue("user-1");
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "user_preferences") throw new Error("Unexpected table");
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
          upsert,
        };
      }),
    } as never);

    const { result } = renderHook(() => useCreatePulsePresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    expect(result.current.presetPanelIds).toEqual(["image", "pulse_custom"]);
    expect(result.current.savedPresets).toEqual([
      buildExpectedPromptEditorPulse({
        presetId: "pulse_custom",
        label: "UGC Director",
        systemInstructions: "Direct the concept like a native UGC performance ad.",
        createdAt: "2026-04-20T00:00:00.000Z",
      }),
      buildExpectedPromptEditorPulse({
        presetId: "image",
        label: "Invalid Built-in Collision",
        systemInstructions: "Should be ignored.",
        createdAt: "2026-04-20T00:00:00.000Z",
      }),
    ]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps local Pulse values when the remote preference row is empty", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.create_pulse_preset_panel_ids",
      JSON.stringify(["image", "custom_2"])
    );
    window.localStorage.setItem(
      "shortpulse.ai_studio.create_pulse_custom_presets",
      JSON.stringify({
        custom_2: {
          label: "Product Director",
          prompt: "Treat the product like a premium hero with one decisive benefit frame.",
        },
      })
    );

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(readSupabaseUserId).mockResolvedValue("user-keep-local");
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "user_preferences") throw new Error("Unexpected table");
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
          upsert,
        };
      }),
    } as never);

    const { result } = renderHook(() => useCreatePulsePresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    expect(result.current.presetPanelIds).toEqual(["image", "custom_2"]);
    expect(result.current.savedPresets).toEqual([
      buildExpectedPromptEditorPulse({
        presetId: "custom_2",
        label: "Product Director",
        systemInstructions:
          "Treat the product like a premium hero with one decisive benefit frame.",
        createdAt: null,
      }),
    ]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("persists saved pulses and panel ids together", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(readSupabaseUserId).mockResolvedValue("user-1");
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "user_preferences") throw new Error("Unexpected table");
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
          upsert,
        };
      }),
    } as never);

    const { result } = renderHook(() => useCreatePulsePresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    act(() => {
      result.current.setSavedPresets([
        buildExpectedPromptEditorPulse({
          presetId: "pulse_custom",
          label: "Hook Builder",
          systemInstructions: "Lead with one fast product hook and a clean payoff.",
          createdAt: null,
        }),
      ]);
    });

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          ai_studio_saved_pulses: [
            buildExpectedPromptEditorPulse({
              presetId: "pulse_custom",
              label: "Hook Builder",
              systemInstructions: "Lead with one fast product hook and a clean payoff.",
              createdAt: null,
            }),
          ],
          ai_studio_create_pulse_panel_ids: ["image", "single_shot", "multi_shot", "story_builder"],
        }),
        { onConflict: "user_id" }
      );
    });
  });
});
