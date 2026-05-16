type ResponseLike = {
  status: number;
  headers?: Pick<Headers, "get"> | null;
};

const parsePositiveInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.trunc(value));
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return Math.max(1, parsed);
  }
  return null;
};

const readAdmissionRetryAfterSeconds = (
  response: ResponseLike,
  payload: unknown
): number | null => {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const value = parsePositiveInteger((payload as Record<string, unknown>).retryAfterSeconds);
    if (value !== null) return value;
  }
  const header = response.headers?.get?.("Retry-After") ?? null;
  return parsePositiveInteger(header);
};

const readAdmissionScope = (payload: unknown): "shared_provider" | "per_user" | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).admissionScope;
  return value === "shared_provider" || value === "per_user" ? value : null;
};

export const readGenerationAdmissionErrorMessage = (
  response: ResponseLike,
  payload: unknown
): string | null => {
  if (response.status !== 429 && response.status !== 503) return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const code = typeof data.code === "string" ? data.code : "";
  if (code !== "GENERATION_ADMISSION_LIMIT" && code !== "GENERATION_ADMISSION_UNAVAILABLE") {
    return null;
  }
  const retryAfterSeconds = readAdmissionRetryAfterSeconds(response, payload);
  if (code === "GENERATION_ADMISSION_UNAVAILABLE") {
    if (retryAfterSeconds === null) {
      return "Generation admission is temporarily unavailable. Please retry shortly.";
    }
    return `Generation admission is temporarily unavailable. Please retry in ${retryAfterSeconds} seconds.`;
  }
  const admissionScope = readAdmissionScope(payload);
  if (admissionScope === "shared_provider") {
    if (retryAfterSeconds === null) {
      return "Shared generation capacity is busy right now. Please retry shortly.";
    }
    return `Shared generation capacity is busy right now. Please retry in ${retryAfterSeconds} seconds.`;
  }
  if (admissionScope === "per_user") {
    if (retryAfterSeconds === null) {
      return "You already have too many active generations. Please retry shortly.";
    }
    return `You already have too many active generations. Please retry in ${retryAfterSeconds} seconds.`;
  }
  if (retryAfterSeconds === null) {
    return "Too many active generations. Please retry shortly.";
  }
  return `Too many active generations. Please retry in ${retryAfterSeconds} seconds.`;
};
