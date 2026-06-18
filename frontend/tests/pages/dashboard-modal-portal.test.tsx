/**
 * Dashboard modal portal tests.
 * Verifies public-home overlays are mounted outside section-contained layout roots.
 */
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardModalPortal } from "../../features/dashboard/components/DashboardModalPortal";
import { DashboardTutorialModal } from "../../features/dashboard/components/DashboardTutorialModal";
import type { DashboardTutorial } from "../../features/dashboard/components/DashboardTutorialGrid";

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

const tutorial: DashboardTutorial = {
  id: "tutorial-1",
  title: "Generate Images",
  youtubeUrl: "https://www.youtube.com/watch?v=-65Vh2-4hoQ",
  thumbnailUrl: "/dashboard/tutorial.jpg",
  thumbnailMediaType: "image",
  thumbnailPosterUrl: null,
  thumbnailAlt: "Generate Images preview",
  displayOrder: 1,
};

function PortalProbe({ label }: { label: string }) {
  return (
    <DashboardModalPortal>
      <div role="dialog" aria-label={label} />
    </DashboardModalPortal>
  );
}

describe("dashboard modal portal", () => {
  it("mounts tutorial modals outside their section container and locks page scroll", () => {
    const { unmount } = render(
      <section data-testid="showcase-root" className="public-home-showcase">
        <DashboardTutorialModal tutorial={tutorial} launchHref="/ai-studio" onClose={vi.fn()} />
      </section>
    );

    const sectionRoot = screen.getByTestId("showcase-root");
    const dialog = screen.getByRole("dialog", { name: "Generate Images" });

    expect(within(sectionRoot).queryByRole("dialog")).not.toBeInTheDocument();
    expect(dialog.parentElement).toBe(document.body);
    expect(document.documentElement).toHaveClass("dashboard-modal-open");
    expect(document.body).toHaveClass("dashboard-modal-open");

    unmount();

    expect(document.documentElement).not.toHaveClass("dashboard-modal-open");
    expect(document.body).not.toHaveClass("dashboard-modal-open");
  });

  it("keeps scroll locked until the last dashboard modal closes", () => {
    const { rerender, unmount } = render(
      <>
        <PortalProbe label="First modal" />
        <PortalProbe label="Second modal" />
      </>
    );

    expect(document.body).toHaveClass("dashboard-modal-open");

    rerender(<PortalProbe label="First modal" />);

    expect(document.body).toHaveClass("dashboard-modal-open");

    unmount();

    expect(document.body).not.toHaveClass("dashboard-modal-open");
  });
});
