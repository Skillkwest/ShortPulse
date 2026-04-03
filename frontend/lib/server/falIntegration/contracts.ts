/**
 * Shared Fal integration contracts used by submit/retrieval engines.
 * These types keep model-specific quirks isolated from route handler glue.
 */

export type GenerationFailureReasonCode =
  | "status_alias_retryable"
  | "result_alias_retryable"
  | "terminal_success_no_media"
  | "status_poll_error"
  | "provider_error"
  | "persist_upload_error"
  | "persist_insert_error"
  | "recovery_exhausted"
  | "payload_drift_detected"
  | "circuit_breaker_open";

export type SubmitPayload = Record<string, unknown>;

export type SubmitTarget = {
  submitUrl: string;
  transformPayload?: (payload: SubmitPayload) => SubmitPayload;
};

export type SubmitTargetAttemptDiagnostic = {
  targetIndex: number;
  attemptsTried: number;
  finalStatus: number | null;
  ok: boolean;
  durationMs: number;
};

export type StatusProbeCandidate = {
  index: number;
  baseUrl: string;
  isJson: boolean;
  isRetryableAlias: boolean;
  httpStatus: number;
  isHttpOk: boolean;
  status: string | null;
  isTerminal: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  hasResponseUrl: boolean;
  hasMedia: boolean;
};

export type ResultProbeCandidate = {
  index: number;
  baseUrl: string;
  isJson: boolean;
  isRetryableAlias: boolean;
  httpStatus: number;
  isHttpOk: boolean;
  status: string | null;
  hasError: boolean;
  hasMedia: boolean;
};
