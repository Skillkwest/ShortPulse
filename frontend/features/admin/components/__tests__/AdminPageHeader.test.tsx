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
  it("renders Customer Support first in the admin nav", () => {
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

    expect(links[0]).toHaveTextContent("Customer Support");
    expect(links[0]).toHaveAttribute("href", "/admin");
    expect(links[1]).toHaveTextContent("Dashboard");
    expect(links[1]).toHaveAttribute("href", "/admin/announcements");
    expect(links[1]).toHaveAttribute("aria-current", "page");
    expect(links[2]).toHaveTextContent("Agent Instructions");
    expect(links[2]).toHaveAttribute("href", "/admin/agent-instructions");
    expect(links[3]).toHaveTextContent("Model Pricing");
    expect(links[3]).toHaveAttribute("href", "/admin/pricing");
    expect(links[4]).toHaveTextContent("Storage");
    expect(links[4]).toHaveAttribute("href", "/admin/storage");
    expect(links[5]).toHaveTextContent("Product Catalog");
    expect(links[5]).toHaveAttribute("href", "/admin/catalog");
    expect(links[6]).toHaveTextContent("Offers");
    expect(links[6]).toHaveAttribute("href", "/admin/offers");
    expect(links[7]).toHaveTextContent("Analytics");
    expect(links[7]).toHaveAttribute("href", "/admin/stats");
    expect(links[8]).toHaveTextContent("Agent Tester Reports");
    expect(links[8]).toHaveAttribute("href", "/admin/tester-reports");
    expect(links[9]).toHaveTextContent("Errors");
    expect(links[9]).toHaveAttribute("href", "/admin/errors");
    expect(links[10]).toHaveTextContent("Legal");
    expect(links[10]).toHaveAttribute("href", "/admin/legal");
    expect(links).toHaveLength(11);
    expect(within(nav).queryByRole("link", { name: "Generation health" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Reports" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Fleet health" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Ophestivus" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Crash Logs" })).not.toBeInTheDocument();
  });

  it("marks the tester reports tab as active", () => {
    render(
      <AdminPageHeader
        title="Agent Tester Reports"
        description="Read automated tester reports."
        userEmail="admin@example.com"
        currentPath="/admin/tester-reports"
      />
    );

    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    expect(within(nav).getByRole("link", { name: "Agent Tester Reports" })).toHaveAttribute(
      "aria-current",
      "page"
    );
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
    expect(subLinks[1]).toHaveTextContent("Customer Issue Reports");
    expect(subLinks[1]).toHaveAttribute("href", "/admin/reports");
    expect(subLinks[1]).toHaveAttribute("aria-current", "page");
    expect(subLinks[2]).toHaveTextContent("User health");
    expect(subLinks[2]).toHaveAttribute("href", "/admin/user-health");
    expect(subLinks[3]).toHaveTextContent("Fleet health");
    expect(subLinks[3]).toHaveAttribute("href", "/admin/user-health-fleet");
    expect(subLinks[4]).toHaveTextContent("Generation trace");
    expect(subLinks[4]).toHaveAttribute("href", "/admin/generation-trace");
    expect(subLinks).toHaveLength(5);
  });

  it("renders generation diagnostic routes as customer support secondary tabs", () => {
    render(
      <AdminPageHeader
        title="Generation trace"
        description="Inspect generation lifecycle events."
        userEmail="admin@example.com"
        currentPath="/admin/generation-trace"
      />
    );

    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    expect(within(nav).getByRole("link", { name: "Customer Support" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).queryByRole("link", { name: "Generation health" })).not.toBeInTheDocument();

    const subNav = screen.getByRole("navigation", { name: "Customer support pages" });
    const subLinks = within(subNav).getAllByRole("link");

    expect(subLinks.map((link) => link.textContent)).toEqual([
      "Support",
      "Customer Issue Reports",
      "User health",
      "Fleet health",
      "Generation trace",
    ]);
    expect(subLinks[4]).toHaveAttribute("href", "/admin/generation-trace");
    expect(subLinks[4]).toHaveAttribute("aria-current", "page");
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
    expect(subLinks[1]).toHaveTextContent("Crash Logs");
    expect(subLinks[1]).toHaveAttribute("href", "/admin/crashes");
    expect(subLinks[2]).toHaveTextContent("Ophestivus");
    expect(subLinks[2]).toHaveAttribute("href", "/admin/kanban");
    expect(subLinks[2]).toHaveAttribute("aria-current", "page");
  });

  it("marks Crash Logs as the active error-management secondary tab", () => {
    render(
      <AdminPageHeader
        title="Crash logs"
        description="Inspect browser crash sessions."
        userEmail="admin@example.com"
        currentPath="/admin/crashes"
      />
    );

    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    expect(within(nav).getByRole("link", { name: "Errors" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    const subNav = screen.getByRole("navigation", { name: "Error management pages" });
    expect(within(subNav).getByRole("link", { name: "Crash Logs" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
