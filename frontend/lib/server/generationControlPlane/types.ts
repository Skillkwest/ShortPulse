import type { NextApiRequest } from "next";

export type GenerationControlPlaneLogContext = {
  req?: NextApiRequest;
  routeLabel: string;
};

export type GenerationControlPlaneCycleResult = {
  ok: true;
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
};
