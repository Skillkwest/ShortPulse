import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AiStudioProtectedRouteEntry from "../../features/ai-studio/routes/AiStudioProtectedRouteEntry";

const routerState = vi.hoisted(() => ({
  pathname: "/ai-studio",
  asPath: "/ai-studio?projectId=project-1",
  query: { projectId: "project-1" } as Record<string, string>,
}));
const replaceMock = vi.hoisted(() => vi.fn());
const createProjectMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useProtectedRouteRestoreGuardMock = vi.hoisted(() => vi.fn());
const useMediaComplianceGateMock = vi.hoisted(() => vi.fn());
const mediaComplianceGatePropsSpy = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({
  useRouter: (() => {
    const router = {
      get pathname() {
        return routerState.pathname;
      },
      get asPath() {
        return routerState.asPath;
      },
      get query() {
        return routerState.query;
      },
      replace: replaceMock,
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
    };
    return () => router;
  })(),
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/AppErrorBoundary", () => ({
  AppErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../features/compliance/components/MediaComplianceGate", () => ({
  MediaComplianceGate: (props: Record<string, unknown>) => {
    mediaComplianceGatePropsSpy(props);
    return <div data-testid="media-compliance-gate">Media compliance gate</div>;
  },
}));

vi.mock("../../features/compliance/hooks/useMediaComplianceGate", () => ({
  useMediaComplianceGate: (...args: unknown[]) => useMediaComplianceGateMock(...args),
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../lib/useProtectedRouteRestoreGuard", () => ({
  useProtectedRouteRestoreGuard: (...args: unknown[]) => useProtectedRouteRestoreGuardMock(...args),
}));

vi.mock("../../features/projects/logic/projectCreateClient", () => ({
  createProject: (...args: unknown[]) => createProjectMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const baseComplianceState = {
  accepted: true,
  acceptedAt: "2026-04-25T18:00:00.000Z",
  acceptAgreement: vi.fn(),
  agreement: {
    key: "media_usage_compliance",
    version: "2026-04-25",
    title: "Media agreement",
    intro: "Please accept.",
    rules: [],
    checkboxLabel: "I agree",
    confirmLabel: "Continue",
  },
  error: null,
  initialized: true,
  loading: false,
  refreshStatus: vi.fn(),
  status: "accepted",
};

const renderRouteEntry = () =>
  render(
    <AiStudioProtectedRouteEntry
      RuntimeComponent={() => <div data-testid="ai-studio-runtime">AI Studio runtime</div>}
    />
  );

describe("AiStudioProtectedRouteEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    routerState.pathname = "/ai-studio";
    routerState.asPath = "/ai-studio?projectId=project-1";
    routerState.query = { projectId: "project-1" };
    createProjectMock.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      title: "Untitled Project",
      createdAt: "2026-06-15T18:00:00.000Z",
      updatedAt: "2026-06-15T18:00:00.000Z",
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        project: {
          id: "00000000-0000-4000-8000-000000000099",
          title: "Untitled Project",
        },
      }),
    } as Response);

    useProtectedRouteMock.mockReturnValue({
      loading: false,
      session: { access_token: "token", user: { id: "user-1" } },
      user: { id: "user-1" },
    });
    useProtectedRouteRestoreGuardMock.mockReturnValue({
      checking: false,
    });

    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
    });
  });

  it("uses the AI Studio entry shell while checking the protected session", () => {
    useProtectedRouteMock.mockReturnValue({
      loading: true,
      session: null,
      user: null,
    });

    renderRouteEntry();

    expect(screen.getByRole("status")).toHaveTextContent("Loading project");
    expect(screen.getByText("ShortPulse · AI Studio")).toBeInTheDocument();
    expect(
      screen.getByText("Checking your session before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Project loading progress")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-studio-runtime")).not.toBeInTheDocument();
  });

  it("keeps the AI Studio runtime hidden while browser restore auth is revalidating", () => {
    useProtectedRouteRestoreGuardMock.mockReturnValue({
      checking: true,
    });

    renderRouteEntry();

    expect(screen.getByRole("status")).toHaveTextContent("Loading project");
    expect(
      screen.getByText("Checking your session before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ai-studio-runtime")).not.toBeInTheDocument();
  });

  it("uses the AI Studio entry shell while checking media compliance", () => {
    routerState.pathname = "/ai-studio";
    routerState.asPath = "/ai-studio";
    routerState.query = {};
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      initialized: false,
      loading: true,
      status: "loading",
    });

    renderRouteEntry();

    expect(screen.getByRole("status")).toHaveTextContent("Loading project");
    expect(
      screen.getByText("Checking your media agreement before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Project loading progress")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-studio-runtime")).not.toBeInTheDocument();
  });

  it("creates a saved checkout project after consent clears before opening AI Studio", async () => {
    routerState.asPath =
      "/ai-studio?checkout=subscription_success&project=new&checkout_session_id=cs_test_123";
    routerState.query = {
      checkout: "subscription_success",
      project: "new",
      checkout_session_id: "cs_test_123",
    };

    renderRouteEntry();

    expect(screen.getByText("Creating Untitled Project")).toBeInTheDocument();
    expect(
      screen.getByText("Saving your starter project before AI Studio opens.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ai-studio-runtime")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith("Untitled Project");
      expect(replaceMock).toHaveBeenCalledWith(
        {
          pathname: "/ai-studio",
          query: { projectId: "00000000-0000-4000-8000-000000000001" },
        },
        undefined,
        { shallow: false }
      );
    });
    expect(window.sessionStorage.getItem("shortpulse.checkoutProject.cs_test_123")).toBe(
      "00000000-0000-4000-8000-000000000001"
    );
    expect(window.sessionStorage.getItem("shortpulse.checkoutProject.user-1:cs_test_123")).toBe(
      "00000000-0000-4000-8000-000000000001"
    );
  });

  it("waits for media consent before creating a checkout project", () => {
    routerState.asPath =
      "/ai-studio?checkout=subscription_success&project=new&checkout_session_id=cs_test_123";
    routerState.query = {
      checkout: "subscription_success",
      project: "new",
      checkout_session_id: "cs_test_123",
    };
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      accepted: false,
      status: "needs_consent",
    });

    renderRouteEntry();

    expect(screen.getByTestId("media-compliance-gate")).toBeInTheDocument();
    expect(createProjectMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("reuses an already-created checkout project for the same Stripe session", async () => {
    routerState.asPath =
      "/ai-studio?checkout=subscription_success&project=new&checkout_session_id=cs_test_123";
    routerState.query = {
      checkout: "subscription_success",
      project: "new",
      checkout_session_id: "cs_test_123",
    };
    window.sessionStorage.setItem(
      "shortpulse.checkoutProject.cs_test_123",
      "00000000-0000-4000-8000-000000000099"
    );

    renderRouteEntry();

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/projects/00000000-0000-4000-8000-000000000099",
        {
          method: "GET",
          shortpulseAuthTimeoutMs: 5000,
          shortpulseRetryNetworkOnce: true,
        }
      );
      expect(createProjectMock).not.toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith(
        {
          pathname: "/ai-studio",
          query: { projectId: "00000000-0000-4000-8000-000000000099" },
        },
        undefined,
        { shallow: false }
      );
    });
  });

  it("does not reuse a cached checkout project when it no longer belongs to the signed-in user", async () => {
    routerState.asPath =
      "/ai-studio?checkout=subscription_success&project=new&checkout_session_id=cs_test_123";
    routerState.query = {
      checkout: "subscription_success",
      project: "new",
      checkout_session_id: "cs_test_123",
    };
    window.sessionStorage.setItem(
      "shortpulse.checkoutProject.user-1:cs_test_123",
      "00000000-0000-4000-8000-000000000099"
    );
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Project not found" }),
    } as Response);

    renderRouteEntry();

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith("Untitled Project");
      expect(replaceMock).toHaveBeenCalledWith(
        {
          pathname: "/ai-studio",
          query: { projectId: "00000000-0000-4000-8000-000000000001" },
        },
        undefined,
        { shallow: false }
      );
    });
    expect(window.sessionStorage.getItem("shortpulse.checkoutProject.user-1:cs_test_123")).toBe(
      "00000000-0000-4000-8000-000000000001"
    );
  });

  it("keeps the explicit compliance form when acceptance is still required", () => {
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      accepted: false,
      status: "needs_consent",
    });

    renderRouteEntry();

    expect(screen.getByTestId("media-compliance-gate")).toBeInTheDocument();
    expect(mediaComplianceGatePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        loading: false,
        error: null,
      })
    );
  });

  it("does not render the consent form when auth recovery is required", () => {
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      accepted: false,
      initialized: true,
      status: "auth_recovery_required",
      error: "Your session expired. Sign in again to continue.",
    });

    renderRouteEntry();

    expect(
      screen.getByText("Refreshing your session before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("media-compliance-gate")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fai-studio%3FprojectId%3Dproject-1");
  });

  it("renders the heavy AI Studio runtime only after the gates clear", () => {
    renderRouteEntry();

    expect(screen.getByTestId("ai-studio-runtime")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
