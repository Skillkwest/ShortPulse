import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useCreatePulsePresetPanelPreference } from "../useCreatePulsePresetPanelPreference";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";

const CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY =
  "shortpulse.ai_studio.create_pulse_preset_panel_ids";
const CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY = "shortpulse.ai_studio.saved_pulses";
const CREATE_PULSE_HIDDEN_BUILT_INS_STORAGE_KEY = "shortpulse.ai_studio.hidden_builtin_pulses";

const scopedCreatePulsePresetPanelIdsStorageKey = (userId: string) =>
  `${CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY}:${userId}`;
const scopedCreatePulseSavedPresetsStorageKey = (userId: string) =>
  `${CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY}:${userId}`;
const scopedCreatePulseHiddenBuiltInsStorageKey = (userId: string) =>
  `${CREATE_PULSE_HIDDEN_BUILT_INS_STORAGE_KEY}:${userId}`;

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
  pulseKind: "custom_gpt" as const,
  createdAt,
  schemaVersion: 2,
});

describe("useCreatePulsePresetPanelPreference", () => {
  beforeEach(() => {
    vi.mocked(ensureSupabaseQueryClient).mockReset();
    vi.mocked(readSupabaseUserId).mockReset();
    window.localStorage.clear();
  });

  it("does not load custom Pulse preferences while disabled", async () => {
    window.localStorage.setItem(
      CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY,
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
      CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY,
      JSON.stringify(["single_shot", "pulse_custom"])
    );
    window.localStorage.setItem(
      CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY,
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

  it("removes hidden built-in Pulses from the visible panel ids", async () => {
    window.localStorage.setItem(
      CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY,
      JSON.stringify(["image", "multi_shot"])
    );
    window.localStorage.setItem(
      CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY,
      JSON.stringify([
        {
          presetId: "image",
          label: "Video Prompt Magic",
          systemInstructions: "Hide this built-in.",
          createdAt: null,
          schemaVersion: 2,
          isHidden: true,
        },
      ])
    );

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

    const { result } = renderHook(() => useCreatePulsePresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.presetPanelIds).toEqual(["multi_shot"]);
    expect(result.current.savedPresets).toEqual([
      expect.objectContaining({
        presetId: "image",
        label: "Video Prompt Magic",
        isHidden: true,
      }),
    ]);
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

  it("does not hydrate signed-in Pulse preferences from global localStorage fallback", async () => {
    window.localStorage.setItem(
      CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY,
      JSON.stringify(["image", "pulse_product"])
    );
    window.localStorage.setItem(
      CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY,
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

    expect(result.current.presetPanelIds).toEqual(["image", "multi_shot", "story_builder"]);
    expect(result.current.savedPresets).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps signed-in Pulse values in user-scoped localStorage when the remote preference row is empty", async () => {
    window.localStorage.setItem(
      scopedCreatePulsePresetPanelIdsStorageKey("user-keep-local"),
      JSON.stringify(["image", "pulse_product"])
    );
    window.localStorage.setItem(
      scopedCreatePulseSavedPresetsStorageKey("user-keep-local"),
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

  it("preserves local hidden built-ins when signed-in remote Pulse preferences load", async () => {
    window.localStorage.setItem(
      scopedCreatePulseHiddenBuiltInsStorageKey("user-hidden-local"),
      JSON.stringify(["image"])
    );

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        ai_studio_create_pulse_panel_ids: ["image", "multi_shot"],
        ai_studio_saved_pulses: [
          {
            presetId: "pulse_custom",
            label: "Hook Builder",
            systemInstructions: "Lead with one fast product hook and a clean payoff.",
            createdAt: null,
          },
        ],
      },
      error: null,
    });

    vi.mocked(readSupabaseUserId).mockResolvedValue("user-hidden-local");
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

    expect(result.current.presetPanelIds).toEqual(["multi_shot"]);
    expect(result.current.savedPresets).toEqual([
      buildExpectedSavedPulse({
        presetId: "pulse_custom",
        label: "Hook Builder",
        systemInstructions: "Lead with one fast product hook and a clean payoff.",
        createdAt: null,
      }),
      expect.objectContaining({
        presetId: "image",
        label: "Video Prompt Magic",
        isHidden: true,
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

  it("remaps legacy default built-in panel ids to the current control-plane ids", async () => {
    window.localStorage.setItem(
      CREATE_PULSE_PRESET_PANEL_IDS_STORAGE_KEY,
      JSON.stringify(["image", "multi_shot", "story_builder"])
    );
    const builtInDefinitions = [
      {
        presetId: "video_prompt_magic_v2",
        label: "Video Prompt Magic",
        description: "Updated built-in.",
        systemInstructions: "Updated instructions.",
        pulseKind: "guided_workflow" as const,
        runtimeMode: "workflow_gpt" as const,
        activationMode: "activate_and_start" as const,
        outputMode: "chat_reply" as const,
        memoryPolicy: "session" as const,
        starterAssistantMessage: null,
        workflowStageHints: null,
        artifactTarget: "video_prompt" as const,
        schemaVersion: 2,
      },
      {
        presetId: "multi_sequence_v2",
        label: "Multi Sequence Video Prompt",
        description: "Updated built-in.",
        systemInstructions: "Updated instructions.",
        pulseKind: "guided_workflow" as const,
        runtimeMode: "workflow_gpt" as const,
        activationMode: "activate_and_start" as const,
        outputMode: "chat_reply" as const,
        memoryPolicy: "session" as const,
        starterAssistantMessage: null,
        workflowStageHints: null,
        artifactTarget: "video_prompt" as const,
        schemaVersion: 2,
      },
      {
        presetId: "story_builder_v2",
        label: "DFY Story Builder",
        description: "Updated built-in.",
        systemInstructions: "Updated instructions.",
        pulseKind: "guided_workflow" as const,
        runtimeMode: "workflow_gpt" as const,
        activationMode: "activate_and_start" as const,
        outputMode: "chat_reply" as const,
        memoryPolicy: "session" as const,
        starterAssistantMessage: null,
        workflowStageHints: null,
        artifactTarget: "image_prompt" as const,
        schemaVersion: 2,
      },
    ];

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

    const { result } = renderHook(() =>
      useCreatePulsePresetPanelPreference({
        builtInDefinitions,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.presetPanelIds).toEqual([
      "video_prompt_magic_v2",
      "multi_sequence_v2",
      "story_builder_v2",
    ]);
  });

  it("persists hidden built-ins when the live control-plane ids differ from the seeded ids", async () => {
    const builtInDefinitions = [
      {
        presetId: "video_prompt_magic_v2",
        label: "Video Prompt Magic",
        description: "Updated built-in.",
        systemInstructions: "Updated instructions.",
        pulseKind: "guided_workflow" as const,
        runtimeMode: "workflow_gpt" as const,
        activationMode: "activate_and_start" as const,
        outputMode: "chat_reply" as const,
        memoryPolicy: "session" as const,
        starterAssistantMessage: null,
        workflowStageHints: null,
        artifactTarget: "video_prompt" as const,
        schemaVersion: 2,
      },
      {
        presetId: "multi_sequence_v2",
        label: "Multi Sequence Video Prompt",
        description: "Updated built-in.",
        systemInstructions: "Updated instructions.",
        pulseKind: "guided_workflow" as const,
        runtimeMode: "workflow_gpt" as const,
        activationMode: "activate_and_start" as const,
        outputMode: "chat_reply" as const,
        memoryPolicy: "session" as const,
        starterAssistantMessage: null,
        workflowStageHints: null,
        artifactTarget: "video_prompt" as const,
        schemaVersion: 2,
      },
      {
        presetId: "story_builder_v2",
        label: "DFY Story Builder",
        description: "Updated built-in.",
        systemInstructions: "Updated instructions.",
        pulseKind: "guided_workflow" as const,
        runtimeMode: "workflow_gpt" as const,
        activationMode: "activate_and_start" as const,
        outputMode: "chat_reply" as const,
        memoryPolicy: "session" as const,
        starterAssistantMessage: null,
        workflowStageHints: null,
        artifactTarget: "image_prompt" as const,
        schemaVersion: 2,
      },
    ];

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

    const { result } = renderHook(() =>
      useCreatePulsePresetPanelPreference({
        builtInDefinitions,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.setSavedPresets([
        {
          presetId: "video_prompt_magic_v2",
          label: "Video Prompt Magic",
          description: "Updated built-in.",
          systemInstructions: "Updated instructions.",
          createdAt: null,
          schemaVersion: 2,
          isHidden: true,
        },
      ]);
    });

    expect(
      JSON.parse(window.localStorage.getItem(CREATE_PULSE_SAVED_PRESETS_STORAGE_KEY) ?? "[]")
    ).toEqual([]);
    expect(
      JSON.parse(window.localStorage.getItem(CREATE_PULSE_HIDDEN_BUILT_INS_STORAGE_KEY) ?? "[]")
    ).toEqual(["video_prompt_magic_v2"]);
  });
});
