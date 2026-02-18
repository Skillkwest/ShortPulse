import { afterEach, describe, expect, it, vi } from "vitest";
import { mapUploadsFromFiles } from "../stateParsers";

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

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    vi.restoreAllMocks();
  });

  it("uses object URLs and marks upload metadata", async () => {
    const createObjectUrlMock = vi
      .fn()
      .mockReturnValueOnce("blob:https://local/image-1")
      .mockReturnValueOnce("blob:https://local/video-1");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });

    const files = toFileList([
      new File(["image"], "image.png", { type: "image/png" }),
      new File(["video"], "clip.mp4", { type: "video/mp4" }),
    ]);

    const outputs = await mapUploadsFromFiles(
      files,
      "image",
      "1:1",
      "fal-ai/bytedance/seedream/v4.5/edit",
      (value) => value ?? "Model",
      () => "id"
    );

    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
    expect(outputs).toHaveLength(2);
    expect(outputs[0]?.mediaSource).toBe("upload");
    expect(outputs[0]?.previewTier).toBe("full");
    expect(outputs[0]?.localObjectUrl).toBe("blob:https://local/image-1");
    expect(outputs[0]?.previewUrl).toBe("blob:https://local/image-1");
    expect(outputs[1]?.mode).toBe("video");
    expect(outputs[1]?.previewUrl).toBe("blob:https://local/video-1#video=1");
    expect(outputs[1]?.localObjectUrl).toBe("blob:https://local/video-1");
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
      () => "fallback-id"
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.localObjectUrl).toBeNull();
    expect(outputs[0]?.previewUrl?.startsWith("data:image/png;base64,")).toBe(true);
  });
});
