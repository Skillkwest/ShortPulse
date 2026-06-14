/**
 * Dashboard tutorial grid tests for poster-first media loading behavior.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DashboardTutorialGrid,
  type DashboardTutorial,
} from "../../features/dashboard/components/DashboardTutorialGrid";

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    <img alt={alt} src={String(rest.src ?? "")} />
  ),
}));

vi.mock("../../features/dashboard/components/DashboardTutorialModal", () => ({
  DashboardTutorialModal: ({ tutorial }: { tutorial: DashboardTutorial }) => (
    <div role="dialog" aria-label={tutorial.title} />
  ),
}));

const buildVideoTutorial = (index: number): DashboardTutorial => ({
  id: `tutorial-${index}`,
  title: `Tutorial ${index}`,
  youtubeUrl: "https://www.youtube.com/watch?v=abc123",
  thumbnailUrl: `https://cdn.example.com/tutorial-${index}.mp4`,
  thumbnailMediaType: "video",
  thumbnailPosterUrl: `https://cdn.example.com/tutorial-${index}.jpg`,
  thumbnailAlt: `Tutorial ${index} preview`,
  displayOrder: index,
});

const setReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const renderGrid = (tutorials: DashboardTutorial[]) =>
  render(<DashboardTutorialGrid tutorials={tutorials} launchHref="/ai-studio" />);

describe("DashboardTutorialGrid media loading", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("autoplays only the first-row video budget and keeps later videos poster-first", async () => {
    setReducedMotion(false);
    renderGrid(Array.from({ length: 6 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tutorial 1: open tutorial" })).toBeInTheDocument();
    });

    const videos = document.querySelectorAll("video");
    expect(videos).toHaveLength(6);
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    expect(videos[4]).toHaveAttribute("src", "https://cdn.example.com/tutorial-5.mp4");
    expect(videos[5]).not.toHaveAttribute("src");
    expect(videos[5]).toHaveAttribute("preload", "none");

    fireEvent.pointerEnter(videos[5]);

    await waitFor(() => {
      expect(videos[5]).toHaveAttribute("src", "https://cdn.example.com/tutorial-6.mp4");
    });
  });

  it("keeps all video thumbnails poster-first when reduced motion is requested", async () => {
    setReducedMotion(true);
    renderGrid(Array.from({ length: 2 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tutorial 1: open tutorial" })).toBeInTheDocument();
    });

    document.querySelectorAll("video").forEach((video) => {
      expect(video).not.toHaveAttribute("src");
      expect(video).toHaveAttribute("preload", "none");
    });
  });
});
