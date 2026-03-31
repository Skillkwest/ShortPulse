import type React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { ReferenceGridCard } from "../ReferenceGridCard";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "9:16",
  model: "Model",
  status: "ready",
  timestamp: "Now",
  taskState: "fail",
  ...overrides,
});

const createProps = (
  overrides: Partial<React.ComponentProps<typeof ReferenceGridCard>> = {}
): React.ComponentProps<typeof ReferenceGridCard> => ({
  item: createOutput(),
  authorityTier: "reusable",
  dragSourceSurface: "reference-grid",
  videoNodeKey: "video-node-key",
  activeOutputId: null,
  isLoading: false,
  loadingVisual: "none",
  cardPreviewUrl: null,
  isVideoPreview: false,
  isImagePreview: false,
  canAutoplayVideo: false,
  videoPreload: "none",
  isPromptOnly: false,
  isLinkedPromptReference: false,
  canRetryStatus: false,
  imageSrc: undefined,
  imageLoading: "lazy",
  imageFetchPriority: "low",
  onSelectOutput: vi.fn(),
  onOpenDetails: vi.fn(),
  onCardDragStart: vi.fn(),
  onCardDragEnd: vi.fn(),
  registerVideoNode: vi.fn(),
  markLoaded: vi.fn(),
  onAutoplayStarted: vi.fn(),
  onAutoplayStopped: vi.fn(),
  ...overrides,
});

describe("ReferenceGridCard", () => {
  it("shows an NSFW pill for provider safety failures", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            errorMessage: "Generation failed",
            errorMessageShort: "Content not allowed",
            errorDetail:
              "The model did not generate the expected output for this prompt because it was flagged as unsafe content.",
          }),
        })}
      />
    );

    expect(screen.getByText("NSFW")).toBeInTheDocument();
  });

  it("does not show an NSFW pill for generic provider failures", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            errorMessage: "Downstream service error",
            errorMessageShort: "Generation failed",
            errorDetail: "Downstream service error",
          }),
        })}
      />
    );

    expect(screen.queryByText("NSFW")).toBeNull();
  });
});
