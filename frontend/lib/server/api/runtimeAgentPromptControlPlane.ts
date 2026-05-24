/**
 * Server-side helper seam for runtime-owned agent prompt overrides.
 * Control-plane rows can override seeded code prompts without requiring a deploy.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAgentPrompt } from "../../agentPromptLoader";
import type { AgentPromptId } from "../../agentPromptsConfig";
import {
  asNullableString,
  clearControlPlaneCatalogCacheState,
  createControlPlaneCatalogCacheState,
  hasSupabaseAdminConfig,
  resolveCachedControlPlaneCatalog,
  resolveControlPlaneCatalogForAdmin,
  saveControlPlaneCatalog,
  type ControlPlaneCatalogCacheState,
  type ControlPlaneCatalogSupabaseParams,
} from "./controlPlaneCatalogCore";
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

export type RuntimeAgentPromptAdminResolution = RuntimeAgentPromptResolution & {
  degraded: boolean;
};

export type RequiredRuntimeAgentPromptResolution = {
  promptId: AgentPromptId;
  promptBody: string;
  updatedAt: string | null;
  updatedByEmail: string | null;
  source: "control_plane";
};

export class RuntimeAgentPromptVersionMismatchError extends Error {
  constructor(promptId: AgentPromptId) {
    super(`Runtime agent prompt ${promptId} changed since it was loaded.`);
    this.name = "RuntimeAgentPromptVersionMismatchError";
  }
}

export class RequiredRuntimeAgentPromptUnavailableError extends Error {
  constructor(promptId: AgentPromptId) {
    super(`Runtime agent prompt ${promptId} requires a live control-plane connection.`);
    this.name = "RequiredRuntimeAgentPromptUnavailableError";
  }
}

export class RequiredRuntimeAgentPromptMissingError extends Error {
  constructor(promptId: AgentPromptId) {
    super(`Runtime agent prompt ${promptId} is missing from the control plane.`);
    this.name = "RequiredRuntimeAgentPromptMissingError";
  }
}

let runtimeAgentPromptCache: Partial<
  Record<AgentPromptId, ControlPlaneCatalogCacheState<RuntimeAgentPromptResolution>>
> = {};

export const clearRuntimeAgentPromptControlPlaneCacheForTests = (): void => {
  Object.values(runtimeAgentPromptCache).forEach((cacheState) => {
    if (cacheState) clearControlPlaneCatalogCacheState(cacheState);
  });
  runtimeAgentPromptCache = {};
};

export const getSeededRuntimeAgentPrompt = (promptId: AgentPromptId): string | null =>
  loadAgentPrompt(promptId, process.env[promptId]);

export const fetchActiveRuntimeAgentPromptRecord = async ({
  promptId,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  promptId: AgentPromptId;
} & ControlPlaneCatalogSupabaseParams): Promise<ActiveRuntimeAgentPromptRecord | null> => {
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

const bootstrapRuntimeAgentPromptRecordFromSeed = async ({
  promptId,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  promptId: AgentPromptId;
  supabaseAdmin?: SupabaseClient;
}): Promise<ActiveRuntimeAgentPromptRecord | null> => {
  const seededPromptBody = getSeededRuntimeAgentPrompt(promptId)?.trim() ?? "";
  if (!seededPromptBody.length) {
    return null;
  }

  const { error } = await supabaseAdmin.from("agent_prompt_runtime").upsert(
    {
      prompt_id: promptId,
      prompt_body: seededPromptBody,
      updated_by_user_id: null,
      updated_by_email: "system_bootstrap",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "prompt_id" }
  );

  if (error) {
    throw new Error(error.message || `Failed to bootstrap runtime agent prompt ${promptId}.`);
  }

  return fetchActiveRuntimeAgentPromptRecord({
    promptId,
    supabaseAdmin,
  });
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
    return buildSeedRuntimeAgentPromptResolution(promptId);
  }

  if (!runtimeAgentPromptCache[promptId]) {
    runtimeAgentPromptCache[promptId] =
      createControlPlaneCatalogCacheState<RuntimeAgentPromptResolution>();
  }

  return resolveCachedControlPlaneCatalog({
    cacheState: runtimeAgentPromptCache[
      promptId
    ] as ControlPlaneCatalogCacheState<RuntimeAgentPromptResolution>,
    bypassCache,
    controlPlaneCacheTtlMs,
    fetchActiveCatalog: () => fetchActiveRuntimeAgentPromptRecord({ promptId }),
    buildControlPlaneResolution: buildControlPlaneRuntimeAgentPromptResolution,
    buildSeedResolution: () => buildSeedRuntimeAgentPromptResolution(promptId),
  });
};

export const resolveRequiredRuntimeAgentPrompt = async ({
  promptId,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  promptId: AgentPromptId;
  supabaseAdmin?: SupabaseClient;
}): Promise<RequiredRuntimeAgentPromptResolution> => {
  if (!hasSupabaseAdminConfig()) {
    throw new RequiredRuntimeAgentPromptUnavailableError(promptId);
  }

  const activePromptRecord = await fetchActiveRuntimeAgentPromptRecord({
    promptId,
    supabaseAdmin,
  });
  const resolvedPromptRecord =
    activePromptRecord ??
    (await bootstrapRuntimeAgentPromptRecordFromSeed({
      promptId,
      supabaseAdmin,
    }));
  if (!resolvedPromptRecord) {
    throw new RequiredRuntimeAgentPromptMissingError(promptId);
  }

  return {
    promptId,
    promptBody: resolvedPromptRecord.promptBody,
    updatedAt: resolvedPromptRecord.updatedAt,
    updatedByEmail: resolvedPromptRecord.updatedByEmail,
    source: "control_plane",
  };
};

export const resolveRuntimeAgentPromptForAdmin = async ({
  promptId,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  promptId: AgentPromptId;
  supabaseAdmin?: SupabaseClient;
}): Promise<RuntimeAgentPromptAdminResolution> => {
  if (!hasSupabaseAdminConfig()) {
    return buildSeedRuntimeAgentPromptAdminResolution(promptId, false);
  }

  return resolveControlPlaneCatalogForAdmin({
    fetchActiveCatalog: () =>
      fetchActiveRuntimeAgentPromptRecord({
        promptId,
        supabaseAdmin,
      }),
    buildControlPlaneResolution: (activePromptRecord) => ({
      promptId,
      promptBody: activePromptRecord.promptBody,
      updatedAt: activePromptRecord.updatedAt,
      updatedByEmail: activePromptRecord.updatedByEmail,
      source: "control_plane" as const,
      degraded: false,
    }),
    buildSeedResolution: (degraded) =>
      buildSeedRuntimeAgentPromptAdminResolution(promptId, degraded),
  });
};

export const saveRuntimeAgentPrompt = async ({
  promptId,
  promptBody,
  expectedUpdatedAt,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  promptId: AgentPromptId;
  promptBody: string;
  expectedUpdatedAt?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ActiveRuntimeAgentPromptRecord> =>
  saveControlPlaneCatalog({
    definitions: [{ promptId, promptBody }],
    normalizeDefinitions: (definitions) => {
      const [entry] = definitions;
      const normalizedPromptBody = entry.promptBody.trim();
      if (!normalizedPromptBody) {
        throw new Error(`Runtime agent prompt ${promptId} cannot be empty.`);
      }
      return [{ promptId, promptBody: normalizedPromptBody }];
    },
    expectedUpdatedAt,
    fetchActiveCatalog: () => fetchActiveRuntimeAgentPromptRecord({ promptId, supabaseAdmin }),
    getActiveUpdatedAt: (activePromptRecord) => activePromptRecord.updatedAt,
    createVersionMismatchError: () => new RuntimeAgentPromptVersionMismatchError(promptId),
    persistDefinitions: async (normalizedDefinitions) => {
      const [{ promptBody: normalizedPromptBody }] = normalizedDefinitions;
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
    },
    clearCache: clearRuntimeAgentPromptControlPlaneCacheForTests,
    reReadActiveCatalog: () => fetchActiveRuntimeAgentPromptRecord({ promptId, supabaseAdmin }),
    missingActiveCatalogMessage: `Runtime agent prompt save did not produce a row for ${promptId}.`,
  });

const buildControlPlaneRuntimeAgentPromptResolution = (
  activePromptRecord: ActiveRuntimeAgentPromptRecord
): RuntimeAgentPromptResolution => ({
  promptId: activePromptRecord.promptId,
  promptBody: activePromptRecord.promptBody,
  updatedAt: activePromptRecord.updatedAt,
  updatedByEmail: activePromptRecord.updatedByEmail,
  source: "control_plane",
});

const buildSeedRuntimeAgentPromptResolution = (
  promptId: AgentPromptId
): RuntimeAgentPromptResolution => ({
  promptId,
  promptBody: getSeededRuntimeAgentPrompt(promptId),
  updatedAt: null,
  updatedByEmail: null,
  source: "seed",
});

const buildSeedRuntimeAgentPromptAdminResolution = (
  promptId: AgentPromptId,
  degraded: boolean
): RuntimeAgentPromptAdminResolution => ({
  ...buildSeedRuntimeAgentPromptResolution(promptId),
  degraded,
});
