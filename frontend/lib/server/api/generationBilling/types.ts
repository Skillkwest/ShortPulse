import type { NextApiRequest, NextApiResponse } from "next";

export type JsonObject = Record<string, unknown>;

export type ChargeOptions = {
  req: NextApiRequest;
  res: NextApiResponse;
  modelId: string;
  payload: JsonObject;
  reason: string;
};

export type ChargeResult = {
  userId: string;
  modelId: string;
  credits: number;
  sourceRef: string;
  markSubmitted: (providerRequestId: string, extra?: JsonObject) => Promise<void>;
  refund: (message?: string, extra?: JsonObject) => Promise<void>;
};

export type LedgerChargeRow = {
  id: string;
  source_ref: string | null;
  change_cents: number;
  metadata: JsonObject | null;
};

export type FailedGenerationSettlementOptions = {
  userId: string;
  providerRequestId: string;
  reason: string;
  routeLabel: string;
  detail?: JsonObject;
};

export type FailedGenerationSettlementResult = {
  settled: boolean;
  sourceRef?: string | null;
  note: string;
};

export type ProviderRequestOwnership = "owned" | "forbidden" | "unknown";

export type ReservationRpcState =
  | "reserved"
  | "already_reserved"
  | "captured"
  | "already_captured"
  | "released"
  | "already_released"
  | "not_found"
  | "failed";

export type ReservationRpcResult = {
  status: ReservationRpcState;
  sourceRef?: string | null;
  message?: string | null;
  code?: string | null;
};

export type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
};

export type RpcInvoker = {
  rpc: (
    functionName: string,
    params: Record<string, unknown>
  ) => Promise<{ data: unknown; error: RpcErrorLike | null }>;
};

export const GENERATION_BILLING_FAILURE_MESSAGE =
  "Unable to process generation credits. Please retry.";
