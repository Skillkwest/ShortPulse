import type { ReservationRpcResult } from "./types";

export const isInsufficientCreditError = (message?: string): boolean =>
  /insufficient credits/i.test(message ?? "");

export const isDuplicateError = (code?: string | null, message?: string): boolean =>
  code === "23505" || /duplicate key value/i.test(message ?? "");

export const isMissingLedgerSchemaError = (code?: string | null, message?: string): boolean => {
  const normalizedCode = String(code ?? "").toUpperCase();
  if (normalizedCode === "42703" || normalizedCode === "PGRST204" || normalizedCode === "42P01") {
    return true;
  }
  const text = String(message ?? "");
  return (
    /relation .* does not exist/i.test(text) ||
    /could not find the table/i.test(text) ||
    /column .*ai_credit_ledger.*does not exist/i.test(text) ||
    /could not find the '.*' column of 'ai_credit_ledger'/i.test(text)
  );
};

export const isMissingReservationSchemaError = (
  code?: string | null,
  message?: string
): boolean => {
  const normalizedCode = String(code ?? "").toUpperCase();
  if (normalizedCode === "42703" || normalizedCode === "PGRST204" || normalizedCode === "42P01") {
    return true;
  }
  const text = String(message ?? "");
  return (
    /relation .* does not exist/i.test(text) ||
    /could not find the table/i.test(text) ||
    /column .*ai_credit_reservations.*does not exist/i.test(text) ||
    /could not find the '.*' column of 'ai_credit_reservations'/i.test(text)
  );
};

export const isMissingGenerationAttemptSchemaError = (
  code?: string | null,
  message?: string
): boolean => {
  const normalizedCode = String(code ?? "").toUpperCase();
  if (normalizedCode === "42703" || normalizedCode === "PGRST204" || normalizedCode === "42P01") {
    return true;
  }
  const text = String(message ?? "");
  return (
    /relation .* does not exist/i.test(text) ||
    /could not find the table/i.test(text) ||
    /column .*generation_attempts.*does not exist/i.test(text) ||
    /could not find the '.*' column of 'generation_attempts'/i.test(text)
  );
};

export const isMissingRpcFunctionError = (code?: string | null, message?: string): boolean => {
  const normalizedCode = String(code ?? "").toUpperCase();
  if (normalizedCode === "PGRST202" || normalizedCode === "42883") return true;
  return /function .* does not exist/i.test(String(message ?? ""));
};

export const isReservationRpcAmbiguityError = (code?: string | null, message?: string): boolean => {
  const normalizedCode = String(code ?? "").toUpperCase();
  if (normalizedCode === "42702") return true;
  const text = String(message ?? "");
  return /column reference .* is ambiguous/i.test(text);
};

export const isReservationFallbackError = (code?: string | null, message?: string): boolean =>
  isMissingRpcFunctionError(code, message) ||
  isMissingReservationSchemaError(code, message) ||
  isReservationRpcAmbiguityError(code, message);

export const isRecoverableReservationFailure = (result: ReservationRpcResult): boolean => {
  if (result.status !== "failed") return false;
  if (
    result.message === "missing_reservation_function" ||
    result.message === "missing_reservation_schema" ||
    result.message === "reservation_rpc_ambiguous_column"
  ) {
    return true;
  }
  return isReservationFallbackError(result.code ?? null, result.message ?? undefined);
};

export const readErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const candidate = (error as { code?: unknown }).code;
  return typeof candidate === "string" ? candidate : null;
};
