import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());
const createTempDirMock = vi.hoisted(() => vi.fn());
const makeTempFileHandleMock = vi.hoisted(() => vi.fn());
const probeMediaDurationSecondsMock = vi.hoisted(() => vi.fn());
const detectVideoMimeTypeMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const unlinkMock = vi.hoisted(() => vi.fn());
const rmMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  default: { execFile: execFileMock },
  execFile: execFileMock,
}));

vi.mock("ffmpeg-static", () => ({
  default: "/mock/ffmpeg",
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  const mockedPromises = {
    ...actual.promises,
    readFile: readFileMock,
    unlink: unlinkMock,
    rm: rmMock,
  };
  return {
    ...actual,
    default: { ...actual, promises: mockedPromises },
    promises: mockedPromises,
  };
});

vi.mock("../mediaAudioExtraction", () => ({
  createTempDir: createTempDirMock,
  makeTempFileHandle: makeTempFileHandleMock,
  probeMediaDurationSeconds: probeMediaDurationSecondsMock,
}));

vi.mock("../uploadSignature", () => ({
  detectVideoMimeType: detectVideoMimeTypeMock,
}));

import { normalizeMotionReferenceVideoForProvider } from "../motionReferenceVideoNormalization";

describe("normalizeMotionReferenceVideoForProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execFileMock.mockImplementation((_bin, _args, callback) => callback(null, "", ""));
    createTempDirMock.mockResolvedValue("/tmp/shortpulse-motion-reference");
    makeTempFileHandleMock.mockResolvedValue({
      path: "/tmp/shortpulse-source.mp4",
      cleanup: vi.fn().mockResolvedValue(undefined),
    });
    probeMediaDurationSecondsMock.mockResolvedValue(5);
    detectVideoMimeTypeMock.mockReturnValue("video/mp4");
    readFileMock.mockResolvedValue(Buffer.from("normalized-mp4"));
    unlinkMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
  });

  it("transcodes MP4 motion references instead of trusting the container", async () => {
    const sourceBuffer = Buffer.from("source-mp4");

    const normalized = await normalizeMotionReferenceVideoForProvider({
      buffer: sourceBuffer,
      filename: "phone-clip.mp4",
      mimeType: "video/mp4",
    });

    expect(probeMediaDurationSecondsMock).toHaveBeenCalledWith({
      buffer: sourceBuffer,
      filename: "phone-clip.mp4",
      mimeType: "video/mp4",
    });
    expect(execFileMock).toHaveBeenCalledWith(
      "/mock/ffmpeg",
      expect.arrayContaining(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]),
      expect.any(Function)
    );
    expect(normalized).toEqual({
      buffer: Buffer.from("normalized-mp4"),
      filename: "phone-clip.mp4",
      mimeType: "video/mp4",
    });
  });
});
