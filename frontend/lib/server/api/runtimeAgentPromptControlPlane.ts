/**
 * Server-side helper seam for runtime-owned agent prompt overrides.
 * Control-plane rows can override seeded code prompts without requiring a deploy.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAgentPrompt } from "../../agentPromptLoader";
import type { AgentPromptId } from "../../agentPromptsConfig";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type ActiveRuntimeAgentPromptRecord = {
  promptId: AgentPromptId;
  promptBody: string;
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
};

export type RuntimeAgentPromptResolution = {
  promptId: AgentPromptId;
  promptBody: string | null;
  updatedAt: string | null;
  updatedByEmail: string | null;
  source: "control_plane" | "seed";
};

const DEFAULT_CONTROL_PLANE_CACHE_TTL_MS = 5000;
const MIN_CONTROL_PLANE_CACHE_TTL_MS = 1000;
const MAX_CONTROL_PLANE_CACHE_TTL_MS = 60000;

let runtimeAgentPromptCache: Partial<
  Record<
    AgentPromptId,
    {
      expiresAtMs: number;
      value: ActiveRuntimeAgentPromptRecord | null;
    }
  >
> = {};

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveControlPlaneCacheTtlMs = (rawValue?: string | null): number => {
  const parsed = Number(rawValue ?? String(DEFAULT_CONTROL_PLANE_CACHE_TTL_MS));
  if (!Number.isFinite(parsed)) return DEFAULT_CONTROL_PLANE_CACHE_TTL_MS;
  return Math.max(
    MIN_CONTROL_PLANE_CACHE_TTL_MS,
    Math.min(MAX_CONTROL_PLANE_CACHE_TTL_MS, Math.floor(parsed))
  );
};

const hasSupabaseAdminConfig = (): boolean =>
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0 &&
  typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0;

export const clearRuntimeAgentPromptControlPlaneCacheForTests = (): void => {
  runtimeAgentPromptCache = {};
};

export const getSeededRuntimeAgentPrompt = (promptId: AgentPromptId): string | null =>
  loadAgentPrompt(promptId, process.env[promptId]);

export const fetchActiveRuntimeAgentPromptRecord = async ({
  promptId,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  promptId: AgentPromptId;
  supabaseAdmin?: SupabaseClient;
}): Promise<ActiveRuntimeAgentPromptRecord | null> => {
  const { data, error } = await supabaseAdmin
    .from("agent_prompt_runtime")
    .select("prompt_id, prompt_body, updated_at, updated_by_user_id, updated_by_email")
    .eq("prompt_id", promptId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || `Failed to load runtime agent prompt ${promptId}.`);
  }
  const promptBody = asNullableString(data?.prompt_body);
  if (!data || !promptBody) return null;

  return {
    promptId,
    promptBody,
    updatedAt: asNullableString(data.updated_at),
    updatedByUserId: asNullableString(data.updated_by_user_id),
    updatedByEmail: asNullableString(data.updated_by_email),
  };
};

export const resolveRuntimeAgentPrompt = async ({
  promptId,
  controlPlaneCacheTtlMs = process.env.AGENT_PROMPT_CONTROL_PLANE_CACHE_TTL_MS,
  bypassCache = false,
}: {
  promptId: AgentPromptId;
  controlPlaneCacheTtlMs?: string | null;
  bypassCache?: boolean;
}): Promise<RuntimeAgentPromptResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return {
      promptId,
      promptBody: getSeededRuntimeAgentPrompt(promptId),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
    };
  }

  const nowMs = Date.now();
  const cached = runtimeAgentPromptCache[promptId];
  if (!bypassCache && cached && cached.expiresAtMs > nowMs) {
    if (cached.value) {
      return {
        promptId,
        promptBody: cached.value.promptBody,
        updatedAt: cached.value.updatedAt,
        updatedByEmail: cached.value.updatedByEmail,
        source: "control_plane",
      };
    }
    return {
      promptId,
      promptBody: getSeededRuntimeAgentPrompt(promptId),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
    };
  }

  try {
    const activePromptRecord = await fetchActiveRuntimeAgentPromptRecord({ promptId });
    runtimeAgentPromptCache[promptId] = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: activePromptRecord,
    };
    if (activePromptRecord) {
      return {
        promptId,
        promptBody: activePromptRecord.promptBody,
        updatedAt: activePromptRecord.updatedAt,
        updatedByEmail: activePromptRecord.updatedByEmail,
        source: "control_plane",
      };
    }
  } catch {
    runtimeAgentPromptCache[promptId] = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: null,
    };
  }

  return {
    promptId,
    promptBody: getSeededRuntimeAgentPrompt(promptId),
    updatedAt: null,
    updatedByEmail: null,
    source: "seed",
  };
};

export const saveRuntimeAgentPrompt = async ({
  promptId,
  promptBody,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  promptId: AgentPromptId;
  promptBody: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ActiveRuntimeAgentPromptRecord> => {
  const normalizedPromptBody = promptBody.trim();
  if (!normalizedPromptBody) {
    throw new Error(`Runtime agent prompt ${promptId} cannot be empty.`);
  }

  const { error } = await supabaseAdmin.from("agent_prompt_runtime").upsert(
    {
      prompt_id: promptId,
      prompt_body: normalizedPromptBody,
      updated_by_user_id: actorUserId ?? null,
      updated_by_email: actorEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "prompt_id" }
  );

  if (error) {
    throw new Error(error.message || `Failed to save runtime agent prompt ${promptId}.`);
  }

  clearRuntimeAgentPromptControlPlaneCacheForTests();
  const activePromptRecord = await fetchActiveRuntimeAgentPromptRecord({
    promptId,
    supabaseAdmin,
  });
  if (!activePromptRecord) {
    throw new Error(`Runtime agent prompt save did not produce a row for ${promptId}.`);
  }
  return activePromptRecord;
};
