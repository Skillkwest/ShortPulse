#!/usr/bin/env npx tsx

import { createClient } from "../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

type CandidateGeneration = {
  id: string;
  requestId: string | null;
  completedAt: string | null;
  outputCount: number;
  publicationCount: number;
  projectionTaskState: string | null;
  projectionPublicationState: string | null;
  recoveryExecutionAt: string | null;
};

type ReplayResult = {
  generationId: string;
  requestId: string | null;
  completedAt: string | null;
  replayOk: boolean;
  replayState?: string;
  replayNote?: string | null;
  publicationCountAfter?: number;
  projectionTaskStateAfter?: string | null;
  projectionPublicationStateAfter?: string | null;
  outputCountAfter?: number;
  error?: string;
};

const readArgValues = (name: string): string[] => {
  const values: string[] = [];
  const prefixed = `${name}=`;
  for (let index = 0; index < process.argv.length; index += 1) {
    const token = process.argv[index];
    if (token === name) {
      const next = process.argv[index + 1];
      if (typeof next === "string") values.push(next);
      continue;
    }
    if (token.startsWith(prefixed)) {
      values.push(token.slice(prefixed.length));
    }
  }
  return values;
};

const hasFlag = (name: string): boolean => process.argv.includes(name);

const readSingleArg = (name: string): string | null => {
  const values = readArgValues(name);
  return values.length > 0 ? values[values.length - 1] ?? null : null;
};

const readIntegerArg = (name: string, fallback: number, min = 1): number => {
  const raw = readSingleArg(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
};

const usage = () => {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/replay_generation_convergence_backlog.ts [options]",
      "",
      "Modes:",
      "  --dry-run                             Default. Print matching candidates only.",
      "  --execute                             Replay matching candidates through executeGenerationRecovery.",
      "",
      "Safety:",
      "  --expected-project-ref <ref>          Required for --execute. Must match the Supabase project host.",
      "",
      "Selection:",
      "  --limit <n>                           Candidate limit for automatic scan (default 10).",
      "  --generation-id <uuid>                Explicit generation id to target. Repeatable.",
      "  --request-id <id>                     Explicit request id to target. Repeatable.",
      "  --scan-limit <n>                      Max success generations to scan when auto-selecting (default 500).",
    ].join("\n")
  );
};

const asProjectRefFromUrl = (url: string): string | null => {
  try {
    const host = new URL(url).host;
    const firstLabel = host.split(".")[0] ?? null;
    return firstLabel && firstLabel.trim().length > 0 ? firstLabel.trim() : null;
  } catch {
    return null;
  }
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

const chunk = <T>(values: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const loadClient = () => {
  loadLocalEnv({ defaultPaths: ["frontend/.env.local", ".env.local"] });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return {
    url,
    projectRef: asProjectRefFromUrl(url),
    supabase: createClient(url, key, { auth: { persistSession: false } }),
  };
};

const fetchSummaryMaps = async ({
  supabase,
  generationIds,
}: {
  supabase: ReturnType<typeof createClient>;
  generationIds: string[];
}) => {
  const outputCountByGenerationId = new Map<string, number>();
  const publicationSummaryByGenerationId = new Map<
    string,
    { publicationCount: number; publishedCount: number }
  >();
  const projectionByGenerationId = new Map<
    string,
    { taskState: string | null; publicationState: string | null }
  >();

  if (!generationIds.length) {
    return {
      outputCountByGenerationId,
      publicationSummaryByGenerationId,
      projectionByGenerationId,
    };
  }

  for (const ids of chunk(generationIds, 200)) {
    const [outputsResult, publicationsResult, projectionsResult] = await Promise.all([
      supabase.from("ai_generation_outputs").select("generation_id").in("generation_id", ids),
      supabase
        .from("generation_publications")
        .select("generation_id, publication_state")
        .in("generation_id", ids),
      supabase
        .from("generation_projection")
        .select("generation_id, task_state, publication_state")
        .in("generation_id", ids),
    ]);

    if (outputsResult.error) throw outputsResult.error;
    if (publicationsResult.error) throw publicationsResult.error;
    if (projectionsResult.error) throw projectionsResult.error;

    for (const row of outputsResult.data ?? []) {
      outputCountByGenerationId.set(
        row.generation_id,
        (outputCountByGenerationId.get(row.generation_id) ?? 0) + 1
      );
    }

    for (const row of publicationsResult.data ?? []) {
      const current = publicationSummaryByGenerationId.get(row.generation_id) ?? {
        publicationCount: 0,
        publishedCount: 0,
      };
      current.publicationCount += 1;
      if ((row.publication_state ?? "").toLowerCase() === "published") {
        current.publishedCount += 1;
      }
      publicationSummaryByGenerationId.set(row.generation_id, current);
    }

    for (const row of projectionsResult.data ?? []) {
      projectionByGenerationId.set(row.generation_id, {
        taskState: asString(row.task_state),
        publicationState: asString(row.publication_state),
      });
    }
  }

  return {
    outputCountByGenerationId,
    publicationSummaryByGenerationId,
    projectionByGenerationId,
  };
};

const buildCandidates = async ({
  supabase,
  explicitGenerationIds,
  explicitRequestIds,
  limit,
  scanLimit,
}: {
  supabase: ReturnType<typeof createClient>;
  explicitGenerationIds: string[];
  explicitRequestIds: string[];
  limit: number;
  scanLimit: number;
}): Promise<CandidateGeneration[]> => {
  let generations:
    | Array<{
        id: string;
        request_id: string | null;
        completed_at: string | null;
        metadata: unknown;
      }>
    | null = null;

  if (explicitGenerationIds.length > 0) {
    const { data, error } = await supabase
      .from("ai_generations")
      .select("id, request_id, completed_at, metadata")
      .in("id", explicitGenerationIds)
      .eq("status", "success");
    if (error) throw error;
    generations = data ?? [];
  } else if (explicitRequestIds.length > 0) {
    const { data, error } = await supabase
      .from("ai_generations")
      .select("id, request_id, completed_at, metadata")
      .in("request_id", explicitRequestIds)
      .eq("status", "success")
      .order("completed_at", { ascending: false });
    if (error) throw error;
    generations = data ?? [];
  } else {
    const { data, error } = await supabase
      .from("ai_generations")
      .select("id, request_id, completed_at, metadata")
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(scanLimit);
    if (error) throw error;
    generations = data ?? [];
  }

  const generationIds = unique((generations ?? []).map((row) => row.id));
  const { outputCountByGenerationId, publicationSummaryByGenerationId, projectionByGenerationId } =
    await fetchSummaryMaps({
      supabase,
      generationIds,
    });

  const candidates = (generations ?? [])
    .map((row) => {
      const publicationSummary = publicationSummaryByGenerationId.get(row.id) ?? {
        publicationCount: 0,
        publishedCount: 0,
      };
      const projection = projectionByGenerationId.get(row.id) ?? {
        taskState: null,
        publicationState: null,
      };
      const metadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      return {
        id: row.id,
        requestId: asString(row.request_id),
        completedAt: asString(row.completed_at),
        outputCount: outputCountByGenerationId.get(row.id) ?? 0,
        publicationCount: publicationSummary.publicationCount,
        projectionTaskState: projection.taskState,
        projectionPublicationState: projection.publicationState,
        recoveryExecutionAt: asString(metadata?.recovery_execution_at),
      };
    })
    .filter((row) => row.outputCount > 0 && row.publicationCount === 0)
    .slice(0, limit);

  return candidates;
};

const readPostReplaySummary = async ({
  supabase,
  generationId,
}: {
  supabase: ReturnType<typeof createClient>;
  generationId: string;
}) => {
  const [outputsResult, publicationsResult, projectionResult] = await Promise.all([
    supabase.from("ai_generation_outputs").select("generation_id").eq("generation_id", generationId),
    supabase
      .from("generation_publications")
      .select("generation_id")
      .eq("generation_id", generationId),
    supabase
      .from("generation_projection")
      .select("task_state, publication_state")
      .eq("generation_id", generationId)
      .maybeSingle(),
  ]);

  if (outputsResult.error) throw outputsResult.error;
  if (publicationsResult.error) throw publicationsResult.error;
  if (projectionResult.error) throw projectionResult.error;

  return {
    outputCountAfter: outputsResult.data?.length ?? 0,
    publicationCountAfter: publicationsResult.data?.length ?? 0,
    projectionTaskStateAfter: asString(projectionResult.data?.task_state),
    projectionPublicationStateAfter: asString(projectionResult.data?.publication_state),
  };
};

const main = async () => {
  if (hasFlag("--help")) {
    usage();
    process.exit(0);
  }

  const execute = hasFlag("--execute");
  const explicitGenerationIds = unique(readArgValues("--generation-id"));
  const explicitRequestIds = unique(readArgValues("--request-id"));
  const limit = readIntegerArg("--limit", 10);
  const scanLimit = readIntegerArg("--scan-limit", 500);
  const expectedProjectRef = readSingleArg("--expected-project-ref");

  const { supabase, projectRef, url } = loadClient();
  const { executeGenerationRecovery } = await import(
    "../frontend/lib/server/falIntegration/recoveryExecution"
  );

  if (execute) {
    if (!expectedProjectRef) {
      throw new Error("--expected-project-ref is required when --execute is used.");
    }
    if (projectRef !== expectedProjectRef) {
      throw new Error(
        `Project ref mismatch. Expected ${expectedProjectRef}, resolved ${projectRef ?? "unknown"} from ${url}.`
      );
    }
  }

  const candidates = await buildCandidates({
    supabase,
    explicitGenerationIds,
    explicitRequestIds,
    limit,
    scanLimit,
  });

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          projectRef,
          candidateCount: candidates.length,
          candidates,
        },
        null,
        2
      )
    );
    return;
  }

  const replayResults: ReplayResult[] = [];
  for (const candidate of candidates) {
    try {
      const replay = await executeGenerationRecovery({
        actor: "admin_replay",
        generationId: candidate.id,
        routeLabel: "scripts.replay_generation_convergence_backlog",
      });
      const postReplay = await readPostReplaySummary({
        supabase,
        generationId: candidate.id,
      });
      replayResults.push({
        generationId: candidate.id,
        requestId: candidate.requestId,
        completedAt: candidate.completedAt,
        replayOk: replay.ok,
        replayState: replay.state,
        replayNote: replay.note ?? null,
        ...postReplay,
      });
    } catch (error) {
      replayResults.push({
        generationId: candidate.id,
        requestId: candidate.requestId,
        completedAt: candidate.completedAt,
        replayOk: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: "execute",
        projectRef,
        candidateCount: candidates.length,
        replayedCount: replayResults.length,
        replayResults,
      },
      null,
      2
    )
  );
};

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
