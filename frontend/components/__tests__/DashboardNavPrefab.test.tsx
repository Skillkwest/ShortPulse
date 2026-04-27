/**
 * DashboardNavPrefab tests.
 * Verifies default dashboard linking and AI Studio hard-navigation mode.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardNavPrefab } from "../DashboardNavPrefab";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("DashboardNavPrefab", () => {
  const originalLocation = window.location;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders the default dashboard href as a link", () => {
    render(<DashboardNavPrefab />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("uses hard navigation mode when requested", () => {
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        assign: assignSpy,
      },
    });

    render(<DashboardNavPrefab navigationMode="assign" />);
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
  });
});
