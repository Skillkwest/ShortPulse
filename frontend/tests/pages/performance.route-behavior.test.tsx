/**
 * Performance analytics page tests for route-owned sorting, refresh, and modal behavior.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PerformanceAnalyticsPage from "../../pages/performance";

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

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

vi.mock("../../features/billing/useResolvedAccountPlan", () => ({
  useResolvedAccountPlan: () => ({
    user: { id: "user-1", email: "kirk@example.com", user_metadata: { plan: "free" } },
    resolvedPlan: { label: "Free", className: "plan-free" },
  }),
}));

describe("Performance analytics route behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T19:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates the route sort state from the sort menu", () => {
    const { container } = render(<PerformanceAnalyticsPage />);

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Sorted by performance score")).toBeInTheDocument();

    const sortToggle = container.querySelector(".sort-toggle");
    expect(sortToggle).not.toBeNull();
    fireEvent.click(sortToggle as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Views" }));

    expect(screen.getByText("Sorted by views")).toBeInTheDocument();
    expect(container.querySelector(".sort-menu")).toBeNull();
    expect(screen.getByRole("button", { name: /^views$/i })).toBeInTheDocument();
  });

  it("shows a busy refresh state and restores the idle state after the refresh delay", async () => {
    render(<PerformanceAnalyticsPage />);

    const refreshButton = screen.getByRole("button", { name: /refresh videos/i });
    fireEvent.click(refreshButton);

    expect(screen.getByText("Refreshing…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refreshing/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("Refresh videos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh videos/i })).not.toBeDisabled();
  });

  it("opens and closes the selected video detail modal", () => {
    const { container } = render(<PerformanceAnalyticsPage />);

    const firstVideoCard = container.querySelector(".compact-card");
    expect(firstVideoCard).not.toBeNull();

    fireEvent.click(firstVideoCard as HTMLElement);

    expect(screen.getByRole("dialog", { name: "Video detail" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog", { name: "Video detail" })).not.toBeInTheDocument();
  });

  it("clears threshold filters through the route-owned reset handler", () => {
    render(<PerformanceAnalyticsPage />);

    fireEvent.change(screen.getByLabelText("Min views"), { target: { value: "15000" } });
    fireEvent.change(screen.getByLabelText("Min likes"), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText("Min followers"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("Max followers"), { target: { value: "90000" } });

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByLabelText("Min views")).toHaveValue(null);
    expect(screen.getByLabelText("Min likes")).toHaveValue(null);
    expect(screen.getByLabelText("Min followers")).toHaveValue(null);
    expect(screen.getByLabelText("Max followers")).toHaveValue(null);
  });
});
