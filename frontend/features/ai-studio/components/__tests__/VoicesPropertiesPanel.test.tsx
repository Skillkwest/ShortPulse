/**
 * VoicesPropertiesPanel rendering tests.
 * Verifies the dedicated Voices workflow shell renders independently from TTS.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSharedVoicesGridStore } from "../../hooks/useSharedVoicesGrid";
import {
  buildVoiceoverElevenV3RequestConfig,
  VoicesPropertiesPanel,
} from "../VoicesPropertiesPanel";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const extractAudioWaveformPeaksFromUrlMock = vi.hoisted(() => vi.fn());
const uploadVoiceChangerSourceFileMock = vi.hoisted(() => vi.fn());
const extractVoiceChangerVideoSourceMock = vi.hoisted(() => vi.fn());
const resolveVoiceChangerVideoAspectMock = vi.hoisted(() => vi.fn());
const resolveVoiceChangerSourceStoragePathMock = vi.hoisted(() => vi.fn());
const signVoiceChangerStoragePathMock = vi.hoisted(() => vi.fn());
const createObjectUrlMock = vi.hoisted(() => vi.fn());
const revokeObjectUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../utils/voiceChangerSourceAsset", () => ({
  uploadVoiceChangerSourceFile: (...args: unknown[]) => uploadVoiceChangerSourceFileMock(...args),
  extractVoiceChangerVideoSource: (...args: unknown[]) =>
    extractVoiceChangerVideoSourceMock(...args),
  resolveVoiceChangerVideoAspect: (...args: unknown[]) =>
    resolveVoiceChangerVideoAspectMock(...args),
  resolveVoiceChangerSourceStoragePath: (...args: unknown[]) =>
    resolveVoiceChangerSourceStoragePathMock(...args),
  signVoiceChangerStoragePath: (...args: unknown[]) => signVoiceChangerStoragePathMock(...args),
}));

vi.mock("../../reference-grid/logic/referenceGridAudioWaveform", async () => {
  const actual = await vi.importActual<
    typeof import("../../reference-grid/logic/referenceGridAudioWaveform")
  >("../../reference-grid/logic/referenceGridAudioWaveform");
  return {
    ...actual,
    extractAudioWaveformPeaksFromUrl: (...args: unknown[]) =>
      extractAudioWaveformPeaksFromUrlMock(...args),
  };
});

describe("VoicesPropertiesPanel", () => {
  beforeEach(() => {
    resetSharedVoicesGridStore();
    fetchWithAuthMock.mockReset();
    extractAudioWaveformPeaksFromUrlMock.mockReset();
    uploadVoiceChangerSourceFileMock.mockReset();
    extractVoiceChangerVideoSourceMock.mockReset();
    resolveVoiceChangerVideoAspectMock.mockReset();
    resolveVoiceChangerSourceStoragePathMock.mockReset();
    signVoiceChangerStoragePathMock.mockReset();
    createObjectUrlMock.mockReset();
    revokeObjectUrlMock.mockReset();
    extractAudioWaveformPeaksFromUrlMock.mockResolvedValue(null);
    createObjectUrlMock.mockImplementation((value: unknown) => `blob:voice-${String(value)}`);
    uploadVoiceChangerSourceFileMock.mockImplementation(async ({ file }: { file: File }) => ({
      storagePath: `user-1/voice-changer/source-audio/${file.name}`,
      signedUrl: `https://signed.example/${encodeURIComponent(file.name)}`,
      mimeType: file.type || "audio/wav",
      name: file.name,
      size: file.size,
    }));
    extractVoiceChangerVideoSourceMock.mockResolvedValue({
      storagePath: "user-1/voice-changer/staged-audio/source.wav",
      signedUrl: "https://signed.example/staged-source.wav",
      mimeType: "audio/wav",
      name: "source.wav",
      size: 128,
    });
    resolveVoiceChangerVideoAspectMock.mockResolvedValue("9:16");
    resolveVoiceChangerSourceStoragePathMock.mockReturnValue(null);
    signVoiceChangerStoragePathMock.mockImplementation(async (storagePath: string) => {
      const filename = storagePath.split("/").filter(Boolean).pop() ?? "source";
      return `https://signed.example/${encodeURIComponent(filename)}`;
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the dedicated voices workflow surface", () => {
    render(<VoicesPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Voices" })).toBeInTheDocument();
    expect(screen.getByLabelText("Available voices")).toBeInTheDocument();
    expect(screen.queryByText("Available voices")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Create New Voice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Voice" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /darian voice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play darian sample/i })).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize available voices and prompt sections" })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Voice script" })).toHaveAttribute(
      "placeholder",
      "Paste or write the script that will be spoken with this voice."
    );
    expect(screen.getByRole("button", { name: "+ Create New Voice" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice description" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generate voice previews" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Generated voice previews")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play generated voice preview" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save voice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(screen.getByText("Voice mode")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Voice mode" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Voice Changer" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByLabelText("Voice shaping")).toBeInTheDocument();
    expect(screen.getByText("Voice shaping")).toBeInTheDocument();
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover language override" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Voiceover output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.queryByText("Create method")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference audio")).not.toBeInTheDocument();
    expect(screen.queryByText("Design setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Create mode uses the fixed 11v3 model.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice Design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Instant Voice Clone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice Remixing" })).not.toBeInTheDocument();
  });

  it("shows a header delete action for a selected live voice and removes it from the grid", async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          voices: [
            {
              voiceId: "voice_adam",
              name: "Adam",
              previewUrl: null,
              description: null,
              isFallback: false,
            },
            {
              voiceId: "voice_bella",
              name: "Bella",
              previewUrl: null,
              description: null,
              isFallback: false,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          voiceId: "voice_adam",
        }),
      });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /adam voice/i })).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: "Delete Voice" });
    expect(deleteButton).toBeEnabled();

    fireEvent.click(deleteButton);

    expect(confirmMock).toHaveBeenCalledWith('Delete "Adam"? This cannot be undone.');

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/voices/voice_adam", {
        method: "DELETE",
        shortpulseLogScope: "generation",
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /adam voice/i })).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /bella voice/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("keeps the create mode guidance in the right rail until the create panel opens", () => {
    render(<VoicesPropertiesPanel />);

    const scriptField = screen.getByRole("textbox", {
      name: "Voice script",
    });

    expect(scriptField).toHaveValue("");
    expect(scriptField).toHaveAttribute("maxLength", "5000");
    expect(screen.getByText("0 / 5,000")).toBeInTheDocument();
    expect(screen.queryByText("Design setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Create mode uses the fixed 11v3 model.")).not.toBeInTheDocument();
    expect(screen.queryByText("Design model")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview text")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Design model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Preview text mode" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Voice shaping")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Voiceover output format" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice description" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice name" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();
  });

  it("uses the top create button as the entry point to the create panel", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const createVoiceModal = screen.getByRole("dialog", { name: "Create New Voice" });
    const voiceNameField = screen.getByRole("textbox", { name: "Voice name" });
    expect(voiceNameField).toHaveFocus();
    expect(voiceNameField).toHaveValue("");
    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(createVoiceModal).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Voice description" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate voice previews" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save voice" })).toBeInTheDocument();
    expect(screen.getByLabelText("Voice shaping")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Voiceover output format" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();
  });

  it("renders skeleton voice chips while the live voices request is loading", () => {
    fetchWithAuthMock.mockImplementation(() => new Promise(() => undefined));

    const { container } = render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Loading voices…");
    expect(container.querySelectorAll(".voices-properties-voice-chip--skeleton")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /darian voice/i })).not.toBeInTheDocument();
  });

  it("switches the right rail between create and edit voice modes", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    expect(screen.getByRole("tab", { name: "Voice Changer" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByRole("textbox", { name: "Voice script" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Voice changer source drop zone")).toBeInTheDocument();
    expect(screen.getByText("Drop a source clip")).toBeInTheDocument();
    expect(screen.getByText("Record")).toBeInTheDocument();
    expect(
      screen.getByText("Record your voice to use as the source for the voice changer.")
    ).toBeInTheDocument();
    expect(screen.getByText("OR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record your voice sample" })).toBeInTheDocument();
    expect(screen.getByText(/Drag one audio or video file/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByLabelText("Voice changer shaping")).toBeInTheDocument();
    expect(screen.getByLabelText("Voice changer settings")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /noise reduction/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("combobox", { name: "Voice changer output format" })).toHaveValue(
      "mp3_44100_128"
    );
    expect(screen.queryByText("Input format")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voice changer input format" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice shaping")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover output format" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice description" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generate voice previews" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /speaker boost/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Voice changer model" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Voiceover" }));

    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Voice shaping")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Voiceover output format" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice description" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();
  });

  it("stages extracted audio from one local video source in the voice changer drop zone", async () => {
    const { container } = render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["video"], "demo-clip.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("Ready for conversion")).toBeInTheDocument();
    });

    expect(uploadVoiceChangerSourceFileMock).toHaveBeenCalledWith({
      file,
      kind: "video",
    });
    expect(extractVoiceChangerVideoSourceMock).toHaveBeenCalled();
    expect(screen.queryByText(/5 B ready for conversion/i)).not.toBeInTheDocument();
    expect(screen.queryByText("demo-clip.mp4")).not.toBeInTheDocument();
    expect(screen.queryByText("Video source")).not.toBeInTheDocument();
    expect(screen.queryByText("From your computer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("continues local video staging when upload returns only a storage path", async () => {
    uploadVoiceChangerSourceFileMock.mockResolvedValueOnce({
      storagePath: "user-1/voice-changer/source-video/local-only.mp4",
      signedUrl: null,
      mimeType: "video/mp4",
      name: "local-only.mp4",
      size: 5,
    });

    const { container } = render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["video"], "local-only.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(extractVoiceChangerVideoSourceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceStoragePath: "user-1/voice-changer/source-video/local-only.mp4",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Ready for conversion")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("does not block readiness on delayed video aspect detection", async () => {
    resolveVoiceChangerVideoAspectMock.mockImplementationOnce(
      () => new Promise<string | null>(() => undefined)
    );

    const { container } = render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["video"], "slow-aspect.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("Ready for conversion")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("preserves the original video aspect when submitting a remuxable voice changer source", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_darian_123",
            name: "Darian",
            previewUrl: "https://cdn.elevenlabs.test/darian.mp3",
            description: "Warm, grounded storyteller",
            isFallback: false,
          },
        ],
      }),
    });
    const onGenerate = vi.fn();
    const { container } = render(<VoicesPropertiesPanel onGenerate={onGenerate} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /darian voice/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    const file = new File(["video"], "portrait-clip.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await screen.findByText("Ready for conversion");

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "voice-changer",
        source: expect.objectContaining({
          extractedFrom: expect.objectContaining({
            aspect: "9:16",
            name: "portrait-clip.mp4",
          }),
        }),
        voiceSettings: {
          stability: 1,
          similarity_boost: 1,
          speed: 1,
          use_speaker_boost: true,
        },
      })
    );
  });

  it("keeps the local video preview alive until extraction finishes", async () => {
    type UploadedVideoSource = {
      storagePath: string;
      signedUrl: string;
      mimeType: string;
      name: string;
      size: number;
    };
    type ExtractedAudioSource = {
      storagePath: string;
      signedUrl: string;
      mimeType: "audio/wav";
      name: string;
      size: number;
    };
    const createDeferred = <T,>() => {
      let resolveValue!: (value: T) => void;
      const promise = new Promise<T>((resolve) => {
        resolveValue = resolve;
      });
      return {
        promise,
        resolve: resolveValue,
      };
    };
    const uploadDeferred = createDeferred<UploadedVideoSource>();
    const extractDeferred = createDeferred<ExtractedAudioSource>();

    uploadVoiceChangerSourceFileMock.mockImplementationOnce(() => uploadDeferred.promise);
    extractVoiceChangerVideoSourceMock.mockImplementationOnce(() => extractDeferred.promise);

    const { container } = render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    const file = new File(["video"], "demo-clip.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await screen.findByText("Preparing voice sample from video");
    expect(
      container.querySelector(".voices-properties-voice-changer-dropzone-spinner")
    ).not.toBeNull();
    expect(
      container.querySelector(".voices-properties-voice-changer-dropzone-loading-preview")
    ).not.toBeNull();
    expect(container.querySelector(".voices-properties-voice-changer-dropzone-video")).toBeNull();
    expect(revokeObjectUrlMock).not.toHaveBeenCalled();

    uploadDeferred.resolve({
      storagePath: "user-1/voice-changer/source-video/demo-clip.mp4",
      signedUrl: "https://signed.example/demo-clip.mp4",
      mimeType: "video/mp4",
      name: "demo-clip.mp4",
      size: 5,
    });

    await screen.findByText("Extracting voice sample");
    expect(
      container.querySelector(".voices-properties-voice-changer-dropzone-spinner")
    ).not.toBeNull();
    expect(
      container.querySelector(".voices-properties-voice-changer-dropzone-loading-preview")
    ).not.toBeNull();
    expect(container.querySelector(".voices-properties-voice-changer-dropzone-video")).toBeNull();
    expect(revokeObjectUrlMock).not.toHaveBeenCalled();

    extractDeferred.resolve({
      storagePath: "user-1/voice-changer/staged-audio/demo-clip.wav",
      signedUrl: "https://signed.example/demo-clip.wav",
      mimeType: "audio/wav",
      name: "demo-clip.wav",
      size: 128,
    });

    await screen.findByText("Ready for conversion");
    expect(container.querySelector(".voices-properties-voice-changer-dropzone-spinner")).toBeNull();
    expect(
      container.querySelector(".voices-properties-voice-changer-dropzone-loading-preview")
    ).toBeNull();
    await waitFor(() => {
      expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
    });
  });

  it("records a local audio source from the voice changer recorder", async () => {
    const mediaStreamTrackStop = vi.fn();
    const mediaStream = {
      getTracks: () => [{ stop: mediaStreamTrackStop }],
    };
    const getUserMediaMock = vi.fn().mockResolvedValue(mediaStream);
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    class MockMediaRecorder {
      static isTypeSupported(type: string) {
        return type === "audio/webm;codecs=opus" || type === "audio/webm";
      }

      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: MediaStream, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "audio/webm";
      }

      start() {}

      stop() {
        this.ondataavailable?.({
          data: new Blob(["recorded-audio"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));
    fireEvent.click(screen.getByRole("button", { name: "Record your voice sample" }));

    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
    const stopRecordingButton = await screen.findByRole("button", {
      name: "Stop recording your voice sample",
    });

    fireEvent.click(stopRecordingButton);

    await waitFor(() => {
      expect(screen.getByText("Ready for conversion")).toBeInTheDocument();
    });

    expect(uploadVoiceChangerSourceFileMock).toHaveBeenCalledWith({
      file: expect.any(File),
      kind: "audio",
    });

    expect(screen.queryByText(/voice-sample-/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b(?:B|KB|MB|GB)\b.*ready for conversion/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Audio source")).not.toBeInTheDocument();
    expect(screen.queryByText("From your computer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(mediaStreamTrackStop).toHaveBeenCalled();
  });

  it("renders an interactive waveform preview for loaded audio sources", async () => {
    extractAudioWaveformPeaksFromUrlMock.mockResolvedValue(
      Array.from({ length: 56 }, (_, index) => 16 + ((index * 7) % 68))
    );

    const { container } = render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["audio"], "voice-source.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadVoiceChangerSourceFileMock).toHaveBeenCalledWith({
        file,
        kind: "audio",
      });
    });

    const playButton = await screen.findByRole("button", { name: "Play source audio preview" });
    const audioNode = container.querySelector(
      ".voices-properties-voice-changer-audio-element"
    ) as HTMLAudioElement | null;

    expect(audioNode).not.toBeNull();
    expect(
      container.querySelectorAll(".voices-properties-voice-changer-audio-wavebar").length
    ).toBeGreaterThan(20);

    Object.defineProperty(audioNode, "duration", {
      configurable: true,
      value: 6,
    });
    Object.defineProperty(audioNode, "currentTime", {
      configurable: true,
      writable: true,
      value: 0,
    });

    fireEvent.loadedMetadata(audioNode as HTMLAudioElement);
    fireEvent.click(playButton);

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    fireEvent.play(audioNode as HTMLAudioElement);
    expect(screen.getByRole("button", { name: "Pause source audio preview" })).toBeInTheDocument();

    Object.defineProperty(audioNode, "currentTime", {
      configurable: true,
      writable: true,
      value: 2.1,
    });
    fireEvent.timeUpdate(audioNode as HTMLAudioElement);

    expect(screen.getByText("0:02")).toBeInTheDocument();
    expect(screen.getByText("0:06")).toBeInTheDocument();
    expect(
      container.querySelectorAll(
        '.voices-properties-voice-changer-audio-wavebar[data-progress-state="played"]'
      ).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Pause source audio preview" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("accepts a native local audio file drag into the voice changer drop zone", async () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const sourceFile = new File(["audio"], "finder-voice.mp3", { type: "audio/mpeg" });
    const dragOverDataTransfer = {
      types: ["Files"],
      items: [{ kind: "file", type: "" }],
      files: [],
      getData: () => "",
      dropEffect: "none",
    };
    const dropDataTransfer = {
      ...dragOverDataTransfer,
      files: [sourceFile],
    };

    fireEvent.dragOver(dropZone, { dataTransfer: dragOverDataTransfer });

    expect(dragOverDataTransfer.dropEffect).toBe("copy");
    expect(dropZone.className).toContain("is-drag-active");

    fireEvent.drop(dropZone, { dataTransfer: dropDataTransfer });

    await waitFor(() => {
      expect(screen.getByText("Ready for conversion")).toBeInTheDocument();
    });

    expect(uploadVoiceChangerSourceFileMock).toHaveBeenCalledWith({
      file: sourceFile,
      kind: "audio",
    });

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Play source audio preview" })).toBeInTheDocument();
  });

  it("accepts an internal reference-grid video drop in voice changer mode", async () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const dataTransfer = {
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-url",
        "text/reference-render-url",
      ],
      files: [],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-123",
            "text/reference-url": "https://cdn.shortpulse.test/renders/shot-01.mp4",
            "text/reference-render-url": "https://cdn.shortpulse.test/renders/shot-01.mp4",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(extractVoiceChangerVideoSourceMock).toHaveBeenCalledWith({
        sourceName: "shot-01.mp4",
        sourceOrigin: "reference-grid",
        sourceMimeType: "video/mp4",
        sourceStoragePath: null,
        sourceUrl: "https://cdn.shortpulse.test/renders/shot-01.mp4",
      });
    });

    expect(screen.queryByText("shot-01.mp4")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference Grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("preserves reference-grid source identity for the active voice changer source video", async () => {
    const onActiveVoiceChangerSourceVideoChange = vi.fn();
    render(
      <VoicesPropertiesPanel
        onActiveVoiceChangerSourceVideoChange={onActiveVoiceChangerSourceVideoChange}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const dataTransfer = {
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-media-id",
        "text/reference-url",
        "text/reference-render-url",
      ],
      files: [],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-123",
            "text/reference-media-id": "media-456",
            "text/reference-url": "https://cdn.shortpulse.test/renders/shot-01.mp4",
            "text/reference-render-url": "https://cdn.shortpulse.test/renders/shot-01.mp4",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(onActiveVoiceChangerSourceVideoChange).toHaveBeenLastCalledWith({
        referenceOutputId: "output-123",
        referenceMediaId: "media-456",
        aspect: "9:16",
      });
    });
  });

  it("accepts an internal reference-grid audio drop in voice changer mode", async () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const dataTransfer = {
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-url",
        "text/reference-render-url",
      ],
      files: [],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-audio-123",
            "text/reference-url": "https://cdn.shortpulse.test/renders/sample-voice.mp3",
            "text/reference-render-url": "https://cdn.shortpulse.test/renders/sample-voice.mp3",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(screen.getByText(/ready for conversion/i)).toBeInTheDocument();
    });

    expect(screen.queryByText("sample-voice.mp3")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference Grid")).not.toBeInTheDocument();
    expect(screen.queryByText("Audio source")).not.toBeInTheDocument();
    expect(screen.getByText(/ready for conversion/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("falls back to a durable reference-grid URL when the render URL is a blob", async () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const dataTransfer = {
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-url",
        "text/reference-render-url",
      ],
      files: [],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-123",
            "text/reference-url": "https://cdn.shortpulse.test/renders/shot-02.mp4",
            "text/reference-render-url": "blob:http://localhost:3000/shot-02",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(extractVoiceChangerVideoSourceMock).toHaveBeenCalledWith({
        sourceName: "shot-02.mp4",
        sourceOrigin: "reference-grid",
        sourceMimeType: "video/mp4",
        sourceStoragePath: null,
        sourceUrl: "https://cdn.shortpulse.test/renders/shot-02.mp4",
      });
    });

    expect(screen.queryByText("shot-02.mp4")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference Grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("rejects non-fetchable blob-only reference-grid drops in voice changer mode", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const dataTransfer = {
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-url",
        "text/reference-render-url",
      ],
      files: [],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-123",
            "text/reference-url": "blob:http://localhost:3000/shot-03-source",
            "text/reference-render-url": "blob:http://localhost:3000/shot-03-render",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    expect(screen.queryByText("shot-03-source")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("uses the voiceover shaping controls only", () => {
    render(<VoicesPropertiesPanel />);

    expect(screen.getByText("Speed")).toBeInTheDocument();
    expect(screen.getByText("1.00x")).toBeInTheDocument();
    expect(screen.getByText("Stability")).toBeInTheDocument();
    expect(screen.getByText("0.50")).toBeInTheDocument();
    expect(screen.getByText("Similarity boost")).toBeInTheDocument();
    expect(screen.getByText("0.75")).toBeInTheDocument();
    expect(screen.queryByText("Style exaggeration")).not.toBeInTheDocument();
    expect(screen.queryByText("Similarity")).not.toBeInTheDocument();
    expect(screen.queryByText("Speaker boost")).not.toBeInTheDocument();
  });

  it("lets voiceover sliders move locally and updates the readout", () => {
    render(<VoicesPropertiesPanel />);

    const speedSlider = screen.getByRole("slider", { name: "Speed" });
    fireEvent.change(speedSlider, { target: { value: "80" } });

    expect(speedSlider).toHaveValue("80");
    expect(screen.getByText("1.30x")).toBeInTheDocument();
  });

  it("hard-codes the correct Eleven v3 voiceover request defaults", () => {
    expect(
      buildVoiceoverElevenV3RequestConfig({
        speed: 50,
        stability: 50,
        similarityBoost: 75,
      })
    ).toEqual({
      model_id: "eleven_multilingual_v2",
      language_code: null,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1,
        style: 0,
      },
    });
  });

  it("lets voice changer sliders move locally and keeps their peach-mode values", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const speedSlider = screen.getByRole("slider", { name: "Speed" });
    fireEvent.change(speedSlider, { target: { value: "72" } });

    expect(speedSlider).toHaveValue("72");
    expect(screen.getByText("1.08x")).toBeInTheDocument();
  });

  it("keeps voiceover and voice changer slider values decoupled across mode switches", () => {
    render(<VoicesPropertiesPanel />);

    const voiceoverSpeedSlider = screen.getByRole("slider", { name: "Speed" });
    fireEvent.change(voiceoverSpeedSlider, { target: { value: "80" } });
    expect(voiceoverSpeedSlider).toHaveValue("80");
    expect(screen.getByText("1.30x")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const voiceChangerSpeedSlider = screen.getByRole("slider", { name: "Speed" });
    expect(voiceChangerSpeedSlider).toHaveValue("64");
    expect(screen.getByText("0.96x")).toBeInTheDocument();

    fireEvent.change(voiceChangerSpeedSlider, { target: { value: "72" } });
    expect(voiceChangerSpeedSlider).toHaveValue("72");
    expect(screen.getByText("1.08x")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Voiceover" }));

    const voiceoverSpeedSliderAfterReturn = screen.getByRole("slider", { name: "Speed" });
    expect(voiceoverSpeedSliderAfterReturn).toHaveValue("80");
    expect(screen.getByText("1.30x")).toBeInTheDocument();
  });

  it("closes the create modal without inserting a fake local voice", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Beacon" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Voice description" }), {
      target: { value: "Clear, bright guide voice with a polished documentary tone." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Close create voice modal" }));

    expect(screen.queryByRole("dialog", { name: "Create New Voice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /beacon voice/i })).not.toBeInTheDocument();
  });

  it("generates previews and saves the selected provider voice into the voices grid", async () => {
    class MockAudio {
      src: string;
      preload = "";
      currentTime = 0;
      ended = false;
      onplay: (() => void) | null = null;
      onpause: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(src: string) {
        this.src = src;
      }

      play() {
        this.onplay?.();
        return Promise.resolve();
      }

      pause() {
        this.onpause?.();
      }
    }

    vi.stubGlobal("Audio", MockAudio as unknown as typeof Audio);
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          previews: [
            {
              generatedVoiceId: "generated-voice-1",
              audioBase64: "ZmFrZS1hdWRpby0x",
              mediaType: "audio/mpeg",
              durationSecs: 2.4,
              language: "en",
            },
            {
              generatedVoiceId: "generated-voice-2",
              audioBase64: "ZmFrZS1hdWRpby0y",
              mediaType: "audio/mpeg",
              durationSecs: 2.1,
              language: "en",
            },
          ],
          previewText: "This is the generated preview text.",
          modelId: "eleven_multilingual_ttv_v2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          voice: {
            voiceId: "voice_created_123",
            name: "Lantern",
            previewUrl: "https://cdn.elevenlabs.test/created-lantern.mp3",
            description: "Measured documentary narrator with a warm, grounded cadence.",
            isFallback: false,
          },
        }),
      });

    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Lantern" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Voice description" }), {
      target: { value: "Measured documentary narrator with a warm, grounded cadence." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate voice previews" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/text-to-voice/design", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceName: "Lantern",
          voiceDescription: "Measured documentary narrator with a warm, grounded cadence.",
        }),
        shortpulseLogScope: "generation",
      });
    });

    expect(screen.getByRole("button", { name: "Select generated preview 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select generated preview 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play generated preview 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Select generated preview 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Save voice" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/text-to-voice/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceName: "Lantern",
          voiceDescription: "Measured documentary narrator with a warm, grounded cadence.",
          generatedVoiceId: "generated-voice-2",
          playedNotSelectedVoiceIds: ["generated-voice-1"],
        }),
        shortpulseLogScope: "generation",
      });
    });

    expect(screen.queryByRole("dialog", { name: "Create New Voice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lantern voice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lantern voice/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("overwrites the prompt text when dropping a prompt into the create-side prompt box", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const promptField = screen.getByRole("textbox", { name: "Voice description" });
    fireEvent.change(promptField, {
      target: { value: "Original prompt that should be replaced." },
    });
    expect(promptField).toHaveValue("Original prompt that should be replaced.");

    const dataTransfer = {
      types: ["text/prompt"],
      getData: (type: string) =>
        type === "text/prompt" ? "Deep dramatic baritone for trailers and cinematic reveals." : "",
      dropEffect: "none",
    };

    fireEvent.dragOver(promptField, { dataTransfer });
    fireEvent.drop(promptField, { dataTransfer });

    expect(promptField).toHaveValue("Deep dramatic baritone for trailers and cinematic reveals.");
  });

  it("overwrites the text-to-speech script when dropping text into the main script box", () => {
    render(<VoicesPropertiesPanel />);

    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    fireEvent.change(scriptField, {
      target: { value: "Original script that should be replaced." },
    });
    expect(scriptField).toHaveValue("Original script that should be replaced.");

    const dataTransfer = {
      types: ["text/prompt"],
      getData: (type: string) =>
        type === "text/prompt" ? "Deep dramatic baritone for trailers and cinematic reveals." : "",
      dropEffect: "none",
    };

    fireEvent.dragOver(scriptField, { dataTransfer });
    fireEvent.drop(scriptField, { dataTransfer });

    expect(scriptField).toHaveValue("Deep dramatic baritone for trailers and cinematic reveals.");
  });

  it("keeps the voice prompt and voice script fully decoupled", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const promptField = screen.getByRole("textbox", { name: "Voice description" });
    const voiceNameField = screen.getByRole("textbox", { name: "Voice name" });
    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    const createVoiceButton = screen.getByRole("button", { name: "Generate voice previews" });
    const saveVoiceButton = screen.getByRole("button", { name: "Save voice" });
    const generateButton = screen.getByRole("button", { name: "Generate" });

    fireEvent.change(voiceNameField, {
      target: { value: "Prompt Lane" },
    });
    fireEvent.change(promptField, {
      target: { value: "Prompt-only text for generating a new voice." },
    });

    expect(voiceNameField).toHaveValue("Prompt Lane");
    expect(promptField).toHaveValue("Prompt-only text for generating a new voice.");
    expect(scriptField).toHaveValue("");
    expect(createVoiceButton).toBeEnabled();
    expect(saveVoiceButton).toBeDisabled();
    expect(generateButton).toBeDisabled();

    fireEvent.change(scriptField, {
      target: { value: "Script-only text for speech output." },
    });

    expect(promptField).toHaveValue("Prompt-only text for generating a new voice.");
    expect(scriptField).toHaveValue("Script-only text for speech output.");
    expect(createVoiceButton).toBeEnabled();
    expect(saveVoiceButton).toBeDisabled();
    expect(generateButton).toBeEnabled();

    fireEvent.change(promptField, {
      target: { value: "" },
    });

    expect(promptField).toHaveValue("");
    expect(scriptField).toHaveValue("Script-only text for speech output.");
    expect(createVoiceButton).toBeDisabled();
    expect(saveVoiceButton).toBeDisabled();
    expect(generateButton).toBeEnabled();
  });

  it("resizes the voice list and prompt sections when dragging the divider", () => {
    const { container } = render(<VoicesPropertiesPanel />);

    const divider = screen.getByRole("separator", {
      name: "Resize available voices and prompt sections",
    });
    const splitContainer = container.querySelector(".voices-properties-main") as HTMLElement;

    expect(splitContainer).toBeTruthy();
    Object.defineProperty(splitContainer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 700,
        height: 900,
        right: 700,
        bottom: 900,
        toJSON: () => ({}),
      }),
    });

    const before = Number(divider.getAttribute("aria-valuenow"));
    expect(Number.isFinite(before)).toBe(true);

    fireEvent.pointerDown(divider, {
      pointerId: 101,
      button: 0,
      clientY: 430,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(window, { pointerId: 101, clientY: 320 });
    fireEvent.pointerUp(window, { pointerId: 101, clientY: 320 });

    const after = Number(divider.getAttribute("aria-valuenow"));
    expect(after).toBeLessThan(before);
  });

  it("hides the voices grid and top create button when the top pane is fully collapsed", () => {
    const { container } = render(<VoicesPropertiesPanel />);

    const divider = screen.getByRole("separator", {
      name: "Resize available voices and prompt sections",
    });
    const splitContainer = container.querySelector(".voices-properties-main") as HTMLElement;

    Object.defineProperty(splitContainer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 700,
        height: 900,
        right: 700,
        bottom: 900,
        toJSON: () => ({}),
      }),
    });

    fireEvent.keyDown(divider, { key: "Home" });

    expect(screen.queryByRole("button", { name: "+ Create New Voice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /darian voice/i })).not.toBeInTheDocument();
  });

  it("keeps generation disabled when only fallback ElevenLabs default voices are available", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "fallback",
        warning: "Showing the ElevenLabs default catalog until live voices are configured.",
        voices: [
          {
            voiceId: "elevenlabs-default:darian",
            name: "Darian",
            previewUrl: null,
            isFallback: true,
          },
        ],
      }),
    });
    const onGenerate = vi.fn();

    render(<VoicesPropertiesPanel onGenerate={onGenerate} />);

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/voices", {
        shortpulseLogScope: "generation",
      });
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Voice script" }), {
      target: { value: "Fallback voices should not submit to ElevenLabs." },
    });

    expect(
      screen.getByText("Showing the ElevenLabs default catalog until live voices are configured.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("submits generation with the live ElevenLabs default voice ids when they load", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_darian_123",
            name: "Darian",
            previewUrl: "https://cdn.elevenlabs.test/darian.mp3",
            description: "Warm, grounded storyteller",
            isFallback: false,
          },
        ],
      }),
    });
    const onGenerate = vi.fn();

    render(<VoicesPropertiesPanel onGenerate={onGenerate} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /darian voice/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Voice script" }), {
      target: { value: "Use the live Darian voice id for generation." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "voiceover",
        script: "Use the live Darian voice id for generation.",
        voice: expect.objectContaining({
          id: "voice_live_darian_123",
          name: "Darian",
          provider: "elevenlabs",
          isFallback: false,
        }),
      })
    );
  });

  it("keeps generate enabled and allows repeated submissions while generation is in flight", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_repeat_123",
            name: "Repeat Voice",
            previewUrl: "https://cdn.elevenlabs.test/repeat.mp3",
            isFallback: false,
          },
        ],
      }),
    });
    const onGenerate = vi.fn();

    render(<VoicesPropertiesPanel onGenerate={onGenerate} isGenerating />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /repeat voice voice/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Voice script" }), {
      target: { value: "Allow multiple voiceover submissions while prior runs are pending." },
    });

    const generateButton = screen.getByRole("button", { name: "Generate" });
    expect(generateButton).toBeEnabled();
    expect(screen.getByText("Generating…")).toBeInTheDocument();

    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledTimes(2);
    });
  });

  it("plays and stops a live voice sample from the chip play button", async () => {
    const pauseMock = vi.fn();
    const playMock = vi.fn().mockResolvedValue(undefined);
    class MockAudio {
      src: string;
      preload = "";
      currentTime = 0;
      ended = false;
      onplay: (() => void) | null = null;
      onpause: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(src: string) {
        this.src = src;
      }

      play() {
        playMock(this.src);
        this.onplay?.();
        return Promise.resolve();
      }

      pause() {
        pauseMock(this.src);
        this.onpause?.();
      }
    }
    vi.stubGlobal("Audio", MockAudio as unknown as typeof Audio);
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_bella_123",
            name: "Bella - Professional, Bright, Warm",
            previewUrl: "https://cdn.elevenlabs.test/bella.mp3",
            description: "professional",
            isFallback: false,
          },
        ],
      }),
    });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    const playButton = await screen.findByRole("button", {
      name: /play bella - professional, bright, warm sample/i,
    });
    fireEvent.click(playButton);

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledWith("https://cdn.elevenlabs.test/bella.mp3");
    });
    expect(
      screen.getByRole("button", {
        name: /stop bella - professional, bright, warm sample/i,
      })
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", {
        name: /stop bella - professional, bright, warm sample/i,
      })
    );

    expect(pauseMock).toHaveBeenCalledWith("https://cdn.elevenlabs.test/bella.mp3");
    expect(
      screen.getByRole("button", {
        name: /play bella - professional, bright, warm sample/i,
      })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("shows only the base voice name on chips when provider names include descriptors", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_adam_123",
            name: "Adam - Deep, cinematic, resonant",
            previewUrl: "https://cdn.elevenlabs.test/adam.mp3",
            description: "Deep, cinematic, resonant",
            isFallback: false,
          },
        ],
      }),
    });

    const { container } = render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /adam - deep, cinematic, resonant voice/i })
      ).toBeInTheDocument();
    });

    expect(container.querySelector(".voices-properties-voice-chip-name")?.textContent).toBe("Adam");
    expect(screen.queryByText("Adam - Deep, cinematic, resonant")).not.toBeInTheDocument();
  });

  it("strips colon-formatted descriptors from voice chips and the generate row", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_maya_123",
            name: "Maya: Young, shy, introspective but a bit anxious",
            previewUrl: "https://cdn.elevenlabs.test/maya.mp3",
            description: "Young, shy, introspective but a bit anxious",
            isFallback: false,
          },
        ],
      }),
    });

    const { container } = render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /maya: young, shy, introspective but a bit anxious voice/i,
        })
      ).toBeInTheDocument();
    });

    expect(container.querySelector(".voices-properties-voice-chip-name")?.textContent).toBe("Maya");
    expect(
      (container.querySelector(".voices-properties-generate-context-value") as HTMLElement | null)
        ?.textContent
    ).toBe("Maya");
    expect(screen.queryByText(/Maya: Young, shy, introspective/i)).not.toBeInTheDocument();
  });

  it("shows the selected grid voice in the generate row", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_adam_123",
            name: "Adam",
            previewUrl: "https://cdn.elevenlabs.test/adam.mp3",
            description: "steady",
            isFallback: false,
          },
          {
            voiceId: "voice_live_bella_123",
            name: "Bella",
            previewUrl: "https://cdn.elevenlabs.test/bella.mp3",
            description: "bright",
            isFallback: false,
          },
        ],
      }),
    });

    const { container } = render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /adam voice/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    const selectedVoiceValue = container.querySelector(
      ".voices-properties-generate-context-value"
    ) as HTMLElement | null;
    expect(selectedVoiceValue?.textContent).toBe("Adam");

    fireEvent.click(screen.getByRole("button", { name: /bella voice/i }));

    expect(selectedVoiceValue?.textContent).toBe("Bella");
  });
});
