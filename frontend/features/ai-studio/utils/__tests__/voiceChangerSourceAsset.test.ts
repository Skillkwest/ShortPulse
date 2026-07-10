import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const getSignedMediaUrlMock = vi.hoisted(() => vi.fn());
const uploadToSignedUrlMock = vi.hoisted(() => vi.fn());
const storageFromMock = vi.hoisted(() =>
  vi.fn(() => ({ uploadToSignedUrl: uploadToSignedUrlMock }))
);
const ensureSupabaseQueryClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    storage: { from: storageFromMock },
  }))
);

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: (...args: unknown[]) => getSignedMediaUrlMock(...args),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ensureSupabaseQueryClientMock(),
}));

import {
  extractVoiceChangerVideoSource,
  resolveVoiceChangerMediaDurationMs,
  resolveVoiceChangerVideoAspect,
  signVoiceSourceStoragePath,
  uploadVoiceChangerSourceFile,
  uploadVoiceCloneSourceFile,
} from "../voiceChangerSourceAsset";

type FakeMetadataProbeElement = HTMLMediaElement & {
  load: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  playsInline: boolean;
  removeAttribute: ReturnType<typeof vi.fn>;
};

const createFakeMetadataProbeElement = (
  kind: "audio" | "video",
  overrides: Partial<HTMLMediaElement & HTMLVideoElement> = {}
) => {
  let source = "";
  const listeners = new Map<string, EventListener>();
  const element = {
    preload: "",
    crossOrigin: null,
    muted: false,
    playsInline: false,
    duration: Number.NaN,
    videoWidth: 0,
    videoHeight: 0,
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type);
    }),
    removeAttribute: vi.fn((attribute: string) => {
      if (attribute === "src") source = "";
    }),
    load: vi.fn(),
    pause: vi.fn(),
    dispatchProbeEvent: (type: string) => {
      listeners.get(type)?.(new Event(type));
    },
    get src() {
      return source;
    },
    set src(value: string) {
      source = value;
    },
    ...overrides,
  } as unknown as FakeMetadataProbeElement & { dispatchProbeEvent: (type: string) => void };

  return {
    kind,
    element,
  };
};

describe("voiceChangerSourceAsset upload helpers", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    getSignedMediaUrlMock.mockReset();
    uploadToSignedUrlMock.mockReset();
    storageFromMock.mockClear();
    ensureSupabaseQueryClientMock.mockClear();
    getSignedMediaUrlMock.mockResolvedValue("https://signed.example/source.wav");
    uploadToSignedUrlMock.mockResolvedValue({ data: { path: "uploaded" }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    ["sample.mp3", "audio", "audio/mpeg"],
    ["sample.wav", "audio", "audio/wav"],
    ["sample.m4a", "audio", "audio/mp4"],
    ["sample.aac", "audio", "audio/aac"],
    ["sample.flac", "audio", "audio/flac"],
    ["sample.ogg", "audio", "audio/ogg"],
    ["sample.mp4", "video", "video/mp4"],
    ["sample.mov", "video", "video/quicktime"],
    ["sample.m4v", "video", "video/x-m4v"],
    ["sample.webm", "audio", "audio/webm"],
    ["sample.webm", "video", "video/webm"],
  ] as const)(
    "infers %s uploads as %s when the browser omits file.type",
    async (filename, kind, expectedMimeType) => {
      fetchWithAuthMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            target: {
              storagePath: `user-1/voice-changer/${kind === "video" ? "source-video" : "source-audio"}/${filename}`,
              uploadToken: "token-1",
              mimeType: expectedMimeType,
              name: filename,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            source: {
              storagePath: `user-1/voice-changer/${kind === "video" ? "source-video" : "source-audio"}/${filename}`,
              previewUrl: `https://signed.example/${filename}`,
              mimeType: expectedMimeType,
              name: filename,
              size: 4,
            },
          }),
        });

      const file = new File(["sample"], filename);
      await uploadVoiceChangerSourceFile({ file, kind });

      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/media/prepare-voice-changer-source-upload",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
      expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
        `user-1/voice-changer/${kind === "video" ? "source-video" : "source-audio"}/${filename}`,
        "token-1",
        file,
        expect.objectContaining({
          contentType: expectedMimeType,
          upsert: false,
        })
      );
      expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
        2,
        "/api/media/stage-voice-changer-source",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    }
  );

  it("normalizes audio/wave uploads to audio/wav before staging", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          target: {
            storagePath: "user-1/voice-changer/source-audio/sample.wav",
            uploadToken: "token-1",
            mimeType: "audio/wav",
            name: "sample.wav",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source: {
            storagePath: "user-1/voice-changer/source-audio/sample.wav",
            previewUrl: "https://signed.example/sample.wav",
            mimeType: "audio/wav",
            name: "sample.wav",
            size: 4,
          },
        }),
      });

    const file = new File(["wav!"], "sample.wav", { type: "audio/wave" });
    await uploadVoiceChangerSourceFile({ file, kind: "audio" });

    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/voice-changer/source-audio/sample.wav",
      "token-1",
      file,
      expect.objectContaining({
        contentType: "audio/wav",
      })
    );
  });

  it("normalizes recorded audio/webm codec parameters before staging", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          target: {
            storagePath: "user-1/voice-changer/source-audio/recorded.webm",
            uploadToken: "token-1",
            mimeType: "audio/webm",
            name: "recorded.webm",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source: {
            storagePath: "user-1/voice-changer/source-audio/recorded.webm",
            previewUrl: "https://signed.example/recorded.webm",
            mimeType: "audio/webm",
            name: "recorded.webm",
            size: 4,
          },
        }),
      });

    const file = new File(["webm"], "recorded.webm", { type: "audio/webm;codecs=opus" });
    await uploadVoiceChangerSourceFile({ file, kind: "audio" });

    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      1,
      "/api/media/prepare-voice-changer-source-upload",
      expect.objectContaining({
        body: JSON.stringify({
          sourceKind: "audio",
          sourceMimeType: "audio/webm",
          sourceName: "recorded.webm",
        }),
      })
    );
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/voice-changer/source-audio/recorded.webm",
      "token-1",
      file,
      expect.objectContaining({
        contentType: "audio/webm",
      })
    );
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/media/stage-voice-changer-source",
      expect.objectContaining({
        body: JSON.stringify({
          sourceKind: "audio",
          sourceMimeType: "audio/webm",
          sourceName: "recorded.webm",
          sourceStoragePath: "user-1/voice-changer/source-audio/recorded.webm",
        }),
      })
    );
  });

  it("returns the detected audio/webm mime type when a webm file stages through the video adapter", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          target: {
            storagePath: "user-1/voice-changer/source-video/sample.webm",
            uploadToken: "token-1",
            mimeType: "video/webm",
            name: "sample.webm",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source: {
            storagePath: "user-1/voice-changer/source-video/sample.webm",
            previewUrl: "https://signed.example/sample.webm",
            mimeType: "audio/webm",
            name: "sample.webm",
            size: 4,
          },
        }),
      });

    const file = new File(["webm!"], "sample.webm");
    await expect(uploadVoiceChangerSourceFile({ file, kind: "video" })).resolves.toMatchObject({
      mimeType: "audio/webm",
    });

    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/voice-changer/source-video/sample.webm",
      "token-1",
      file,
      expect.objectContaining({
        contentType: "video/webm",
      })
    );
  });

  it("keeps voice clone uploads on the clone staging route", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        source: {
          storagePath: "user-1/voice-clone/source-audio/sample.wav",
          previewUrl: "https://signed.example/sample.wav",
          mimeType: "audio/wav",
          name: "sample.wav",
          size: 4,
        },
      }),
    });

    const file = new File(["wav!"], "sample.wav", { type: "audio/wave" });
    await expect(uploadVoiceCloneSourceFile({ file })).resolves.toMatchObject({
      storagePath: "user-1/voice-clone/source-audio/sample.wav",
      mimeType: "audio/wav",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/stage-voice-clone-source",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "audio/wav",
          "x-shortpulse-upload-filename": "sample.wav",
        }),
        body: file,
      })
    );
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
    expect(uploadToSignedUrlMock).not.toHaveBeenCalled();
  });

  it("times out and aborts voice changer upload preparation", async () => {
    vi.useFakeTimers();
    const capturedSignals: AbortSignal[] = [];
    fetchWithAuthMock.mockImplementationOnce((_url, options: { signal?: AbortSignal } = {}) => {
      if (options.signal) capturedSignals.push(options.signal);
      return new Promise(() => undefined);
    });

    const file = new File(["wav!"], "sample.wav", { type: "audio/wav" });
    const uploadPromise = uploadVoiceChangerSourceFile({ file, kind: "audio" });
    const uploadExpectation = expect(uploadPromise).rejects.toThrow(
      "voice source upload preparation timed out"
    );

    await vi.advanceTimersByTimeAsync(20_000);

    await uploadExpectation;
    expect(capturedSignals[0]?.aborted).toBe(true);
    expect(uploadToSignedUrlMock).not.toHaveBeenCalled();
  });

  it("times out voice changer storage uploads that never settle", async () => {
    vi.useFakeTimers();
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        target: {
          storagePath: "user-1/voice-changer/source-audio/sample.wav",
          uploadToken: "token-1",
          mimeType: "audio/wav",
          name: "sample.wav",
        },
      }),
    });
    uploadToSignedUrlMock.mockImplementationOnce(() => new Promise(() => undefined));

    const file = new File(["wav!"], "sample.wav", { type: "audio/wav" });
    const uploadPromise = uploadVoiceChangerSourceFile({ file, kind: "audio" });
    const uploadExpectation = expect(uploadPromise).rejects.toThrow(
      "voice source storage upload timed out"
    );

    await vi.advanceTimersByTimeAsync(180_000);

    await uploadExpectation;
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it("times out and aborts direct voice clone source staging", async () => {
    vi.useFakeTimers();
    const capturedSignals: AbortSignal[] = [];
    fetchWithAuthMock.mockImplementationOnce((_url, options: { signal?: AbortSignal } = {}) => {
      if (options.signal) capturedSignals.push(options.signal);
      return new Promise(() => undefined);
    });

    const file = new File(["wav!"], "sample.wav", { type: "audio/wav" });
    const uploadPromise = uploadVoiceCloneSourceFile({ file });
    const uploadExpectation = expect(uploadPromise).rejects.toThrow(
      "voice clone source staging timed out"
    );

    await vi.advanceTimersByTimeAsync(180_000);

    await uploadExpectation;
    expect(capturedSignals[0]?.aborted).toBe(true);
  });

  it("times out and aborts voice changer video audio extraction", async () => {
    vi.useFakeTimers();
    const capturedSignals: AbortSignal[] = [];
    fetchWithAuthMock.mockImplementationOnce((_url, options: { signal?: AbortSignal } = {}) => {
      if (options.signal) capturedSignals.push(options.signal);
      return new Promise(() => undefined);
    });

    const extractPromise = extractVoiceChangerVideoSource({
      sourceName: "source.mp4",
      sourceOrigin: "local",
      sourceMimeType: "video/mp4",
      sourceStoragePath: "user-1/voice-changer/source-video/source.mp4",
      sourceUrl: null,
    });
    const extractExpectation = expect(extractPromise).rejects.toThrow(
      "voice sample extraction timed out"
    );

    await vi.advanceTimersByTimeAsync(180_000);

    await extractExpectation;
    expect(capturedSignals[0]?.aborted).toBe(true);
  });

  it("times out stored voice source signing", async () => {
    vi.useFakeTimers();
    getSignedMediaUrlMock.mockImplementationOnce(() => new Promise(() => undefined));

    const signPromise = signVoiceSourceStoragePath("user-1/voice-changer/source-audio/sample.wav");
    const signExpectation = expect(signPromise).rejects.toThrow("voice source signing timed out");

    await vi.advanceTimersByTimeAsync(10_000);

    await signExpectation;
  });
});

describe("voiceChangerSourceAsset metadata probes", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("times out and cleans up audio duration probes that never settle", async () => {
    vi.useFakeTimers();
    const fakeAudio = createFakeMetadataProbeElement("audio");
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "audio") {
        return fakeAudio.element as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });

    const durationPromise = resolveVoiceChangerMediaDurationMs(
      "https://signed.example/source.wav",
      "audio"
    );

    await vi.runAllTimersAsync();

    await expect(durationPromise).resolves.toBeNull();
    expect(createElementSpy).toHaveBeenCalledWith("audio");
    expect(fakeAudio.element.pause).toHaveBeenCalled();
    expect(fakeAudio.element.removeAttribute).toHaveBeenCalledWith("src");
    expect(fakeAudio.element.load).toHaveBeenCalled();
    expect(fakeAudio.element.src).toBe("");
  });

  it("times out and cleans up video aspect probes that never settle", async () => {
    vi.useFakeTimers();
    const fakeVideo = createFakeMetadataProbeElement("video");
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "video") {
        return fakeVideo.element as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });

    const aspectPromise = resolveVoiceChangerVideoAspect("https://signed.example/source.mp4");

    await vi.runAllTimersAsync();

    await expect(aspectPromise).resolves.toBeNull();
    expect(createElementSpy).toHaveBeenCalledWith("video");
    expect(fakeVideo.element.muted).toBe(true);
    expect(fakeVideo.element.playsInline).toBe(true);
    expect(fakeVideo.element.pause).toHaveBeenCalled();
    expect(fakeVideo.element.removeAttribute).toHaveBeenCalledWith("src");
    expect(fakeVideo.element.load).toHaveBeenCalled();
    expect(fakeVideo.element.src).toBe("");
  });
});
