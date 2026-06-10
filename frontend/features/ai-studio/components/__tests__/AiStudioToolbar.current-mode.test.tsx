import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiStudioToolbar } from "../AiStudioToolbar";

const useRouterMock = vi.hoisted(() => vi.fn());
const useResolvedProtectedSessionStateMock = vi.hoisted(() => vi.fn());
const signOutSupabaseSessionMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const nextImageProps = { ...props };
    delete nextImageProps.priority;
    return <div data-testid="mock-next-image" {...nextImageProps} />;
  },
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

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

vi.mock("../../../../components/DashboardNavPrefab", () => ({
  DashboardNavPrefab: () => <span>Dashboard</span>,
}));

vi.mock("../../../../lib/protectedRouteSessionContext", () => ({
  useResolvedProtectedSessionState: (...args: unknown[]) =>
    useResolvedProtectedSessionStateMock(...args),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  signOutSupabaseSession: (...args: unknown[]) => signOutSupabaseSessionMock(...args),
}));

const renderToolbar = () =>
  render(
    <AiStudioToolbar
      selectedTool={null}
      showCreateTools={false}
      onOpenProjects={vi.fn()}
      onSelectTool={vi.fn()}
      onToggleCreateTools={vi.fn()}
    />
  );

const mockElementRect = (element: Element, rect: Partial<DOMRect>) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: rect.left ?? 16,
        y: rect.top ?? 900,
        left: rect.left ?? 16,
        top: rect.top ?? 900,
        right: rect.right ?? 176,
        bottom: rect.bottom ?? 944,
        width: rect.width ?? 160,
        height: rect.height ?? 44,
        toJSON: () => ({}),
      }) as DOMRect,
  });
};

describe("AiStudioToolbar current mode", () => {
  beforeEach(() => {
    routerReplaceMock.mockReset();
    signOutSupabaseSessionMock.mockReset();
    signOutSupabaseSessionMock.mockResolvedValue(undefined);
    useRouterMock.mockReturnValue({
      asPath: "/ai-studio?projectId=project-1",
      replace: routerReplaceMock,
    });
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { access_token: "token" },
      user: {
        id: "user-1",
        email: "kirk@example.com",
        user_metadata: {
          display_name: "Kirk Artman",
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders account controls instead of retired mode-toggle chrome", () => {
    const { container } = render(
      <AiStudioToolbar
        selectedTool="create"
        showCreateTools={true}
        onOpenProjects={vi.fn()}
        onSelectTool={vi.fn()}
        onToggleCreateTools={vi.fn()}
      />
    );

    expect(container.querySelector(".toolbar-footer--toggle-hidden")).toBeNull();
    expect(container.querySelector(".toolbar-footer--account")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Account settings" })).toBeInTheDocument();
  });

  it("routes the primary Create action directly to the create workflow", () => {
    const onSelectTool = vi.fn();
    const onToggleCreateTools = vi.fn();

    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={false}
        onOpenProjects={vi.fn()}
        onSelectTool={onSelectTool}
        onToggleCreateTools={onToggleCreateTools}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith("create");
  });

  it("renders Characters in Libraries instead of the primary workflow section", () => {
    const onSelectTool = vi.fn();
    const onToggleCreateTools = vi.fn();

    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={false}
        onOpenProjects={vi.fn()}
        onSelectTool={onSelectTool}
        onToggleCreateTools={onToggleCreateTools}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Characters" }));

    expect(onToggleCreateTools).toHaveBeenCalledWith(false);
    expect(onSelectTool).toHaveBeenCalledWith("character");

    const librariesSection = screen.getByText("Libraries").closest(".toolbar-lower");
    expect(librariesSection).not.toBeNull();
    const libraryButtons = within(librariesSection as HTMLElement).getAllByRole("button");
    const labels = libraryButtons.map((button) => button.textContent?.trim() ?? "");
    expect(labels.indexOf("Media")).toBeLessThan(labels.indexOf("Characters"));
    expect(
      within(librariesSection as HTMLElement).getByRole("button", { name: "Characters" })
    ).toBeTruthy();
  });

  it("opens the account menu with profile sections, report issue, and logout", async () => {
    renderToolbar();

    const trigger = screen.getByRole("button", { name: "Account settings" });
    mockElementRect(trigger, { left: 18, right: 178, bottom: 930, width: 160 });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Account settings" });

    expect(document.body.contains(menu)).toBe(true);
    expect(menu).toHaveStyle({ position: "fixed", zIndex: "1230" });
    expect(screen.getByText("Kirk Artman")).toBeInTheDocument();
    expect(screen.getByText("kirk@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/profile?section=account"
    );
    expect(screen.getByRole("menuitem", { name: "Subscription" })).toHaveAttribute(
      "href",
      "/profile?section=subscription"
    );
    expect(screen.getByRole("menuitem", { name: "Credits & billing" })).toHaveAttribute(
      "href",
      "/profile?section=credits"
    );
    expect(screen.getByRole("menuitem", { name: "Storage" })).toHaveAttribute(
      "href",
      "/profile?section=storage"
    );
    expect(screen.getByRole("menuitem", { name: "Transactions" })).toHaveAttribute(
      "href",
      "/profile?section=transactions"
    );
    expect(screen.getByRole("menuitem", { name: "Report an issue" })).toHaveAttribute(
      "href",
      "/report-issue?from=%2Fai-studio%3FprojectId%3Dproject-1"
    );
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });

  it("falls back to email when account metadata is not a usable display name", async () => {
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { access_token: "token" },
      user: {
        id: "user-1",
        email: "fallback@example.com",
        user_metadata: {
          display_name: { nested: "not-a-string" },
          full_name: 42,
        },
      },
    });

    renderToolbar();

    const trigger = screen.getByRole("button", { name: "Account settings" });
    mockElementRect(trigger, { left: 18, right: 178, bottom: 930, width: 160 });
    fireEvent.click(trigger);

    expect(await screen.findByRole("menu", { name: "Account settings" })).toBeInTheDocument();
    expect(screen.getAllByText("fallback@example.com").length).toBeGreaterThan(0);
  });

  it("closes the account menu on Escape and outside click", async () => {
    renderToolbar();

    const trigger = screen.getByRole("button", { name: "Account settings" });
    mockElementRect(trigger, { left: 18, right: 178, bottom: 930, width: 160 });
    fireEvent.click(trigger);

    expect(await screen.findByRole("menu", { name: "Account settings" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("menu", { name: "Account settings" })).not.toBeInTheDocument();
    });

    fireEvent.click(trigger);
    expect(await screen.findByRole("menu", { name: "Account settings" })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole("menu", { name: "Account settings" })).not.toBeInTheDocument();
    });
  });

  it("confirms logout before signing out and routing home", async () => {
    renderToolbar();

    const trigger = screen.getByRole("button", { name: "Account settings" });
    mockElementRect(trigger, { left: 18, right: 178, bottom: 930, width: 160 });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Log out" }));

    const dialog = screen.getByRole("dialog", { name: "Log out?" });
    expect(within(dialog).getByRole("heading", { name: "Log out?" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Log out?" })).not.toBeInTheDocument();
    });

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Log out" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(signOutSupabaseSessionMock).toHaveBeenCalledTimes(1);
      expect(routerReplaceMock).toHaveBeenCalledWith("/");
    });
  });
});
