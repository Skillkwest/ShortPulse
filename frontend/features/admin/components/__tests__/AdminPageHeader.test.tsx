/**
 * AdminPageHeader tests.
 * Verifies the shared admin navigation order and active route state.
 */
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AdminPageHeader } from "../AdminPageHeader";

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

describe("AdminPageHeader", () => {
  it("renders Dashboard as the first admin nav item before Support", () => {
    render(
      <AdminPageHeader
        title="Dashboard"
        description="Manage dashboard content."
        userEmail="admin@example.com"
        currentPath="/admin/announcements"
      />
    );

    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    const links = within(nav).getAllByRole("link");

    expect(links[0]).toHaveTextContent("Dashboard");
    expect(links[0]).toHaveAttribute("href", "/admin/announcements");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).toHaveTextContent("Support");
    expect(links[1]).toHaveAttribute("href", "/admin");
  });
});
