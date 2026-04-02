import crypto from "node:crypto";
import os from "node:os";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import type { GenerationControlPlaneCycleResult } from "./types";
import type { GenerationControlPlaneWorkerHeartbeat } from "./workerLoop";

const GENERATION_CONTROL_PLANE_WORKER_TYPE = "generation_control_plane";
const GENERATION_CONTROL_PLANE_WORKER_SCOPE = "generation_control_plane";
const DEFAULT_GENERATION_CONTROL_PLANE_LEASE_SECONDS = 30;

type WorkerStatus = GenerationControlPlaneWorkerHeartbeat["status"] | "starting" | "draining";

type WorkerRunStatus = "running" | "ok" | "error";

type SupabaseLike = ReturnType<typeof getSupabaseAdmin>;

export type GenerationControlPlaneRunWriter = {
  startRun: (payload: { routeLabel: string }) => Promise<string | null>;
  finishRun: (payload: {
    runId: string | null;
    status: WorkerRunStatus;
    result?: GenerationControlPlaneCycleResult;
    error?: string;
  }) => Promise<void>;
};

type GenerationControlPlaneDbOps = GenerationControlPlaneRunWriter & {
  acquireLeadership: (payload?: { scope?: string; leaseSeconds?: number }) => Promise<boolean>;
  releaseLeadership: (payload?: { scope?: string }) => Promise<void>;
  writeHeartbeat: (payload: GenerationControlPlaneWorkerHeartbeat) => Promise<void>;
};

type GenerationControlPlaneDbOpsOptions = {
  supabaseAdmin?: SupabaseLike;
  instanceKey?: string;
  instanceLabel?: string;
  workerType?: string;
  buildId?: string | null;
  metadata?: Record<string, unknown>;
};

const toBuildId = (): string | null =>
  process.env.SHORTPULSE_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
  null;

const toInstanceLabel = (): string =>
  process.env.SHORTPULSE_GENERATION_WORKER_INSTANCE_LABEL?.trim() ||
  `${os.hostname()}:${process.pid}`;

const toRouteMetadata = (): Record<string, unknown> => ({
  runtime: "node",
  hostname: os.hostname(),
  pid: process.pid,
});

type WorkerInstanceRow = {
  id: string;
};

type LeadershipResponseRow = {
  acquired: boolean;
  worker_instance_id: string;
  expires_at: string;
};

const sanitizeStatus = (status: WorkerStatus): WorkerStatus => {
  switch (status) {
    case "starting":
    case "running":
    case "ok":
    case "error":
    case "stopped":
    case "draining":
      return status;
    default:
      return "error";
  }
};

export const createGenerationControlPlaneWorkerDbOps = ({
  supabaseAdmin = getSupabaseAdmin(),
  instanceKey = process.env.SHORTPULSE_GENERATION_WORKER_INSTANCE_KEY?.trim() ||
    crypto.randomUUID(),
  instanceLabel = toInstanceLabel(),
  workerType = GENERATION_CONTROL_PLANE_WORKER_TYPE,
  buildId = toBuildId(),
  metadata = {},
}: GenerationControlPlaneDbOpsOptions = {}): GenerationControlPlaneDbOps => {
  let instanceId: string | null = null;

  const ensureInstance = async (): Promise<string> => {
    if (instanceId) return instanceId;

    const payload = {
      worker_type: workerType,
      instance_key: instanceKey,
      instance_label: instanceLabel,
      hostname: os.hostname(),
      pid: process.pid,
      build_id: buildId,
      status: "starting",
      started_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      metadata: {
        ...toRouteMetadata(),
        ...metadata,
      },
    };

    const { data, error } = await supabaseAdmin
      .from("worker_instances")
      .upsert(payload, {
        onConflict: "instance_key",
      })
      .select("id")
      .single<WorkerInstanceRow>();

    if (error || !data?.id) {
      throw new Error(
        `Failed to register generation control-plane worker instance: ${error?.message ?? "missing id"}`
      );
    }

    instanceId = data.id;
    return instanceId;
  };

  const writeHeartbeat = async (payload: GenerationControlPlaneWorkerHeartbeat): Promise<void> => {
    const id = await ensureInstance();
    const status = sanitizeStatus(payload.status);
    const now = payload.updatedAt || new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status,
      last_heartbeat_at: now,
      updated_at: now,
    };

    if (payload.lastOkAt) {
      updatePayload.last_ok_at = payload.lastOkAt;
    } else if (status === "ok") {
      updatePayload.last_ok_at = now;
    }

    if (payload.lastError !== undefined) {
      updatePayload.last_error = payload.lastError;
    }

    if (payload.lastResponse !== undefined) {
      updatePayload.last_response = payload.lastResponse;
    }

    const { error } = await supabaseAdmin
      .from("worker_instances")
      .update(updatePayload)
      .eq("id", id);
    if (error) {
      throw new Error(
        `Failed to persist generation control-plane worker heartbeat: ${error.message}`
      );
    }
  };

  const startRun = async ({ routeLabel }: { routeLabel: string }): Promise<string | null> => {
    const id = await ensureInstance();
    const startedAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("worker_runs")
      .insert({
        worker_instance_id: id,
        trigger_source: "resident_worker",
        route_label: routeLabel,
        status: "running",
        started_at: startedAt,
        metadata: {
          instance_key: instanceKey,
        },
      })
      .select("id")
      .single<WorkerInstanceRow>();

    if (error || !data?.id) {
      throw new Error(
        `Failed to create generation control-plane worker run: ${error?.message ?? "missing id"}`
      );
    }

    return data.id;
  };

  const acquireLeadership = async ({
    scope = GENERATION_CONTROL_PLANE_WORKER_SCOPE,
    leaseSeconds = DEFAULT_GENERATION_CONTROL_PLANE_LEASE_SECONDS,
  }: {
    scope?: string;
    leaseSeconds?: number;
  } = {}): Promise<boolean> => {
    const id = await ensureInstance();
    const { data, error } = await supabaseAdmin.rpc("acquire_worker_leadership", {
      p_scope: scope,
      p_worker_instance_id: id,
      p_worker_type: workerType,
      p_lease_seconds: Math.max(1, Math.trunc(leaseSeconds)),
      p_metadata: {
        instance_key: instanceKey,
        instance_label: instanceLabel,
      },
    });

    const row = Array.isArray(data) ? (data[0] as LeadershipResponseRow | undefined) : undefined;

    if (error || !row) {
      throw new Error(
        `Failed to acquire generation control-plane leadership: ${error?.message ?? "missing row"}`
      );
    }

    return Boolean(row.acquired);
  };

  const releaseLeadership = async ({
    scope = GENERATION_CONTROL_PLANE_WORKER_SCOPE,
  }: {
    scope?: string;
  } = {}): Promise<void> => {
    const id = await ensureInstance();
    const { error } = await supabaseAdmin.rpc("release_worker_leadership", {
      p_scope: scope,
      p_worker_instance_id: id,
    });
    if (error) {
      throw new Error(`Failed to release generation control-plane leadership: ${error.message}`);
    }
  };

  const finishRun = async ({
    runId,
    status,
    result,
    error,
  }: {
    runId: string | null;
    status: WorkerRunStatus;
    result?: GenerationControlPlaneCycleResult;
    error?: string;
  }): Promise<void> => {
    if (!runId) return;
    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("worker_runs")
      .update({
        status,
        completed_at: completedAt,
        metrics: result ?? {},
        error_summary: error ?? null,
        updated_at: completedAt,
      })
      .eq("id", runId);

    if (updateError) {
      throw new Error(
        `Failed to finalize generation control-plane worker run: ${updateError.message}`
      );
    }
  };

  return {
    acquireLeadership,
    writeHeartbeat,
    startRun,
    finishRun,
    releaseLeadership,
  };
};
