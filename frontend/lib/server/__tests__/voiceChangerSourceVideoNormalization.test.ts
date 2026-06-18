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
  MAX_VOICE_CHANGER_SOURCE_BYTES: 40 * 1024 * 1024,
  probeMediaDurationSeconds: probeMediaDurationSecondsMock,
}));

vi.mock("../uploadSignature", () => ({
  detectVideoMimeType: detectVideoMimeTypeMock,
}));

import { normalizeVoiceChangerSourceVideoForProcessing } from "../voiceChangerSourceVideoNormalization";

describe("normalizeVoiceChangerSourceVideoForProcessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execFileMock.mockImplementation((_bin, _args, callback) => callback(null, "", ""));
    createTempDirMock.mockResolvedValue("/tmp/shortpulse-voice-changer");
    makeTempFileHandleMock.mockResolvedValue({
      path: "/tmp/source.webm",
      cleanup: vi.fn().mockResolvedValue(undefined),
    });
    probeMediaDurationSecondsMock.mockResolvedValue(12);
    detectVideoMimeTypeMock.mockReturnValue("video/mp4");
    readFileMock.mockResolvedValue(Buffer.from("normalized-mp4"));
    unlinkMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
  });

  it("transcodes oversized Voice Changer source videos to processing-safe MP4", async () => {
    const normalized = await normalizeVoiceChangerSourceVideoForProcessing({
      buffer: Buffer.from("oversized-webm"),
      filename: "phone-clip.webm",
      mimeType: "video/webm",
      maxBytes: 1024,
    });

    expect(probeMediaDurationSecondsMock).toHaveBeenCalledWith({
      buffer: Buffer.from("oversized-webm"),
      filename: "phone-clip.webm",
      mimeType: "video/webm",
    });
    expect(execFileMock).toHaveBeenCalledWith(
      "/mock/ffmpeg",
      expect.arrayContaining([
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-movflags",
        "+faststart",
      ]),
      expect.any(Function)
    );
    expect(normalized).toEqual({
      buffer: Buffer.from("normalized-mp4"),
      filename: "phone-clip.mp4",
      mimeType: "video/mp4",
    });
  });

  it("rejects videos that cannot be compressed under the processing limit", async () => {
    readFileMock.mockResolvedValue(Buffer.alloc(2048));

    await expect(
      normalizeVoiceChangerSourceVideoForProcessing({
        buffer: Buffer.from("oversized-webm"),
        filename: "phone-clip.webm",
        mimeType: "video/webm",
        maxBytes: 1024,
      })
    ).rejects.toMatchObject({
      status: 413,
      details:
        "Voice changer source video could not be compressed under the processing limit. Use a shorter clip and try again.",
    });
    expect(execFileMock).toHaveBeenCalledTimes(3);
  });
});
