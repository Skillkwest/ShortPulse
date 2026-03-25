import fs from "node:fs";
import path from "node:path";
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

const resolveHeartbeatPath = (): string => {
  const configured = process.env.SHORTPULSE_FAL_DEV_WORKER_HEARTBEAT_PATH?.trim();
  if (!configured) {
    return path.resolve(process.cwd(), DEFAULT_HEARTBEAT_RELATIVE_PATH);
  }
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
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
  const heartbeatPath = resolveHeartbeatPath();
  if (!fs.existsSync(heartbeatPath)) return null;
  try {
    const raw = fs.readFileSync(heartbeatPath, "utf8");
    const parsed = JSON.parse(raw) as HeartbeatPayload;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.updatedAt !== "string" || !parsed.updatedAt.trim()) return null;
    const timestampMs = Date.parse(parsed.updatedAt);
    if (!Number.isFinite(timestampMs)) return null;
    return timestampMs;
  } catch {
    return null;
  }
};

export const isLocalDevGenerationWorkerRequired = (flags: FalRuntimeFlags): boolean => {
  if (!flags.queueEnabled || !flags.reconcilerEnabled) return false;
  if (process.env.NODE_ENV === "production") return false;
  return isLocalDevBaseUrl(flags.publicApiBaseUrl);
};

export const hasFreshLocalGenerationWorkerHeartbeat = (): boolean => {
  const heartbeatTimestampMs = readHeartbeatTimestampMs();
  if (heartbeatTimestampMs === null) return false;
  const maxAgeMs = parseHeartbeatMaxAgeMs(
    process.env.SHORTPULSE_FAL_DEV_WORKER_HEARTBEAT_MAX_AGE_MS
  );
  return Date.now() - heartbeatTimestampMs <= maxAgeMs;
};
