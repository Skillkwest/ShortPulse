import type { NextApiRequest, NextApiResponse } from "next";

export type JsonObject = Record<string, unknown>;

export type ChargeOptions = {
  req: NextApiRequest;
  res: NextApiResponse;
  modelId: string;
  payload: JsonObject;
  reason: string;
  skipBilling?: boolean;
};

export type ChargeResult = {
  userId: string;
  modelId: string;
  credits: number;
  sourceRef: string;
  billingMode: "reservation" | "direct_debit";
  markSubmitted: (providerRequestId: string, extra?: JsonObject) => Promise<void>;
  refund: (message?: string, extra?: JsonObject) => Promise<void>;
};

export type LedgerChargeRow = {
  id: string;
  source_ref: string | null;
  change_cents: number;
  metadata: JsonObject | null;
};

export type GenerationSettlementOutcome = "success" | "fail";

export type GenerationSettlementOptions = {
  userId: string;
  providerRequestId: string;
  outcome: GenerationSettlementOutcome;
  reason: string;
  routeLabel: string;
  detail?: JsonObject;
};

export type GenerationSettlementResult = {
  settled: boolean;
  sourceRef?: string | null;
  note: string;
};

export type FailedGenerationSettlementOptions = Omit<GenerationSettlementOptions, "outcome">;

export type FailedGenerationSettlementResult = GenerationSettlementResult;

export type ProviderRequestOwnership = "owned" | "forbidden" | "unknown";

export type ReservationRpcState =
  | "reserved"
  | "already_reserved"
  | "admission_limited"
  | "captured"
  | "already_captured"
  | "released"
  | "already_released"
  | "not_found"
  | "failed";

export type ReservationAdmissionSnapshot = {
  reason: string | null;
  globalActive: number;
  globalMax: number;
  tier: string;
  tierActive: number;
  tierMax: number;
  retryAfterSeconds: number;
};

export type ReservationRpcResult = {
  status: ReservationRpcState;
  sourceRef?: string | null;
  message?: string | null;
  code?: string | null;
  admission?: ReservationAdmissionSnapshot | null;
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
