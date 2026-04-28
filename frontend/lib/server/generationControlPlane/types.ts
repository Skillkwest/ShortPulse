import type { NextApiRequest } from "next";

export type GenerationControlPlaneLogContext = {
  req?: NextApiRequest;
  routeLabel: string;
};

export type GenerationControlPlaneStageTiming = {
  durationMs: number;
};

export type GenerationControlPlaneStageTimings = {
  preProviderRetirement: GenerationControlPlaneStageTiming;
  reservationCleanup: GenerationControlPlaneStageTiming;
  providerAttachedReservationCleanup: GenerationControlPlaneStageTiming;
  observationInboxProcessing: GenerationControlPlaneStageTiming;
  requestIdRepair: GenerationControlPlaneStageTiming;
  recoveryClaim: GenerationControlPlaneStageTiming;
  recoveryExecution: GenerationControlPlaneStageTiming;
};

export type GenerationControlPlaneCycleResult = {
  ok: true;
  observationClaimed: number;
  observationProcessed: number;
  observationIgnored: number;
  observationFailed: number;
  observationErrors: number;
  claimed: number;
  processed: number;
  recovered: number;
  requeued: number;
  exhausted: number;
  duplicates: number;
  errors: number;
  skipped: number;
  reservationCleanupScanned: number;
  reservationCleanupReleased: number;
  reservationCleanupErrors: number;
  preProviderRetirementScanned: number;
  preProviderQueueExhausted: number;
  preProviderGenerationsExhausted: number;
  preProviderReservationsReleased: number;
  preProviderRetirementErrors: number;
  stageTimings: GenerationControlPlaneStageTimings;
};
