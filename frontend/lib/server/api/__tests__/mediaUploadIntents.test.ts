import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimMediaUploadIntent,
  expireMediaUploadIntent,
  finalizeMediaUploadIntent,
  MediaUploadIntentError,
  rejectMediaUploadIntent,
  reserveMediaUploadIntent,
} from "../mediaUploadIntents";

const rpcMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

const row = {
  id: "intent-1",
  user_id: "user-1",
  purpose: "media_library",
  media_kind: "image",
  bucket_id: "media_upload_staging",
  staging_path: "user-1/intent-1/object",
  source_name: "photo.jpg",
  declared_mime_type: "image/jpeg",
  max_bytes: 25_000_000,
  owner_kind: null,
  owner_ref: null,
  destination_kind: "uploaded_images",
  idempotency_key: "request-1",
  status: "prepared",
  detected_mime_type: null,
  actual_bytes: null,
  inspection_version: null,
  inspection_result: null,
  expires_at: "2026-07-11T17:00:00.000Z",
};

describe("mediaUploadIntents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({ data: row, error: null });
  });

  it("reserves only bounded transport metadata without tokens or provider authority", async () => {
    await expect(
      reserveMediaUploadIntent({
        userId: "user-1",
        purpose: "media_library",
        mediaKind: "image",
        sourceName: "photo.jpg",
        declaredMimeType: "image/jpeg",
        maxBytes: 25_000_000,
        destinationKind: "uploaded_images",
        idempotencyKey: "request-1",
      })
    ).resolves.toMatchObject({
      id: "intent-1",
      bucketId: "media_upload_staging",
      status: "prepared",
    });

    expect(rpcMock).toHaveBeenCalledWith("reserve_media_upload_intent", {
      p_user_id: "user-1",
      p_purpose: "media_library",
      p_media_kind: "image",
      p_source_name: "photo.jpg",
      p_declared_mime_type: "image/jpeg",
      p_max_bytes: 25_000_000,
      p_owner_kind: null,
      p_owner_ref: null,
      p_destination_kind: "uploaded_images",
      p_idempotency_key: "request-1",
      p_ttl_seconds: 7200,
    });
    expect(JSON.stringify(rpcMock.mock.calls[0])).not.toMatch(
      /signed|token|provider|credit|billing/i
    );
  });

  it("claims through the atomic RPC and rejects an expired returned row", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ...row, status: "claimed" },
      error: null,
    });
    await expect(
      claimMediaUploadIntent({
        intentId: "intent-1",
        userId: "user-1",
        purpose: "media_library",
        stagingPath: "user-1/intent-1/object",
      })
    ).resolves.toMatchObject({ status: "claimed" });
    expect(rpcMock).toHaveBeenCalledWith("claim_media_upload_intent", {
      p_intent_id: "intent-1",
      p_user_id: "user-1",
      p_purpose: "media_library",
      p_staging_path: "user-1/intent-1/object",
    });

    rpcMock.mockResolvedValueOnce({
      data: { ...row, status: "expired" },
      error: null,
    });
    await expect(
      claimMediaUploadIntent({
        intentId: "intent-1",
        userId: "user-1",
        purpose: "media_library",
        stagingPath: "user-1/intent-1/object",
      })
    ).rejects.toMatchObject({
      status: 410,
      code: "MEDIA_UPLOAD_INTENT_EXPIRED",
    } satisfies Partial<MediaUploadIntentError>);
  });

  it("does not let idempotent reservation reuse sign a terminal intent", async () => {
    rpcMock.mockResolvedValueOnce({ data: { ...row, status: "expired" }, error: null });
    await expect(
      reserveMediaUploadIntent({
        userId: "user-1",
        purpose: "media_library",
        mediaKind: "image",
        sourceName: "photo.jpg",
        declaredMimeType: "image/jpeg",
        maxBytes: 25_000_000,
        idempotencyKey: "request-1",
      })
    ).rejects.toMatchObject({ status: 410, code: "MEDIA_UPLOAD_INTENT_EXPIRED" });
  });

  it("finalizes and rejects with sanitized inspection facts", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        ...row,
        status: "finalized",
        detected_mime_type: "image/jpeg",
        actual_bytes: 2048,
        inspection_version: "media-v1",
        inspection_result: "accepted",
      },
      error: null,
    });
    await finalizeMediaUploadIntent({
      intentId: "intent-1",
      userId: "user-1",
      purpose: "media_library",
      stagingPath: "user-1/intent-1/object",
      detectedMimeType: "image/jpeg",
      actualBytes: 2048,
      inspectionVersion: "media-v1",
    });
    expect(rpcMock).toHaveBeenLastCalledWith("finalize_media_upload_intent", {
      p_intent_id: "intent-1",
      p_user_id: "user-1",
      p_purpose: "media_library",
      p_staging_path: "user-1/intent-1/object",
      p_detected_mime_type: "image/jpeg",
      p_actual_bytes: 2048,
      p_inspection_version: "media-v1",
    });

    rpcMock.mockResolvedValueOnce({
      data: { ...row, status: "rejected", inspection_result: "signature_mismatch" },
      error: null,
    });
    await rejectMediaUploadIntent({
      intentId: "intent-1",
      userId: "user-1",
      purpose: "media_library",
      stagingPath: "user-1/intent-1/object",
      reasonCode: "signature_mismatch",
      detectedMimeType: "application/octet-stream",
      actualBytes: 1024,
      inspectionVersion: "media-v1",
    });
    expect(rpcMock).toHaveBeenLastCalledWith("reject_media_upload_intent", {
      p_intent_id: "intent-1",
      p_user_id: "user-1",
      p_purpose: "media_library",
      p_staging_path: "user-1/intent-1/object",
      p_reason_code: "signature_mismatch",
      p_detected_mime_type: "application/octet-stream",
      p_actual_bytes: 1024,
      p_inspection_version: "media-v1",
    });
  });

  it("expires via the server-only lifecycle RPC", async () => {
    rpcMock.mockResolvedValueOnce({ data: { ...row, status: "expired" }, error: null });
    await expect(
      expireMediaUploadIntent({ intentId: "intent-1", userId: "user-1" })
    ).resolves.toMatchObject({ status: "expired" });
    expect(rpcMock).toHaveBeenCalledWith("expire_media_upload_intent", {
      p_intent_id: "intent-1",
      p_user_id: "user-1",
    });
  });

  it("fails closed and maps conflicts, expiry, and byte-limit errors", async () => {
    for (const [message, expected] of [
      [
        "Media upload intent is not claimable.",
        { status: 409, code: "MEDIA_UPLOAD_INTENT_CONFLICT" },
      ],
      ["Media upload intent not found.", { status: 409, code: "MEDIA_UPLOAD_INTENT_CONFLICT" }],
      ["Media upload intent is expired.", { status: 410, code: "MEDIA_UPLOAD_INTENT_EXPIRED" }],
      [
        "Media upload intent byte limit exceeded.",
        { status: 413, code: "MEDIA_UPLOAD_INTENT_TOO_LARGE" },
      ],
      ["database unavailable", { status: 503, code: "MEDIA_UPLOAD_INTENT_UNAVAILABLE" }],
    ] as const) {
      rpcMock.mockResolvedValueOnce({ data: null, error: { message } });
      await expect(
        expireMediaUploadIntent({ intentId: "intent-1", userId: "user-1" })
      ).rejects.toMatchObject(expected);
    }

    rpcMock.mockResolvedValueOnce({ data: { id: "partial" }, error: null });
    await expect(
      expireMediaUploadIntent({ intentId: "intent-1", userId: "user-1" })
    ).rejects.toMatchObject({ status: 503, code: "MEDIA_UPLOAD_INTENT_UNAVAILABLE" });
  });
});
