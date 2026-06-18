import { describe, expect, it, vi } from "vitest";
import {
  fetchMediaListPage,
  isMediaListRequestErrorCode,
  MEDIA_LIST_AUTH_REQUIRED_CODE,
  MEDIA_LIST_SERVER_ERROR_CODE,
} from "../mediaListApi";

describe("fetchMediaListPage", () => {
  it("opts media-list panel requests into the authenticated fetch network retry", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          rows: [],
          nextCursor: null,
          hasMore: false,
          signedById: {},
          libraryTotalCount: 0,
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        }
      );
    });

    await fetchMediaListPage({
      cursor: null,
      folderId: "all_items",
      includeLibraryTotalCount: true,
      limit: 36,
      mediaKind: "images",
      profile: "minimal",
      query: "",
      surface: "media-library-panel",
      tab: null,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/media/list",
      expect.objectContaining({
        shortpulseLogScope: "app",
        shortpulseRetryNetworkOnce: true,
      })
    );
    const requestOptions = (fetcher.mock.calls as unknown as Array<[string, RequestInit]>)[0]?.[1];
    const requestBody = JSON.parse(String(requestOptions?.body ?? "{}")) as Record<string, unknown>;
    expect(requestBody.projectId).toBeUndefined();
  });

  it("surfaces auth-required failures as classified media-list errors", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          headers: { "Content-Type": "application/json" },
          status: 401,
        })
    );

    await expect(
      fetchMediaListPage({
        cursor: null,
        limit: 36,
        query: "",
        surface: "media-library-panel",
        fetcher,
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(isMediaListRequestErrorCode(error, MEDIA_LIST_AUTH_REQUIRED_CODE)).toBe(true);
      expect((error as { status?: number }).status).toBe(401);
      return true;
    });
  });

  it("surfaces server failures as classified media-list errors", async () => {
    const fetcher = vi.fn(async () => new Response("server broke", { status: 500 }));

    await expect(
      fetchMediaListPage({
        cursor: null,
        limit: 36,
        query: "",
        surface: "media-library-panel",
        fetcher,
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(isMediaListRequestErrorCode(error, MEDIA_LIST_SERVER_ERROR_CODE)).toBe(true);
      expect((error as { status?: number }).status).toBe(500);
      return true;
    });
  });
});
