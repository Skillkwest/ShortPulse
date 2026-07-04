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
  it("renders Product Catalog as the fourth admin nav item", () => {
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
    expect(links[1]).toHaveTextContent("Agent Instructions");
    expect(links[1]).toHaveAttribute("href", "/admin/agent-instructions");
    expect(links[2]).toHaveTextContent("Model Pricing");
    expect(links[2]).toHaveAttribute("href", "/admin/pricing");
    expect(links[3]).toHaveTextContent("Product Catalog");
    expect(links[3]).toHaveAttribute("href", "/admin/catalog");
    expect(links[4]).toHaveTextContent("Customer Support");
    expect(links[4]).toHaveAttribute("href", "/admin");
    expect(links[5]).toHaveTextContent("Legal");
    expect(links[5]).toHaveAttribute("href", "/admin/legal");
    expect(links[9]).toHaveTextContent("Errors");
    expect(links[9]).toHaveAttribute("href", "/admin/errors");
    expect(links[10]).toHaveTextContent("Generation health");
    expect(links[10]).toHaveAttribute("href", "/admin/user-health");
    expect(within(nav).queryByRole("link", { name: "Reports" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Fleet health" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Ophestivus" })).not.toBeInTheDocument();
  });

  it("renders customer support pages as secondary tabs", () => {
    render(
      <AdminPageHeader
        title="Issue reports"
        description="Read user-reported issues."
        userEmail="admin@example.com"
        currentPath="/admin/reports"
      />
    );

    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    expect(within(nav).getByRole("link", { name: "Customer Support" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    const subNav = screen.getByRole("navigation", { name: "Customer support pages" });
    const subLinks = within(subNav).getAllByRole("link");

    expect(subLinks[0]).toHaveTextContent("Support");
    expect(subLinks[0]).toHaveAttribute("href", "/admin");
    expect(subLinks[1]).toHaveTextContent("Reports");
    expect(subLinks[1]).toHaveAttribute("href", "/admin/reports");
    expect(subLinks[1]).toHaveAttribute("aria-current", "page");
  });

  it("renders generation health pages as secondary tabs", () => {
    render(
      <AdminPageHeader
        title="Generation trace"
        description="Inspect generation lifecycle events."
        userEmail="admin@example.com"
        currentPath="/admin/generation-trace"
      />
    );

    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    expect(within(nav).getByRole("link", { name: "Generation health" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    const subNav = screen.getByRole("navigation", { name: "Generation health pages" });
    const subLinks = within(subNav).getAllByRole("link");

    expect(subLinks[0]).toHaveTextContent("User health");
    expect(subLinks[0]).toHaveAttribute("href", "/admin/user-health");
    expect(subLinks[1]).toHaveTextContent("Fleet health");
    expect(subLinks[1]).toHaveAttribute("href", "/admin/user-health-fleet");
    expect(subLinks[2]).toHaveTextContent("Generation trace");
    expect(subLinks[2]).toHaveAttribute("href", "/admin/generation-trace");
    expect(subLinks[2]).toHaveAttribute("aria-current", "page");
  });

  it("renders error management pages as secondary tabs", () => {
    render(
      <AdminPageHeader
        title="Ophestivus"
        description="Track operator tasks."
        userEmail="admin@example.com"
        currentPath="/admin/kanban"
      />
    );

    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    expect(within(nav).getByRole("link", { name: "Errors" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    const subNav = screen.getByRole("navigation", { name: "Error management pages" });
    const subLinks = within(subNav).getAllByRole("link");

    expect(subLinks[0]).toHaveTextContent("Errors");
    expect(subLinks[0]).toHaveAttribute("href", "/admin/errors");
    expect(subLinks[1]).toHaveTextContent("Ophestivus");
    expect(subLinks[1]).toHaveAttribute("href", "/admin/kanban");
    expect(subLinks[1]).toHaveAttribute("aria-current", "page");
  });
});
