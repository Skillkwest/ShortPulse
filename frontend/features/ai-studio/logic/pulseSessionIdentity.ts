/**
 * Pulse session identity helpers.
 * Pulse freshness must be scoped to a runtime session instance, not just a preset id.
 */
import { randomId } from "./ids";

export const createPulseSessionInstanceId = (): string =>
  `pulse_${Date.now().toString(36)}_${randomId()}`;

export const buildRestoredPulseSessionInstanceId = ({
  sessionId,
  updatedAt,
  presetId,
}: {
  sessionId: string;
  updatedAt: string;
  presetId: string;
}): string =>
  [
    "pulse_restore",
    sessionId.replace(/[^a-z0-9_-]/gi, "_"),
    presetId.replace(/[^a-z0-9_-]/gi, "_"),
    updatedAt.replace(/[^a-z0-9_-]/gi, "_"),
  ].join("_");
