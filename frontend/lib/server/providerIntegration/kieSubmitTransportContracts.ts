/**
 * Kie submit transport contract helpers.
 * Normalizes logical response outcomes when HTTP transport status and Kie body status diverge.
 */

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length || !/^-?\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
};

const isHttpStatusCode = (value: number): boolean => value >= 100 && value <= 599;

const readKieBodyCode = (payload: JsonObject): number | null => {
  const rootCode = asNumber(payload.code);
  if (rootCode !== null) return rootCode;
  const dataCode = asNumber(asObject(payload.data).code);
  if (dataCode !== null) return dataCode;
  return asNumber(asObject(payload.result).code);
};

const resolveLogicalStatus = ({
  responseStatus,
  bodyCode,
}: {
  responseStatus: number;
  bodyCode: number | null;
}): number => {
  if (responseStatus < 200 || responseStatus >= 300) return responseStatus;
  if (bodyCode === null || bodyCode === 200) return responseStatus;
  if (!isHttpStatusCode(bodyCode)) return responseStatus;
  return bodyCode;
};

/**
 * Applies Kie logical status normalization to submit responses.
 */
export const normalizeKieSubmitTransportResult = ({
  response,
  data,
}: {
  response: Response;
  data: JsonObject;
}): {
  response: Response;
  data: JsonObject;
  bodyCode: number | null;
  logicalStatus: number;
} => {
  const bodyCode = readKieBodyCode(data);
  const logicalStatus = resolveLogicalStatus({
    responseStatus: response.status,
    bodyCode,
  });
  if (logicalStatus === response.status) {
    return { response, data, bodyCode, logicalStatus };
  }
  return {
    response: new Response(JSON.stringify(data), {
      status: logicalStatus,
      headers: new Headers(response.headers),
    }),
    data,
    bodyCode,
    logicalStatus,
  };
};
