import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS,
  EDIT_PRESET_PANEL_MAX,
  type ExpertEditPresetId,
} from "../../components/edit/expertEditPresets";
import { useExpertEditPresetPanelPreference } from "../useExpertEditPresetPanelPreference";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

describe("useExpertEditPresetPanelPreference", () => {
  beforeEach(() => {
    vi.mocked(ensureSupabaseQueryClient).mockReset();
    vi.mocked(readSupabaseUserId).mockReset();
    window.localStorage.clear();
  });

  it("keeps defaults without reading auth or preferences when disabled", async () => {
    const { result } = renderHook(() => useExpertEditPresetPanelPreference({ enabled: false }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    expect(readSupabaseUserId).not.toHaveBeenCalled();
    expect(ensureSupabaseQueryClient).not.toHaveBeenCalled();
    expect(result.current.presetPanelIds).toEqual(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS);
    expect(result.current.customPresetOverrides).toEqual({});

    act(() => {
      result.current.setPresetPanelIds(["selfie"]);
    });

    expect(
      window.localStorage.getItem("shortpulse.ai_studio.expert_edit_preset_panel_ids")
    ).toBeNull();
  });

  it("loads local preference and becomes ready when no user session exists", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.expert_edit_preset_panel_ids",
      JSON.stringify(["low_angle", "custom_8"])
    );
    window.localStorage.setItem(
      "shortpulse.ai_studio.expert_edit_custom_presets",
      JSON.stringify({
        custom_8: { label: "My Custom Eight", prompt: "Use custom eight prompt." },
      })
    );

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

    const { result } = renderHook(() => useExpertEditPresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.presetPanelIds).toEqual(["low_angle", "custom_8"]);
    expect(result.current.customPresetOverrides).toEqual({
      custom_8: { label: "My Custom Eight", prompt: "Use custom eight prompt." },
    });
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("falls back to seeded defaults when stored/remote values are missing without backfilling on mount", async () => {
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

    const { result } = renderHook(() => useExpertEditPresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    expect(result.current.presetPanelIds).toEqual(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS);
    expect(result.current.customPresetOverrides).toEqual({});
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not hydrate signed-in Expert Edit preferences from global localStorage fallback", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.expert_edit_preset_panel_ids",
      JSON.stringify(["low_angle", "custom_8"])
    );
    window.localStorage.setItem(
      "shortpulse.ai_studio.expert_edit_custom_presets",
      JSON.stringify({
        custom_8: { label: "My Custom Eight", prompt: "Use custom eight prompt." },
      })
    );

    const userIdDeferred = createDeferred<string | null>();
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(readSupabaseUserId).mockReturnValue(userIdDeferred.promise);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "user_preferences") throw new Error("Unexpected table");
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        };
      }),
    } as never);

    const { result } = renderHook(() => useExpertEditPresetPanelPreference());

    await waitFor(() => {
      expect(result.current.presetPanelIds).toEqual(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS);
      expect(result.current.customPresetOverrides).toEqual({});
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      userIdDeferred.resolve("user-3");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    expect(result.current.presetPanelIds).toEqual(EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS);
    expect(result.current.customPresetOverrides).toEqual({});
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("preserves an explicitly empty preset panel allocation", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.expert_edit_preset_panel_ids",
      JSON.stringify([])
    );

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue({ from: vi.fn() } as never);

    const { result } = renderHook(() => useExpertEditPresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.presetPanelIds).toEqual([]);

    act(() => {
      result.current.setPresetPanelIds([]);
    });

    const storedRaw = window.localStorage.getItem(
      "shortpulse.ai_studio.expert_edit_preset_panel_ids"
    );
    expect(storedRaw).toBeTruthy();
    expect(JSON.parse(storedRaw ?? "null")).toEqual([]);
  });

  it("uses legacy label fallback from remote without backfilling new id columns on mount", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        expert_edit_preset_panel_ids: null,
        expert_edit_custom_presets: null,
        expert_edit_preset_panel_labels: ["Selfie", "Custom 18"],
      },
      error: null,
    });

    vi.mocked(readSupabaseUserId).mockResolvedValue("user-2");
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

    const { result } = renderHook(() => useExpertEditPresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.presetPanelIds).toEqual(["selfie"]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("normalizes oversized/invalid values and ignores stale failed writes", async () => {
    const firstWrite = createDeferred<{ error: null | { message: string } }>();
    const secondWrite = createDeferred<{ error: null | { message: string } }>();
    let upsertCall = 0;

    const upsert = vi.fn(() => {
      const nextCall = upsertCall;
      upsertCall += 1;
      if (nextCall === 0) return firstWrite.promise;
      return secondWrite.promise;
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        expert_edit_preset_panel_ids: ["unknown", "custom_18", "selfie", "selfie", 99] as unknown,
        expert_edit_custom_presets: {
          custom_18: { label: "Custom 18 Name", prompt: "Custom 18 Prompt" },
          custom_3: { label: " ", prompt: " " },
          custom_1: { label: "Custom One", prompt: "Custom One Prompt" },
        },
        expert_edit_preset_panel_labels: ["Selfie"],
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

    const { result } = renderHook(() => useExpertEditPresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    expect(result.current.presetPanelIds).toEqual(["selfie", "custom_18"]);
    expect(result.current.customPresetOverrides).toEqual({
      custom_18: { label: "Custom 18 Name", prompt: "Custom 18 Prompt" },
      custom_1: { label: "Custom One", prompt: "Custom One Prompt" },
    });

    act(() => {
      result.current.setPresetPanelIds([
        "custom_5",
        ...Array.from({ length: 20 }, (_, index) => `custom_${index + 1}`),
      ] as unknown as ExpertEditPresetId[]);
      result.current.setPresetPanelIds(["selfie", "zoom_out", "custom_18"]);
      result.current.setCustomPresetOverrides({
        custom_18: { label: "Custom Eighteen", prompt: "Prompt Eighteen" },
      });
    });

    await act(async () => {
      secondWrite.resolve({ error: null });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.syncState).toBe("ready");
      expect(result.current.presetPanelIds).toEqual(["selfie", "zoom_out", "custom_18"]);
      expect(result.current.customPresetOverrides).toEqual({
        custom_18: { label: "Custom Eighteen", prompt: "Prompt Eighteen" },
      });
    });

    await act(async () => {
      firstWrite.reject(new Error("stale failure"));
      await Promise.resolve();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.presetPanelIds).toEqual(["selfie", "zoom_out", "custom_18"]);

    const storedRaw = window.localStorage.getItem(
      "shortpulse.ai_studio.expert_edit_preset_panel_ids:user-1"
    );
    expect(storedRaw).toBeTruthy();
    const storedParsed = JSON.parse(storedRaw ?? "[]") as unknown[];
    expect(storedParsed.length).toBeLessThanOrEqual(EDIT_PRESET_PANEL_MAX);
  });

  it("loads authenticated Expert Edit remote preferences only once during bootstrap", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(readSupabaseUserId).mockResolvedValue("user-4");
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

    const { result } = renderHook(() => useExpertEditPresetPanelPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.syncState).toBe("ready");
    });

    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });
});
