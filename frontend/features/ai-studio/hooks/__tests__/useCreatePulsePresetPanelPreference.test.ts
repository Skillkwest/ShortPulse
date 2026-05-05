import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useCreatePulsePresetPanelPreference } from "../useCreatePulsePresetPanelPreference";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

const buildExpectedSavedPulse = ({
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
  runtimeMode: "workflow_gpt" as const,
  activationMode: "activate_and_start" as const,
  starterAssistantMessage: null,
  outputMode: "chat_reply" as const,
  artifactTarget: "text_artifact" as const,
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

  it("does not load custom Pulse preferences while disabled", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.saved_pulses",
      JSON.stringify([
        {
          presetId: "pulse_custom",
          label: "Private Pulse",
          systemInstructions: "Custom hidden instructions.",
          createdAt: null,
        },
      ])
    );

    const { result } = renderHook(() => useCreatePulsePresetPanelPreference({ enabled: false }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.savedPresets).toEqual([]);
    expect(result.current.syncState).toBe("ready");
    expect(ensureSupabaseQueryClient).not.toHaveBeenCalled();
    expect(readSupabaseUserId).not.toHaveBeenCalled();
  });

  it("keeps Pulse preference loading out of the page root and inside Pulse surfaces", () => {
    const pageSource = readFileSync(`${process.cwd()}/pages/ai-studio.tsx`, "utf8");
    const pulsePageRuntimeSource = readFileSync(
      `${process.cwd()}/features/ai-studio/hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime.ts`,
      "utf8"
    );
    const pulseProviderSource = readFileSync(
      `${process.cwd()}/features/ai-studio/components/create/CreatePulsePreferenceProvider.tsx`,
      "utf8"
    );

    expect(pageSource).not.toContain("useCreatePulsePresetPanelPreference");
    expect(pageSource).not.toContain("CreatePulsePreferenceRuntime");
    expect(pageSource).not.toContain("<CreatePulsePreferenceProvider");
    expect(pulsePageRuntimeSource).toContain("useCreatePulsePresetPanelPreference");
    expect(pulsePageRuntimeSource).toContain("enabled: shouldLoadPulsePreferences");
    expect(pulseProviderSource).toContain("useCreatePulsePresetPanelPreference");
  });

  it("drops retired local pulse ids without legacy custom-slot migration", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.create_pulse_preset_panel_ids",
      JSON.stringify(["single_shot", "pulse_custom"])
    );
    window.localStorage.setItem(
      "shortpulse.ai_studio.saved_pulses",
      JSON.stringify([
        {
          presetId: "pulse_custom",
          label: "Storyboard",
          systemInstructions: "Build a storyboard-ready pulse sequence.",
          createdAt: null,
        },
        {
          presetId: "ad_hook",
          label: "Ad Hook",
          systemInstructions: "Retired.",
          createdAt: null,
        },
      ])
    );

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

    const { result } = renderHook(() => useCreatePulsePresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.presetPanelIds).toEqual(["pulse_custom"]);
    expect(result.current.savedPresets).toEqual([
      buildExpectedSavedPulse({
        presetId: "pulse_custom",
        label: "Storyboard",
        systemInstructions: "Build a storyboard-ready pulse sequence.",
        createdAt: null,
      }),
    ]);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("normalizes remote pulse preferences and drops built-in collisions without backfilling on mount", async () => {
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
      buildExpectedSavedPulse({
        presetId: "pulse_custom",
        label: "UGC Director",
        systemInstructions: "Direct the concept like a native UGC performance ad.",
        createdAt: "2026-04-20T00:00:00.000Z",
      }),
    ]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps local Pulse values when the remote preference row is empty", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.create_pulse_preset_panel_ids",
      JSON.stringify(["image", "pulse_product"])
    );
    window.localStorage.setItem(
      "shortpulse.ai_studio.saved_pulses",
      JSON.stringify([
        {
          presetId: "pulse_product",
          label: "Product Director",
          systemInstructions:
            "Treat the product like a premium hero with one decisive benefit frame.",
          createdAt: null,
        },
      ])
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

    expect(result.current.presetPanelIds).toEqual(["image", "pulse_product"]);
    expect(result.current.savedPresets).toEqual([
      buildExpectedSavedPulse({
        presetId: "pulse_product",
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

    await act(async () => {
      await result.current.setSavedPresets([
        buildExpectedSavedPulse({
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
            buildExpectedSavedPulse({
              presetId: "pulse_custom",
              label: "Hook Builder",
              systemInstructions: "Lead with one fast product hook and a clean payoff.",
              createdAt: null,
            }),
          ],
          ai_studio_create_pulse_panel_ids: ["image", "multi_shot", "story_builder"],
        }),
        { onConflict: "user_id" }
      );
    });
  });
});
