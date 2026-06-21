import type { NextApiRequest } from "next";

export type GenerationControlPlaneLogContext = {
  req?: NextApiRequest;
  routeLabel: string;
};

export type GenerationControlPlaneStageTiming = {
  durationMs: number;
};

export type GenerationControlPlaneStageTimings = {
  reservationCleanup: GenerationControlPlaneStageTiming;
  providerAttachedReservationCleanup: GenerationControlPlaneStageTiming;
  observationInboxProcessing: GenerationControlPlaneStageTiming;
  recoveryClaim: GenerationControlPlaneStageTiming;
  recoveryExecution: GenerationControlPlaneStageTiming;
  projectionRepair: GenerationControlPlaneStageTiming;
  audioCompanionArtProcessing: GenerationControlPlaneStageTiming;
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
  projectionRepairRan: boolean;
  projectionRepairScanned: number;
  projectionRepairRepaired: number;
  projectionRepairSkipped: number;
  audioCompanionArtClaimed: number;
  audioCompanionArtProcessed: number;
  audioCompanionArtReady: number;
  audioCompanionArtFailed: number;
  audioCompanionArtSkipped: number;
  audioCompanionArtErrors: number;
  stageTimings: GenerationControlPlaneStageTimings;
};
