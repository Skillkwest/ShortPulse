import type { NextApiRequest } from "next";

export type GenerationControlPlaneLogContext = {
  req?: NextApiRequest;
  routeLabel: string;
};

export type GenerationControlPlaneStageTiming = {
  durationMs: number;
};

export type GenerationControlPlaneStageTimings = {
  queueDispatch: GenerationControlPlaneStageTiming;
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
  queueClaimed: number;
  queueSubmitted: number;
  queueRetried: number;
  queueRequeuedNoCapacity: number;
  queueExhausted: number;
  queueSkipped: number;
  queueDispatchErrors: number;
  stageTimings: GenerationControlPlaneStageTimings;
};
