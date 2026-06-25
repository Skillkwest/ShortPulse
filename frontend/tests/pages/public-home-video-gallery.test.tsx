import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicHomeVideoGallery } from "../../features/dashboard/components/PublicHomeVideoGallery";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  } & Record<string, unknown>) => {
    void _prefetch;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    <div aria-label={alt} data-next-image={String(rest.src ?? "")} />
  ),
}));

const renderGallery = () =>
  render(<PublicHomeVideoGallery loginHref="/auth?next=%2Fdashboard" signupHref="/ai-studio" />);

describe("PublicHomeVideoGallery", () => {
  let playSpy: ReturnType<typeof vi.spyOn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps gallery video sources detached until preview intent", async () => {
    renderGallery();

    const video = screen.getByLabelText(
      "One-shot monster wall break thriller demo video"
    ) as HTMLVideoElement;
    const card = video.closest("figure");

    expect(card).not.toBeNull();
    expect(video).not.toHaveAttribute("src");
    expect(video).toHaveAttribute(
      "poster",
      "/dashboard/gallery/monster-wall-break-demo-poster.webp"
    );
    expect(video).toHaveAttribute("preload", "none");

    expect(playSpy).not.toHaveBeenCalled();

    fireEvent.pointerEnter(card as HTMLElement);

    await waitFor(() => {
      expect(video).toHaveAttribute("preload", "auto");
      expect(playSpy).toHaveBeenCalled();
    });

    fireEvent.pointerLeave(card as HTMLElement);

    await waitFor(() => {
      expect(video).toHaveAttribute("preload", "none");
      expect(pauseSpy).toHaveBeenCalled();
    });
  });

  it("pauses gallery preview playback while a prompt modal is open", async () => {
    renderGallery();

    const video = screen.getByLabelText(
      "One-shot monster wall break thriller demo video"
    ) as HTMLVideoElement;
    const card = video.closest("figure") as HTMLElement;

    expect(video).not.toHaveAttribute("src");

    fireEvent.pointerEnter(card);

    await waitFor(() => {
      expect(video).toHaveAttribute("preload", "auto");
      expect(playSpy).toHaveBeenCalled();
    });

    pauseSpy.mockClear();
    fireEvent.click(within(card).getByRole("button", { name: "View Prompt" }));

    expect(screen.getByRole("dialog", { name: "Creator prompt" })).toBeInTheDocument();

    await waitFor(() => {
      expect(pauseSpy).toHaveBeenCalled();
      expect(video).toHaveAttribute("preload", "none");
    });
  });
});
