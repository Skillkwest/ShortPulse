/**
 * Owns the server-only database lifecycle for browser-to-storage upload intents.
 * Signed upload URLs and storage tokens are deliberately created by the owning
 * media domain after reservation and are never persisted in this authority.
 */
import { getSupabaseAdmin } from "./supabaseAdmin";

export type MediaUploadIntentPurpose =
  | "media_library"
  | "reference_image"
  | "reference_video"
  | "motion_reference_video"
  | "voice_changer_source"
  | "product_image_asset";

export type MediaUploadIntentKind = "image" | "video" | "audio";
export type MediaUploadIntentStatus = "prepared" | "claimed" | "finalized" | "rejected" | "expired";

export type MediaUploadIntent = {
  id: string;
  userId: string;
  purpose: MediaUploadIntentPurpose;
  mediaKind: MediaUploadIntentKind;
  bucketId: "media_upload_staging";
  stagingPath: string;
  sourceName: string;
  declaredMimeType: string;
  maxBytes: number;
  ownerKind: string | null;
  ownerRef: string | null;
  destinationKind: string | null;
  idempotencyKey: string;
  status: MediaUploadIntentStatus;
  detectedMimeType: string | null;
  actualBytes: number | null;
  inspectionVersion: string | null;
  inspectionResult: string | null;
  expiresAt: string;
};

export class MediaUploadIntentError extends Error {
  constructor(
    public readonly status: 400 | 409 | 410 | 413 | 503,
    public readonly code:
      | "MEDIA_UPLOAD_INTENT_INVALID"
      | "MEDIA_UPLOAD_INTENT_CONFLICT"
      | "MEDIA_UPLOAD_INTENT_EXPIRED"
      | "MEDIA_UPLOAD_INTENT_TOO_LARGE"
      | "MEDIA_UPLOAD_INTENT_UNAVAILABLE",
    message: string
  ) {
    super(message);
    this.name = "MediaUploadIntentError";
  }
}

type IntentRow = Record<string, unknown>;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const asSafeNonNegativeInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

const asNullableString = (value: unknown): string | null =>
  value == null ? null : asNonEmptyString(value);

const parseIntent = (payload: unknown): MediaUploadIntent => {
  const raw = Array.isArray(payload) ? payload[0] : payload;
  if (!raw || typeof raw !== "object") {
    throw new Error("Media upload intent RPC returned an invalid row.");
  }
  const row = raw as IntentRow;
  const id = asNonEmptyString(row.id);
  const userId = asNonEmptyString(row.user_id);
  const purpose = asNonEmptyString(row.purpose) as MediaUploadIntentPurpose;
  const mediaKind = asNonEmptyString(row.media_kind) as MediaUploadIntentKind;
  const bucketId = asNonEmptyString(row.bucket_id);
  const stagingPath = asNonEmptyString(row.staging_path);
  const sourceName = asNonEmptyString(row.source_name);
  const declaredMimeType = asNonEmptyString(row.declared_mime_type);
  const maxBytes = asSafeNonNegativeInteger(row.max_bytes);
  const idempotencyKey = asNonEmptyString(row.idempotency_key);
  const status = asNonEmptyString(row.status) as MediaUploadIntentStatus;
  const actualBytes = row.actual_bytes == null ? null : asSafeNonNegativeInteger(row.actual_bytes);
  const expiresAt = asNonEmptyString(row.expires_at);

  if (
    !id ||
    !userId ||
    ![
      "media_library",
      "reference_image",
      "reference_video",
      "motion_reference_video",
      "voice_changer_source",
      "product_image_asset",
    ].includes(purpose) ||
    !["image", "video", "audio"].includes(mediaKind) ||
    bucketId !== "media_upload_staging" ||
    !stagingPath ||
    !sourceName ||
    !declaredMimeType ||
    maxBytes === null ||
    !idempotencyKey ||
    !["prepared", "claimed", "finalized", "rejected", "expired"].includes(status) ||
    (row.actual_bytes != null && actualBytes === null) ||
    !expiresAt
  ) {
    throw new Error("Media upload intent RPC returned an invalid row.");
  }

  return {
    id,
    userId,
    purpose,
    mediaKind,
    bucketId: "media_upload_staging",
    stagingPath,
    sourceName,
    declaredMimeType,
    maxBytes,
    ownerKind: asNullableString(row.owner_kind),
    ownerRef: asNullableString(row.owner_ref),
    destinationKind: asNullableString(row.destination_kind),
    idempotencyKey,
    status,
    detectedMimeType: asNullableString(row.detected_mime_type),
    actualBytes,
    inspectionVersion: asNullableString(row.inspection_version),
    inspectionResult: asNullableString(row.inspection_result),
    expiresAt,
  };
};

const readRpcErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
};

const mapRpcError = (error: unknown): MediaUploadIntentError => {
  const message = readRpcErrorMessage(error);
  if (message.includes("byte limit exceeded")) {
    return new MediaUploadIntentError(
      413,
      "MEDIA_UPLOAD_INTENT_TOO_LARGE",
      "The uploaded file exceeds its admitted size."
    );
  }
  if (message.includes("expired")) {
    return new MediaUploadIntentError(
      410,
      "MEDIA_UPLOAD_INTENT_EXPIRED",
      "The upload target has expired. Prepare the upload again."
    );
  }
  if (
    message.includes("idempotency conflict") ||
    message.includes("not found") ||
    message.includes("not claimable") ||
    message.includes("not finalizable") ||
    message.includes("not rejectable") ||
    message.includes("not expirable") ||
    message.includes("conflict")
  ) {
    return new MediaUploadIntentError(
      409,
      "MEDIA_UPLOAD_INTENT_CONFLICT",
      "The upload intent no longer matches this operation."
    );
  }
  if (message.includes("Invalid media upload")) {
    return new MediaUploadIntentError(
      400,
      "MEDIA_UPLOAD_INTENT_INVALID",
      "The upload intent request is invalid."
    );
  }
  return new MediaUploadIntentError(
    503,
    "MEDIA_UPLOAD_INTENT_UNAVAILABLE",
    "Upload admission is temporarily unavailable."
  );
};

const requireIntentStatus = (
  intent: MediaUploadIntent,
  expected: MediaUploadIntentStatus
): MediaUploadIntent => {
  if (intent.status === "expired") {
    throw new MediaUploadIntentError(
      410,
      "MEDIA_UPLOAD_INTENT_EXPIRED",
      "The upload target has expired. Prepare the upload again."
    );
  }
  if (intent.status !== expected) {
    throw new MediaUploadIntentError(
      409,
      "MEDIA_UPLOAD_INTENT_CONFLICT",
      "The upload intent no longer matches this operation."
    );
  }
  return intent;
};

const callIntentRpc = async (
  name: string,
  params: Record<string, unknown>
): Promise<MediaUploadIntent> => {
  const { data, error } = await getSupabaseAdmin().rpc(name, params);
  if (error) throw mapRpcError(error);
  try {
    return parseIntent(data);
  } catch {
    throw new MediaUploadIntentError(
      503,
      "MEDIA_UPLOAD_INTENT_UNAVAILABLE",
      "Upload admission is temporarily unavailable."
    );
  }
};

/** Reserves one idempotent, bounded transport target. */
export const reserveMediaUploadIntent = async ({
  userId,
  purpose,
  mediaKind,
  sourceName,
  declaredMimeType,
  maxBytes,
  ownerKind = null,
  ownerRef = null,
  destinationKind = null,
  idempotencyKey,
  ttlSeconds = 7200,
}: {
  userId: string;
  purpose: MediaUploadIntentPurpose;
  mediaKind: MediaUploadIntentKind;
  sourceName: string;
  declaredMimeType: string;
  maxBytes: number;
  ownerKind?: string | null;
  ownerRef?: string | null;
  destinationKind?: string | null;
  idempotencyKey: string;
  ttlSeconds?: number;
}): Promise<MediaUploadIntent> => {
  const intent = await callIntentRpc("reserve_media_upload_intent", {
    p_user_id: userId,
    p_purpose: purpose,
    p_media_kind: mediaKind,
    p_source_name: sourceName,
    p_declared_mime_type: declaredMimeType,
    p_max_bytes: Math.trunc(maxBytes),
    p_owner_kind: ownerKind,
    p_owner_ref: ownerRef,
    p_destination_kind: destinationKind,
    p_idempotency_key: idempotencyKey,
    p_ttl_seconds: Math.trunc(ttlSeconds),
  });
  return requireIntentStatus(intent, "prepared");
};

/** Atomically claims a prepared intent; only one concurrent claimant can win. */
export const claimMediaUploadIntent = async ({
  intentId,
  userId,
  purpose,
  stagingPath,
}: {
  intentId: string;
  userId: string;
  purpose: MediaUploadIntentPurpose;
  stagingPath: string;
}): Promise<MediaUploadIntent> => {
  const intent = await callIntentRpc("claim_media_upload_intent", {
    p_intent_id: intentId,
    p_user_id: userId,
    p_purpose: purpose,
    p_staging_path: stagingPath,
  });
  return requireIntentStatus(intent, "claimed");
};

/** Finalizes a claimed intent with sanitized inspection facts only. */
export const finalizeMediaUploadIntent = async ({
  intentId,
  userId,
  purpose,
  stagingPath,
  detectedMimeType,
  actualBytes,
  inspectionVersion,
}: {
  intentId: string;
  userId: string;
  purpose: MediaUploadIntentPurpose;
  stagingPath: string;
  detectedMimeType: string;
  actualBytes: number;
  inspectionVersion: string;
}): Promise<MediaUploadIntent> => {
  const intent = await callIntentRpc("finalize_media_upload_intent", {
    p_intent_id: intentId,
    p_user_id: userId,
    p_purpose: purpose,
    p_staging_path: stagingPath,
    p_detected_mime_type: detectedMimeType,
    p_actual_bytes: Math.trunc(actualBytes),
    p_inspection_version: inspectionVersion,
  });
  return requireIntentStatus(intent, "finalized");
};

/** Rejects prepared or claimed bytes using a bounded machine-readable reason. */
export const rejectMediaUploadIntent = async ({
  intentId,
  userId,
  purpose,
  stagingPath,
  reasonCode,
  detectedMimeType = null,
  actualBytes = null,
  inspectionVersion = null,
}: {
  intentId: string;
  userId: string;
  purpose: MediaUploadIntentPurpose;
  stagingPath: string;
  reasonCode: string;
  detectedMimeType?: string | null;
  actualBytes?: number | null;
  inspectionVersion?: string | null;
}): Promise<MediaUploadIntent> => {
  const intent = await callIntentRpc("reject_media_upload_intent", {
    p_intent_id: intentId,
    p_user_id: userId,
    p_purpose: purpose,
    p_staging_path: stagingPath,
    p_reason_code: reasonCode,
    p_detected_mime_type: detectedMimeType,
    p_actual_bytes: actualBytes == null ? null : Math.trunc(actualBytes),
    p_inspection_version: inspectionVersion,
  });
  return requireIntentStatus(intent, "rejected");
};

/** Marks an elapsed prepared or claimed intent expired. */
export const expireMediaUploadIntent = async ({
  intentId,
  userId,
}: {
  intentId: string;
  userId: string;
}): Promise<MediaUploadIntent> =>
  callIntentRpc("expire_media_upload_intent", {
    p_intent_id: intentId,
    p_user_id: userId,
  });
