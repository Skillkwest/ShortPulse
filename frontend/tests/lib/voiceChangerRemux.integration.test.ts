/**
 * Real ffmpeg contract test for Voice Changer video/audio remuxing.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { afterEach, describe, expect, it } from "vitest";
import { createRemuxedVoiceChangerVideo } from "../../lib/server/elevenlabsProviderClient";

const execFileAsync = promisify(execFile);
const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))
  );
});

describe("createRemuxedVoiceChangerVideo ffmpeg integration", () => {
  it("creates a playable output containing both video and converted audio streams", async () => {
    if (!ffmpegPath) throw new Error("ffmpeg-static binary is unavailable.");
    const directory = await mkdtemp(path.join(tmpdir(), "shortpulse-remux-"));
    cleanupPaths.push(directory);
    const videoPath = path.join(directory, "source.mp4");
    const audioPath = path.join(directory, "voice.wav");
    const outputPath = path.join(directory, "output.mp4");

    await execFileAsync(ffmpegPath, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=160x90:d=0.5",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      videoPath,
    ]);
    await execFileAsync(ffmpegPath, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=0.5",
      "-c:a",
      "pcm_s16le",
      audioPath,
    ]);

    const result = await createRemuxedVoiceChangerVideo({
      sourceVideoBuffer: await readFile(videoPath),
      sourceVideoFilename: "source.mp4",
      sourceVideoMimeType: "video/mp4",
      convertedAudioBuffer: await readFile(audioPath),
      convertedAudioContentType: "audio/wav",
    });
    await writeFile(outputPath, result.buffer);

    const videoProbe = await execFileAsync(ffmpegPath, [
      "-v",
      "error",
      "-i",
      outputPath,
      "-map",
      "0:v:0",
      "-f",
      "null",
      "-",
    ]);
    const audioProbe = await execFileAsync(ffmpegPath, [
      "-v",
      "error",
      "-i",
      outputPath,
      "-map",
      "0:a:0",
      "-f",
      "null",
      "-",
    ]);

    expect(result.contentType).toBe("video/mp4");
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(videoProbe.stderr).toBe("");
    expect(audioProbe.stderr).toBe("");
  }, 30_000);
});
