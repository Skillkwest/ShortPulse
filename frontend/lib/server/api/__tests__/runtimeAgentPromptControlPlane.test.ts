import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRuntimeAgentPromptControlPlaneCacheForTests,
  resolveRequiredRuntimeAgentPrompt,
} from "../runtimeAgentPromptControlPlane";

describe("runtimeAgentPromptControlPlane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRuntimeAgentPromptControlPlaneCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  it("bootstraps the Standard runtime prompt row from the seeded prompt when missing", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          prompt_id: "STUDIO_AGENT_SYSTEM",
          prompt_body:
            "You are the ShortPulse AI Studio Standard assistant.\n\nRespond directly to the user's request in plain text.",
          updated_at: "2026-05-24T15:00:00.000Z",
          updated_by_user_id: null,
          updated_by_email: "system_bootstrap",
        },
        error: null,
      });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn((table: string) => {
      if (table !== "agent_prompt_runtime") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select,
        upsert,
      };
    });

    const resolved = await resolveRequiredRuntimeAgentPrompt({
      promptId: "STUDIO_AGENT_SYSTEM",
      supabaseAdmin: { from } as never,
    });

    expect(resolved).toEqual({
      promptId: "STUDIO_AGENT_SYSTEM",
      promptBody:
        "You are the ShortPulse AI Studio Standard assistant.\n\nRespond directly to the user's request in plain text.",
      updatedAt: "2026-05-24T15:00:00.000Z",
      updatedByEmail: "system_bootstrap",
      source: "control_plane",
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt_id: "STUDIO_AGENT_SYSTEM",
        updated_by_user_id: null,
        updated_by_email: "system_bootstrap",
      }),
      { onConflict: "prompt_id" }
    );
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});
