/**
 * DetailModal behavior tests.
 * Verifies character attribution rendering for character-mode generated outputs.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailModal } from "../DetailModal";
import type { StudioOutput } from "../../types";

const baseOutput: StudioOutput = {
  id: "out-1",
  prompt: "A cozy cinematic lounge portrait.",
  mode: "image",
  aspect: "9:16",
  model: "Seedream 4.5 Edit",
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  status: "ready",
  timestamp: "Submitted",
  previewUrl: "https://cdn.test/image.png",
};

const buildGeneratedAudioOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  ...baseOutput,
  id: "audio-out-1",
  mode: "audio",
  aspect: "9:16",
  model: "ElevenLabs Voiceover",
  modelId: "eleven_multilingual_v2",
  mediaSource: "generated",
  generationId: "gen-audio-1",
  previewUrl: "https://cdn.test/audio.mp3",
  mimeType: "audio/mpeg",
  ...overrides,
});

describe("DetailModal", () => {
  it("shows character and style attribution with the actual model used", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          characterContext: {
            applied: true,
            characterId: "char-1",
            characterName: "Taylor",
            lookId: "2",
            lookName: "Hero Close-Up",
            characterProfileImageUrl: "https://cdn.test/char.png",
          },
          styleContext: {
            applied: true,
            styleId: "photorealistic",
            styleName: "Photorealistic",
            stylePrompt: "photoreal skin texture and natural daylight contrast",
            stylePreviewImageUrl: "https://cdn.test/style.png",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Seedream 4.5")).toBeInTheDocument();
    expect(screen.queryByText("Pulse Character")).not.toBeInTheDocument();
    const characterName = screen.getByText("Taylor");
    expect(screen.getByText("Character · Hero Close-Up")).toBeInTheDocument();
    const promptLabel = screen.getByText("PROMPT");
    expect(characterName).toBeInTheDocument();
    expect(screen.getByAltText("Taylor profile")).toBeInTheDocument();
    const styleName = screen.getByText("Photorealistic");
    expect(styleName).toBeInTheDocument();
    expect(screen.getByAltText("Photorealistic style")).toBeInTheDocument();
    expect(screen.getByLabelText("Style used for generation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Prompt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save prompt" })).not.toBeInTheDocument();
    expect(characterName.compareDocumentPosition(promptLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(styleName.compareDocumentPosition(promptLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("uses style catalog preview when style context has id but no explicit preview url", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          styleContext: {
            applied: true,
            styleId: "photorealistic",
            styleName: "Photorealistic",
            stylePrompt: "photoreal skin texture and natural daylight contrast",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByAltText("Photorealistic style")).toBeInTheDocument();
  });

  it("recovers character chip avatar via injected refresh/resolver callbacks", async () => {
    let refreshedCharacterAvatarUrl: string | null = null;
    const refreshCharacterOptions = vi.fn(async () => {
      refreshedCharacterAvatarUrl = "https://cdn.test/char-refreshed.png";
      return [
        {
          id: "char-1",
          name: "Taylor",
          profileImageUrl: refreshedCharacterAvatarUrl,
        },
      ];
    });
    const resolveCharacterAvatarUrlById = vi.fn((characterId: string | null | undefined) =>
      characterId === "char-1" ? refreshedCharacterAvatarUrl : null
    );
    render(
      <DetailModal
        output={{
          ...baseOutput,
          characterContext: {
            applied: true,
            characterId: "char-1",
            characterName: "Taylor",
            characterProfileImageUrl: "broken-avatar",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        refreshCharacterOptions={refreshCharacterOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
      />
    );

    fireEvent.error(screen.getByAltText("Taylor profile"));

    await waitFor(() => {
      expect(screen.getByAltText("Taylor profile").getAttribute("src")).toBe(
        "https://cdn.test/char-refreshed.png"
      );
    });
    expect(refreshCharacterOptions).toHaveBeenCalled();
  });

  it("falls back to style initials when the style thumbnail fails to load", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          styleContext: {
            applied: true,
            styleId: "style-1",
            styleName: "Sunset Glow",
            stylePrompt: "warm sunset cinematic grade",
            stylePreviewImageUrl: "broken-style-avatar",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    fireEvent.error(screen.getByAltText("Sunset Glow style"));
    expect(screen.getByText("SG")).toBeInTheDocument();
  });

  it("shows Save Prompt action in prompt-only mode and saves the edited prompt", () => {
    const onSavePrompt = vi.fn();
    render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "text",
          previewUrl: undefined,
          prompt: "Original prompt",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSavePrompt={onSavePrompt}
      />
    );

    const promptTextarea = screen.getByPlaceholderText("Describe your adjustments...");
    fireEvent.change(promptTextarea, { target: { value: "Updated prompt for library" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Prompt" }));
    expect(onSavePrompt).toHaveBeenCalledWith("Updated prompt for library");
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
  });

  it("routes download button clicks through the provided download callback", () => {
    const onDownloadReference = vi.fn();
    render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onDownloadReference={onDownloadReference}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onDownloadReference).toHaveBeenCalledWith("out-1");
  });

  it("renders a Save button before Download for media and routes clicks through the save callback", () => {
    const onSaveReference = vi.fn();
    render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSaveReference={onSaveReference}
      />
    );

    const actionButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "Save" || button.textContent === "Download");
    expect(actionButtons.map((button) => button.textContent)).toEqual(["Save", "Download"]);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveReference).toHaveBeenCalledWith("out-1");
  });

  it("shows Saved state for media references that are already persisted", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          saveState: "saved",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSaveReference={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("hides save and download actions for generated media missing durable identity", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          mediaSource: "generated",
          generationId: undefined,
          previewStoragePath: undefined,
          fullStoragePath: undefined,
          savedMediaIds: [],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onDownloadReference={vi.fn()}
        onSaveReference={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
  });

  it("shows Retry Save for failed media persistence state", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          saveState: "failed",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSaveReference={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Retry Save" })).toBeInTheDocument();
  });

  it("keeps image previews fit-to-screen on open and does not zoom in on double-click", () => {
    const { container } = render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const vessel = container.querySelector(".art-image-vessel");
    expect(vessel).not.toBeNull();
    if (!vessel) return;

    expect(vessel.classList.contains("is-zoomed")).toBe(false);
    fireEvent.doubleClick(vessel);
    expect(vessel.classList.contains("is-zoomed")).toBe(false);
  });

  it("treats uploaded image blob URLs as images instead of videos", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewUrl: "blob:https://shortpulse.test/reference-image-1",
          timestamp: "Dropped",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
    expect(container.querySelector("video.art-hero-image")).toBeNull();
    expect(container.querySelector("img.art-hero-image")).not.toBeNull();
  });

  it("shows only media type in the header for non-generated library media", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mediaSource: "library",
          model: "my-uploaded-file.png",
          prompt: "my-uploaded-file.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
  });

  it("shows only media type in the header for media loaded from library modal even when source media was generated", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "library-123",
          mediaSource: "generated",
          model: "my-uploaded-file.png",
          prompt: "my-uploaded-file.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
  });

  it("renders generated voiceover audio with the normalized header label only", () => {
    const { container } = render(
      <DetailModal
        output={buildGeneratedAudioOutput()}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("voiceover");
  });

  it("renders generated voice changer audio with the normalized header label only", () => {
    const { container } = render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Voice Changer",
          modelId: "eleven_multilingual_sts_v2",
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("voice changer");
  });

  it("renders generated music audio with the normalized header label only", () => {
    const { container } = render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Music",
          modelId: "eleven_music_v1",
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("music");
  });

  it("renders generated sound effects audio with the normalized header label only", () => {
    const { container } = render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Sound Effects",
          modelId: "eleven_sound_effects_v1",
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("SFX");
  });

  it("uses the audio modal sizing hook for pure audio outputs", () => {
    const { container } = render(
      <DetailModal
        output={buildGeneratedAudioOutput()}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(
      container.querySelector(".reference-modal-new")?.classList.contains("is-audio-modal")
    ).toBe(true);
  });

  it("keeps the aspect hidden for generated pure audio outputs", () => {
    const { container } = render(
      <DetailModal
        output={buildGeneratedAudioOutput({ aspect: "9:16" })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent).not.toContain("9:16");
  });

  it("shows voice changer and aspect for generated remuxed voice changer video", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "voice-changer-video-1",
          mode: "video",
          aspect: "16:9",
          model: "ElevenLabs Voice Changer",
          modelId: "eleven_multilingual_sts_v2",
          mediaSource: "generated",
          generationId: "gen-video-1",
          previewUrl: "https://cdn.test/remuxed-video.mp4",
          mimeType: "video/mp4",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("voice changer/16:9");
  });

  it("shows voice changer and the preserved aspect for an active staged source video", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "source-video-1",
          mode: "video",
          aspect: "9:16",
          mediaSource: "library",
          prompt: "source-video.mp4",
          previewUrl: "https://cdn.test/source-video.mp4",
          mimeType: "video/mp4",
        }}
        context={{
          activeVoiceChangerSourceVideo: {
            aspect: "4:3",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("voice changer/4:3");
  });

  it("keeps image mode previews as images when URL paths contain video-like segments", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "image",
          previewUrl:
            "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/uploads/videos/reference_asset_12345?token=abc123",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(container.querySelector("video.art-hero-image")).toBeNull();
    expect(container.querySelector("img.art-hero-image")).not.toBeNull();
  });

  it("keeps poster-image previews as images for video outputs when no playable preview URL is selected", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "video",
          previewUrl: "https://cdn.test/video-poster.jpg",
          resultUrls: [],
          previewStoragePath: null,
          fullStoragePath: null,
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(container.querySelector("video.art-hero-image")).toBeNull();
    expect(container.querySelector("img.art-hero-image")).not.toBeNull();
  });

  it("falls back to an alternative result URL when the first image does not match the output aspect", async () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          aspect: "5:4",
          previewUrl: "https://cdn.test/wrong-portrait.png",
          resultUrls: ["https://cdn.test/wrong-portrait.png", "https://cdn.test/correct-5x4.png"],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const firstImage = container.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(firstImage).not.toBeNull();
    if (!firstImage) return;

    Object.defineProperty(firstImage, "naturalWidth", { configurable: true, value: 800 });
    Object.defineProperty(firstImage, "naturalHeight", { configurable: true, value: 1000 });
    fireEvent.load(firstImage);

    await waitFor(() => {
      const nextImage = container.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(nextImage).not.toBeNull();
      expect(nextImage?.getAttribute("src")).toBe("https://cdn.test/correct-5x4.png");
    });
  });

  it("uses full storage media URL for detail rendering when available", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewStoragePath: "https://cdn.test/preview-low.jpg",
          fullStoragePath: "https://cdn.test/full-quality.jpg",
          previewUrl: "https://cdn.test/legacy.jpg",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = container.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://cdn.test/full-quality.jpg");
  });

  it("prefers canonical preview media over transient preview url in detail rendering", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewStoragePath: "https://cdn.test/canonical-preview.jpg",
          fullStoragePath: null,
          previewUrl: "https://cdn.test/transient-preview.jpg",
          resultUrls: ["https://cdn.test/transient-preview.jpg"],
          mediaSource: "generated",
          generationId: "gen-1",
          savedMediaIds: [],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = container.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://cdn.test/canonical-preview.jpg");
  });
});
