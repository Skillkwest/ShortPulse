/**
 * MusicPropertiesPanel rendering tests.
 * Verifies the dedicated Music workflow stays decoupled from generic Sound and Sound Effects.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolvePricingGridBilledCredits } from "../../../../lib/model-runtime/pricingGridBilledCredits";
import { createCanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import { preparePromptReferenceDrag } from "../../utils/dragDrop";
import { hardcodedMusicModelId, MusicPropertiesPanel } from "../MusicPropertiesPanel";

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const createPromptReferenceDragTransfer = (promptText: string): DataTransfer => {
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
  preparePromptReferenceDrag(
    {
      dataTransfer: transfer,
      currentTarget: dragNode,
    } as unknown as Parameters<typeof preparePromptReferenceDrag>[0],
    {
      promptText,
      referenceId: "canvas-text-reference",
      sourceSurface: "all-refs",
    }
  );
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

describe("MusicPropertiesPanel", () => {
  it("renders the music mode toggle instead of the retired preview area", () => {
    const { container } = render(<MusicPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(
      screen
        .getByRole("heading", { name: "Music" })
        .closest(".music-properties-script-actions-left")
        ?.closest(".music-properties-script-actions")
    ).not.toBeNull();
    expect(screen.getByText("Music Mode")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Music composition modes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Standard" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Custom" })).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByText("No music previews yet")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveAttribute(
      "placeholder",
      "Describe the song you want to generate: genre, pacing, instrumentation, vocal style, and where the cue should land in the edit."
    );
    expect(
      screen.getByRole("separator", {
        name: "Resize music mode and composition sections",
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Music inspiration")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Music inspiration").closest(".music-properties-script-input-shell")
    ).toHaveClass("music-properties-script-input-shell--with-inspiration");
    expect(screen.getByRole("button", { name: "indie folk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "riddim" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "passionate vocals" })).toBeNull();
    expect(screen.queryByRole("button", { name: "boastful" })).toBeNull();
    expect(screen.getByRole("button", { name: "Scroll inspiration left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll inspiration right" })).toBeInTheDocument();
    expect(screen.getByText("0 / 2,000")).toBeInTheDocument();
    expect(
      container
        .querySelector(".music-properties-inspiration-header")
        ?.contains(screen.getByText("0 / 2,000"))
    ).toBe(true);
    expect(screen.getByLabelText("Music defaults")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Instrumental" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("button", { name: "Songs per generate" })).toHaveTextContent("2 songs");
    expect(screen.getByRole("button", { name: "Music duration" })).toHaveTextContent("Auto");
    expect(screen.getByRole("button", { name: "Music duration" })).toHaveAttribute(
      "title",
      "Let the music model choose the track length."
    );
    expect(screen.getByRole("button", { name: "Generate music" })).toBeDisabled();
  });

  it("randomizes the music genre rail when the panel mounts", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.25);

    render(<MusicPropertiesPanel />);

    expect(randomSpy).toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it("enables generation when the user writes a music prompt", () => {
    render(<MusicPropertiesPanel onGenerate={() => undefined} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value:
          "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
      },
    });

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending."
    );
    expect(screen.getByRole("button", { name: "Generate music" })).toBeEnabled();
  });

  it("accepts session-backed text reference drops into the music prompt", () => {
    render(<MusicPropertiesPanel />);

    const promptField = screen.getByRole("textbox", { name: "Music prompt" });
    const transfer = createPromptReferenceDragTransfer("Canvas text direction for the music cue.");

    fireEvent.dragOver(promptField, { dataTransfer: transfer });
    fireEvent.drop(promptField, { dataTransfer: transfer });

    expect(promptField).toHaveValue("Canvas text direction for the music cue.");
    expect(transfer.dropEffect).toBe("copy");
  });

  it("restores full session-backed music text when browser fields are shortened", () => {
    render(<MusicPropertiesPanel />);

    const fullPrompt = `Opening cue. ${"Layered synth motif with live drums. ".repeat(25)}Final lift.`;
    const shortenedPrompt = fullPrompt.slice(0, 120);
    const promptField = screen.getByRole("textbox", { name: "Music prompt" });
    const transfer = createPromptReferenceDragTransfer(fullPrompt);
    transfer.setData("text/prompt", shortenedPrompt);
    transfer.setData("text/plain", shortenedPrompt);

    fireEvent.drop(promptField, { dataTransfer: transfer });

    expect(promptField).toHaveValue(fullPrompt);
  });

  it("inserts music text reference drops at the caret when Shift is held", () => {
    render(<MusicPropertiesPanel />);

    const promptField = screen.getByRole("textbox", {
      name: "Music prompt",
    }) as HTMLTextAreaElement;
    fireEvent.change(promptField, { target: { value: "Intro  outro" } });
    const transfer = createPromptReferenceDragTransfer("bridge");

    act(() => {
      promptField.focus();
      promptField.setSelectionRange("Intro ".length, "Intro ".length);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));
      fireEvent.dragOver(promptField, { dataTransfer: transfer, shiftKey: true });
      fireEvent.drop(promptField, {
        dataTransfer: transfer,
        shiftKey: true,
      });
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    });

    expect(promptField).toHaveValue("Intro bridge outro");
  });

  it("accepts session-backed text reference drops into custom lyrics", () => {
    render(<MusicPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    const lyricsField = screen.getByRole("textbox", { name: "Song lyrics" });

    fireEvent.drop(lyricsField, {
      dataTransfer: createPromptReferenceDragTransfer("Canvas lyric reference line."),
    });

    expect(lyricsField).toHaveValue("Canvas lyric reference line.");
  });

  it("does not treat media reference drops as music text", () => {
    render(<MusicPropertiesPanel />);

    const promptField = screen.getByRole("textbox", { name: "Music prompt" });
    fireEvent.change(promptField, { target: { value: "Keep this music draft." } });
    const transfer = createTransfer({
      "image/url": "https://cdn.example.test/reference.png",
      "text/reference-url": "https://cdn.example.test/reference.png",
      "text/plain": "https://cdn.example.test/reference.png",
    });

    fireEvent.dragOver(promptField, { dataTransfer: transfer });
    fireEvent.drop(promptField, { dataTransfer: transfer });

    expect(promptField).toHaveValue("Keep this music draft.");
    expect(transfer.dropEffect).toBe("none");
  });

  it("registers music prompt and custom lyrics as Canvas text tear-out targets", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    render(<MusicPropertiesPanel canvasTearOutTargetRegistry={registry} />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));

    const promptField = screen.getByRole("textbox", { name: "Music prompt" });
    const lyricsField = screen.getByRole("textbox", { name: "Song lyrics" });
    mockElementRect(promptField, {
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
    });
    mockElementRect(lyricsField, {
      bottom: 240,
      height: 100,
      left: 0,
      right: 100,
      top: 140,
      width: 100,
      x: 0,
      y: 140,
    });

    await waitFor(() => {
      expect(
        registry.resolveTargetAtPoint(
          { clientX: 10, clientY: 10 },
          { kind: "text", text: "Canvas music prompt." }
        )
      ).not.toBeNull();
      expect(
        registry.resolveTargetAtPoint(
          { clientX: 10, clientY: 160 },
          { kind: "text", text: "Canvas lyric line." }
        )
      ).not.toBeNull();
    });

    act(() => {
      registry
        .resolveTargetAtPoint(
          { clientX: 10, clientY: 10 },
          { kind: "text", text: "Canvas music prompt." }
        )
        ?.target.accept({ kind: "text", text: "Canvas music prompt." });
      registry
        .resolveTargetAtPoint(
          { clientX: 10, clientY: 160 },
          { kind: "text", text: "Canvas lyric line." }
        )
        ?.target.accept({ kind: "text", text: "Canvas lyric line." });
    });

    expect(promptField).toHaveValue("Canvas music prompt.");
    expect(lyricsField).toHaveValue("Canvas lyric line.");
  });

  it("supports controlled prompt and lyrics drafts from page state", () => {
    const onPromptChange = vi.fn();
    const onLyricsChange = vi.fn();
    const { rerender } = render(
      <MusicPropertiesPanel
        prompt="Warm melodic house cue."
        lyrics="Stay with me."
        onPromptChange={onPromptChange}
        onLyricsChange={onLyricsChange}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "Warm melodic house cue."
    );
    expect(screen.getByRole("textbox", { name: "Song lyrics" })).toHaveValue("Stay with me.");

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Updated cue direction." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Song lyrics" }), {
      target: { value: "Updated lyric line." },
    });

    expect(onPromptChange).toHaveBeenCalledWith("Updated cue direction.");
    expect(onLyricsChange).toHaveBeenCalledWith("Updated lyric line.");

    rerender(
      <MusicPropertiesPanel
        prompt="Updated cue direction."
        lyrics="Updated lyric line."
        onPromptChange={onPromptChange}
        onLyricsChange={onLyricsChange}
      />
    );

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "Updated cue direction."
    );
    expect(screen.getByRole("textbox", { name: "Song lyrics" })).toHaveValue("Updated lyric line.");
  });

  it("supports a controlled duration draft from page state", () => {
    const onDurationChange = vi.fn();
    const { rerender } = render(
      <MusicPropertiesPanel durationSeconds={180} onDurationChange={onDurationChange} />
    );

    expect(screen.getByRole("button", { name: "Music duration" })).toHaveTextContent("3m");

    fireEvent.click(screen.getByRole("button", { name: "Music duration" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "10m" }));

    expect(onDurationChange).toHaveBeenCalledWith(600);

    rerender(<MusicPropertiesPanel durationSeconds={600} onDurationChange={onDurationChange} />);

    expect(screen.getByRole("button", { name: "Music duration" })).toHaveTextContent("10m");
  });

  it("supports controlled generation-critical music controls from page state", () => {
    const onComposerModeChange = vi.fn();
    const onInstrumentalEnabledChange = vi.fn();
    const onSingerEnabledChange = vi.fn();
    const onSongBatchCountChange = vi.fn();

    const { rerender } = render(
      <MusicPropertiesPanel
        composerMode="simple"
        instrumentalEnabled={false}
        singerEnabled={false}
        songBatchCount={4}
        onComposerModeChange={onComposerModeChange}
        onInstrumentalEnabledChange={onInstrumentalEnabledChange}
        onSingerEnabledChange={onSingerEnabledChange}
        onSongBatchCountChange={onSongBatchCountChange}
      />
    );

    expect(screen.getByRole("tab", { name: "Standard" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Songs per generate" })).toHaveTextContent("4 songs");

    fireEvent.click(screen.getByRole("switch", { name: "Instrumental" }));
    fireEvent.click(screen.getByRole("button", { name: "Songs per generate" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "1 song" }));
    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));

    rerender(
      <MusicPropertiesPanel
        composerMode="custom"
        instrumentalEnabled={false}
        singerEnabled={false}
        songBatchCount={1}
        onComposerModeChange={onComposerModeChange}
        onInstrumentalEnabledChange={onInstrumentalEnabledChange}
        onSingerEnabledChange={onSingerEnabledChange}
        onSongBatchCountChange={onSongBatchCountChange}
      />
    );

    fireEvent.click(screen.getByRole("switch", { name: "Singer" }));

    expect(onComposerModeChange).toHaveBeenCalledWith("custom");
    expect(onInstrumentalEnabledChange).toHaveBeenCalledWith(true);
    expect(onSingerEnabledChange).toHaveBeenCalledWith(true);
    expect(onSongBatchCountChange).toHaveBeenCalledWith(1);
  });

  it("keeps generate available when shared pricing is unavailable", () => {
    render(<MusicPropertiesPanel onGenerate={() => undefined} pricingPolicyReady={false} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value: "Warm melodic house cue with a soft vocal texture and a clean branded ending.",
      },
    });

    expect(screen.getByRole("button", { name: "Generate music" })).toBeEnabled();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows balance context on the generate control without changing the command label", () => {
    render(<MusicPropertiesPanel onGenerate={() => undefined} balanceCredits={10000} />);

    const generateButton = screen.getByRole("button", { name: "Generate music" });

    expect(generateButton).toHaveAttribute("data-credit-confidence", "covered");
    expect(generateButton.getAttribute("title")).toContain("balance 10000 credits");
    expect(screen.queryByText("Balance covers this run")).not.toBeInTheDocument();
  });

  it("switches between simple and custom composer modes", () => {
    render(<MusicPropertiesPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));

    expect(screen.getByRole("tab", { name: "Custom" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Custom music composer")).toBeInTheDocument();
    expect(screen.getByText("Song style and vibe")).toBeInTheDocument();
    expect(screen.getByText("Lyrics")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveAttribute(
      "placeholder",
      "Describe the song style, production direction, instrumentation, vocal feel, and emotional arc."
    );
    expect(screen.getByRole("textbox", { name: "Song lyrics" })).toHaveAttribute(
      "placeholder",
      "Write lyrics, hooks, section ideas, ad-libs, or line-by-line structure here."
    );
    expect(
      screen.getByText("Prompt and lyrics share one 2,000-character generation budget.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("separator", {
        name: "Resize song style and lyrics sections",
      })
    ).toBeNull();
    expect(screen.getByLabelText("Music inspiration")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Music inspiration").closest(".music-properties-script-input-shell")
    ).toHaveClass("music-properties-script-input-shell--custom-prompt");
    expect(screen.getByRole("button", { name: "Scroll inspiration left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll inspiration right" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Singer" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Music defaults")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Songs per generate" })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Music duration" })).toHaveTextContent("Auto");
    expect(screen.getByRole("button", { name: "Music duration" })).toHaveAttribute(
      "title",
      "Let the music model choose the track length."
    );
    expect(screen.queryByLabelText("Custom mode note")).toBeNull();
  });

  it("submits the provider-facing music request shape", async () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value:
          "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
    const firstRequest = onGenerate.mock.calls[0][0];
    const secondRequest = onGenerate.mock.calls[1][0];
    expect(onGenerate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
        rawPrompt:
          "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
        durationSeconds: null,
        bpm: 112,
        mode: "vocal",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        instrumentalEnabled: false,
        modelId: "music_v1",
      })
    );
    expect(onGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
        durationSeconds: null,
        bpm: 112,
        mode: "vocal",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        instrumentalEnabled: false,
        modelId: "music_v1",
      })
    );
    const expectedDisplayedCredits = resolvePricingGridBilledCredits({
      modelId: hardcodedMusicModelId,
      params: {
        durationSeconds: null,
      },
    });
    expect(firstRequest.displayedBilledCredits).toBe(secondRequest.displayedBilledCredits);
    expect(firstRequest.displayedBilledCredits).toBe(expectedDisplayedCredits);
  });

  it("submits instrumental mode when the Standard instrumental toggle is enabled", async () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("switch", { name: "Instrumental" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value: "Sparse ambient cue with glassy textures, soft pulses, and a clear edit ending.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
    expect(onGenerate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mode: "instrumental",
        instrumentalEnabled: true,
      })
    );
    expect(onGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "instrumental",
        instrumentalEnabled: true,
      })
    );
  });

  it("submits the selected fixed music duration", async () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value: "Slow-burn cinematic cue with a restrained piano intro and a sweeping final lift.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Music duration" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "3m" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
    expect(onGenerate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        durationSeconds: 180,
      })
    );
    expect(onGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        durationSeconds: 180,
      })
    );
  });

  it("submits vocal mode when singer is enabled in custom mode", async () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    fireEvent.click(screen.getByRole("switch", { name: "Singer" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: {
        value: "Melodic club anthem with a strong topline and a clean chorus payoff.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
    expect(onGenerate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mode: "vocal",
      })
    );
    expect(onGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "vocal",
      })
    );
  });

  it("lets the user adjust how many songs generate per run", async () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("button", { name: "Songs per generate" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "4 songs" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Percussive electronic cue with a dark rising tension." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    expect(screen.getByRole("button", { name: "Songs per generate" })).toHaveTextContent("4");
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(4));
  });

  it("submits the full multi-song run even if one request rejects", async () => {
    const onGenerate = vi.fn().mockResolvedValueOnce(false);

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Percussive electronic cue with a dark rising tension." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
  });

  it("includes custom lyrics in the submitted music prompt", async () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Melancholic synth-pop duet with a slow-burn chorus." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Song lyrics" }), {
      target: { value: "Stay with me through the neon afterglow." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
    expect(onGenerate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mode: "vocal",
        rawPrompt: "Melancholic synth-pop duet with a slow-burn chorus.",
        text: "Melancholic synth-pop duet with a slow-burn chorus.\n\nLyrics:\nStay with me through the neon afterglow.",
      })
    );
  });

  it("submits vocal mode in custom mode when lyrics are present even without singer enabled", async () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Heat-seeker rap with a melodic hook." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Song lyrics" }), {
      target: { value: "City lights burn through the smoke tonight." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
    expect(onGenerate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mode: "vocal",
      })
    );
    expect(onGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "vocal",
      })
    );
  });

  it("disables generate when the combined custom prompt and lyrics exceed the provider limit", () => {
    render(<MusicPropertiesPanel onGenerate={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "p".repeat(1980) },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Song lyrics" }), {
      target: { value: "l".repeat(20) },
    });

    expect(screen.getByText("2,010 / 2,000")).toBeInTheDocument();
    expect(screen.getByText("Shorten the prompt or lyrics by 10 characters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate music" })).toBeDisabled();
  });

  it("appends authored inspiration prompts into the prompt in simple mode", () => {
    render(<MusicPropertiesPanel />);

    fireEvent.click(screen.getByRole("button", { name: "drum and bass" }));

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "High-energy drum and bass cue with rapid breakbeats, driving sub bass, sharp transitions, futuristic textures, and a clean adrenaline-forward momentum built for motion."
    );
  });

  it("appends authored inspiration prompts through the controlled draft path", () => {
    const onPromptChange = vi.fn();
    const nextPrompt =
      "Existing cue.\n\nWarm indie folk cue with intimate acoustic guitar, brushed percussion, soft handclaps, earthy bass, and a reflective cinematic build that feels human, hopeful, and organic.";
    const { rerender } = render(
      <MusicPropertiesPanel prompt="Existing cue." onPromptChange={onPromptChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "indie folk" }));

    expect(onPromptChange).toHaveBeenCalledWith(nextPrompt);

    rerender(<MusicPropertiesPanel prompt={nextPrompt} onPromptChange={onPromptChange} />);

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(nextPrompt);
  });

  it("shows the inserted inspiration text when the panel is wired like the page runtime", () => {
    const Harness = () => {
      const [prompt, setPrompt] = React.useState("");

      return <MusicPropertiesPanel prompt={prompt} onPromptChange={setPrompt} />;
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "indie folk" }));

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "Warm indie folk cue with intimate acoustic guitar, brushed percussion, soft handclaps, earthy bass, and a reflective cinematic build that feels human, hopeful, and organic."
    );
  });

  it("keeps chip clicks inserting prompt text through a real pointer sequence", () => {
    render(<MusicPropertiesPanel />);

    const chip = screen.getByRole("button", { name: "indie folk" });

    fireEvent.pointerDown(chip, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 120,
    });
    fireEvent.pointerUp(chip, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 120,
    });
    fireEvent.click(chip);

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "Warm indie folk cue with intimate acoustic guitar, brushed percussion, soft handclaps, earthy bass, and a reflective cinematic build that feels human, hopeful, and organic."
    );
  });

  it("submits the authored inspiration prompt text after a chip click", async () => {
    const onGenerate = vi.fn();

    render(<MusicPropertiesPanel onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("button", { name: "indie folk" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate music" }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
    expect(onGenerate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: "Warm indie folk cue with intimate acoustic guitar, brushed percussion, soft handclaps, earthy bass, and a reflective cinematic build that feels human, hopeful, and organic.",
      })
    );
    expect(onGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: "Warm indie folk cue with intimate acoustic guitar, brushed percussion, soft handclaps, earthy bass, and a reflective cinematic build that feels human, hopeful, and organic.",
      })
    );
  });

  it("fails closed when an inspiration prompt would exceed the shared custom-mode budget", () => {
    render(<MusicPropertiesPanel prompt={"p".repeat(1920)} lyrics={"l".repeat(25)} />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    fireEvent.click(screen.getByRole("button", { name: "west coast rap" }));

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue("p".repeat(1920));
    expect(
      screen.getByText("This inspiration will not fit. Shorten the prompt or lyrics and try again.")
    ).toBeInTheDocument();
  });

  it("clears the inspiration overflow error after the draft changes", () => {
    const { rerender } = render(
      <MusicPropertiesPanel prompt={"p".repeat(1920)} lyrics={"l".repeat(25)} />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    fireEvent.click(screen.getByRole("button", { name: "west coast rap" }));

    expect(
      screen.getByText("This inspiration will not fit. Shorten the prompt or lyrics and try again.")
    ).toBeInTheDocument();

    rerender(<MusicPropertiesPanel prompt="Shorter prompt" lyrics={"l".repeat(25)} />);

    expect(
      screen.queryByText(
        "This inspiration will not fit. Shorten the prompt or lyrics and try again."
      )
    ).not.toBeInTheDocument();
  });

  it("suppresses chip insertion after a real drag gesture on the inspiration rail", () => {
    const { container } = render(<MusicPropertiesPanel />);
    const scroller = container.querySelector(".music-properties-inspiration-chips");
    const chip = screen.getByRole("button", { name: "trip hop" });

    expect(scroller).not.toBeNull();

    fireEvent.pointerDown(scroller as Element, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 120,
    });
    fireEvent.pointerMove(scroller as Element, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 80,
    });
    fireEvent.pointerUp(scroller as Element, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 80,
    });
    fireEvent.click(chip);

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue("");
  });

  it("keeps generate enabled while generation is running", () => {
    render(<MusicPropertiesPanel isGenerating onGenerate={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Minimal synth bed with a bright branded tag." },
    });

    expect(screen.getByRole("button", { name: "Generate music" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Generate music" })).toHaveTextContent("Generate");
  });

  it("keeps inspiration chips interactive while generation is running", () => {
    render(<MusicPropertiesPanel isGenerating onGenerate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "riddim" }));

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "Heavy riddim drop with aggressive bass growls, sharp syncopation, stripped-down tension builds, festival-scale energy, and a dark modern sound design focus built for impact."
    );
    expect(screen.getByRole("button", { name: "Generate music" })).toBeEnabled();
  });

  it("keeps the prompt counter in sync locally", () => {
    render(<MusicPropertiesPanel />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Minimal synth bed" },
    });

    expect(screen.getByText("17 / 2,000")).toBeInTheDocument();
  });
});
