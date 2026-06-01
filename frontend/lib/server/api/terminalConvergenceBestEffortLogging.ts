/**
 * Shared best-effort logging for post-settlement projection/publication writes.
 * Keeps terminal convergence intact when downstream view-model persistence fails.
 */
import { writeAppErrorLog } from "./appErrorLogs";
import { toErrorMessage } from "./errorMessage";

type SharedWriteFailureInput = {
  source: string;
  message: string;
  generationId: string;
  requestId: string | null;
  routeLabel: string;
  userId: string;
  provider: string | null;
  modelId: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Record a best-effort projection write failure without disturbing terminal settlement.
 */
export const logBestEffortGenerationProjectionWriteFailure = async ({
  source,
  message,
  generationId,
  requestId,
  routeLabel,
  userId,
  provider,
  modelId,
  metadata = {},
}: SharedWriteFailureInput): Promise<void> => {
  await writeAppErrorLog({
    source,
    message,
    requestId,
    userId,
    statusCode: 200,
    metadata: {
      generation_id: generationId,
      route_label: routeLabel,
      provider,
      model_id: modelId,
      ...metadata,
    },
  }).catch(() => undefined);
};

/**
 * Record a best-effort publication write failure without disturbing terminal settlement.
 */
export const logBestEffortGenerationPublicationWriteFailure = async ({
  source,
  message,
  generationId,
  requestId,
  routeLabel,
  userId,
  provider,
  modelId,
  metadata = {},
}: SharedWriteFailureInput): Promise<void> => {
  await writeAppErrorLog({
    source,
    message,
    requestId,
    userId,
    statusCode: 200,
    metadata: {
      generation_id: generationId,
      route_label: routeLabel,
      provider,
      model_id: modelId,
      ...metadata,
    },
  }).catch(() => undefined);
};

/**
 * Normalize a downstream write failure into stable telemetry-safe text.
 */
export const describeBestEffortWriteFailure = (error: unknown): string =>
  toErrorMessage(error, "Unknown error");
