type JsonObject = Record<string, unknown>;

type BuildAcceptedRunningGenerationUpdateInput = {
  provider: string;
  modelId: string;
  providerRequestId: string;
  nextRecoveryAtIso: string;
  metadata: JsonObject;
};

type BuildRequestIdRepairGenerationUpdateInput = {
  providerRequestId: string;
  nextRecoveryAtIso: string;
  metadata: JsonObject;
};

export const buildAcceptedRunningGenerationUpdate = ({
  provider,
  modelId,
  providerRequestId,
  nextRecoveryAtIso,
  metadata,
}: BuildAcceptedRunningGenerationUpdateInput): Record<string, unknown> => ({
  provider,
  model_id: modelId,
  request_id: providerRequestId,
  status: "running",
  failure_reason_code: null,
  error_message: null,
  completed_at: null,
  recovery_state: "queued",
  recovery_attempts: 0,
  last_recovery_at: null,
  next_recovery_at: nextRecoveryAtIso,
  last_media_detected_at: null,
  metadata,
});

export const buildRequestIdRepairGenerationUpdate = ({
  providerRequestId,
  nextRecoveryAtIso,
  metadata,
}: BuildRequestIdRepairGenerationUpdateInput): Record<string, unknown> => ({
  request_id: providerRequestId,
  status: "running",
  failure_reason_code: null,
  error_message: null,
  completed_at: null,
  recovery_state: "queued",
  next_recovery_at: nextRecoveryAtIso,
  metadata,
});
