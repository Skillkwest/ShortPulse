/**
 * MusicPropertiesPanel rendering tests.
 * Verifies the dedicated Music workflow stays decoupled from generic Sound and Sound Effects.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MusicPropertiesPanel } from "../MusicPropertiesPanel";

describe("MusicPropertiesPanel", () => {
  it("renders the music mode toggle instead of the retired preview area", () => {
    const { container } = render(<MusicPropertiesPanel />);

    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Songs per generate" })).toHaveTextContent("2");
    expect(screen.getByRole("note", { name: "Duration auto" })).toHaveTextContent("Auto");
    expect(screen.getByRole("note", { name: "Duration auto" })).toHaveAttribute(
      "title",
      "Auto duration is chosen by the music model."
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
    expect(screen.getByRole("note", { name: "Duration auto" })).toHaveTextContent("Auto");
    expect(screen.getByRole("note", { name: "Duration auto" })).toHaveAttribute(
      "title",
      "Auto duration is chosen by the music model."
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
        durationSeconds: null,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        modelId: "music_v1",
      })
    );
    expect(onGenerate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: "Warm melodic house cue with a soft vocal texture, subtle lift into the hook, and a clean branded ending.",
        durationSeconds: null,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        modelId: "music_v1",
      })
    );
    expect(firstRequest.displayedBilledCredits).toBe(secondRequest.displayedBilledCredits);
    expect(firstRequest.displayedBilledCredits).not.toBeNull();
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

  it("fails closed when an inspiration prompt would exceed the shared custom-mode budget", () => {
    render(<MusicPropertiesPanel prompt={"p".repeat(1920)} lyrics={"l".repeat(25)} />);

    fireEvent.click(screen.getByRole("tab", { name: "Custom" }));
    fireEvent.click(screen.getByRole("button", { name: "west coast rap" }));

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue("p".repeat(1920));
    expect(
      screen.getByText("This inspiration will not fit. Shorten the prompt or lyrics and try again.")
    ).toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "Generating music" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Generating music" })).toHaveTextContent(
      "Generating..."
    );
  });

  it("keeps inspiration chips interactive while generation is running", () => {
    render(<MusicPropertiesPanel isGenerating onGenerate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "riddim" }));

    expect(screen.getByRole("textbox", { name: "Music prompt" })).toHaveValue(
      "Heavy riddim drop with aggressive bass growls, sharp syncopation, stripped-down tension builds, festival-scale energy, and a dark modern sound design focus built for impact."
    );
    expect(screen.getByRole("button", { name: "Generating music" })).toBeEnabled();
  });

  it("keeps the prompt counter in sync locally", () => {
    render(<MusicPropertiesPanel />);

    fireEvent.change(screen.getByRole("textbox", { name: "Music prompt" }), {
      target: { value: "Minimal synth bed" },
    });

    expect(screen.getByText("17 / 2,000")).toBeInTheDocument();
  });
});
