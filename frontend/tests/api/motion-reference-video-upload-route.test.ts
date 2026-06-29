/**
 * API coverage for browser-direct Motion Control reference-video staging routes.
 * Verifies signed target creation, staged-byte validation, final storage, and cleanup.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareHandler from "../../pages/api/media/prepare-motion-reference-video-upload";
import stageHandler from "../../pages/api/media/stage-motion-reference-video";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const getMediaComplianceAcceptanceStatusForUserMock = vi.fn();
const retireMotionReferenceVideoStoragePathForUserMock = vi.fn();
const normalizeMotionReferenceVideoForProviderMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/mediaComplianceAcceptance", () => ({
  getMediaComplianceAcceptanceStatusForUser: (...args: unknown[]) =>
    getMediaComplianceAcceptanceStatusForUserMock(...args),
  isMediaComplianceUnavailableError: (error: unknown) =>
    Boolean(
      error &&
      typeof error === "object" &&
      (error as { code?: unknown }).code === "MEDIA_COMPLIANCE_UNAVAILABLE"
    ),
}));

vi.mock("../../lib/server/motionReferenceVideoAssetLease", () => ({
  retireMotionReferenceVideoStoragePathForUser: (...args: unknown[]) =>
    retireMotionReferenceVideoStoragePathForUserMock(...args),
}));

vi.mock("../../lib/server/motionReferenceVideoNormalization", () => ({
  MotionReferenceVideoNormalizationError: class MotionReferenceVideoNormalizationError extends Error {
    readonly status: number;
    readonly details?: string;

    constructor(status: number, message: string, details?: string) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
  normalizeMotionReferenceVideoForProvider: (...args: unknown[]) =>
    normalizeMotionReferenceVideoForProviderMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  end: vi.fn().mockReturnThis(),
});

const buildWebmVideoTrackSignature = (): Buffer =>
  Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x18, 0x53, 0x80, 0x67,
    0x8a, 0x16, 0x54, 0xae, 0x6b, 0x85, 0xae, 0x83, 0x83, 0x81, 0x01,
  ]);

describe("motion reference video direct-upload routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    getMediaComplianceAcceptanceStatusForUserMock.mockResolvedValue({
      accepted: true,
      acceptedAt: "2026-06-29T00:00:00.000Z",
    });
    retireMotionReferenceVideoStoragePathForUserMock.mockResolvedValue({
      deleted: false,
      waitingOnLease: true,
    });
    normalizeMotionReferenceVideoForProviderMock.mockImplementation(
      async ({
        buffer,
        filename,
        mimeType,
      }: {
        buffer: Buffer;
        filename: string;
        mimeType: string;
      }) => ({
        buffer,
        filename,
        mimeType,
      })
    );
  });

  it("prepares a signed upload target for codec-bearing WebM recordings", async () => {
    const createSignedUploadUrlMock = vi.fn(async (path: string) => ({
      data: {
        path,
        token: "upload-token",
      },
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUploadUrl: createSignedUploadUrlMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        sourceName: "motion-reference.webm",
        sourceMimeType: "video/webm;codecs=vp9,opus",
      },
    };
    const res = createMockResponse();

    await prepareHandler(req as never, res as never);

    expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^user-1\/upload-staging\/videos\/motion-control\/.*motion-reference\.webm$/
      )
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      target: {
        storagePath: expect.stringMatching(
          /^user-1\/upload-staging\/videos\/motion-control\/.*motion-reference\.webm$/
        ),
        uploadToken: "upload-token",
        mimeType: "video/webm",
        name: "motion-reference.webm",
      },
    });
  });

  it("stages a prepared WebM clip as a provider-ready MP4 motion source", async () => {
    const rawBody = buildWebmVideoTrackSignature();
    const normalizedBody = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftypmp42", "ascii"),
    ]);
    normalizeMotionReferenceVideoForProviderMock.mockResolvedValueOnce({
      buffer: normalizedBody,
      filename: "motion-reference.mp4",
      mimeType: "video/mp4",
    });
    const uploadMock = vi.fn(async () => ({ error: null }));
    const removeMock = vi.fn(async () => ({ data: [], error: null }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: {
        signedUrl: "https://signed.example/motion-video",
      },
      error: null,
    }));
    const downloadMock = vi.fn(async () => ({
      data: {
        size: rawBody.length,
        type: "video/webm",
        arrayBuffer: async () =>
          rawBody.buffer.slice(rawBody.byteOffset, rawBody.byteOffset + rawBody.byteLength),
      },
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: downloadMock,
          upload: uploadMock,
          createSignedUrl: createSignedUrlMock,
          remove: removeMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        sourceName: "motion-reference.webm",
        sourceMimeType: "video/webm;codecs=vp9,opus",
        sourceStoragePath: "user-1/upload-staging/videos/motion-control/staged.webm",
      },
    };
    const res = createMockResponse();

    await stageHandler(req as never, res as never);

    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(downloadMock).toHaveBeenCalledWith(
      "user-1/upload-staging/videos/motion-control/staged.webm"
    );
    expect(normalizeMotionReferenceVideoForProviderMock).toHaveBeenCalledWith({
      buffer: rawBody,
      filename: "motion-reference.webm",
      mimeType: "video/webm",
    });
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/videos\/motion-control\/.*motion-reference\.mp4$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/mp4", upsert: false })
    );
    expect(removeMock).toHaveBeenCalledWith([
      "user-1/upload-staging/videos/motion-control/staged.webm",
    ]);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://signed.example/motion-video",
      path: expect.stringMatching(/^user-1\/videos\/motion-control\/.*motion-reference\.mp4$/),
      size: normalizedBody.length,
      mimeType: "video/mp4",
      name: "motion-reference.mp4",
    });
  });

  it("deletes stale motion-reference clips through the canonical media route", async () => {
    const removeMock = vi.fn(async () => ({ data: [], error: null }));
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          remove: removeMock,
        })),
      },
    });

    const req = {
      method: "DELETE",
      body: {
        path: "user-1/videos/motion-control/stale.mp4",
        mode: "stale",
      },
    };
    const res = createMockResponse();

    await stageHandler(req as never, res as never);

    expect(removeMock).toHaveBeenCalledWith(["user-1/videos/motion-control/stale.mp4"]);
    expect(retireMotionReferenceVideoStoragePathForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it("retires committed motion-reference clips through generation leases", async () => {
    const req = {
      method: "DELETE",
      body: {
        path: "user-1/videos/motion-control/committed.mp4",
        mode: "retire",
      },
    };
    const res = createMockResponse();

    await stageHandler(req as never, res as never);

    expect(retireMotionReferenceVideoStoragePathForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      storagePath: "user-1/videos/motion-control/committed.mp4",
    });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});
