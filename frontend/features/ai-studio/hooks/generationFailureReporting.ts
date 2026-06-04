export type GenerationFailureTelemetryMode = "incident" | "validation" | "state_only";

export type GenerationFailureContext = {
  reasonCode?: string | null;
  providerState?: string | null;
  pollAttempt?: number | null;
  noMediaAttempt?: number | null;
  elapsedMs?: number | null;
  maxWaitMs?: number | null;
  telemetryMode?: GenerationFailureTelemetryMode;
};

export type NotifyGenerationFailure = (
  outputId: string,
  message: string,
  detail?: string,
  context?: GenerationFailureContext
) => void;
