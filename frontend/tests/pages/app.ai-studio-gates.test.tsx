import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../pages/_app";

const nextRouterMock = vi.fn();
const useProtectedRouteMock = vi.fn();
const useMediaComplianceGateMock = vi.fn();
const addBreadcrumbMock = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => nextRouterMock(),
}));

vi.mock("../../lib/authGuard", () => ({
  PROTECTED_ROUTES: ["/ai-studio", "/profile"],
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/compliance/hooks/useMediaComplianceGate", () => ({
  useMediaComplianceGate: (...args: unknown[]) => useMediaComplianceGateMock(...args),
}));

vi.mock("../../components/AppErrorBoundary", () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../lib/appErrorReporter", () => ({
  installGlobalAppErrorHandlers: () => () => undefined,
  reportAppError: vi.fn(),
}));

vi.mock("../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbMock(...args),
  redactUrlForTelemetry: (value: string) => value,
}));

vi.mock("../../lib/mediaPerfTelemetry", () => ({
  installMediaPerfDebugHandle: vi.fn(),
}));

const renderApp = () =>
  render(<App Component={() => <div>page</div>} pageProps={{}} router={nextRouterMock()} />);

describe("App AI Studio protected gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextRouterMock.mockReturnValue({
      pathname: "/ai-studio",
      asPath: "/ai-studio?projectId=project-1",
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
    });
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      session: { access_token: "token" },
      user: { id: "user-1" },
    });
    useMediaComplianceGateMock.mockReturnValue({
      agreement: { title: "Agreement", intro: "", bullets: [] },
      accepted: true,
      acceptedAt: null,
      initialized: true,
      loading: false,
      error: null,
      acceptAgreement: vi.fn(),
      refreshStatus: vi.fn(),
    });
  });

  it("uses the polished entry screen while AI Studio session access is still loading", () => {
    useProtectedRouteMock.mockReturnValue({
      loading: true,
      session: null,
      user: null,
    });

    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Loading project");
    expect(screen.queryByText("Checking your session…")).not.toBeInTheDocument();
    expect(
      screen.getByText("Checking your session before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.getByText("Verify session")).toBeInTheDocument();
    expect(screen.getByText("Resolve project")).toBeInTheDocument();
  });

  it("uses the polished entry screen while AI Studio media compliance is loading", () => {
    useMediaComplianceGateMock.mockReturnValue({
      agreement: { title: "Agreement", intro: "", bullets: [] },
      accepted: false,
      acceptedAt: null,
      initialized: false,
      loading: true,
      error: null,
      acceptAgreement: vi.fn(),
      refreshStatus: vi.fn(),
    });

    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Loading project");
    expect(screen.queryByText("Checking your media agreement…")).not.toBeInTheDocument();
    expect(
      screen.getByText("Checking your media agreement before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.getByText("Check media agreement")).toBeInTheDocument();
    expect(screen.getByText("Load workspace")).toBeInTheDocument();
  });

  it("keeps the legacy compliance loader for non-AI-Studio protected routes", () => {
    nextRouterMock.mockReturnValue({
      pathname: "/profile",
      asPath: "/profile",
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
    });
    useMediaComplianceGateMock.mockReturnValue({
      agreement: { title: "Agreement", intro: "", bullets: [] },
      accepted: false,
      acceptedAt: null,
      initialized: false,
      loading: true,
      error: null,
      acceptAgreement: vi.fn(),
      refreshStatus: vi.fn(),
    });

    renderApp();

    expect(screen.getByText("Checking your media agreement…")).toBeInTheDocument();
    expect(screen.queryByText("Loading project")).not.toBeInTheDocument();
  });
});
