import { act, renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveMediaPreviewCandidates,
  resolveMediaStoragePathCandidate,
} from "../../../../lib/mediaPreviewPath";
import { useMediaPreviewRecoveryController } from "../useMediaPreviewRecoveryController";

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  classifyMediaPreviewPath: vi.fn(() => "unknown"),
  resolveMediaPreviewCandidates: vi.fn(),
  resolveMediaStoragePathCandidate: vi.fn(),
}));

const resolveMediaPreviewCandidatesMock = vi.mocked(resolveMediaPreviewCandidates);
const resolveMediaStoragePathCandidateMock = vi.mocked(resolveMediaStoragePathCandidate);

type Row = {
  id: string;
  storage_path: string;
  file_type: string;
  source?: string | null;
  signedUrl?: string | null;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: "row-1",
  storage_path: "user-1/upload/one.png",
  file_type: "image/png",
  source: "upload",
  ...overrides,
});

describe("useMediaPreviewRecoveryController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveMediaPreviewCandidatesMock.mockImplementation(
      (row: { storage_path?: string | null }) => ({
        storagePaths: row.storage_path ? [row.storage_path] : [],
        directUrl: null,
      })
    );
    resolveMediaStoragePathCandidateMock.mockImplementation((value: unknown) => {
      if (typeof value !== "string") return null;
      const match = value.match(/path=([^&]+)/);
      if (match?.[1]) return decodeURIComponent(match[1]);
      return value;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes signed url and revokes stale object urls", async () => {
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", {
      revokeObjectURL: revokeObjectUrl,
    });
    const applySignedUrlsToTab = vi.fn();
    const signStoragePath = vi.fn(async () => "https://signed.example.com/one.png");

    const { result } = renderHook(() => {
      const currentUserIdRef = useRef<string | null>("user-1");
      const signedUrlRetryRef = useRef<Record<string, number>>({});
      const objectUrlByMediaIdRef = useRef<Record<string, string>>({
        "row-1": "blob://old-url",
      });
      return {
        controller: useMediaPreviewRecoveryController<Row>({
          applySignedUrlsToTab,
          currentUserIdRef,
          resolveSignedUrlsByMediaIds: vi.fn(async () => new Set<string>()),
          hydrateViaStorageDownload: vi.fn(async () => null),
          signStoragePath,
          signedUrlRetryRef,
          objectUrlByMediaIdRef,
          resolveTabForRow: () => "uploaded_images",
        }),
      };
    });

    const refreshed = await result.current.controller.refreshSignedUrl(makeRow());

    expect(signStoragePath).toHaveBeenCalledWith("user-1/upload/one.png", {
      forceRefresh: true,
      previewProfile: "none",
    });
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob://old-url");
    expect(applySignedUrlsToTab).toHaveBeenCalledWith(
      "uploaded_images",
      new Map([["row-1", "https://signed.example.com/one.png"]])
    );
    expect(refreshed).toBe("https://signed.example.com/one.png");
  });

  it("runs beforeRetry but stops retries once cap is reached", async () => {
    const beforeRetry = vi.fn();
    const signStoragePath = vi.fn(async () => null);
    const hydrateViaStorageDownload = vi.fn(async () => null);

    const { result } = renderHook(() => {
      const currentUserIdRef = useRef<string | null>("user-1");
      const signedUrlRetryRef = useRef<Record<string, number>>({
        "row-1": 3,
      });
      const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
      return {
        controller: useMediaPreviewRecoveryController<Row>({
          applySignedUrlsToTab: vi.fn(),
          currentUserIdRef,
          resolveSignedUrlsByMediaIds: vi.fn(async () => new Set<string>(["row-1"])),
          hydrateViaStorageDownload,
          signStoragePath,
          signedUrlRetryRef,
          objectUrlByMediaIdRef,
          resolveTabForRow: () => "uploaded_images",
          beforeRetry,
        }),
      };
    });

    act(() => {
      result.current.controller.handleMediaPreviewError(
        makeRow(),
        "https://failed.example.com/one.png"
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(beforeRetry).toHaveBeenCalledTimes(1);
    expect(signStoragePath).not.toHaveBeenCalled();
    expect(hydrateViaStorageDownload).not.toHaveBeenCalled();
  });

  it("applies a better trusted direct preview url before signing recovery", async () => {
    resolveMediaPreviewCandidatesMock.mockReturnValue({
      storagePaths: ["user-1/upload/one.png"],
      directUrl: "https://cdn.example.com/previews/one.png",
    });
    const applySignedUrlsToTab = vi.fn();
    const signStoragePath = vi.fn(async () => "https://signed.example.com/one.png");
    const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
    const hydrateViaStorageDownload = vi.fn(async () => null);

    const { result } = renderHook(() => {
      const currentUserIdRef = useRef<string | null>("user-1");
      const signedUrlRetryRef = useRef<Record<string, number>>({});
      const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
      return {
        controller: useMediaPreviewRecoveryController<Row>({
          applySignedUrlsToTab,
          currentUserIdRef,
          resolveSignedUrlsByMediaIds,
          hydrateViaStorageDownload,
          signStoragePath,
          signedUrlRetryRef,
          objectUrlByMediaIdRef,
          resolveTabForRow: () => "uploaded_images",
        }),
        signedUrlRetryRef,
      };
    });

    act(() => {
      result.current.controller.handleMediaPreviewError(
        makeRow({ signedUrl: "https://signed.example.com/stale.png" }),
        "https://signed.example.com/stale.png"
      );
    });

    await waitFor(() => {
      expect(applySignedUrlsToTab).toHaveBeenCalledWith(
        "uploaded_images",
        new Map([["row-1", "https://cdn.example.com/previews/one.png"]])
      );
    });
    expect(signStoragePath).not.toHaveBeenCalled();
    expect(resolveSignedUrlsByMediaIds).not.toHaveBeenCalled();
    expect(hydrateViaStorageDownload).not.toHaveBeenCalled();
    expect(result.current.signedUrlRetryRef.current["row-1"]).toBeUndefined();
  });

  it("hydrates unresolved media after retry refresh misses", async () => {
    const signStoragePath = vi.fn(async () => null);
    const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>(["row-1"]));
    const hydrateViaStorageDownload = vi.fn(async () => "blob://downloaded");

    const { result } = renderHook(() => {
      const currentUserIdRef = useRef<string | null>("user-1");
      const signedUrlRetryRef = useRef<Record<string, number>>({});
      const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
      return {
        controller: useMediaPreviewRecoveryController<Row>({
          applySignedUrlsToTab: vi.fn(),
          currentUserIdRef,
          resolveSignedUrlsByMediaIds,
          hydrateViaStorageDownload,
          signStoragePath,
          signedUrlRetryRef,
          objectUrlByMediaIdRef,
          resolveTabForRow: () => "uploaded_images",
        }),
        signedUrlRetryRef,
      };
    });

    act(() => {
      result.current.controller.handleMediaPreviewError(makeRow());
    });

    await waitFor(() => {
      expect(hydrateViaStorageDownload).toHaveBeenCalledTimes(1);
    });
    expect(resolveSignedUrlsByMediaIds).toHaveBeenCalledWith("uploaded_images", [makeRow()]);
    expect(result.current.signedUrlRetryRef.current["row-1"]).toBe(1);
  });

  it("hydrates immediately when refresh only re-signs the same failing storage path", async () => {
    const signStoragePath = vi.fn(
      async () => "https://signed.example.com/object?path=user-1/upload/one.png&token=fresh"
    );
    const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
    const hydrateViaStorageDownload = vi.fn(async () => "blob://downloaded");

    const { result } = renderHook(() => {
      const currentUserIdRef = useRef<string | null>("user-1");
      const signedUrlRetryRef = useRef<Record<string, number>>({});
      const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
      return {
        controller: useMediaPreviewRecoveryController<Row>({
          applySignedUrlsToTab: vi.fn(),
          currentUserIdRef,
          resolveSignedUrlsByMediaIds,
          hydrateViaStorageDownload,
          signStoragePath,
          signedUrlRetryRef,
          objectUrlByMediaIdRef,
          resolveTabForRow: () => "uploaded_images",
        }),
      };
    });

    act(() => {
      result.current.controller.handleMediaPreviewError(
        makeRow({
          signedUrl: "https://signed.example.com/object?path=user-1/upload/one.png&token=stale",
        }),
        "https://signed.example.com/object?path=user-1/upload/one.png&token=failed"
      );
    });

    await waitFor(() => {
      expect(hydrateViaStorageDownload).toHaveBeenCalledTimes(1);
    });
    expect(resolveSignedUrlsByMediaIds).not.toHaveBeenCalled();
  });
});
