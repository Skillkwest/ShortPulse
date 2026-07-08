import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiStudioToolbar } from "../AiStudioToolbar";
import {
  librariesToolList,
  primaryToolList,
  soundChildTools,
  workflowToolList,
} from "../../constants";
import {
  SHORTPULSE_COMMUNITY_LINK_REL,
  SHORTPULSE_COMMUNITY_LINK_TARGET,
  SHORTPULSE_COMMUNITY_URL,
} from "../../../../lib/communityLinks";
import type { ToolId } from "../../types";

const WORKFLOW_PLAN_CTA = {
  label: "View plans",
  href: "/profile?section=subscription",
  ariaLabel: "View subscription plans",
};

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

const railRepeatClickCase = (
  label: string,
  selectedTool: ToolId,
  expectedTool: ToolId
): [string, ToolId, ToolId] => [label, selectedTool, expectedTool];

const leftRailRepeatClickCases = [
  ...primaryToolList.map((tool) => railRepeatClickCase(tool.label, tool.id, tool.id)),
  ...workflowToolList.map((tool) => {
    const activeTool: ToolId = tool.id === "sound" ? "voices" : tool.id;
    return railRepeatClickCase(tool.label, activeTool, activeTool);
  }),
  ...soundChildTools.map((tool) => railRepeatClickCase(tool.label, tool.id, tool.id)),
  ...librariesToolList.map((tool) => railRepeatClickCase(tool.label, tool.id, tool.id)),
] satisfies Array<[string, ToolId, ToolId]>;

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

  it("links the left-rail logo to the dashboard", () => {
    renderToolbar();

    const logoLink = screen.getByRole("link", { name: "Go to dashboard" });

    expect(logoLink).toHaveAttribute("href", "/dashboard");
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

  it("keeps Starter-restricted Video and Sound in place as plan links", () => {
    const onSelectTool = vi.fn();
    const onWorkflowPlanAccessAttempt = vi.fn();

    render(
      <AiStudioToolbar
        selectedTool={null}
        showCreateTools={false}
        workflowPlanAccessCta={WORKFLOW_PLAN_CTA}
        onOpenProjects={vi.fn()}
        onSelectTool={onSelectTool}
        onWorkflowPlanAccessAttempt={onWorkflowPlanAccessAttempt}
        onToggleCreateTools={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Video" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sound" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Voices" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Music" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sound Effects" })).toBeNull();

    const videoPlanLink = screen.getByRole("link", {
      name: "Video: View subscription plans",
    });
    const soundPlanLink = screen.getByRole("link", {
      name: "Sound: View subscription plans",
    });

    expect(videoPlanLink).toHaveAttribute("href", "/profile?section=subscription");
    expect(soundPlanLink).toHaveAttribute("href", "/profile?section=subscription");
    expect(videoPlanLink).toHaveAttribute("data-tool-id", "video");
    expect(soundPlanLink).toHaveAttribute("data-tool-id", "sound");
    expect(videoPlanLink.querySelector(".toolbar-label-default")).toHaveTextContent("Video");
    expect(soundPlanLink.querySelector(".toolbar-label-default")).toHaveTextContent("Sound");
    expect(videoPlanLink.querySelector(".toolbar-label-plan-cta")).toHaveTextContent("View plans");
    expect(soundPlanLink.querySelector(".toolbar-label-plan-cta")).toHaveTextContent("View plans");
    expect(videoPlanLink.querySelector(".toolbar-plan-lock-icon")).not.toBeNull();
    expect(soundPlanLink.querySelector(".toolbar-plan-lock-icon")).not.toBeNull();

    fireEvent.click(videoPlanLink);
    fireEvent.click(soundPlanLink);

    expect(onWorkflowPlanAccessAttempt).toHaveBeenCalledTimes(2);
    expect(onSelectTool).not.toHaveBeenCalled();
  });

  it("opens Community as an external community link", () => {
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

    const communityLink = screen.getByRole("link", { name: "Community" });

    expect(communityLink).toHaveAttribute("href", SHORTPULSE_COMMUNITY_URL);
    expect(communityLink).toHaveAttribute("target", SHORTPULSE_COMMUNITY_LINK_TARGET);
    expect(communityLink).toHaveAttribute("rel", SHORTPULSE_COMMUNITY_LINK_REL);
    expect(screen.queryByRole("button", { name: "Community" })).toBeNull();
    expect(onSelectTool).not.toHaveBeenCalled();
    expect(onToggleCreateTools).not.toHaveBeenCalled();
  });

  it.each(leftRailRepeatClickCases)(
    "keeps the active %s rail panel open on repeat click",
    (label, selectedTool, expectedTool) => {
      const onSelectTool = vi.fn();
      const onToggleCreateTools = vi.fn();

      render(
        <AiStudioToolbar
          selectedTool={selectedTool}
          showCreateTools={false}
          onOpenProjects={vi.fn()}
          onSelectTool={onSelectTool}
          onToggleCreateTools={onToggleCreateTools}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: label }));

      expect(onToggleCreateTools).toHaveBeenCalledWith(false);
      expect(onSelectTool).toHaveBeenCalledWith(expectedTool);
      expect(onSelectTool).not.toHaveBeenCalledWith(null);
    }
  );

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

  it("omits deferred shortcuts, templates, and retired My Generations entry points", () => {
    renderToolbar();

    expect(screen.queryByText("Shortcuts")).toBeNull();
    expect(screen.queryByRole("button", { name: "Templates" })).toBeNull();
    expect(screen.queryByRole("button", { name: "My Generations" })).toBeNull();
  });

  it("opens the account menu with profile sections, report issue, and logout", async () => {
    renderToolbar();

    const trigger = screen.getByRole("button", { name: "Account settings" });
    mockElementRect(trigger, { left: 18, right: 178, top: 680, bottom: 724, width: 160 });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Account settings" });

    expect(document.body.contains(menu)).toBe(true);
    expect(menu).toHaveStyle({
      position: "fixed",
      left: "18px",
      bottom: `${window.innerHeight - 680 + 12}px`,
      zIndex: "1230",
    });
    expect(screen.getByText("Kirk Artman")).toBeInTheDocument();
    expect(screen.getByText("kirk@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/profile?section=account&from=%2Fai-studio%3FprojectId%3Dproject-1"
    );
    expect(screen.getByRole("menuitem", { name: "Billing" })).toHaveAttribute(
      "href",
      "/profile?section=account&from=%2Fai-studio%3FprojectId%3Dproject-1#billing"
    );
    expect(screen.getByRole("menuitem", { name: "Subscription" })).toHaveAttribute(
      "href",
      "/profile?section=subscription&from=%2Fai-studio%3FprojectId%3Dproject-1"
    );
    expect(screen.getByRole("menuitem", { name: "Credits" })).toHaveAttribute(
      "href",
      "/profile?section=credits&from=%2Fai-studio%3FprojectId%3Dproject-1"
    );
    expect(screen.getByRole("menuitem", { name: "Storage" })).toHaveAttribute(
      "href",
      "/profile?section=storage&from=%2Fai-studio%3FprojectId%3Dproject-1"
    );
    expect(screen.getByRole("menuitem", { name: "Transactions" })).toHaveAttribute(
      "href",
      "/profile?section=transactions&from=%2Fai-studio%3FprojectId%3Dproject-1"
    );
    expect(screen.getByRole("menuitem", { name: "Customer Support" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Report an issue" })).toHaveAttribute(
      "href",
      "/report-issue?from=%2Fai-studio%3FprojectId%3Dproject-1"
    );
    const menuItemLabels = within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent?.trim() ?? "");
    expect(menuItemLabels.indexOf("Customer Support")).toBeLessThan(
      menuItemLabels.indexOf("Report an issue")
    );
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Customer Support" }));
    expect(
      await screen.findByRole("dialog", { name: "Contact Customer Support" })
    ).toHaveTextContent("Use the email below");
    expect(screen.getByText("service@shortpulse.co")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open email app" })).not.toBeInTheDocument();
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
