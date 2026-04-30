import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";
import type { StudioOutput } from "../../types";
import { useAiStudioReferenceAssetActions } from "../useAiStudioReferenceAssetActions";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: vi.fn(),
  readSupabaseUserId: vi.fn(),
}));

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const makeOutput = (id: string, prompt = "Prompt text"): StudioOutput => ({
  id,
  prompt,
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/seedream",
  status: "ready",
  timestamp: "now",
  taskState: "success",
});

type MockQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type SupabaseMockConfig = {
  mediaResults?: MockQueryResult[];
  projectionResults?: MockQueryResult[];
  publicationResults?: MockQueryResult[];
  generationResults?: MockQueryResult[];
  generationOutputResults?: MockQueryResult[];
  storageDownloadResult?: {
    data: Blob | null;
    error: { message: string } | null;
  };
};

const createSupabaseMock = ({
  mediaResults = [],
  projectionResults = [],
  publicationResults = [],
  generationResults = [],
  generationOutputResults = [],
  storageDownloadResult = { data: new Blob(["file"], { type: "image/png" }), error: null },
}: SupabaseMockConfig = {}) => {
  const sortRows = (data: unknown, field: string, options?: { ascending?: boolean }) => {
    if (!Array.isArray(data)) return data;
    const ascending = options?.ascending ?? true;
    return [...data].sort((left, right) => {
      const leftValue = (left as Record<string, unknown>)[field];
      const rightValue = (right as Record<string, unknown>)[field];
      if (leftValue === rightValue) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      return ascending
        ? String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true })
        : String(rightValue).localeCompare(String(leftValue), undefined, { numeric: true });
    });
  };

  const createLimitChain = (result: MockQueryResult, orderedData: unknown) => ({
    maybeSingle: async () => ({
      data: Array.isArray(orderedData) ? (orderedData[0] ?? null) : orderedData,
      error: result.error,
    }),
    then: (resolve: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve(
        resolve({
          data: orderedData,
          error: result.error,
        })
      ),
  });

  const createMediaSelectBuilder = (result: MockQueryResult) => {
    let orderedData = result.data;
    const builder = {} as {
      in: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    };
    builder.in = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn((field: string, options?: { ascending?: boolean }) => {
      orderedData = sortRows(orderedData, field, options);
      return builder;
    });
    builder.limit = vi.fn(() => createLimitChain(result, orderedData));
    builder.maybeSingle = vi.fn(async () => ({
      data: Array.isArray(orderedData) ? (orderedData[0] ?? null) : orderedData,
      error: result.error,
    }));
    return builder;
  };

  const createProjectionSelectBuilder = (result: MockQueryResult) => {
    const builder = {
      eq: vi.fn(),
      limit: vi.fn(),
    } as {
      eq: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    };
    builder.eq.mockReturnValue(builder);
    builder.limit.mockReturnValue({
      maybeSingle: async () => ({
        data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
        error: result.error,
      }),
    });
    return builder;
  };

  const from = vi.fn((table: string) => ({
    select: vi.fn(() => {
      if (table === "generation_projection") {
        return createProjectionSelectBuilder(
          projectionResults.shift() ?? { data: null, error: null }
        );
      }
      if (table === "ai_generations") {
        return createProjectionSelectBuilder(
          generationResults.shift() ?? { data: null, error: null }
        );
      }
      if (table === "generation_publications") {
        return createMediaSelectBuilder(publicationResults.shift() ?? { data: [], error: null });
      }
      if (table === "ai_generation_outputs") {
        return createMediaSelectBuilder(
          generationOutputResults.shift() ?? { data: [], error: null }
        );
      }
      return createMediaSelectBuilder(mediaResults.shift() ?? { data: [], error: null });
    }),
  }));

  const storageDownload = vi.fn(async () => storageDownloadResult);
  const storageFrom = vi.fn(() => ({
    download: storageDownload,
  }));

  const supabase = {
    from,
    storage: {
      from: storageFrom,
    },
  };

  return {
    supabase,
    from,
    storageFrom,
    storageDownload,
  };
};

const installDownloadDomMocks = () => {
  const click = vi.fn();
  const link = {
    href: "",
    download: "",
    rel: "",
    click,
  } as unknown as HTMLAnchorElement;
  const nativeCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName.toLowerCase() === "a") {
      return link as unknown as HTMLElement;
    }
    return nativeCreateElement(tagName);
  }) as typeof document.createElement);

  if (!window.URL.createObjectURL) {
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: () => "blob:shortpulse-test",
    });
  }
  if (!window.URL.revokeObjectURL) {
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
  }
  vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:shortpulse-test");
  vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => undefined);

  return {
    link,
    click,
  };
};

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioReferenceAssetActions>[0]> = {}
): Parameters<typeof useAiStudioReferenceAssetActions>[0] => ({
  findOutputById: () => null,
  saveReferenceToLibrary: vi.fn(),
  setUiError: asDispatch<string | null>(vi.fn()),
  ...overrides,
});

describe("useAiStudioReferenceAssetActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readSupabaseUserId).mockResolvedValue("user-1");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads media via generation id when saved ids are absent", async () => {
    const { supabase, from, storageDownload } = createSupabaseMock({
      generationOutputResults: [
        {
          data: [
            {
              media_file_id: "media-generation-output-1",
              output_index: 0,
            },
          ],
          error: null,
        },
      ],
      mediaResults: [
        {
          data: [
            {
              storage_path: "user-1/generations/images/by-generation.jpg",
              filename: "by-generation.jpg",
            },
          ],
          error: null,
        },
      ],
    });
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click } = installDownloadDomMocks();
    const output = {
      ...makeOutput("out-2", "Generation prompt"),
      generationId: "gen-1",
      previewUrl: "https://cdn.test/generated-preview.jpg",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-2" ? output : null),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-2");
    });

    expect(from).toHaveBeenCalledWith("media_files");
    expect(from).toHaveBeenCalledWith("ai_generation_outputs");
    expect(storageDownload).toHaveBeenCalledWith("user-1/generations/images/by-generation.jpg");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("prefers canonical generated output media over saved media ids for generated downloads", async () => {
    const { supabase, storageDownload } = createSupabaseMock({
      generationOutputResults: [
        {
          data: [
            {
              media_file_id: "media-canonical-1",
              output_index: 0,
            },
          ],
          error: null,
        },
      ],
      mediaResults: [
        {
          data: [
            {
              storage_path: "user-1/generations/images/canonical-generated.png",
              filename: "canonical-generated.png",
            },
          ],
          error: null,
        },
      ],
    });
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click, link } = installDownloadDomMocks();
    const output = {
      ...makeOutput("out-generated-canonical", "Canonical generated prompt"),
      mediaSource: "generated",
      generationId: "gen-canonical-1",
      savedMediaIds: ["media-stale-1"],
      previewUrl: "https://cdn.test/generated-canonical-preview.png",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-generated-canonical" ? output : null),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-generated-canonical");
    });

    expect(storageDownload).toHaveBeenCalledWith(
      "user-1/generations/images/canonical-generated.png"
    );
    expect(link.download).toBe("canonical-generated.png");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("preserves canonical output ordering when resolving generated download media", async () => {
    const { supabase, storageDownload } = createSupabaseMock({
      generationOutputResults: [
        {
          data: [
            {
              media_file_id: "media-output-0",
              output_index: 0,
            },
            {
              media_file_id: "media-output-1",
              output_index: 1,
            },
          ],
          error: null,
        },
      ],
      mediaResults: [
        {
          data: [
            {
              storage_path: "user-1/generations/images/output-index-1.png",
              filename: "output-index-1.png",
            },
          ],
          error: null,
        },
      ],
    });
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    installDownloadDomMocks();
    const output = {
      ...makeOutput("out-generated-order", "Ordered generated prompt"),
      mediaSource: "generated",
      generationId: "gen-order-1",
      previewUrl: "https://cdn.test/generated-order-preview.png",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-generated-order" ? output : null),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-generated-order");
    });

    expect(storageDownload).toHaveBeenCalledWith("user-1/generations/images/output-index-1.png");
  });

  it("fails closed when generated download is missing durable generation identity", async () => {
    const { supabase, from, storageDownload } = createSupabaseMock();
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click } = installDownloadDomMocks();
    const setUiError = vi.fn();
    const output = {
      ...makeOutput("out-task", "Task derived prompt"),
      taskId: "req-123",
      previewUrl: "https://cdn.test/result/task-derived.jpeg",
      mediaSource: "generated",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-task" ? output : null),
          setUiError: asDispatch<string | null>(setUiError),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-task");
    });

    expect(from).toHaveBeenCalledWith("generation_projection");
    expect(from).not.toHaveBeenCalledWith("ai_generations");
    expect(storageDownload).not.toHaveBeenCalled();
    expect(setUiError).toHaveBeenCalledWith(
      "Generated media is missing durable generation tracking."
    );
    expect(click).not.toHaveBeenCalled();
  });

  it("recovers generation id from request-backed state before failing generated downloads", async () => {
    const { supabase, storageDownload } = createSupabaseMock({
      projectionResults: [
        {
          data: { generation_id: "gen-from-projection" },
          error: null,
        },
      ],
      generationOutputResults: [
        {
          data: [
            {
              media_file_id: "media-from-request-backed-generation",
              output_index: 0,
            },
          ],
          error: null,
        },
      ],
      mediaResults: [
        {
          data: [
            {
              storage_path: "user-1/generations/images/request-backed.png",
              filename: "request-backed.png",
            },
          ],
          error: null,
        },
      ],
    });
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click, link } = installDownloadDomMocks();
    const setUiError = vi.fn();
    const output = {
      ...makeOutput("out-task-backed", "Task derived prompt"),
      taskId: "req-123",
      previewUrl: "https://cdn.test/result/task-derived.jpeg",
      mediaSource: "generated",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-task-backed" ? output : null),
          setUiError: asDispatch<string | null>(setUiError),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-task-backed");
    });

    expect(storageDownload).toHaveBeenCalledWith("user-1/generations/images/request-backed.png");
    expect(link.download).toBe("request-backed.png");
    expect(click).toHaveBeenCalledTimes(1);
    expect(setUiError).not.toHaveBeenCalled();
  });

  it("uses provider fetch blob fallback for durably tracked generated references when no storage file is found", async () => {
    const { supabase, storageDownload } = createSupabaseMock();
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click, link } = installDownloadDomMocks();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(new Blob(["remote"], { type: "image/png" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const output = {
      ...makeOutput("out-generated", "Generated fallback"),
      mediaSource: "generated",
      generationId: "gen-fallback-1",
      previewUrl: "https://fal.media/files/generated-fallback.png",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-generated" ? output : null),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-generated");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://fal.media/files/generated-fallback.png",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
    expect(storageDownload).not.toHaveBeenCalled();
    expect(link.download).toBe("Generated fallback.png");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("keeps non-generated fallback behavior when only preview URL is available", async () => {
    const { supabase } = createSupabaseMock();
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click, link } = installDownloadDomMocks();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const output = {
      ...makeOutput("out-upload", "Uploaded prompt"),
      mediaSource: "upload",
      previewUrl: "https://cdn.test/upload-only.jpg",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-upload" ? output : null),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-upload");
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(link.href).toBe("https://cdn.test/upload-only.jpg");
    expect(link.download).toBe("Uploaded prompt.jpg");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("downloads media via canonical output storage paths when ids are absent", async () => {
    const { supabase, storageDownload } = createSupabaseMock();
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click, link } = installDownloadDomMocks();
    const output = {
      ...makeOutput("out-storage-path", "Durable upload"),
      mediaSource: "upload",
      previewStoragePath: "user-1/private/images/durable-upload.png",
      fullStoragePath: "user-1/private/images/durable-upload.png",
      previewUrl: "https://cdn.test/durable-upload.png",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-storage-path" ? output : null),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-storage-path");
    });

    expect(storageDownload).toHaveBeenCalledWith("user-1/private/images/durable-upload.png");
    expect(link.download).toBe("Durable upload.png");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("unwraps next-image optimizer URLs before triggering direct URL download fallback", async () => {
    const { supabase } = createSupabaseMock();
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click, link } = installDownloadDomMocks();
    const output = {
      ...makeOutput("out-next-image", "Optimizer source"),
      mediaSource: "upload",
      previewUrl: "/_next/image?url=https%3A%2F%2Fcdn.test%2Foriginal-image.png&w=640&q=40",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-next-image" ? output : null),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-next-image");
    });

    expect(link.href).toBe("https://cdn.test/original-image.png");
    expect(link.download).toBe("Optimizer source.png");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("surfaces generated URL download failures instead of opening a new tab", async () => {
    const { supabase } = createSupabaseMock();
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click } = installDownloadDomMocks();
    const setUiError = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const output = {
      ...makeOutput("out-fail", "Generated failure"),
      mediaSource: "generated",
      generationId: "gen-failure-1",
      previewUrl: "https://fal.media/files/generated-failure.png",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-fail" ? output : null),
          setUiError: asDispatch<string | null>(setUiError),
        })
      )
    );

    await act(async () => {
      await result.current.handleDownloadReference("out-fail");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://fal.media/files/generated-failure.png",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
    expect(setUiError).toHaveBeenCalledWith("Unable to download media from provider URL.");
    expect(click).not.toHaveBeenCalled();
  });

  it("maps generated URL download timeouts to a stable provider error message", async () => {
    vi.useFakeTimers();
    const { supabase } = createSupabaseMock();
    vi.mocked(ensureSupabaseQueryClient).mockReturnValue(supabase as never);
    const { click } = installDownloadDomMocks();
    const setUiError = vi.fn();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const output = {
      ...makeOutput("out-timeout", "Generated timeout"),
      mediaSource: "generated",
      generationId: "gen-timeout-1",
      previewUrl: "https://fal.media/files/generated-timeout.png",
    } satisfies StudioOutput;

    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          findOutputById: (id) => (id === "out-timeout" ? output : null),
          setUiError: asDispatch<string | null>(setUiError),
        })
      )
    );

    await act(async () => {
      const pendingDownload = result.current.handleDownloadReference("out-timeout");
      await vi.advanceTimersByTimeAsync(12000);
      await pendingDownload;
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://fal.media/files/generated-timeout.png",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
    expect(setUiError).toHaveBeenCalledWith("Unable to download media from provider URL.");
    expect(click).not.toHaveBeenCalled();
  });

  it("saves a valid reference id and ignores empty ids", () => {
    const saveReferenceToLibrary = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(createParams({ saveReferenceToLibrary }))
    );

    act(() => {
      result.current.handleSaveReference("");
      result.current.handleSaveReference("out-1");
    });

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("out-1");
  });
});
