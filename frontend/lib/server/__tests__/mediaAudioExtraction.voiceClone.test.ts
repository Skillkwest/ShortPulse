import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  detectAudioMimeTypeMock,
  execFileMock,
  mkdtempMock,
  writeFileMock,
  statMock,
  readFileMock,
  unlinkMock,
  rmMock,
} = vi.hoisted(() => ({
  detectAudioMimeTypeMock: vi.fn(),
  execFileMock: vi.fn(),
  mkdtempMock: vi.fn(),
  writeFileMock: vi.fn(),
  statMock: vi.fn(),
  readFileMock: vi.fn(),
  unlinkMock: vi.fn(),
  rmMock: vi.fn(),
}));

vi.mock("child_process", () => ({
  default: {
    execFile: execFileMock,
  },
  execFile: execFileMock,
}));

vi.mock("ffmpeg-static", () => ({
  default: "/mock/ffmpeg",
}));

vi.mock("fs", () => {
  const promises = {
    mkdtemp: mkdtempMock,
    writeFile: writeFileMock,
    stat: statMock,
    readFile: readFileMock,
    unlink: unlinkMock,
    rm: rmMock,
  };
  return {
    default: { promises },
    promises,
  };
});

vi.mock("../uploadSignature", () => ({
  detectAudioMimeType: detectAudioMimeTypeMock,
}));

import {
  MAX_VOICE_CLONE_NORMALIZED_BYTES,
  MediaAudioPreparationUnavailableError,
  normalizeAudioForVoiceClone,
} from "../mediaAudioExtraction";

describe("normalizeAudioForVoiceClone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detectAudioMimeTypeMock.mockReturnValue("audio/webm");
    let mkdtempCallCount = 0;
    mkdtempMock.mockImplementation(async () => {
      mkdtempCallCount += 1;
      if (mkdtempCallCount === 1) return "/tmp/source-dir";
      if (mkdtempCallCount === 2) return "/tmp/output-dir";
      return `/tmp/probe-dir-${mkdtempCallCount}`;
    });
    writeFileMock.mockResolvedValue(undefined);
    statMock.mockResolvedValue({ size: 1024 });
    readFileMock.mockResolvedValue(Buffer.from("normalized-wav"));
    unlinkMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
    execFileMock.mockImplementation((_command, args, callback) => {
      if (Array.isArray(args) && args.includes("-f") && args.includes("null")) {
        callback(null, "", "Duration: 00:01:12.00");
        return;
      }
      callback(null, "", "");
    });
  });

  it("rejects normalized outputs that exceed the clone preparation byte cap", async () => {
    statMock.mockResolvedValueOnce({ size: MAX_VOICE_CLONE_NORMALIZED_BYTES + 1 });

    await expect(
      normalizeAudioForVoiceClone({
        buffer: Buffer.from("source-audio"),
        filename: "voice.webm",
        mimeType: "audio/webm",
      })
    ).rejects.toMatchObject({
      message:
        "The selected voice sample is too large to prepare for cloning. Use a shorter clip and try again.",
      statusCode: 413,
    });

    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("surfaces infrastructure failures as unavailable preparation errors", async () => {
    execFileMock.mockImplementationOnce((_command, _args, callback) => {
      const error = Object.assign(
        new Error("spawn ENOSPC /tmp/output-dir/voice-clone-source.wav"),
        {
          code: "ENOSPC",
        }
      );
      callback(error);
    });

    const rejection = normalizeAudioForVoiceClone({
      buffer: Buffer.from("source-audio"),
      filename: "voice.webm",
      mimeType: "audio/webm",
    });

    await expect(rejection).rejects.toBeInstanceOf(MediaAudioPreparationUnavailableError);
    await expect(rejection).rejects.toMatchObject({
      message: "Voice clone audio preparation is temporarily unavailable. Please try again.",
      status: 503,
      statusCode: 503,
    });
  });

  it("does not leak raw ffmpeg details in user-facing preparation errors", async () => {
    execFileMock.mockImplementationOnce((_command, _args, callback) => {
      callback(new Error("ffmpeg failed while writing /tmp/output-dir/voice-clone-source.wav"));
    });

    await expect(
      normalizeAudioForVoiceClone({
        buffer: Buffer.from("source-audio"),
        filename: "voice.webm",
        mimeType: "audio/webm",
      })
    ).rejects.toMatchObject({
      message: "Unable to prepare the selected voice sample for cloning. Try MP3 or WAV.",
      statusCode: 400,
    });
  });

  it("rejects clone samples that are shorter than the minimum supported duration", async () => {
    execFileMock.mockImplementation((_command, args, callback) => {
      if (Array.isArray(args) && args.includes("-f") && args.includes("null")) {
        callback(null, "", "Duration: 00:00:05.00");
        return;
      }
      callback(null, "", "");
    });

    const rejection = normalizeAudioForVoiceClone({
      buffer: Buffer.from("source-audio"),
      filename: "voice.webm",
      mimeType: "audio/webm",
    });

    await expect(rejection).rejects.toThrow(
      "Voice clone samples must be at least 1 minute long. Record a longer clip and try again."
    );
    await expect(rejection).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
