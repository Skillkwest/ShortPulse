import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSourceFromTransfer,
  createVoiceChangerSourceFromReference,
  findFirstSupportedFile,
} from "../voiceChangerSourceIntake";

const makeTransfer = ({
  data = {},
  files = [],
  items = [],
  types,
}: {
  data?: Record<string, string>;
  files?: File[];
  items?: Array<{ kind: string; type: string }>;
  types?: string[];
} = {}): DataTransfer =>
  ({
    types: types ?? Object.keys(data),
    files,
    items,
    getData: vi.fn((type: string) => data[type] ?? ""),
  }) as unknown as DataTransfer;

describe("voiceChangerSourceIntake", () => {
  const createObjectUrlMock = vi.fn((file: File) => `blob:mock-${file.name}`);
  let originalCreateObjectUrl: typeof URL.createObjectURL | undefined;

  beforeEach(() => {
    originalCreateObjectUrl = URL.createObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    createObjectUrlMock.mockClear();
  });

  afterEach(() => {
    if (originalCreateObjectUrl) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectUrl,
      });
    } else {
      delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    }
  });

  it("finds the first file matching the accepted source kinds", () => {
    const image = new File(["image"], "still.png", { type: "image/png" });
    const audio = new File(["audio"], "sample.mp3", { type: "audio/mpeg" });

    expect(findFirstSupportedFile([image, audio], ["audio"])).toBe(audio);
    expect(findFirstSupportedFile([image], ["audio", "video"])).toBeNull();
  });

  it("prefers native files over external plain-text URLs", () => {
    const file = new File(["audio"], "finder-voice.mp3", { type: "audio/mpeg" });
    const transfer = makeTransfer({
      files: [file],
      types: ["Files", "text/plain"],
      items: [{ kind: "file", type: "" }],
      data: {
        "text/plain": "https://external.example.com/not-the-file.mp3",
      },
    });

    const source = createSourceFromTransfer(transfer);

    expect(source).toMatchObject({
      kind: "audio",
      origin: "local",
      name: "finder-voice.mp3",
      file,
      sourceUrl: "blob:mock-finder-voice.mp3",
    });
  });

  it("prefers internal reference-grid audio payloads over synthetic browser files", () => {
    const syntheticFile = new File(["synthetic"], "synthetic.mp3", { type: "audio/mpeg" });
    const transfer = makeTransfer({
      files: [syntheticFile],
      types: [
        "Files",
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-media-kind",
        "text/reference-url",
      ],
      data: {
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-output-id": "output-audio-1",
        "text/reference-media-id": "media-audio-1",
        "text/reference-media-kind": "audio",
        "text/reference-url": "https://cdn.example.com/reference-grid-audio.mp3",
      },
    });

    const source = createSourceFromTransfer(transfer);

    expect(source).toMatchObject({
      kind: "audio",
      origin: "reference-grid",
      file: null,
      sourceUrl: "https://cdn.example.com/reference-grid-audio.mp3",
      referenceOutputId: "output-audio-1",
      referenceMediaId: "media-audio-1",
    });
    expect(source?.name).toBe("reference-grid-audio.mp3");
  });

  it("falls back to a durable reference URL when the render URL is a blob", () => {
    const transfer = makeTransfer({
      data: {
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-output-id": "output-audio-2",
        "text/reference-media-kind": "audio",
        "text/reference-render-url": "blob:preview-only",
        "text/reference-url": "https://cdn.example.com/durable-source.ogg",
      },
    });

    const source = createSourceFromTransfer(transfer);

    expect(source).toMatchObject({
      kind: "audio",
      origin: "reference-grid",
      sourceUrl: "https://cdn.example.com/durable-source.ogg",
      storagePath: null,
    });
  });

  it("rejects non-fetchable blob-only reference-grid drops", () => {
    const transfer = makeTransfer({
      data: {
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-output-id": "output-audio-3",
        "text/reference-media-kind": "audio",
        "text/reference-render-url": "blob:preview-only",
        "text/reference-url": "blob:source-only",
      },
    });

    expect(createSourceFromTransfer(transfer)).toBeNull();
  });

  it("filters source creation by accepted source kind", () => {
    const transfer = makeTransfer({
      data: {
        "text/plain": "https://cdn.example.com/source-video.mp4",
      },
    });

    expect(createSourceFromTransfer(transfer, ["audio"])).toBeNull();
    expect(createSourceFromTransfer(transfer, ["video"])).toMatchObject({
      kind: "video",
      origin: "url",
      sourceUrl: "https://cdn.example.com/source-video.mp4",
    });
  });

  it("keeps storage-backed references valid without a remote source URL", () => {
    const source = createVoiceChangerSourceFromReference({
      kind: "audio",
      origin: "reference-grid",
      name: "Stored source",
      storagePath: "user-1/generated/audio/source.wav",
    });

    expect(source).toMatchObject({
      kind: "audio",
      origin: "reference-grid",
      sourceUrl: null,
      storagePath: "user-1/generated/audio/source.wav",
    });
  });
});
