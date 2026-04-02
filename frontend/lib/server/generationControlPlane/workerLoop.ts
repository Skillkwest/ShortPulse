import fs from "node:fs";
import path from "node:path";
import { runGenerationControlPlaneCycle } from "./runCycle";
import type { GenerationControlPlaneCycleResult } from "./types";
import type { GenerationControlPlaneRunWriter } from "./workerOps";
export { createGenerationControlPlaneWorkerDbOps } from "./workerOps";

export const DEFAULT_GENERATION_CONTROL_PLANE_WORKER_INTERVAL_MS = 5_000;
export const DEFAULT_GENERATION_CONTROL_PLANE_WORKER_ERROR_BACKOFF_MS = 5_000;
export const DEFAULT_GENERATION_CONTROL_PLANE_WORKER_ROUTE_LABEL =
  "worker/generation-control-plane";

export type GenerationControlPlaneWorkerHeartbeat = {
  updatedAt: string;
  status: "running" | "ok" | "error" | "stopped";
  pid?: number;
  lastOkAt?: string;
  lastError?: string;
  lastResponse?: GenerationControlPlaneCycleResult;
};

type GenerationControlPlaneWorkerLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

type GenerationControlPlaneWorkerOnceOptions = {
  routeLabel?: string;
  logger?: GenerationControlPlaneWorkerLogger;
  writeHeartbeat?: (payload: GenerationControlPlaneWorkerHeartbeat) => void | Promise<void>;
  runWriter?: GenerationControlPlaneRunWriter;
  runCycle?: typeof runGenerationControlPlaneCycle;
};

type GenerationControlPlaneWorkerLoopOptions = GenerationControlPlaneWorkerOnceOptions & {
  intervalMs?: number;
  errorBackoffMs?: number;
  shouldStop?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
};

const defaultLogger: GenerationControlPlaneWorkerLogger = {
  info: (message) => console.log(message),
  error: (message) => console.error(message),
};

const noopHeartbeatWriter = () => {};

export const readInteger = (value: string | undefined, fallback: number, min = 1): number => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
};

export const resolveHeartbeatPath = (): string => {
  const configured = process.env.SHORTPULSE_FAL_DEV_WORKER_HEARTBEAT_PATH?.trim();
  if (!configured) {
    return path.resolve(process.cwd(), ".tmp", "generation-control-plane-worker-heartbeat.json");
  }
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
};

export const writeGenerationControlPlaneWorkerHeartbeat = (
  payload: GenerationControlPlaneWorkerHeartbeat
): void => {
  const heartbeatPath = resolveHeartbeatPath();
  fs.mkdirSync(path.dirname(heartbeatPath), { recursive: true });
  fs.writeFileSync(
    heartbeatPath,
    JSON.stringify(
      {
        ...payload,
        pid: process.pid,
      },
      null,
      2
    )
  );
};

export const runGenerationControlPlaneWorkerOnce = async ({
  routeLabel = DEFAULT_GENERATION_CONTROL_PLANE_WORKER_ROUTE_LABEL,
  logger = defaultLogger,
  writeHeartbeat = noopHeartbeatWriter,
  runCycle = runGenerationControlPlaneCycle,
  runWriter,
}: GenerationControlPlaneWorkerOnceOptions = {}): Promise<
  | {
      ok: true;
      result: GenerationControlPlaneCycleResult;
    }
  | {
      ok: false;
      error: string;
    }
> => {
  const startedAt = Date.now();
  let runId: string | null = null;
  try {
    await writeHeartbeat({
      updatedAt: new Date().toISOString(),
      status: "running",
    });
    runId = (await runWriter?.startRun({ routeLabel })) ?? null;

    const result = await runCycle({
      context: {
        routeLabel,
      },
    });

    await writeHeartbeat({
      updatedAt: new Date().toISOString(),
      lastOkAt: new Date().toISOString(),
      status: "ok",
      lastResponse: result,
    });
    await runWriter?.finishRun({
      runId,
      status: "ok",
      result,
    });

    logger.info(
      `[generation-worker] ok duration_ms=${Date.now() - startedAt} claimed=${result.claimed} queueClaimed=${result.queueClaimed} queueSubmitted=${result.queueSubmitted} errors=${result.errors} queueDispatchErrors=${result.queueDispatchErrors}`
    );

    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeHeartbeat({
      updatedAt: new Date().toISOString(),
      status: "error",
      lastError: message,
    });
    await runWriter?.finishRun({
      runId,
      status: "error",
      error: message,
    });
    logger.error(`[generation-worker] error=${message}`);
    return { ok: false, error: message };
  }
};

export const runGenerationControlPlaneWorkerLoop = async ({
  intervalMs = DEFAULT_GENERATION_CONTROL_PLANE_WORKER_INTERVAL_MS,
  errorBackoffMs = DEFAULT_GENERATION_CONTROL_PLANE_WORKER_ERROR_BACKOFF_MS,
  routeLabel = DEFAULT_GENERATION_CONTROL_PLANE_WORKER_ROUTE_LABEL,
  logger = defaultLogger,
  writeHeartbeat = writeGenerationControlPlaneWorkerHeartbeat,
  shouldStop = () => false,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  runCycle = runGenerationControlPlaneCycle,
  runWriter,
}: GenerationControlPlaneWorkerLoopOptions = {}): Promise<void> => {
  logger.info(
    `[generation-worker] start route_label=${routeLabel} interval_ms=${intervalMs} error_backoff_ms=${errorBackoffMs}`
  );

  while (!shouldStop()) {
    const result = await runGenerationControlPlaneWorkerOnce({
      routeLabel,
      logger,
      writeHeartbeat,
      runWriter,
      runCycle,
    });
    if (shouldStop()) break;
    await sleep(result.ok ? intervalMs : errorBackoffMs);
  }

  await writeHeartbeat({
    updatedAt: new Date().toISOString(),
    status: "stopped",
  });
  logger.info("[generation-worker] stopped");
};
