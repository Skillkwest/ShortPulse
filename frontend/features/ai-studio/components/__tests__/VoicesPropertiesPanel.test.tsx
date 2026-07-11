/**
 * VoicesPropertiesPanel rendering tests.
 * Verifies the dedicated Voices workflow shell renders independently from TTS.
 */
import { readFileSync } from "node:fs";
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CUSTOM_VOICE_NAME_CHARACTERS } from "../../../../lib/customVoiceName";
import { resolvePricingGridBilledCredits } from "../../../../lib/model-runtime/pricingGridBilledCredits";
import { createCanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import { AI_STUDIO_PLAN_CTA } from "../../logic/generationAccessCta";
import { resetSharedVoicesGridStore } from "../../hooks/useSharedVoicesGrid";
import { useVoiceChangerSourceController } from "../../hooks/useVoiceChangerSourceController";
import {
  hardcodedVoiceGenerationDefaults,
  hardcodedVoiceOutputFormat,
  hardcodedVoiceoverV3Defaults,
  hardcodedVoiceoverModelId,
  buildVoiceoverRequestConfig,
  VoicesPropertiesPanel,
} from "../VoicesPropertiesPanel";
import {
  createVoiceChangerSourceFromFile,
  VoiceChangerSourceDropzone,
  type VoiceChangerSource,
} from "../VoiceChangerSourceDropzone";
import { preparePromptReferenceDrag, prepareReferenceDrag } from "../../utils/dragDrop";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const extractAudioWaveformPeaksFromUrlMock = vi.hoisted(() => vi.fn());
const uploadVoiceChangerSourceFileMock = vi.hoisted(() => vi.fn());
const stageVoiceChangerVideoReferenceSourceMock = vi.hoisted(() => vi.fn());
const uploadVoiceCloneSourceFileMock = vi.hoisted(() => vi.fn());
const extractVoiceChangerVideoSourceMock = vi.hoisted(() => vi.fn());
const resolveVoiceChangerMediaDurationMsMock = vi.hoisted(() => vi.fn());
const resolveVoiceChangerVideoAspectMock = vi.hoisted(() => vi.fn());
const resolveVoiceChangerSourceStoragePathMock = vi.hoisted(() => vi.fn());
const signVoiceChangerStoragePathMock = vi.hoisted(() => vi.fn());
const createObjectUrlMock = vi.hoisted(() => vi.fn());
const revokeObjectUrlMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;
const voicesPropertiesStylesheet = readFileSync(
  "styles/ai-studio-voices-properties.module.css",
  "utf8"
);

const extractVoicesCssRule = (selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = Array.from(
    voicesPropertiesStylesheet.matchAll(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "g"))
  );
  return matches.at(-1)?.groups?.body ?? "";
};

const createReferenceDragTransfer = () => {
  const data: Record<string, string> = {};
  const transfer = {
    effectAllowed: "all",
    dropEffect: "none",
    files: emptyFileList,
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    getData: (type: string) => data[type] ?? "",
    get types() {
      return Object.keys(data);
    },
    setDragImage: () => undefined,
  } as unknown as DataTransfer;
  const dragNode = document.createElement("div");
  const event = {
    dataTransfer: transfer,
    currentTarget: dragNode,
  } as unknown as Parameters<typeof prepareReferenceDrag>[0];
  return { transfer, event };
};

const createPromptReferenceDragTransfer = (promptText: string): DataTransfer => {
  const { transfer, event } = createReferenceDragTransfer();
  preparePromptReferenceDrag(event, {
    promptText,
    referenceId: "canvas-text-reference",
    sourceSurface: "all-refs",
  });
  return transfer;
};

const createTransfer = (data: Record<string, string>): DataTransfer => {
  const transferData = { ...data };
  return {
    effectAllowed: "all",
    dropEffect: "none",
    files: emptyFileList,
    setData: (type: string, value: string) => {
      transferData[type] = value;
    },
    getData: (type: string) => transferData[type] ?? "",
    get types() {
      return Object.keys(transferData);
    },
    setDragImage: () => undefined,
  } as unknown as DataTransfer;
};

const mockElementRect = (
  element: HTMLElement,
  rect: Pick<DOMRect, "bottom" | "height" | "left" | "right" | "top" | "width" | "x" | "y">
) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(
      () =>
        ({
          ...rect,
          toJSON: () => ({}),
        }) as DOMRect
    ),
  });
};

const openVoicesLibraryModal = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Voices" }));
  return await screen.findByRole("dialog", { name: "Voices" });
};

const openCreateVoiceModal = async () => {
  await openVoicesLibraryModal();
  fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));
  return await screen.findByRole("dialog", { name: "Create New Voice" });
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

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  useSupabaseSessionState: () => useSupabaseSessionStateMock(),
}));

vi.mock("../../utils/voiceChangerSourceAsset", () => ({
  uploadVoiceChangerSourceFile: (...args: unknown[]) => uploadVoiceChangerSourceFileMock(...args),
  stageVoiceChangerVideoReferenceSource: (...args: unknown[]) =>
    stageVoiceChangerVideoReferenceSourceMock(...args),
  uploadVoiceCloneSourceFile: (...args: unknown[]) => uploadVoiceCloneSourceFileMock(...args),
  extractVoiceChangerVideoSource: (...args: unknown[]) =>
    extractVoiceChangerVideoSourceMock(...args),
  resolveVoiceChangerMediaDurationMs: (...args: unknown[]) =>
    resolveVoiceChangerMediaDurationMsMock(...args),
  resolveVoiceChangerVideoAspect: (...args: unknown[]) =>
    resolveVoiceChangerVideoAspectMock(...args),
  resolveVoiceChangerSourceStoragePath: (...args: unknown[]) =>
    resolveVoiceChangerSourceStoragePathMock(...args),
  signVoiceSourceStoragePath: (...args: unknown[]) => signVoiceChangerStoragePathMock(...args),
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
    stageVoiceChangerVideoReferenceSourceMock.mockReset();
    uploadVoiceCloneSourceFileMock.mockReset();
    extractVoiceChangerVideoSourceMock.mockReset();
    resolveVoiceChangerMediaDurationMsMock.mockReset();
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
    stageVoiceChangerVideoReferenceSourceMock.mockImplementation(
      async ({ sourceName }: { sourceName: string }) => ({
        storagePath: `user-1/voice-changer/source-video/${sourceName}`,
        signedUrl: `https://signed.example/${encodeURIComponent(sourceName)}`,
        mimeType: "video/mp4",
        name: sourceName,
        size: 1024,
      })
    );
    uploadVoiceCloneSourceFileMock.mockImplementation(async ({ file }: { file: File }) => ({
      storagePath: `user-1/voice-clone/source-audio/${file.name}`,
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
    resolveVoiceChangerMediaDurationMsMock.mockResolvedValue(4200);
    resolveVoiceChangerVideoAspectMock.mockResolvedValue("9:16");
    resolveVoiceChangerSourceStoragePathMock.mockReturnValue(null);
    signVoiceChangerStoragePathMock.mockImplementation(async (storagePath: string) => {
      const filename = storagePath.split("/").filter(Boolean).pop() ?? "source";
      return `https://signed.example/${encodeURIComponent(filename)}`;
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
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
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the dedicated voices workflow surface", () => {
    const { container } = render(<VoicesPropertiesPanel />);
    const voicesButton = screen.getByRole("button", { name: "Voices" });

    expect(screen.getByRole("heading", { name: "Select or create new voice" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Available voices")).not.toBeInTheDocument();
    expect(voicesButton).toBeInTheDocument();
    expect(voicesButton).toHaveStyle("width: 144px");
    expect(voicesButton).toHaveStyle("height: 42px");
    expect(voicesButton).toHaveStyle("padding: 0 24px");
    expect(voicesButton).toHaveStyle("font-size: 0.98rem");
    expect(
      voicesButton
        .closest(".voices-properties-library-selector--footer")
        ?.closest(".voices-properties-script-actions")
    ).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Voice script" })).toHaveAttribute(
      "placeholder",
      "Paste or write the script that will be spoken with this voice."
    );
    expect(screen.queryByRole("button", { name: "+ Create New Voice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Enter your prompt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create New Voice" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Generated voice previews")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play generated voice preview" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save voice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(screen.queryByText("Cost estimate pending")).not.toBeInTheDocument();
    expect(screen.getByText("Voice Mode")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Voice mode" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice Clone" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Voice Changer" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(
      screen.getByRole("separator", { name: "Resize voices mode and composition sections" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Voice shaping")).not.toBeInTheDocument();
    expect(screen.queryByText("Voice shaping")).not.toBeInTheDocument();
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover language override" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Format")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover output format" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Create method")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference audio")).not.toBeInTheDocument();
    expect(screen.queryByText("Design setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Create mode uses the fixed 11v3 model.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice Design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Instant Voice Clone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice Remixing" })).not.toBeInTheDocument();
    expect(container.querySelector(".voices-properties-script-divider")).not.toBeNull();
    expect(screen.getByText("0 / 5,000")).toBeInTheDocument();
    expect(
      container
        .querySelector(".voices-properties-script-meta-row")
        ?.contains(screen.getByText("0 / 5,000"))
    ).toBe(true);
    expect(
      container
        .querySelector(".voices-properties-panel-header")
        ?.contains(screen.getByRole("tablist", { name: "Voice mode" }))
    ).toBe(true);
  });

  it("accepts session-backed text reference drops into the voice script", () => {
    render(<VoicesPropertiesPanel />);

    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    const transfer = createPromptReferenceDragTransfer("Canvas narration line.");

    fireEvent.dragOver(scriptField, { dataTransfer: transfer });
    fireEvent.drop(scriptField, { dataTransfer: transfer });

    expect(scriptField).toHaveValue("Canvas narration line.");
    expect(transfer.dropEffect).toBe("copy");
  });

  it("restores full session-backed voice script text when browser fields are shortened", () => {
    render(<VoicesPropertiesPanel />);

    const fullScript = `Opening narration. ${"Measured dramatic sentence with careful pacing. ".repeat(35)}Final line.`;
    const shortenedScript = fullScript.slice(0, 100);
    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    const transfer = createPromptReferenceDragTransfer(fullScript);
    transfer.setData("text/prompt", shortenedScript);
    transfer.setData("text/plain", shortenedScript);

    fireEvent.drop(scriptField, { dataTransfer: transfer });

    expect(scriptField).toHaveValue(fullScript);
  });

  it("inserts voice script text reference drops at the caret when Shift is held", () => {
    render(<VoicesPropertiesPanel />);

    const scriptField = screen.getByRole("textbox", {
      name: "Voice script",
    }) as HTMLTextAreaElement;
    fireEvent.change(scriptField, { target: { value: "Line one.  Line three." } });
    const transfer = createPromptReferenceDragTransfer("Line two.");

    act(() => {
      scriptField.focus();
      scriptField.setSelectionRange("Line one. ".length, "Line one. ".length);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));
      fireEvent.dragOver(scriptField, { dataTransfer: transfer, shiftKey: true });
      fireEvent.drop(scriptField, {
        dataTransfer: transfer,
        shiftKey: true,
      });
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    });

    expect(scriptField).toHaveValue("Line one. Line two. Line three.");
  });

  it("does not treat media reference drops as voice script text", () => {
    render(<VoicesPropertiesPanel />);

    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    fireEvent.change(scriptField, { target: { value: "Keep this voice script." } });
    const transfer = createTransfer({
      "image/url": "https://cdn.example.test/reference.png",
      "text/reference-url": "https://cdn.example.test/reference.png",
      "text/plain": "https://cdn.example.test/reference.png",
    });

    fireEvent.dragOver(scriptField, { dataTransfer: transfer });
    fireEvent.drop(scriptField, { dataTransfer: transfer });

    expect(scriptField).toHaveValue("Keep this voice script.");
    expect(transfer.dropEffect).toBe("none");
  });

  it("registers the voice script as a Canvas text tear-out target", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    render(<VoicesPropertiesPanel canvasTearOutTargetRegistry={registry} />);

    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    fireEvent.change(scriptField, { target: { value: "Existing voice script." } });
    mockElementRect(scriptField, {
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
    });

    await waitFor(() => {
      expect(
        registry.resolveTargetAtPoint(
          { clientX: 10, clientY: 10 },
          { kind: "text", text: "Canvas voiceover line." }
        )
      ).not.toBeNull();
    });

    act(() => {
      registry
        .resolveTargetAtPoint(
          { clientX: 10, clientY: 10 },
          { kind: "text", text: "Canvas voiceover line." }
        )
        ?.target.accept({ kind: "text", text: "Canvas voiceover line." });
    });

    expect(scriptField).toHaveValue("Canvas voiceover line.");
  });

  it("supports controlled voice script and voice description drafts from page state", async () => {
    const onVoiceScriptChange = vi.fn();
    const onVoicePromptChange = vi.fn();
    const { rerender } = render(
      <VoicesPropertiesPanel
        voiceScript="Read this controlled script."
        voicePrompt="Confident, polished narrator."
        onVoiceScriptChange={onVoiceScriptChange}
        onVoicePromptChange={onVoicePromptChange}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Voice script" }), {
      target: { value: "Updated controlled script." },
    });
    expect(onVoiceScriptChange).toHaveBeenCalledWith("Updated controlled script.");

    await openCreateVoiceModal();
    const createVoiceModal = screen.getByRole("dialog", { name: "Create New Voice" });
    const voiceDescriptionField = within(createVoiceModal).getByRole("textbox", {
      name: "Enter your prompt",
    });

    expect(voiceDescriptionField).toHaveValue("Confident, polished narrator.");

    fireEvent.change(voiceDescriptionField, {
      target: { value: "Updated controlled description." },
    });
    expect(onVoicePromptChange).toHaveBeenCalledWith("Updated controlled description.");

    rerender(
      <VoicesPropertiesPanel
        voiceScript="Updated controlled script."
        voicePrompt="Updated controlled description."
        onVoiceScriptChange={onVoiceScriptChange}
        onVoicePromptChange={onVoicePromptChange}
      />
    );

    expect(screen.getByRole("textbox", { name: "Voice script" })).toHaveValue(
      "Updated controlled script."
    );
    expect(
      within(screen.getByRole("dialog", { name: "Create New Voice" })).getByRole("textbox", {
        name: "Enter your prompt",
      })
    ).toHaveValue("Updated controlled description.");
  });

  it("measures existing create-voice prompt text when the modal opens", async () => {
    const textareaPrototype = HTMLTextAreaElement.prototype as unknown as {
      scrollHeight?: number;
    };
    Object.defineProperty(textareaPrototype, "scrollHeight", {
      configurable: true,
      get: () => 420,
    });

    try {
      render(<VoicesPropertiesPanel voicePrompt={"Warm cinematic narrator. ".repeat(30)} />);

      const createVoiceModal = await openCreateVoiceModal();
      const voiceDescriptionField = within(createVoiceModal).getByRole("textbox", {
        name: "Enter your prompt",
      }) as HTMLTextAreaElement;

      expect(voiceDescriptionField).toHaveValue("Warm cinematic narrator. ".repeat(30));
      expect(voiceDescriptionField.style.height).toBe("264px");
      expect(voiceDescriptionField.style.overflowY).toBe("auto");
    } finally {
      delete textareaPrototype.scrollHeight;
    }
  });

  it("keeps create-voice prompt textareas scrollable by default", () => {
    const railTextareaRule = extractVoicesCssRule(
      ".bootstrapStyleScope :global(.voices-properties-rail-textarea)"
    );

    expect(railTextareaRule).toContain("overflow-y: auto");
    expect(railTextareaRule).toContain("overflow-x: hidden");
    expect(railTextareaRule).not.toContain("overflow: hidden");
  });

  it("enhances the voiceover script through the protected enhance route", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ enhancedScript: "[excited] Updated launch script." }), {
        status: 200,
      })
    );
    render(<VoicesPropertiesPanel />);

    const scriptInput = screen.getByRole("textbox", { name: "Voice script" });
    fireEvent.change(scriptInput, { target: { value: "Updated launch script." } });
    fireEvent.click(screen.getByRole("button", { name: "Enhance voiceover script" }));

    await waitFor(() => {
      expect(screen.getByText("Enhanced version ready")).toBeInTheDocument();
    });
    expect(scriptInput).toHaveValue("Updated launch script.");
    expect(screen.getByText("[excited] Updated launch script.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(scriptInput).toHaveValue("[excited] Updated launch script.");
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/ai/voiceover-enhance",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ script: "Updated launch script." }),
      })
    );
  });

  it("shows voiceover enhance progress while the script is being enhanced", async () => {
    const enhanceResponse = createDeferred<Response>();
    fetchWithAuthMock.mockReturnValueOnce(enhanceResponse.promise);
    render(<VoicesPropertiesPanel />);

    const scriptInput = screen.getByRole("textbox", { name: "Voice script" });
    fireEvent.change(scriptInput, { target: { value: "Updated launch script." } });
    fireEvent.click(screen.getByRole("button", { name: "Enhance voiceover script" }));

    const loadingButton = screen.getByRole("button", { name: "Enhancing voiceover script" });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Enhancing script...")).toBeInTheDocument();

    await act(async () => {
      enhanceResponse.resolve(
        new Response(JSON.stringify({ enhancedScript: "[excited] Updated launch script." }), {
          status: 200,
        })
      );
      await enhanceResponse.promise;
    });

    await waitFor(() => {
      expect(screen.getByText("Enhanced version ready")).toBeInTheDocument();
    });
    expect(scriptInput).toHaveValue("Updated launch script.");
    expect(screen.queryByText("Enhancing script...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enhance voiceover script" })).toBeEnabled();
  });

  it("keeps voiceover script text visible in the native typing layer", () => {
    const { container } = render(<VoicesPropertiesPanel />);

    const scriptInput = screen.getByRole("textbox", { name: "Voice script" });
    fireEvent.change(scriptInput, {
      target: { value: "[calm] Native textarea text stays visible." },
    });

    expect(container.querySelector(".voices-properties-script-highlight")).not.toBeInTheDocument();
    expect(scriptInput).toHaveValue("[calm] Native textarea text stays visible.");
    expect(scriptInput).toHaveClass("voices-properties-script-input");
  });

  it("keeps bracketed voiceover tags in the generation payload", async () => {
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      if (url === "/api/ai/voiceover-enhance") {
        return new Response(
          JSON.stringify({ enhancedScript: "[confused] Updated launch script." }),
          {
            status: 200,
          }
        );
      }
      if (url === "/api/elevenlabs/voices") {
        return new Response(
          JSON.stringify({
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
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    const onGenerate = vi.fn();
    render(<VoicesPropertiesPanel onGenerate={onGenerate} />);

    const scriptInput = screen.getByRole("textbox", { name: "Voice script" });
    fireEvent.change(scriptInput, { target: { value: "Updated launch script." } });
    fireEvent.click(screen.getByRole("button", { name: "Enhance voiceover script" }));

    await waitFor(() => {
      expect(screen.getByText("Enhanced version ready")).toBeInTheDocument();
    });
    expect(scriptInput).toHaveValue("Updated launch script.");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(scriptInput).toHaveValue("[confused] Updated launch script.");

    const generateButton = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect(generateButton).toBeEnabled();
    });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "voiceover",
          script: "[confused] Updated launch script.",
        })
      );
    });
  });

  it("shows a voiceover enhance error when the enhance route fails", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Voiceover Enhance failed", details: "Try again shortly." }),
        { status: 503 }
      )
    );
    render(<VoicesPropertiesPanel />);

    fireEvent.change(screen.getByRole("textbox", { name: "Voice script" }), {
      target: { value: "Updated launch script." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enhance voiceover script" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again shortly.");
  });

  it("allows the voiceover compose area to grow beyond the old fixed height while keeping voice changer locked", () => {
    const { container } = render(<VoicesPropertiesPanel />);
    const composeArea = container.querySelector(".voices-properties-compose-area");

    expect(composeArea).not.toBeNull();
    expect(composeArea).not.toHaveStyle("height: 600px");
    expect(composeArea).not.toHaveStyle("max-height: 600px");

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    expect(composeArea).toHaveStyle("height: 600px");
    expect(composeArea).toHaveStyle("max-height: 600px");
  });

  it("opens the voices library modal from the header action and restores focus on close", async () => {
    render(<VoicesPropertiesPanel />);

    const voicesButton = screen.getByRole("button", { name: "Voices" });
    fireEvent.click(voicesButton);

    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
    expect(screen.getByLabelText("Available voices")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Voice library sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "My Voices" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Default Voices" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("button", { name: "+ Create New Voice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select voice" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Default Voices" }));
    expect(screen.getByRole("button", { name: /darian voice/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /preview unavailable for darian sample/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close voices modal" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Voices" })).not.toBeInTheDocument();
    });
    expect(voicesButton).toHaveFocus();
  });

  it("opens the voices library modal from the selected voice label without changing the header trigger", async () => {
    render(<VoicesPropertiesPanel />);

    const selectedVoiceTrigger = screen.getByRole("button", {
      name: /open voices modal for selected voice darian/i,
    });
    fireEvent.click(selectedVoiceTrigger);

    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voices" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close voices modal" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Voices" })).not.toBeInTheDocument();
    });
    expect(selectedVoiceTrigger).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Voices" }));
    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
  });

  it("shows a header delete action for a selected live voice and removes it from the grid", async () => {
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
    await openVoicesLibraryModal();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    });

    const deleteButton = screen.getByRole("button", { name: "Remove" });
    expect(deleteButton).toBeEnabled();

    fireEvent.click(deleteButton);

    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
    const confirmationDialog = screen.getByRole("dialog", { name: "Remove this voice?" });
    fireEvent.click(within(confirmationDialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/voices/voice_adam", {
        method: "DELETE",
        shortpulseLogScope: "generation",
      });
    });

    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Remove this voice?" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /adam voice/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /bella voice/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("keeps the default create surface focused on the left-column script composer", () => {
    render(<VoicesPropertiesPanel />);

    const scriptField = screen.getByRole("textbox", {
      name: "Voice script",
    });

    expect(scriptField).toHaveValue("");
    expect(scriptField).not.toHaveAttribute("maxLength");
    expect(screen.getByText("0 / 5,000")).toBeInTheDocument();
    expect(screen.queryByText("Design setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Create mode uses the fixed 11v3 model.")).not.toBeInTheDocument();
    expect(screen.queryByText("Design model")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview text")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Design model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Preview text mode" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice shaping")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover output format" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Enter your prompt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice name" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();
  });

  it("preserves over-budget voice scripts so they can be scrolled and edited down", () => {
    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    const overBudgetScript = "Long narrated beat. ".repeat(300);

    fireEvent.change(scriptField, { target: { value: overBudgetScript } });

    expect(scriptField).toHaveValue(overBudgetScript);
    expect(
      screen.getByText(`${overBudgetScript.length.toLocaleString()} / 5,000`)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("uses the voices modal create button as the entry point to the create panel", async () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    await openVoicesLibraryModal();
    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const createVoiceModal = screen.getByRole("dialog", { name: "Create New Voice" });
    const voiceNameField = screen.getByRole("textbox", { name: "Voice name" });
    await waitFor(() => {
      expect(voiceNameField).toHaveFocus();
    });
    expect(voiceNameField).toHaveValue("");
    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(createVoiceModal).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Enter your prompt" })).toBeInTheDocument();
    expect(
      screen.getByText("Use at least 20 characters to generate voice previews.")
    ).toBeInTheDocument();
    expect(screen.getByText("0 / 20 minimum")).toBeInTheDocument();
    const createModalTopRow = createVoiceModal.querySelector(".voices-create-modal-top-row");
    const createModalActionsRow = createVoiceModal.querySelector(".voices-create-modal-actions");
    expect(createModalTopRow).not.toBeNull();
    expect(createModalActionsRow).not.toBeNull();
    expect(
      within(createModalTopRow as HTMLElement).getByRole("tablist", {
        name: "Voice creation method",
      })
    ).toBeInTheDocument();
    expect(
      within(createModalTopRow as HTMLElement).getByRole("button", { name: "Save voice" })
    ).toBeInTheDocument();
    expect(
      within(createModalActionsRow as HTMLElement).getByRole("button", { name: "Generate Voice" })
    ).toHaveTextContent("Generate Voice");
    expect(
      within(createModalActionsRow as HTMLElement).queryByRole("button", {
        name: "Generate previews",
      })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice shaping")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover output format" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();
  });

  it("preserves over-budget create-voice prompts without enabling preview generation", async () => {
    render(<VoicesPropertiesPanel />);

    const createVoiceModal = await openCreateVoiceModal();
    const voiceNameField = screen.getByRole("textbox", { name: "Voice name" });
    const promptField = screen.getByRole("textbox", { name: "Enter your prompt" });
    const createVoiceButton = within(createVoiceModal).getByRole("button", {
      name: "Generate Voice",
    });
    const overBudgetPrompt = "Warm theatrical voice description. ".repeat(40);

    fireEvent.change(voiceNameField, { target: { value: "Long Prompt Voice" } });
    fireEvent.change(promptField, { target: { value: overBudgetPrompt } });

    expect(promptField).toHaveValue(overBudgetPrompt);
    expect(promptField).not.toHaveAttribute("maxLength");
    expect(createVoiceButton).toBeDisabled();
    fireEvent.click(createVoiceButton);
    expect(fetchWithAuthMock).not.toHaveBeenCalledWith(
      "/api/elevenlabs/text-to-voice/design",
      expect.anything()
    );
  });

  it("renders skeleton voice chips while the live voices request is loading", () => {
    fetchWithAuthMock.mockImplementation(() => new Promise(() => undefined));

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Voices" }));

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Loading voices…");
    expect(document.querySelectorAll(".voices-properties-voice-chip--skeleton")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /darian voice/i })).not.toBeInTheDocument();
  });

  it("keeps the in-flight voices request when the generation handler identity changes", async () => {
    const voicesResponse = createDeferred<Response>();
    fetchWithAuthMock.mockReturnValue(voicesResponse.promise);

    const { rerender } = render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Voices" }));

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".voices-properties-voice-chip--skeleton")).toHaveLength(12);

    rerender(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".voices-properties-voice-chip--skeleton")).toHaveLength(12);

    voicesResponse.resolve({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_default_adam",
            name: "Adam",
            previewUrl: "https://cdn.elevenlabs.test/adam.mp3",
            description: "steady",
            isFallback: false,
            librarySection: "default",
          },
        ],
      }),
    } as Response);

    await waitFor(() => {
      expect(document.querySelectorAll(".voices-properties-voice-chip--skeleton")).toHaveLength(0);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Default Voices" }));
    expect(screen.getByRole("button", { name: /adam voice/i })).toBeInTheDocument();
  });

  it("returns to built-in voices when the live voices request times out", async () => {
    vi.useFakeTimers();
    fetchWithAuthMock.mockImplementation((_url: string, init?: RequestInit) => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      return new Promise((_resolve, reject) => {
        const rejectAsAborted = () => reject(abortError);
        init?.signal?.addEventListener("abort", rejectAsAborted, { once: true });
        if (init?.signal) {
          init.signal.onabort = rejectAsAborted;
        }
      });
    });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Voices" }));

    expect(document.querySelectorAll(".voices-properties-voice-chip--skeleton")).toHaveLength(12);

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(document.querySelectorAll(".voices-properties-voice-chip--skeleton")).toHaveLength(0);
    expect(
      screen.getByText("Voice library took too long to load. Showing built-in voices for now.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /darian voice/i })).toBeInTheDocument();
  });

  it("splits the voices modal into Default Voices and My Voices tabs", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_default_adam",
            name: "Adam",
            previewUrl: "https://cdn.elevenlabs.test/adam.mp3",
            description: "steady",
            isFallback: false,
            librarySection: "default",
          },
          {
            voiceId: "voice_my_custom",
            name: "Custom Voice",
            previewUrl: "https://cdn.elevenlabs.test/custom.mp3",
            description: "saved",
            isFallback: false,
            librarySection: "my",
          },
        ],
      }),
    });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openVoicesLibraryModal();

    expect(screen.getByRole("tab", { name: "My Voices" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("button", { name: /custom voice voice/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /adam voice/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select voice" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /custom voice voice/i }));

    expect(screen.getByRole("button", { name: /custom voice voice/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Select voice" })).toBeEnabled();

    fireEvent.click(screen.getByRole("tab", { name: "Default Voices" }));

    expect(screen.getByRole("tab", { name: "Default Voices" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("button", { name: /adam voice/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /custom voice voice/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select voice" })).toBeDisabled();
  });

  it("switches the inline left-column surface between voiceover and voice changer modes", () => {
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
    expect(screen.queryByText("Input format")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voice changer input format" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice shaping")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover output format" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Enter your prompt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create New Voice" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer shaping")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice changer settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Voiceover" }));

    expect(screen.getByRole("tab", { name: "Voiceover" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Voice script" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Enter your prompt" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice shaping")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Voiceover output format" })
    ).not.toBeInTheDocument();
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

    expect(screen.getByText("Extracted audio is ready for conversion.")).toBeInTheDocument();
    expect(uploadVoiceChangerSourceFileMock).toHaveBeenCalledWith({
      file,
      kind: "video",
    });
    expect(extractVoiceChangerVideoSourceMock).toHaveBeenCalled();
    expect(screen.queryByText(/using extracted audio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/5 B ready for conversion/i)).not.toBeInTheDocument();
    expect(screen.getByText("demo-clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("Video source")).toBeInTheDocument();
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Video source preview unavailable" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /source audio preview/i })).not.toBeInTheDocument();
    expect(
      container.querySelector(".voices-properties-voice-changer-audio-waveform")
    ).not.toBeInTheDocument();
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

  it("blocks voice changer generate when the source is ready but priced credits are unresolved", async () => {
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
    resolveVoiceChangerMediaDurationMsMock.mockResolvedValueOnce(null);

    const onGenerate = vi.fn();
    const { container } = render(<VoicesPropertiesPanel onGenerate={onGenerate} />);
    await openVoicesLibraryModal();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["video"], "unpriced-clip.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("Ready for conversion")).toBeInTheDocument();
    });

    const generateButton = screen.getByRole("button", { name: "Generate" });
    expect(generateButton).toBeDisabled();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    fireEvent.click(generateButton);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("blocks voice changer generate when a ready source has no staged media authority", async () => {
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

    render(
      <VoicesPropertiesPanel
        onGenerate={onGenerate}
        voiceChangerSource={{
          id: "source-without-authority",
          kind: "audio",
          displayKind: "audio",
          origin: "local",
          status: "ready",
          aspect: null,
          durationMs: 1000,
          name: "unstaged.wav",
          mimeType: "audio/wav",
          file: null,
          previewUrl: null,
          posterUrl: null,
          sourceUrl: null,
          objectUrl: null,
          storagePath: null,
          referenceOutputId: null,
          referenceMediaId: null,
          errorMessage: null,
          extractedFrom: null,
        }}
      />
    );
    await openVoicesLibraryModal();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const generateButton = screen.getByRole("button", { name: "Generate" });
    expect(generateButton).toBeDisabled();
    fireEvent.click(generateButton);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("blocks voice changer generate when a ready source only has a transient blob URL", async () => {
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

    render(
      <VoicesPropertiesPanel
        onGenerate={onGenerate}
        voiceChangerSource={{
          id: "blob-only-source",
          kind: "audio",
          displayKind: "audio",
          origin: "local",
          status: "ready",
          aspect: null,
          durationMs: 1000,
          name: "unstaged.wav",
          mimeType: "audio/wav",
          file: null,
          previewUrl: null,
          posterUrl: null,
          sourceUrl: "blob:http://localhost:3000/unstaged-source",
          objectUrl: "blob:http://localhost:3000/unstaged-source",
          storagePath: null,
          referenceOutputId: null,
          referenceMediaId: null,
          errorMessage: null,
          extractedFrom: null,
        }}
      />
    );
    await openVoicesLibraryModal();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const generateButton = screen.getByRole("button", { name: "Generate" });
    expect(generateButton).toBeDisabled();
    fireEvent.click(generateButton);
    expect(onGenerate).not.toHaveBeenCalled();
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
    await openVoicesLibraryModal();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
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
        outputFormat: hardcodedVoiceOutputFormat,
        source: expect.objectContaining({
          extractedFrom: expect.objectContaining({
            aspect: "9:16",
            name: "portrait-clip.mp4",
          }),
        }),
        voiceSettings: {
          stability: hardcodedVoiceGenerationDefaults.stability,
          similarity_boost: hardcodedVoiceGenerationDefaults.similarity_boost,
          speed: 1,
          use_speaker_boost: hardcodedVoiceGenerationDefaults.use_speaker_boost,
        },
        removeBackgroundNoise: false,
      })
    );
    const submittedRequest = onGenerate.mock.calls[0]?.[0];
    expect(submittedRequest?.displayedBilledCredits).toBe(
      resolvePricingGridBilledCredits({
        modelId: submittedRequest?.modelId,
        params: {
          sourceDurationSeconds:
            typeof submittedRequest?.source?.durationMs === "number"
              ? submittedRequest.source.durationMs / 1000
              : undefined,
        },
      })
    );
    expect(submittedRequest?.pricingPolicyReady).toBe(true);
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
    expect(revokeObjectUrlMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1));
  });

  it("keeps the voice changer source loaded across panel unmounts within the page session", async () => {
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

    const uploadDeferred = createDeferred<UploadedVideoSource>();
    const extractDeferred = createDeferred<ExtractedAudioSource>();

    uploadVoiceChangerSourceFileMock.mockImplementationOnce(() => uploadDeferred.promise);
    extractVoiceChangerVideoSourceMock.mockImplementationOnce(() => extractDeferred.promise);

    const SessionHarness = () => {
      const [isVoiceChangerVisible, setIsVoiceChangerVisible] = React.useState(true);
      const { voiceChangerSource, handleVoiceChangerSourceChange } =
        useVoiceChangerSourceController();

      return (
        <div>
          <button type="button" onClick={() => setIsVoiceChangerVisible(true)}>
            Open Voice Changer
          </button>
          <button type="button" onClick={() => setIsVoiceChangerVisible(false)}>
            Open Create
          </button>
          {isVoiceChangerVisible ? (
            <VoicesPropertiesPanel
              selectedTool="voice-changer"
              voiceChangerSource={voiceChangerSource}
              onVoiceChangerSourceChange={handleVoiceChangerSourceChange}
            />
          ) : (
            <div>Create panel</div>
          )}
        </div>
      );
    };

    const { container } = render(<SessionHarness />);
    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    const file = new File(["video"], "background-demo.mp4", { type: "video/mp4" });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await screen.findByText("Preparing voice sample from video");

    fireEvent.click(screen.getByRole("button", { name: "Open Create" }));
    expect(screen.getByText("Create panel")).toBeInTheDocument();
    expect(screen.queryByText("Preparing voice sample from video")).toBeNull();

    uploadDeferred.resolve({
      storagePath: "user-1/voice-changer/source-video/background-demo.mp4",
      signedUrl: "https://signed.example/background-demo.mp4",
      mimeType: "video/mp4",
      name: "background-demo.mp4",
      size: 5,
    });
    extractDeferred.resolve({
      storagePath: "user-1/voice-changer/staged-audio/background-demo.wav",
      signedUrl: "https://signed.example/background-demo.wav",
      mimeType: "audio/wav",
      name: "background-demo.wav",
      size: 128,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Voice Changer" }));

    await screen.findByText("Ready for conversion");
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
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

  it("explains how to recover when microphone access is blocked", async () => {
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: "denied", onchange: null }),
      },
    });
    const getUserMediaMock = vi.fn().mockRejectedValue({
      name: "NotAllowedError",
      message: "",
    });
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));
    fireEvent.click(screen.getByRole("button", { name: "Record your voice sample" }));

    expect(await screen.findByText(/microphone access is blocked/i)).toBeInTheDocument();
    expect(
      screen.getByText(/allow microphone access in your browser's site settings/i)
    ).toBeInTheDocument();
  });

  it("preflights a blocked microphone before the user clicks record", async () => {
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: "denied", onchange: null }),
      },
    });

    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    expect(await screen.findByText(/microphone access is blocked/i)).toBeInTheDocument();
    expect(
      screen.getByText(/enable shortpulse in your computer's system microphone settings/i)
    ).toBeInTheDocument();
  });

  it("shows a waiting state while the browser permission prompt is still pending", async () => {
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
      },
    });
    const getUserMediaMock = vi.fn(
      () =>
        new Promise<MediaStream>(() => {
          // Leave the permission request unresolved to mimic the browser prompt waiting on user action.
        })
    );
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));
    fireEvent.click(screen.getByRole("button", { name: "Record your voice sample" }));

    expect(await screen.findByText(/waiting for microphone permission/i)).toBeInTheDocument();
  });

  it("tells the user the browser will ask for microphone access before recording", async () => {
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
      },
    });

    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    expect(
      await screen.findByText(/your browser will ask for microphone access when you record/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your browser will ask for microphone access when you record/i)
    ).toBeInTheDocument();
  });

  it("surfaces a secure-context hint when browser recording APIs are unavailable on an insecure page", async () => {
    const originalMediaDevices = globalThis.navigator.mediaDevices;
    const originalIsSecureContext = window.isSecureContext;
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });

    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));
    fireEvent.click(screen.getByRole("button", { name: "Record your voice sample" }));

    expect(
      await screen.findByText(/microphone recording requires https or localhost/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/open shortpulse in a secure browser tab/i)).toBeInTheDocument();

    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: originalIsSecureContext,
    });
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

  it("promotes resolved voice changer audio preview duration back to the source", () => {
    const onSourceChange = vi.fn();
    const onSourceMetadataChange = vi.fn();
    const source: VoiceChangerSource = {
      id: "source-audio",
      kind: "audio",
      displayKind: "audio",
      origin: "local",
      status: "ready",
      aspect: null,
      durationMs: null,
      name: "voice-source.mp3",
      mimeType: "audio/mpeg",
      file: null,
      previewUrl: null,
      posterUrl: null,
      sourceUrl: "https://example.com/voice-source.mp3",
      objectUrl: null,
      storagePath: "users/demo/voice-source.mp3",
      referenceOutputId: null,
      referenceMediaId: null,
      errorMessage: null,
      extractedFrom: null,
    };

    const { container } = render(
      <VoiceChangerSourceDropzone
        source={source}
        onSourceChange={onSourceChange}
        onSourceMetadataChange={onSourceMetadataChange}
      />
    );
    const audioNode = container.querySelector(
      ".voices-properties-voice-changer-audio-element"
    ) as HTMLAudioElement | null;

    expect(audioNode).not.toBeNull();

    Object.defineProperty(audioNode, "duration", {
      configurable: true,
      value: 15,
    });

    fireEvent.loadedMetadata(audioNode as HTMLAudioElement);

    expect(onSourceMetadataChange).toHaveBeenCalledWith(source.id, { durationMs: 15_000 });
    expect(onSourceChange).not.toHaveBeenCalled();
  });

  it("renders a poster instead of waveform controls for extracted video audio", () => {
    const source: VoiceChangerSource = {
      id: "source-video-derived",
      kind: "audio",
      displayKind: "video",
      origin: "local",
      status: "ready",
      aspect: null,
      durationMs: 10_000,
      name: "clip.wav",
      mimeType: "audio/wav",
      file: null,
      previewUrl: null,
      posterUrl: "data:image/jpeg;base64,poster",
      sourceUrl: "https://example.com/clip.wav",
      objectUrl: null,
      storagePath: "users/demo/clip.wav",
      referenceOutputId: null,
      referenceMediaId: null,
      errorMessage: null,
      extractedFrom: {
        kind: "video",
        name: "clip.mp4",
        mimeType: "video/mp4",
        previewUrl: null,
        sourceUrl: "https://example.com/clip.mp4",
        storagePath: "users/demo/clip.mp4",
        aspect: "16:9",
        referenceOutputId: null,
        referenceMediaId: null,
      },
    };

    const { container } = render(
      <VoiceChangerSourceDropzone source={source} onSourceChange={vi.fn()} />
    );

    expect(screen.getByRole("img", { name: "clip.mp4 video poster" })).toHaveAttribute(
      "src",
      source.posterUrl
    );
    expect(screen.queryByRole("button", { name: /source audio preview/i })).not.toBeInTheDocument();
    expect(
      container.querySelector(".voices-properties-voice-changer-audio-waveform")
    ).not.toBeInTheDocument();
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

  it("ignores a delayed internal reference resolution after a newer source selection", async () => {
    const resolution = createDeferred<VoiceChangerSource | null>();
    const onSourceChange = vi.fn();
    const { container } = render(
      <VoiceChangerSourceDropzone
        source={null}
        onSourceChange={onSourceChange}
        resolveInternalReferenceSource={() => resolution.promise}
      />
    );
    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const internalTransfer = {
      types: ["text/reference-origin", "text/reference-output-id", "text/reference-url"],
      files: [],
      getData: (type: string) =>
        ({
          "text/reference-origin": "ai-studio-reference-grid",
          "text/reference-output-id": "output-slow",
          "text/reference-url": "https://cdn.shortpulse.test/slow-reference.mp3",
        })[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.drop(dropZone, { dataTransfer: internalTransfer });

    const newerFile = new File(["newer"], "newer-source.mp3", { type: "audio/mpeg" });
    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [newerFile] } });

    expect(onSourceChange).toHaveBeenCalledTimes(1);
    expect(onSourceChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "newer-source.mp3" })
    );

    await act(async () => {
      resolution.resolve(
        createVoiceChangerSourceFromFile(
          new File(["slow"], "slow-reference.mp3", { type: "audio/mpeg" })
        )
      );
      await resolution.promise;
    });

    expect(onSourceChange).toHaveBeenCalledTimes(1);
  });

  it("does not restore a delayed internal reference after the source is removed", async () => {
    const resolution = createDeferred<VoiceChangerSource | null>();
    const onSourceChange = vi.fn();
    render(
      <VoiceChangerSourceDropzone
        source={createVoiceChangerSourceFromFile(
          new File(["current"], "current-source.mp3", { type: "audio/mpeg" })
        )}
        onSourceChange={onSourceChange}
        resolveInternalReferenceSource={() => resolution.promise}
      />
    );
    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const internalTransfer = {
      types: ["text/reference-origin", "text/reference-output-id", "text/reference-url"],
      files: [],
      getData: (type: string) =>
        ({
          "text/reference-origin": "ai-studio-reference-grid",
          "text/reference-output-id": "output-slow",
          "text/reference-url": "https://cdn.shortpulse.test/slow-reference.mp3",
        })[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.drop(dropZone, { dataTransfer: internalTransfer });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onSourceChange).toHaveBeenCalledTimes(1);
    expect(onSourceChange).toHaveBeenCalledWith(null);

    await act(async () => {
      resolution.resolve(
        createVoiceChangerSourceFromFile(
          new File(["slow"], "slow-reference.mp3", { type: "audio/mpeg" })
        )
      );
      await resolution.promise;
    });

    expect(onSourceChange).toHaveBeenCalledTimes(1);
  });

  it("treats a staged audio webm as audio even when the local file initially looks like video", async () => {
    uploadVoiceChangerSourceFileMock.mockResolvedValueOnce({
      storagePath: "user-1/voice-changer/source-audio/ambiguous.webm",
      signedUrl: "https://signed.example/ambiguous.webm",
      mimeType: "audio/webm",
      name: "ambiguous.webm",
      size: 4,
    });

    const { container } = render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const fileInput = container.querySelector(
      ".voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["webm"], "ambiguous.webm");
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
    expect(extractVoiceChangerVideoSourceMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play source audio preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("prefers a native local audio file over external plain-text URLs in voice changer mode", async () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    const sourceFile = new File(["audio"], "finder-voice.mp3", { type: "audio/mpeg" });
    const dragOverDataTransfer = {
      types: ["Files", "text/plain"],
      items: [{ kind: "file", type: "" }],
      files: [],
      getData: (type: string) =>
        type === "text/plain" ? "https://external.example.com/not-the-file.mp3" : "",
      dropEffect: "none",
    };
    const dropDataTransfer = {
      ...dragOverDataTransfer,
      files: [sourceFile],
    };

    fireEvent.dragOver(dropZone, { dataTransfer: dragOverDataTransfer });
    expect(dragOverDataTransfer.dropEffect).toBe("copy");

    fireEvent.drop(dropZone, { dataTransfer: dropDataTransfer });

    await waitFor(() => {
      expect(uploadVoiceChangerSourceFileMock).toHaveBeenCalledWith({
        file: sourceFile,
        kind: "audio",
      });
    });

    expect(uploadVoiceChangerSourceFileMock.mock.calls[0]?.[0]).toMatchObject({
      file: sourceFile,
      kind: "audio",
    });
    expect(resolveVoiceChangerMediaDurationMsMock).toHaveBeenCalledWith(
      "https://signed.example/finder-voice.mp3",
      "audio"
    );
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
      expect(stageVoiceChangerVideoReferenceSourceMock).toHaveBeenCalledWith({
        sourceName: "shot-01.mp4",
        sourceMimeType: "video/mp4",
        sourceStoragePath: null,
        sourceUrl: "https://cdn.shortpulse.test/renders/shot-01.mp4",
      });
      expect(extractVoiceChangerVideoSourceMock).toHaveBeenCalledWith({
        sourceName: "shot-01.mp4",
        sourceOrigin: "reference-grid",
        sourceMimeType: "video/mp4",
        sourceStoragePath: "user-1/voice-changer/source-video/shot-01.mp4",
        sourceUrl: "https://signed.example/shot-01.mp4",
      });
    });

    expect(screen.getByText("shot-01.mp4")).toBeInTheDocument();
    expect(screen.queryByText("Reference Grid")).not.toBeInTheDocument();
    expect(screen.getByText("Extracted audio is ready for conversion.")).toBeInTheDocument();
    expect(screen.queryByText(/using extracted audio/i)).not.toBeInTheDocument();
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

  it("treats ogg reference URLs as audio in voice changer mode", async () => {
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
            "text/reference-output-id": "output-audio-ogg",
            "text/reference-url": "https://cdn.shortpulse.test/renders/sample-voice.ogg",
            "text/reference-render-url": "https://cdn.shortpulse.test/renders/sample-voice.ogg",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(resolveVoiceChangerMediaDurationMsMock).toHaveBeenCalledWith(
        "https://cdn.shortpulse.test/renders/sample-voice.ogg",
        "audio"
      );
    });
    expect(extractVoiceChangerVideoSourceMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("accepts a real audio reference drag payload from the reference grid", async () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const { transfer, event } = createReferenceDragTransfer();
    prepareReferenceDrag(event, {
      id: "output-audio-real",
      prompt: "Reference voice",
      mode: "audio",
      aspect: "1:1",
      model: "Audio model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://cdn.shortpulse.test/renders/reference-voice-preview.mp3",
      fullStoragePath: "https://cdn.shortpulse.test/renders/reference-voice-full.mp3",
      previewStoragePath: "https://cdn.shortpulse.test/renders/reference-voice-preview.mp3",
      resultUrls: ["https://cdn.shortpulse.test/renders/reference-voice-full.mp3"],
      savedMediaIds: ["media-audio-real"],
    });

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    fireEvent.dragOver(dropZone, { dataTransfer: transfer });
    fireEvent.drop(dropZone, { dataTransfer: transfer });

    await waitFor(() => {
      expect(screen.getByText(/ready for conversion/i)).toBeInTheDocument();
    });

    expect(resolveVoiceChangerMediaDurationMsMock).toHaveBeenCalledWith(
      "https://signed.example/reference-voice-full.mp3",
      "audio"
    );
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("prefers internal reference-grid audio payloads over synthetic browser files in voice changer mode", async () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const { transfer, event } = createReferenceDragTransfer();
    prepareReferenceDrag(event, {
      id: "output-audio-mixed",
      prompt: "Reference voice mixed payload",
      mode: "audio",
      aspect: "1:1",
      model: "Audio model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://cdn.shortpulse.test/renders/reference-voice-preview.mp3",
      fullStoragePath: "user-1/generated/reference-voice-full.mp3",
      previewStoragePath: "user-1/generated/reference-voice-preview.mp3",
      resultUrls: ["https://cdn.shortpulse.test/renders/reference-voice-full.mp3"],
      savedMediaIds: ["media-audio-mixed"],
    });
    (transfer as unknown as { files: File[] }).files = [
      new File(["ghost-audio"], "ghost-browser-file.mp3", { type: "audio/mpeg" }),
    ];

    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    fireEvent.dragOver(dropZone, { dataTransfer: transfer });
    fireEvent.drop(dropZone, { dataTransfer: transfer });

    await waitFor(() => {
      expect(resolveVoiceChangerMediaDurationMsMock).toHaveBeenCalledWith(
        "https://signed.example/reference-voice-full.mp3",
        "audio"
      );
    });

    expect(uploadVoiceChangerSourceFileMock).not.toHaveBeenCalled();
    expect(screen.getByText(/ready for conversion/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("resolves blob-backed reference-grid audio through the internal voice changer resolver", async () => {
    const sourceFile = new File(["local-audio"], "local-reference.wav", { type: "audio/wav" });
    const resolveVoiceChangerInternalReferenceSource = vi.fn((payload) =>
      createVoiceChangerSourceFromFile(sourceFile, {
        origin: "reference-grid",
        referenceOutputId: payload.outputId,
        referenceMediaId: payload.mediaId,
        durationMs: 1200,
      })
    );

    render(
      <VoicesPropertiesPanel
        resolveVoiceChangerInternalReferenceSource={resolveVoiceChangerInternalReferenceSource}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dataTransfer = {
      types: ["text/reference-origin", "text/reference-output-id", "text/reference-media-id"],
      files: [],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-local-audio",
            "text/reference-media-id": "media-local-audio",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };
    const dropZone = screen.getByLabelText("Voice changer source drop zone");

    fireEvent.dragOver(dropZone, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("copy");
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(uploadVoiceChangerSourceFileMock).toHaveBeenCalledWith({
        file: sourceFile,
        kind: "audio",
      });
    });
    expect(resolveVoiceChangerInternalReferenceSource).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("prefers degraded internal audio hints over synthetic browser files in voice changer mode", async () => {
    const sourceFile = new File(["local-audio"], "local-reference.wav", { type: "audio/wav" });
    const resolveVoiceChangerInternalReferenceSource = vi.fn((payload) =>
      createVoiceChangerSourceFromFile(sourceFile, {
        origin: "reference-grid",
        referenceOutputId: payload.outputId,
        referenceMediaId: payload.mediaId,
        durationMs: 1200,
      })
    );

    render(
      <VoicesPropertiesPanel
        resolveVoiceChangerInternalReferenceSource={resolveVoiceChangerInternalReferenceSource}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const ghostFile = new File(["ghost-audio"], "ghost-browser-file.mp3", {
      type: "audio/mpeg",
    });
    const dataTransfer = {
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-media-id",
        "Files",
      ],
      files: [ghostFile],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-local-audio",
            "text/reference-media-id": "media-local-audio",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };
    const dropZone = screen.getByLabelText("Voice changer source drop zone");

    fireEvent.dragOver(dropZone, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("copy");
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(uploadVoiceChangerSourceFileMock).toHaveBeenCalledWith({
        file: sourceFile,
        kind: "audio",
      });
    });
    expect(uploadVoiceChangerSourceFileMock.mock.calls[0]?.[0]).toMatchObject({
      file: sourceFile,
      kind: "audio",
    });
    expect(resolveVoiceChangerInternalReferenceSource).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  it("shows an error when an internal reference-grid audio drop cannot be resolved", async () => {
    const resolveVoiceChangerInternalReferenceSource = vi.fn(() => null);
    render(
      <VoicesPropertiesPanel
        resolveVoiceChangerInternalReferenceSource={resolveVoiceChangerInternalReferenceSource}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Voice Changer" }));

    const dataTransfer = {
      types: ["text/reference-origin", "text/reference-output-id"],
      files: [],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-unresolved-audio",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };
    const dropZone = screen.getByLabelText("Voice changer source drop zone");
    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    expect(
      await screen.findByText("Unable to use this reference as source audio.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
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
      expect(stageVoiceChangerVideoReferenceSourceMock).toHaveBeenCalledWith({
        sourceName: "shot-02.mp4",
        sourceMimeType: "video/mp4",
        sourceStoragePath: null,
        sourceUrl: "https://cdn.shortpulse.test/renders/shot-02.mp4",
      });
      expect(extractVoiceChangerVideoSourceMock).toHaveBeenCalledWith({
        sourceName: "shot-02.mp4",
        sourceOrigin: "reference-grid",
        sourceMimeType: "video/mp4",
        sourceStoragePath: "user-1/voice-changer/source-video/shot-02.mp4",
        sourceUrl: "https://signed.example/shot-02.mp4",
      });
    });

    expect(screen.getByText("shot-02.mp4")).toBeInTheDocument();
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

  it("hard-codes the correct Eleven v3 voiceover request defaults", () => {
    expect(buildVoiceoverRequestConfig()).toEqual({
      model_id: hardcodedVoiceoverModelId,
      language_code: null,
      voice_settings: {
        stability: hardcodedVoiceoverV3Defaults.stability,
        similarity_boost: hardcodedVoiceoverV3Defaults.similarity_boost,
        speed: hardcodedVoiceoverV3Defaults.speed,
        style: hardcodedVoiceoverV3Defaults.style,
      },
    });
  });

  it("closes the create modal without inserting a fake local voice", async () => {
    render(<VoicesPropertiesPanel />);

    const voicesButton = screen.getByRole("button", { name: "Voices" });
    fireEvent.click(voicesButton);
    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Beacon" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Enter your prompt" }), {
      target: { value: "Clear, bright guide voice with a polished documentary tone." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Close create voice modal" }));

    expect(screen.queryByRole("dialog", { name: "Create New Voice" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(voicesButton).toHaveFocus();
    });
    fireEvent.click(voicesButton);
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
              previewToken: "token-generated-voice-1",
              audioBase64: "ZmFrZS1hdWRpby0x",
              mediaType: "audio/mpeg",
              durationSecs: 2.4,
              language: "en",
            },
            {
              generatedVoiceId: "generated-voice-2",
              previewToken: "token-generated-voice-2",
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

    await openCreateVoiceModal();
    const createVoiceModal = screen.getByRole("dialog", { name: "Create New Voice" });
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Lantern" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Enter your prompt" }), {
      target: { value: "Measured documentary narrator with a warm, grounded cadence." },
    });
    fireEvent.click(within(createVoiceModal).getByRole("button", { name: "Generate Voice" }));

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
          generatedVoiceToken: "token-generated-voice-2",
          playedNotSelectedVoiceIds: ["generated-voice-1"],
          playedNotSelectedVoiceTokens: ["token-generated-voice-1"],
        }),
        shortpulseLogScope: "generation",
      });
    });

    expect(screen.queryByRole("dialog", { name: "Create New Voice" })).not.toBeInTheDocument();
    const voicesPanel = screen.getByRole("region", { name: "Voices properties" });
    expect(within(voicesPanel).getByText("Lantern")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(voicesPanel).getByTestId("selected-voice-loaded-arrow")).toBeInTheDocument();
    });
    expect(within(voicesPanel).getByTestId("selected-voice-loaded-arrow")).toHaveTextContent("→");
    expect(within(voicesPanel).getByTestId("selected-voice-loaded-arrow")).toHaveStyle(
      "font-size: 44px"
    );
    await openVoicesLibraryModal();
    expect(screen.getByRole("tab", { name: "My Voices" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /lantern voice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lantern voice/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  }, 15000);

  it("stages an audio sample and saves a cloned provider voice into the voices grid", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        voice: {
          voiceId: "voice_cloned_123",
          name: "Cloned Lantern",
          previewUrl: "https://cdn.elevenlabs.test/cloned-lantern.mp3",
          description: "Cloned documentary narrator.",
          isFallback: false,
        },
      }),
    });

    render(<VoicesPropertiesPanel />);

    await openCreateVoiceModal();
    fireEvent.click(screen.getByRole("tab", { name: "Clone Voice" }));
    const createDialog = screen.getByRole("dialog", { name: "Create New Voice" });

    expect(screen.getByText("Drop a voice sample")).toBeInTheDocument();
    expect(screen.getByText("Record a voice sample to create a cloned voice.")).toBeInTheDocument();
    expect(
      screen.getByText("Accepts MP3, WAV, M4A, AAC, FLAC, OGG, and WEBM.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Voice description" })).not.toBeInTheDocument();
    expect(within(createDialog).queryByText(/voice changer/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Cloned Lantern" },
    });

    const fileInput = document.querySelector(
      ".voices-create-modal .voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    resolveVoiceChangerMediaDurationMsMock.mockResolvedValueOnce(7_000);
    const file = new File(["audio"], "clone-sample.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("Ready to clone")).toBeInTheDocument();
    });

    const saveVoiceButton = within(createDialog).getByRole("button", {
      name: "Create cloned voice",
    });
    expect(saveVoiceButton).toBeDisabled();
    expect(uploadVoiceCloneSourceFileMock).toHaveBeenCalledWith({ file });
    const cloneButton = screen.getByRole("button", { name: "Create cloned voice" });
    expect(cloneButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText("I have permission to clone this voice."));
    expect(cloneButton).toBeEnabled();
    expect(saveVoiceButton).toBeEnabled();
    fireEvent.click(saveVoiceButton);

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/voices/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceName: "Cloned Lantern",
          sourceStoragePath: "user-1/voice-clone/source-audio/clone-sample.mp3",
          sourceName: "clone-sample.mp3",
          removeBackgroundNoise: true,
        }),
        shortpulseLogScope: "generation",
      });
    });

    expect(screen.queryByRole("dialog", { name: "Create New Voice" })).not.toBeInTheDocument();
    const voicesPanel = screen.getByRole("region", { name: "Voices properties" });
    expect(within(voicesPanel).getByText("Cloned Lantern")).toBeInTheDocument();
    expect(within(voicesPanel).getByTestId("selected-voice-loaded-arrow")).toBeInTheDocument();
    expect(within(voicesPanel).getByTestId("selected-voice-loaded-arrow")).toHaveTextContent("→");
    expect(within(voicesPanel).getByTestId("selected-voice-loaded-arrow")).toHaveStyle(
      "font-size: 44px"
    );
    await openVoicesLibraryModal();
    expect(screen.getByRole("tab", { name: "My Voices" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /cloned lantern voice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cloned lantern voice/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  }, 15000);

  it("prefers internal reference-grid audio payloads over synthetic browser files in clone voice mode", async () => {
    render(<VoicesPropertiesPanel />);

    await openCreateVoiceModal();
    fireEvent.click(screen.getByRole("tab", { name: "Clone Voice" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Reference Clone" },
    });

    const { transfer, event } = createReferenceDragTransfer();
    prepareReferenceDrag(event, {
      id: "output-clone-mixed",
      prompt: "Reference clone voice",
      mode: "audio",
      aspect: "1:1",
      model: "Audio model",
      status: "ready",
      timestamp: "Now",
      previewUrl: "https://cdn.shortpulse.test/renders/reference-clone-preview.mp3",
      fullStoragePath: "user-1/generated/reference-clone-full.mp3",
      previewStoragePath: "user-1/generated/reference-clone-preview.mp3",
      resultUrls: ["https://cdn.shortpulse.test/renders/reference-clone-full.mp3"],
      savedMediaIds: ["media-clone-mixed"],
    });
    (transfer as unknown as { files: File[] }).files = [
      new File(["ghost-audio"], "ghost-browser-file.mp3", { type: "audio/mpeg" }),
    ];

    const dropZone = screen.getByLabelText("Voice clone source drop zone");
    fireEvent.dragOver(dropZone, { dataTransfer: transfer });
    fireEvent.drop(dropZone, { dataTransfer: transfer });

    await waitFor(() => {
      expect(screen.getByText("Ready to clone")).toBeInTheDocument();
    });

    expect(uploadVoiceCloneSourceFileMock).not.toHaveBeenCalled();
    expect(signVoiceChangerStoragePathMock).toHaveBeenCalledWith(
      "user-1/generated/reference-clone-full.mp3"
    );
  });

  it("prefers degraded internal audio hints over synthetic browser files in clone voice mode", async () => {
    const sourceFile = new File(["local-audio"], "clone-reference.wav", { type: "audio/wav" });
    const resolveVoiceChangerInternalReferenceSource = vi.fn((payload) =>
      createVoiceChangerSourceFromFile(sourceFile, {
        origin: "reference-grid",
        referenceOutputId: payload.outputId,
        referenceMediaId: payload.mediaId,
        durationMs: 2200,
      })
    );

    render(
      <VoicesPropertiesPanel
        resolveVoiceChangerInternalReferenceSource={resolveVoiceChangerInternalReferenceSource}
      />
    );

    await openCreateVoiceModal();
    fireEvent.click(screen.getByRole("tab", { name: "Clone Voice" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Hint Clone" },
    });

    const ghostFile = new File(["ghost-audio"], "ghost-browser-file.mp3", {
      type: "audio/mpeg",
    });
    const dataTransfer = {
      types: [
        "text/reference-origin",
        "text/reference-output-id",
        "text/reference-media-id",
        "Files",
      ],
      files: [ghostFile],
      getData: (type: string) =>
        (
          ({
            "text/reference-origin": "ai-studio-reference-grid",
            "text/reference-output-id": "output-clone-local-audio",
            "text/reference-media-id": "media-clone-local-audio",
          }) as Record<string, string>
        )[type] ?? "",
      dropEffect: "none",
    };
    const dropZone = screen.getByLabelText("Voice clone source drop zone");
    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(screen.getByText("Ready to clone")).toBeInTheDocument();
    });

    expect(resolveVoiceChangerInternalReferenceSource).toHaveBeenCalledTimes(1);
    expect(uploadVoiceCloneSourceFileMock.mock.calls[0]?.[0]).toMatchObject({
      file: sourceFile,
    });
  });

  it("allows shorter cloned voice samples to submit", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        voice: {
          voiceId: "voice_short_123",
          name: "Short Clone",
          previewUrl: "https://cdn.elevenlabs.test/short-clone.mp3",
          description: null,
          isFallback: false,
        },
      }),
    });

    render(<VoicesPropertiesPanel />);

    await openCreateVoiceModal();
    fireEvent.click(screen.getByRole("tab", { name: "Clone Voice" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Short Clone" },
    });

    const fileInput = document.querySelector(
      ".voices-create-modal .voices-properties-voice-changer-file-input"
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    resolveVoiceChangerMediaDurationMsMock.mockResolvedValueOnce(5_000);
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["audio"], "short-sample.mp3", { type: "audio/mpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Ready to clone")).toBeInTheDocument();
    });

    const cloneButton = screen.getByRole("button", { name: "Create cloned voice" });
    expect(cloneButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText("I have permission to clone this voice."));
    expect(cloneButton).toBeEnabled();
    fireEvent.click(cloneButton);

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/voices/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceName: "Short Clone",
          sourceStoragePath: "user-1/voice-clone/source-audio/short-sample.mp3",
          sourceName: "short-sample.mp3",
          removeBackgroundNoise: true,
        }),
        shortpulseLogScope: "generation",
      });
    });
  });

  it("records and stages a short clone sample before enabling the clone submit path", async () => {
    const mediaStreamTrackStop = vi.fn();
    const getUserMediaMock = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: mediaStreamTrackStop }],
    });
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
          data: new Blob(["recorded-clone-audio"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    resolveVoiceChangerMediaDurationMsMock.mockResolvedValueOnce(7_000);

    render(<VoicesPropertiesPanel />);

    await openCreateVoiceModal();
    fireEvent.click(screen.getByRole("tab", { name: "Clone Voice" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Recorded Clone" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Record your voice sample" }));
    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });

    const stopRecordingButton = await screen.findByRole("button", {
      name: "Stop recording your voice sample",
    });
    fireEvent.click(stopRecordingButton);

    await waitFor(() => {
      expect(screen.getByText("Ready to clone")).toBeInTheDocument();
    });

    expect(uploadVoiceCloneSourceFileMock).toHaveBeenCalledWith({
      file: expect.any(File),
    });
    expect(uploadVoiceChangerSourceFileMock).not.toHaveBeenCalled();

    const cloneButton = screen.getByRole("button", { name: "Create cloned voice" });
    expect(cloneButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText("I have permission to clone this voice."));
    expect(cloneButton).toBeEnabled();
    expect(mediaStreamTrackStop).toHaveBeenCalled();
  });

  it("shows an obvious loading state while voice previews are generating", async () => {
    fetchWithAuthMock.mockImplementation(
      () =>
        new Promise(() => {
          // Keep the request pending so the modal remains in its active generation state.
        })
    );

    render(<VoicesPropertiesPanel />);

    const createVoiceModal = await openCreateVoiceModal();
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Lantern" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Enter your prompt" }), {
      target: { value: "Measured documentary narrator with a warm, grounded cadence." },
    });

    const createVoiceButton = within(createVoiceModal).getByRole("button", {
      name: "Generate Voice",
    });
    fireEvent.click(createVoiceButton);

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    });
    expect(createVoiceButton).toBeEnabled();
    expect(createVoiceButton).toHaveTextContent("Generate Voice");
    expect(screen.getByRole("status")).toHaveTextContent("Generating voice previews...");
    expect(screen.getByRole("status")).toHaveTextContent(
      "This can take a few seconds. Please wait while we build your options."
    );

    fireEvent.click(createVoiceButton);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
  });

  it("overwrites the prompt text when dropping a prompt into the create-side prompt box", () => {
    render(<VoicesPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Voices" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const promptField = screen.getByRole("textbox", { name: "Enter your prompt" });
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

    fireEvent.click(screen.getByRole("button", { name: "Voices" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));

    const createVoiceModal = screen.getByRole("dialog", { name: "Create New Voice" });
    const voicesPanel = screen.getByRole("region", { name: "Voices properties" });
    const promptField = screen.getByRole("textbox", { name: "Enter your prompt" });
    const voiceNameField = screen.getByRole("textbox", { name: "Voice name" });
    const scriptField = screen.getByRole("textbox", { name: "Voice script" });
    const createVoiceButton = within(createVoiceModal).getByRole("button", {
      name: "Generate Voice",
    });
    const saveVoiceButton = screen.getByRole("button", { name: "Save voice" });
    const generateButton = within(voicesPanel).getByRole("button", { name: "Generate" });

    fireEvent.change(voiceNameField, {
      target: { value: "Prompt Lane" },
    });
    fireEvent.change(promptField, {
      target: { value: "Prompt-only text for generating a new voice." },
    });

    expect(voiceNameField).toHaveValue("Prompt Lane");
    expect(promptField).toHaveValue("Prompt-only text for generating a new voice.");
    expect(screen.getByText("44 / 20 minimum")).toBeInTheDocument();
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

  it("keeps generation disabled when only fallback default voices are available", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "fallback",
        warning: "Showing default voices until live voices are configured.",
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
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/elevenlabs/voices",
        expect.objectContaining({
          shortpulseAuthTimeoutMs: 5_000,
          shortpulseLogScope: "generation",
          signal: expect.any(AbortSignal),
        })
      );
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Voice script" }), {
      target: { value: "Fallback voices should not submit." },
    });

    await openVoicesLibraryModal();

    expect(
      screen.getByText("Showing default voices until live voices are configured.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("shows api voice-library warnings without falling back to default-only mode", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        warning: "Some saved custom voices may be temporarily unavailable. Please try again.",
        voices: [
          {
            voiceId: "voice-live-1",
            name: "Darian",
            previewUrl: null,
            description: "Warm, grounded storyteller",
            isFallback: false,
            librarySection: "default",
            canRemoveFromLibrary: false,
            canDeleteFromProvider: false,
            destructiveAction: "none",
          },
        ],
      }),
    });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openVoicesLibraryModal();
    fireEvent.click(screen.getByRole("tab", { name: "Default Voices" }));

    expect(
      screen.getByText("Some saved custom voices may be temporarily unavailable. Please try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Darian voice" })).toBeInTheDocument();
    expect(
      screen.queryByText("Showing default voices until live voices are configured.")
    ).not.toBeInTheDocument();
  });

  it("clears stale shared-browser voice state when a fresh voice load fails", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "custom-voice-1",
            name: "Custom Voice",
            previewUrl: "https://signed.example/custom-voice-1.mp3",
            description: "Belongs to the previous user",
            isFallback: false,
            librarySection: "my",
            canRemoveFromLibrary: true,
            canDeleteFromProvider: false,
            destructiveAction: "remove",
            destructiveActionLabel: "Remove",
          },
        ],
      }),
    });

    const firstRender = render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openVoicesLibraryModal();
    expect(await screen.findByRole("button", { name: "Custom Voice voice" })).toBeInTheDocument();
    firstRender.unmount();

    fetchWithAuthMock.mockRejectedValueOnce(new Error("Unable to load voices."));

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openVoicesLibraryModal();

    expect(screen.queryByRole("button", { name: "Custom Voice voice" })).not.toBeInTheDocument();
    expect(screen.getByText("Unable to load voices.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("clears create-voice and library state when the authenticated user changes", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "custom-voice-1",
            name: "Custom Voice",
            previewUrl: "https://signed.example/custom-voice-1.mp3",
            description: "Belongs to the previous user",
            isFallback: false,
            librarySection: "my",
            canRemoveFromLibrary: true,
            canDeleteFromProvider: false,
            destructiveAction: "remove",
            destructiveActionLabel: "Remove",
          },
        ],
      }),
    });

    const view = render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openVoicesLibraryModal();
    expect(await screen.findByRole("button", { name: "Custom Voice voice" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Create New Voice" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Voice name" }), {
      target: { value: "Leaked Preview Voice" },
    });

    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-2" } },
      user: { id: "user-2" },
    });
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [],
      }),
    });

    view.rerender(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Create New Voice" })).not.toBeInTheDocument();
    });
    await openVoicesLibraryModal();
    expect(screen.queryByRole("button", { name: "Custom Voice voice" })).not.toBeInTheDocument();
  });

  it("clamps overlong custom voice names to the supported persisted length", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [],
      }),
    });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openCreateVoiceModal();
    const voiceNameField = screen.getByRole("textbox", { name: "Voice name" });

    fireEvent.change(voiceNameField, {
      target: { value: "a".repeat(MAX_CUSTOM_VOICE_NAME_CHARACTERS + 25) },
    });

    expect(voiceNameField).toHaveValue("a".repeat(MAX_CUSTOM_VOICE_NAME_CHARACTERS));
  });

  it("submits generation with the live default voice ids when they load", async () => {
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
    await openVoicesLibraryModal();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
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
        outputFormat: hardcodedVoiceOutputFormat,
        config: {
          model_id: hardcodedVoiceoverModelId,
          language_code: null,
          voice_settings: {
            stability: hardcodedVoiceoverV3Defaults.stability,
            similarity_boost: hardcodedVoiceoverV3Defaults.similarity_boost,
            speed: hardcodedVoiceoverV3Defaults.speed,
            style: hardcodedVoiceoverV3Defaults.style,
          },
        },
        voice: expect.objectContaining({
          id: "voice_live_darian_123",
          name: "Darian",
          provider: "elevenlabs",
          isFallback: false,
        }),
      })
    );
    const submittedRequest = onGenerate.mock.calls[0]?.[0];
    expect(submittedRequest?.displayedBilledCredits).toBe(
      resolvePricingGridBilledCredits({
        modelId: hardcodedVoiceoverModelId,
        params: {
          textCharacters: submittedRequest?.script?.length,
        },
      })
    );
    expect(submittedRequest?.pricingPolicyReady).toBe(true);
  });

  it("keeps generate available while a voice generation is already in flight", async () => {
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
    await openVoicesLibraryModal();

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
    expect(generateButton).toHaveTextContent("Generate");

    fireEvent.click(generateButton);
    expect(onGenerate).toHaveBeenCalledTimes(1);
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
    await openVoicesLibraryModal();

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

  it("keeps the voices modal open after selecting a voice and closes only from the footer action", async () => {
    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);

    const voicesButton = screen.getByRole("button", { name: "Voices" });
    await openVoicesLibraryModal();
    fireEvent.click(screen.getByRole("tab", { name: "Default Voices" }));

    fireEvent.click(screen.getByRole("button", { name: /talia voice/i }));

    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talia voice/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Select voice" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Voices" })).not.toBeInTheDocument();
    });
    expect(voicesButton).toHaveFocus();
  });

  it("does not close the voices modal when previewing a sample from the chip play button", async () => {
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
    await openVoicesLibraryModal();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /play bella - professional, bright, warm sample/i,
      })
    );

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledWith("https://cdn.elevenlabs.test/bella.mp3");
    });
    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select voice" })).toBeInTheDocument();
  });

  it("shows a notice when a voice does not have a preview sample yet", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_missing_preview_123",
            name: "Beacon",
            previewUrl: null,
            description: "missing preview",
            isFallback: false,
          },
        ],
      }),
    });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openVoicesLibraryModal();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /preview unavailable for beacon sample/i,
      })
    );

    expect(screen.getByText("This voice does not have a preview sample yet.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
  });

  it("clears preview-only notices when the voices modal is reopened", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: "api",
        voices: [
          {
            voiceId: "voice_live_missing_preview_124",
            name: "Beacon",
            previewUrl: null,
            description: "missing preview",
            isFallback: false,
          },
        ],
      }),
    });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openVoicesLibraryModal();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /preview unavailable for beacon sample/i,
      })
    );

    expect(screen.getByText("This voice does not have a preview sample yet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close voices modal" }));
    await openVoicesLibraryModal();

    expect(
      screen.queryByText("This voice does not have a preview sample yet.")
    ).not.toBeInTheDocument();
  });

  it("shows a notice when a voice preview playback request fails", async () => {
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
        return Promise.reject(new Error("Playback blocked"));
      }

      pause() {
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
            voiceId: "voice_live_failing_preview_123",
            name: "Nova",
            previewUrl: "https://cdn.elevenlabs.test/nova.mp3",
            description: "failing preview",
            isFallback: false,
          },
        ],
      }),
    });

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    await openVoicesLibraryModal();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /play nova sample/i,
      })
    );

    await waitFor(() => {
      expect(screen.getByText("Unable to play this voice sample right now.")).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog", { name: "Voices" })).toBeInTheDocument();
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

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    const voicesDialog = await openVoicesLibraryModal();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /adam - deep, cinematic, resonant voice/i })
      ).toBeInTheDocument();
    });

    expect(voicesDialog.querySelector(".voices-properties-voice-chip-name")?.textContent).toBe(
      "Adam"
    );
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

    render(<VoicesPropertiesPanel onGenerate={vi.fn()} />);
    const voicesDialog = await openVoicesLibraryModal();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /maya: young, shy, introspective but a bit anxious voice/i,
        })
      ).toBeInTheDocument();
    });

    expect(voicesDialog.querySelector(".voices-properties-voice-chip-name")?.textContent).toBe(
      "Maya"
    );
    expect(
      (document.querySelector(".voices-properties-generate-context-value") as HTMLElement | null)
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
    await openVoicesLibraryModal();

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

  it("replaces voice generate with the active plan CTA when generation access is gated", () => {
    const onGenerate = vi.fn();
    render(
      <VoicesPropertiesPanel onGenerate={onGenerate} generationAccessCta={AI_STUDIO_PLAN_CTA} />
    );

    const planCta = screen.getByRole("link", { name: "View subscription plans" });
    expect(planCta).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("button", { name: "Generate" })).toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
