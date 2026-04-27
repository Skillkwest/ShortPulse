import { act, renderHook, waitFor } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaPreviewSigningController } from "../useMediaPreviewSigningController";
import { createMediaPerfTimer, logMediaPerf } from "../../../../lib/mediaPerfTelemetry";
import {
  classifyMediaPreviewPath,
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../../../../lib/mediaPreviewPath";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import { createMediaTabBooleanState, type MediaDataTab } from "../../logic/mediaLibraryPageHelpers";
import type { MediaTab } from "../../logic/mediaMoveRouting";

vi.mock("../../../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: vi.fn(),
  logMediaPerf: vi.fn(),
}));

vi.mock("../../../../lib/mediaPreviewPath", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/mediaPreviewPath")>();
  return {
    ...actual,
    classifyMediaPreviewPath: vi.fn(actual.classifyMediaPreviewPath),
    resolveMediaDirectPreviewUrls: vi.fn(),
    resolveMediaSigningStoragePaths: vi.fn(),
  };
});

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
}));

const createMediaPerfTimerMock = vi.mocked(createMediaPerfTimer);
const logMediaPerfMock = vi.mocked(logMediaPerf);
const classifyMediaPreviewPathMock = vi.mocked(classifyMediaPreviewPath);
const resolveMediaDirectPreviewUrlsMock = vi.mocked(resolveMediaDirectPreviewUrls);
const resolveMediaSigningStoragePathsMock = vi.mocked(resolveMediaSigningStoragePaths);
const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);

type Row = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source?: string | null;
  status?: "uploading" | "ready";
  signedUrl?: string;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: "row-1",
  filename: "first.png",
  storage_path: "user/images/first.png",
  file_type: "image/png",
  source: "upload",
  status: "ready",
  ...overrides,
});

describe("useMediaPreviewSigningController", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    createMediaPerfTimerMock.mockReturnValue(vi.fn());
    classifyMediaPreviewPathMock.mockImplementation((row, resolvedPath) => {
      const normalizedResolvedPath = typeof resolvedPath === "string" ? resolvedPath.trim() : "";
      const thumbVariantPath =
        row && typeof row === "object" && "thumb_variant_path" in row
          ? (row.thumb_variant_path as string | null | undefined)
          : null;
      const storagePath =
        row && typeof row === "object" && "storage_path" in row
          ? (row.storage_path as string | null | undefined)
          : null;
      if (thumbVariantPath && normalizedResolvedPath === thumbVariantPath) return "durable";
      if (storagePath && normalizedResolvedPath === storagePath) return "original";
      return "unknown";
    });
    resolveMediaSigningStoragePathsMock.mockImplementation(
      (row: { storage_path?: string | null }) => [row.storage_path ?? ""]
    );
    resolveMediaDirectPreviewUrlsMock.mockReturnValue([]);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("signs unresolved rows and applies signed URLs to the active tab without self-pulsing a completed pass", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/images/first.png", "https://signed/first"]])
    );
    const applySpy = vi.fn();
    const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
    const hydrateViaStorageDownload = vi.fn(async () => null);

    const { result } = renderHook(() => {
      const [rows, setRows] = useState<Row[]>([makeRow()]);
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(true);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1"]));

      const applySignedUrlsToTab = useCallback(
        (tab: MediaDataTab, signedById: Map<string, string>) => {
          applySpy(tab, signedById);
          setRows((prev) =>
            prev.map((row) => {
              const signedUrl = signedById.get(row.id);
              return signedUrl ? { ...row, signedUrl } : row;
            })
          );
        },
        []
      );

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 1,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 2, prefetchWindow: 2, signBatchSize: 2 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 0,
      });

      return {
        rows,
        signAttemptRef,
        signPassNonce,
      };
    });

    await waitFor(() => expect(getSignedMediaUrlsBatchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.rows[0]?.signedUrl).toBe("https://signed/first"));

    expect(resolveSignedUrlsByMediaIds).not.toHaveBeenCalled();
    expect(hydrateViaStorageDownload).not.toHaveBeenCalled();
    expect(result.current.signAttemptRef.current["row-1"]).toBe(0);
    expect(result.current.signPassNonce).toBe(0);
  });

  it("does not run proactive hydrate fallback during routine signing passes", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
    const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>(["row-1"]));
    const hydrateViaStorageDownload = vi.fn(async () => "blob://row-1");

    renderHook(() => {
      const rows = [makeRow()];
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(false);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1"]));
      const applySignedUrlsToTab = vi.fn();

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 2,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 1, prefetchWindow: 1, signBatchSize: 1 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 0,
      });
    });

    await waitFor(() => expect(resolveSignedUrlsByMediaIds).toHaveBeenCalled());
    await waitFor(() => expect(hydrateViaStorageDownload).not.toHaveBeenCalled());
    expect(logMediaPerfMock).toHaveBeenCalledWith(
      "media.sign.batch.failed",
      expect.objectContaining({ failed_count: 1 })
    );
  });

  it("runs hydrate fallback when explicitly enabled for the signing pass", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
    const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>(["row-1"]));
    const hydrateViaStorageDownload = vi.fn(async () => "blob://row-1");

    renderHook(() => {
      const rows = [makeRow()];
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(false);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1"]));
      const applySignedUrlsToTab = vi.fn();

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 2,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 1, prefetchWindow: 1, signBatchSize: 1 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 0,
        backgroundHydrateFallbackEnabled: true,
      });
    });

    await waitFor(() => expect(hydrateViaStorageDownload).toHaveBeenCalledTimes(1));
  });

  it("caps signing candidates per row when the caller provides a limit", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/images/primary.png", "https://signed/primary"]])
    );
    resolveMediaSigningStoragePathsMock.mockReturnValue([
      "user/images/primary.png",
      "user/images/fallback-a.png",
      "user/images/fallback-b.png",
      "user/images/fallback-c.png",
    ]);

    renderHook(() => {
      const rows = [makeRow()];
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(true);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1"]));
      const applySignedUrlsToTab = vi.fn();
      const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
      const hydrateViaStorageDownload = vi.fn(async () => null);

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 1,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 1, prefetchWindow: 1, signBatchSize: 1 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 0,
        maxSignCandidatesPerRow: 2,
      });
    });

    await waitFor(() => expect(getSignedMediaUrlsBatchMock).toHaveBeenCalled());
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePaths: ["user/images/primary.png", "user/images/fallback-a.png"],
      })
    );
  });

  it("applies trusted direct preview URLs even when there are no storage paths to sign", async () => {
    resolveMediaSigningStoragePathsMock.mockReturnValue([]);
    resolveMediaDirectPreviewUrlsMock.mockReturnValue([
      "https://cdn.example.com/direct-preview.png",
    ]);
    const applySpy = vi.fn();

    const { result } = renderHook(() => {
      const [rows, setRows] = useState<Row[]>([makeRow({ storage_path: "" })]);
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(true);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1"]));
      const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
      const hydrateViaStorageDownload = vi.fn(async () => null);

      const applySignedUrlsToTab = vi.fn((tab: MediaDataTab, signedById: Map<string, string>) => {
        applySpy(tab, signedById);
        setRows((prev) =>
          prev.map((row) => {
            const signedUrl = signedById.get(row.id);
            return signedUrl ? { ...row, signedUrl } : row;
          })
        );
      });

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 1,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 1, prefetchWindow: 1, signBatchSize: 1 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 0,
      });

      return {
        rows,
      };
    });

    await waitFor(() =>
      expect(result.current.rows[0]?.signedUrl).toBe("https://cdn.example.com/direct-preview.png")
    );

    expect(getSignedMediaUrlsBatchMock).not.toHaveBeenCalled();
    expect(applySpy).toHaveBeenCalledWith(
      "uploaded_images",
      new Map([["row-1", "https://cdn.example.com/direct-preview.png"]])
    );
  });

  it("does not blind-prefetch beyond the initial slice before visibility is known", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/images/first.png", "https://signed/first"]])
    );
    resolveMediaSigningStoragePathsMock.mockImplementation(
      (row: { storage_path?: string | null }) => [row.storage_path ?? ""]
    );

    renderHook(() => {
      const rows = [
        makeRow({ id: "row-1", storage_path: "user/images/first.png" }),
        makeRow({ id: "row-2", storage_path: "user/images/second.png" }),
        makeRow({ id: "row-3", storage_path: "user/images/third.png" }),
      ];
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(true);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>());
      const applySignedUrlsToTab = vi.fn();
      const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
      const hydrateViaStorageDownload = vi.fn(async () => null);

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 1,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 1, prefetchWindow: 3, signBatchSize: 3 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 0,
      });
    });

    await waitFor(() => expect(getSignedMediaUrlsBatchMock).toHaveBeenCalled());
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePaths: ["user/images/first.png"],
      })
    );
  });

  it("requests a follow-up pass when more prioritized rows exist than the batch budget can process", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/images/first.png", "https://signed/first"]])
    );

    const { result } = renderHook(() => {
      const [rows, setRows] = useState([
        makeRow({ id: "row-1", storage_path: "user/images/first.png" }),
        makeRow({ id: "row-2", storage_path: "user/images/second.png" }),
      ]);
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(true);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1", "row-2"]));
      const applySignedUrlsToTab = vi.fn((_: MediaDataTab, signedById: Map<string, string>) => {
        setRows((prev) =>
          prev.map((row) => {
            const signedUrl = signedById.get(row.id);
            return signedUrl ? { ...row, signedUrl } : row;
          })
        );
      });
      const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
      const hydrateViaStorageDownload = vi.fn(async () => null);

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 1,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 2, prefetchWindow: 0, signBatchSize: 1 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 1,
      });

      return {
        signPassNonce,
      };
    });

    await waitFor(() => expect(getSignedMediaUrlsBatchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.signPassNonce).toBeGreaterThan(0));
  });

  it("spaces deferred signing work instead of recursively burst-draining the full frontier", async () => {
    vi.useFakeTimers();
    try {
      getSignedMediaUrlsBatchMock.mockImplementation(async ({ storagePaths }) => {
        return new Map(
          storagePaths.map((storagePath: string) => [storagePath, `https://signed/${storagePath}`])
        );
      });

      renderHook(() => {
        const [rows, setRows] = useState([
          makeRow({ id: "row-1", storage_path: "user/images/first.png" }),
          makeRow({ id: "row-2", storage_path: "user/images/second.png" }),
          makeRow({ id: "row-3", storage_path: "user/images/third.png" }),
        ]);
        const [signPassNonce, setSignPassNonce] = useState(0);
        const activeTabRef = useRef<MediaTab>("uploaded_images");
        const activeMediaQueryRef = useRef("");
        const currentUserIdRef = useRef<string | null>("user-1");
        const isMountedRef = useRef(true);
        const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
        const signAttemptRef = useRef<Record<string, number>>({});
        const visibleMediaIdsRef = useRef(new Set<string>(["row-1"]));
        const applySignedUrlsToTab = vi.fn((_: MediaDataTab, signedById: Map<string, string>) => {
          setRows((prev) =>
            prev.map((row) => {
              const signedUrl = signedById.get(row.id);
              return signedUrl ? { ...row, signedUrl } : row;
            })
          );
        });
        const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
        const hydrateViaStorageDownload = vi.fn(async () => null);

        useMediaPreviewSigningController({
          activeMediaTab: "uploaded_images",
          activeMediaCacheLoading: false,
          activeMediaCachePagesLoaded: 1,
          activeMediaQuery: "",
          activeMediaQueryRef,
          activeTabRef,
          applySignedUrlsToTab,
          currentUserIdRef,
          filteredMedia: rows,
          hydrateViaStorageDownload,
          isMountedRef,
          mediaSignInFlightRef,
          resolveSignedUrlsByMediaIds,
          setSignPassNonce,
          signAttemptRef,
          signBudget: { initialSignLimit: 1, prefetchWindow: 2, signBatchSize: 1 },
          signPassNonce,
          visibleMediaIdsRef,
          visibleMediaVersion: 1,
        });
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(181);
        await Promise.resolve();
      });
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps dense panel-style signing bounded across initial open and load-more append", async () => {
    vi.useFakeTimers();
    try {
      getSignedMediaUrlsBatchMock.mockImplementation(async ({ storagePaths }) => {
        return new Map(
          storagePaths.map((storagePath: string) => [storagePath, `https://signed/${storagePath}`])
        );
      });

      const { result } = renderHook(() => {
        const makeDenseRows = (start: number, count: number) =>
          Array.from({ length: count }, (_, index) =>
            makeRow({
              id: `row-${start + index}`,
              storage_path: `user/images/${start + index}.png`,
            })
          );

        const [rows, setRows] = useState(() => makeDenseRows(1, 12));
        const [signPassNonce, setSignPassNonce] = useState(0);
        const [visibleMediaVersion, setVisibleMediaVersion] = useState(1);
        const activeTabRef = useRef<MediaTab>("uploaded_images");
        const activeMediaQueryRef = useRef("");
        const currentUserIdRef = useRef<string | null>("user-1");
        const isMountedRef = useRef(true);
        const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
        const signAttemptRef = useRef<Record<string, number>>({});
        const visibleMediaIdsRef = useRef(
          new Set<string>(["row-1", "row-2", "row-3", "row-4", "row-5", "row-6", "row-7", "row-8"])
        );

        const applySignedUrlsToTab = vi.fn((_: MediaDataTab, signedById: Map<string, string>) => {
          setRows((prev) =>
            prev.map((row) => {
              const signedUrl = signedById.get(row.id);
              return signedUrl ? { ...row, signedUrl } : row;
            })
          );
        });
        const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
        const hydrateViaStorageDownload = vi.fn(async () => null);

        useMediaPreviewSigningController({
          activeMediaTab: "uploaded_images",
          activeMediaCacheLoading: false,
          activeMediaCachePagesLoaded: 1,
          activeMediaQuery: "",
          activeMediaQueryRef,
          activeTabRef,
          applySignedUrlsToTab,
          currentUserIdRef,
          filteredMedia: rows,
          hydrateViaStorageDownload,
          isMountedRef,
          mediaSignInFlightRef,
          resolveSignedUrlsByMediaIds,
          setSignPassNonce,
          signAttemptRef,
          signBudget: { initialSignLimit: 4, prefetchWindow: 4, signBatchSize: 4 },
          signPassNonce,
          visibleMediaIdsRef,
          visibleMediaVersion,
          surface: "media-library-panel",
        });

        return {
          appendLoadMorePage: () => {
            visibleMediaIdsRef.current = new Set<string>([
              "row-13",
              "row-14",
              "row-15",
              "row-16",
              "row-17",
              "row-18",
              "row-19",
              "row-20",
            ]);
            setRows((prev) => [...prev, ...makeDenseRows(13, 8)]);
            setVisibleMediaVersion((prev) => prev + 1);
          },
        };
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(181);
        await Promise.resolve();
      });
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledTimes(3);

      await act(async () => {
        result.current.appendLoadMorePage();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledTimes(5);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await Promise.resolve();
      });
      expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("records durable-vs-original path counts in sign completion telemetry", async () => {
    const finishTimerSpy = vi.fn();
    createMediaPerfTimerMock.mockReturnValue(finishTimerSpy);
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        ["user/images/original.png", "https://signed/original"],
        ["user/variants/images/thumb_480.png", "https://signed/thumb"],
      ])
    );
    resolveMediaSigningStoragePathsMock.mockImplementation(
      (row: { storage_path?: string | null; thumb_variant_path?: string | null } | undefined) => {
        const thumbVariantPath = row?.thumb_variant_path ?? null;
        const storagePath = row?.storage_path ?? "";
        return thumbVariantPath ? [thumbVariantPath, storagePath] : [storagePath];
      }
    );

    renderHook(() => {
      const [rows, setRows] = useState([
        makeRow({ id: "row-1", storage_path: "user/images/original.png" }),
        makeRow({
          id: "row-2",
          storage_path: "user/images/second-original.png",
          thumb_variant_path: "user/variants/images/thumb_480.png",
        } as Row & { thumb_variant_path?: string }),
      ]);
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user");
      const isMountedRef = useRef(true);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1", "row-2"]));
      const applySignedUrlsToTab = vi.fn((_: MediaDataTab, signedById: Map<string, string>) => {
        setRows((previousRows) =>
          previousRows.map((row) => {
            const signedUrl = signedById.get(row.id);
            return signedUrl ? { ...row, signedUrl } : row;
          })
        );
      });
      const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
      const hydrateViaStorageDownload = vi.fn(async () => null);

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 1,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 2, prefetchWindow: 0, signBatchSize: 2 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 1,
      });
    });

    await waitFor(() => expect(finishTimerSpy).toHaveBeenCalled());
    expect(finishTimerSpy).toHaveBeenCalledWith(
      "media.sign.batch.completed",
      expect.objectContaining({
        primary_durable_count: 1,
        primary_original_count: 1,
        resolved_durable_count: 1,
        resolved_original_count: 1,
      })
    );
  });

  it("skips signing when the active tab already has a signing pass in flight", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());

    renderHook(() => {
      const rows = [makeRow()];
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(true);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      mediaSignInFlightRef.current.uploaded_images = true;
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1"]));
      const applySignedUrlsToTab = vi.fn();
      const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
      const hydrateViaStorageDownload = vi.fn(async () => null);

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 1,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 1, prefetchWindow: 1, signBatchSize: 1 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 0,
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSignedMediaUrlsBatchMock).not.toHaveBeenCalled();
  });

  it("skips signing when pass is disabled by the caller surface", async () => {
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());

    renderHook(() => {
      const rows = [makeRow()];
      const [signPassNonce, setSignPassNonce] = useState(0);
      const activeTabRef = useRef<MediaTab>("uploaded_images");
      const activeMediaQueryRef = useRef("");
      const currentUserIdRef = useRef<string | null>("user-1");
      const isMountedRef = useRef(true);
      const mediaSignInFlightRef = useRef(createMediaTabBooleanState());
      const signAttemptRef = useRef<Record<string, number>>({});
      const visibleMediaIdsRef = useRef(new Set<string>(["row-1"]));
      const applySignedUrlsToTab = vi.fn();
      const resolveSignedUrlsByMediaIds = vi.fn(async () => new Set<string>());
      const hydrateViaStorageDownload = vi.fn(async () => null);

      useMediaPreviewSigningController({
        activeMediaTab: "uploaded_images",
        activeMediaCacheLoading: false,
        activeMediaCachePagesLoaded: 1,
        activeMediaQuery: "",
        activeMediaQueryRef,
        activeTabRef,
        applySignedUrlsToTab,
        currentUserIdRef,
        filteredMedia: rows,
        hydrateViaStorageDownload,
        isMountedRef,
        mediaSignInFlightRef,
        resolveSignedUrlsByMediaIds,
        setSignPassNonce,
        signAttemptRef,
        signBudget: { initialSignLimit: 1, prefetchWindow: 1, signBatchSize: 1 },
        signPassNonce,
        visibleMediaIdsRef,
        visibleMediaVersion: 0,
        isSigningPassEnabled: false,
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSignedMediaUrlsBatchMock).not.toHaveBeenCalled();
  });
});
