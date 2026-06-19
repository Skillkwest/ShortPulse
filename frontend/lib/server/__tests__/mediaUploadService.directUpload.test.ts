import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { prepareMediaUploadForUser } from "../mediaUploadService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

describe("prepareMediaUploadForUser", () => {
  const createSignedUploadUrlMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUploadUrl: createSignedUploadUrlMock,
        })),
      },
    } as never);
  });

  it("returns the server-scoped signed upload path", async () => {
    createSignedUploadUrlMock.mockImplementation(async (storagePath: string) => ({
      data: {
        path: storagePath,
        token: "upload-token",
      },
      error: null,
    }));

    const target = await prepareMediaUploadForUser({
      userId: "user-1",
      destinationTab: "uploaded_images",
      filename: "reference.webp",
      declaredMimeType: "image/webp",
    });

    expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/upload-staging\/uploaded_images\/.*reference\.webp$/)
    );
    expect(target).toEqual({
      path: expect.stringMatching(/^user-1\/upload-staging\/uploaded_images\/.*reference\.webp$/),
      token: "upload-token",
      mimeType: "image/webp",
      name: "reference.webp",
    });
  });

  it("fails closed when the signed upload path differs from the requested path", async () => {
    createSignedUploadUrlMock.mockResolvedValueOnce({
      data: {
        path: "user-2/upload-staging/uploaded_images/reference.webp",
        token: "upload-token",
      },
      error: null,
    });

    await expect(
      prepareMediaUploadForUser({
        userId: "user-1",
        destinationTab: "uploaded_images",
        filename: "reference.webp",
        declaredMimeType: "image/webp",
      })
    ).rejects.toMatchObject({
      status: 500,
      message: "Unable to prepare media upload",
      details: "Signed upload target path did not match requested storage path.",
    });
  });
});
