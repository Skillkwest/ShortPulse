import { afterEach, describe, expect, it, vi } from "vitest";
import { isVideoUrl, mapUploadsFromFiles } from "../stateParsers";

const toFileList = (files: File[]): FileList => {
  const indexed = files.reduce<Record<number, File>>((acc, file, index) => {
    acc[index] = file;
    return acc;
  }, {});
  return {
    ...indexed,
    length: files.length,
    item: (index: number) => files[index] ?? null,
  } as unknown as FileList;
};

describe("mapUploadsFromFiles", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalVideoElement = HTMLMediaElement.prototype.load;
  const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: originalVideoElement,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: originalCanvasGetContext,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      value: originalCanvasToDataUrl,
    });
    vi.restoreAllMocks();
  });

  it("uses stable data previews for images while retaining object URLs for upload metadata", async () => {
    const createObjectUrlMock = vi
      .fn()
      .mockReturnValueOnce("blob:https://local/image-1")
      .mockReturnValueOnce("blob:https://local/video-1")
      .mockReturnValueOnce("blob:https://local/audio-1");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: function load(this: HTMLMediaElement) {
        if (!this.currentSrc && !this.getAttribute("src")) return;
        Object.defineProperty(this, "readyState", {
          configurable: true,
          value: HTMLMediaElement.HAVE_CURRENT_DATA,
        });
        Object.defineProperty(this, "videoWidth", {
          configurable: true,
          value: 720,
        });
        Object.defineProperty(this, "videoHeight", {
          configurable: true,
          value: 1280,
        });
        queueMicrotask(() => {
          this.dispatchEvent(new Event("loadeddata"));
          this.dispatchEvent(new Event("seeked"));
        });
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () =>
        ({
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      value: () => "data:image/jpeg;base64,video-poster",
    });

    const files = toFileList([
      new File(["image"], "image.png", { type: "image/png" }),
      new File(["video"], "clip.mp4", { type: "video/mp4" }),
      new File(["audio"], "voice.mp3", { type: "audio/mpeg" }),
    ]);

    const outputs = await mapUploadsFromFiles(
      files,
      "image",
      "1:1",
      "fal-ai/bytedance/seedream/v4.5/edit",
      (value) => value ?? "Model",
      () => "id",
      "drop"
    );

    expect(createObjectUrlMock).toHaveBeenCalledTimes(3);
    expect(outputs).toHaveLength(3);
    expect(outputs[0]?.mediaSource).toBe("upload");
    expect(outputs[0]?.previewTier).toBe("full");
    expect(outputs[0]?.localObjectUrl).toBe("blob:https://local/image-1");
    expect(outputs[0]?.previewUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(outputs[0]?.timestamp).toBe("Dropped");
    expect(outputs[1]?.mode).toBe("video");
    expect(outputs[1]?.previewUrl).toBe("blob:https://local/video-1#video=1");
    expect(outputs[1]?.localObjectUrl).toBe("blob:https://local/video-1");
    expect(outputs[1]?.previewPosterUrl).toBe("data:image/jpeg;base64,video-poster");
    expect(outputs[2]?.mode).toBe("audio");
    expect(outputs[2]?.previewUrl).toBe("blob:https://local/audio-1#audio=1");
    expect(outputs[2]?.localObjectUrl).toBe("blob:https://local/audio-1");
    expect(outputs[2]?.previewPosterUrl).toBeNull();
    expect(outputs[2]?.mimeType).toBe("audio/mpeg");
  });

  it("falls back to data URLs when object URLs are unavailable", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: undefined,
    });

    const files = toFileList([new File(["image"], "image.png", { type: "image/png" })]);
    const outputs = await mapUploadsFromFiles(
      files,
      "image",
      "1:1",
      "fal-ai/bytedance/seedream/v4.5/edit",
      (value) => value ?? "Model",
      () => "fallback-id",
      "filePicker"
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.localObjectUrl).toBeNull();
    expect(outputs[0]?.previewUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(outputs[0]?.timestamp).toBe("Uploaded");
  });

  it("dedupes duplicate file entries across picker/drop ingestion", async () => {
    const createObjectUrlMock = vi.fn().mockReturnValue("blob:https://local/image-1");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });

    const duplicate = new File(["image"], "image.png", {
      type: "image/png",
      lastModified: 1700000000000,
    });
    const files = toFileList([duplicate, duplicate]);

    const outputs = await mapUploadsFromFiles(
      files,
      "image",
      "1:1",
      "fal-ai/bytedance/seedream/v4.5/edit",
      (value) => value ?? "Model",
      () => "dedupe-id",
      "filePicker"
    );

    expect(outputs).toHaveLength(1);
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
  });

  it("does not classify image optimizer URLs as video when source contains /videos/", () => {
    const optimizerUrl =
      "/_next/image?url=https%3A%2F%2Fexample.supabase.co%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fuploads%2Fvideos%2Freference_asset_12345%3Ftoken%3Dabc123&w=512&q=34";
    expect(isVideoUrl(optimizerUrl)).toBe(false);
  });

  it("does not classify model slugs containing video text as video media", () => {
    const imageUrl = "https://cdn.example.com/fal-ai/kling-video/v3/pro/reference-output.png";
    expect(isVideoUrl(imageUrl)).toBe(false);
  });
});
