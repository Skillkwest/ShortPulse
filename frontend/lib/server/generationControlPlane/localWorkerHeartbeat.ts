import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import type { FalRuntimeFlags } from "../api/falRuntimeFlags";

type HeartbeatPayload = {
  updatedAt?: string | null;
};

const DEFAULT_HEARTBEAT_MAX_AGE_MS = 15_000;
const DEFAULT_HEARTBEAT_RELATIVE_PATH = path.join(
  ".tmp",
  "generation-control-plane-worker-heartbeat.json"
);

const parseHeartbeatMaxAgeMs = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HEARTBEAT_MAX_AGE_MS;
  return Math.max(1_000, parsed);
};

const resolveHeartbeatPaths = (): string[] => {
  const configured = process.env.SHORTPULSE_FAL_DEV_WORKER_HEARTBEAT_PATH?.trim();
  if (!configured) {
    const cwd = process.cwd();
    return Array.from(
      new Set([
        path.resolve(cwd, DEFAULT_HEARTBEAT_RELATIVE_PATH),
        path.resolve(cwd, "frontend", DEFAULT_HEARTBEAT_RELATIVE_PATH),
      ])
    );
  }
  return [path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)];
};

const isLoopbackHostname = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname === "[::1]" ||
  hostname === "0.0.0.0";

const isLocalDevBaseUrl = (value: string | null): boolean => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
};

const readHeartbeatTimestampMs = (): number | null => {
  let freshestTimestampMs: number | null = null;

  for (const heartbeatPath of resolveHeartbeatPaths()) {
    if (!fs.existsSync(heartbeatPath)) continue;
    try {
      const raw = fs.readFileSync(heartbeatPath, "utf8");
      const parsed = JSON.parse(raw) as HeartbeatPayload;
      if (!parsed || typeof parsed !== "object") continue;
      if (typeof parsed.updatedAt !== "string" || !parsed.updatedAt.trim()) continue;
      const timestampMs = Date.parse(parsed.updatedAt);
      if (!Number.isFinite(timestampMs)) continue;
      if (freshestTimestampMs === null || timestampMs > freshestTimestampMs) {
        freshestTimestampMs = timestampMs;
      }
    } catch {
      continue;
    }
  }

  return freshestTimestampMs;
};

const readDbHeartbeatTimestampMs = async (): Promise<number | null> => {
  const response = await getSupabaseAdmin()
    .from("worker_instances")
    .select("last_heartbeat_at,status")
    .eq("worker_type", "generation_control_plane")
    .eq("hostname", os.hostname())
    .in("status", ["starting", "running", "ok"])
    .order("last_heartbeat_at", { ascending: false })
    .limit(1);

  if (response.error) {
    throw response.error;
  }

  const row = Array.isArray(response.data) ? response.data[0] : null;
  const heartbeatValue =
    row && typeof row === "object" && "last_heartbeat_at" in row
      ? (row.last_heartbeat_at as string | null | undefined)
      : null;
  if (!heartbeatValue || !heartbeatValue.trim()) return null;

  const timestampMs = Date.parse(heartbeatValue);
  return Number.isFinite(timestampMs) ? timestampMs : null;
};

export const isLocalDevGenerationWorkerRequired = (flags: FalRuntimeFlags): boolean => {
  if (!flags.queueEnabled || !flags.reconcilerEnabled) return false;
  if (process.env.NODE_ENV === "production") return false;
  return isLocalDevBaseUrl(flags.publicApiBaseUrl);
};

export const hasFreshLocalGenerationWorkerHeartbeat = async (): Promise<boolean> => {
  const heartbeatTimestampMs = readHeartbeatTimestampMs();
  const maxAgeMs = parseHeartbeatMaxAgeMs(
    process.env.SHORTPULSE_FAL_DEV_WORKER_HEARTBEAT_MAX_AGE_MS
  );
  if (heartbeatTimestampMs !== null && Date.now() - heartbeatTimestampMs <= maxAgeMs) {
    return true;
  }

  try {
    const dbHeartbeatTimestampMs = await readDbHeartbeatTimestampMs();
    return dbHeartbeatTimestampMs !== null && Date.now() - dbHeartbeatTimestampMs <= maxAgeMs;
  } catch {
    return false;
  }
};
