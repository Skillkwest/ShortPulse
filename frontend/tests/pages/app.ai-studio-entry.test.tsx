import { render, screen } from "@testing-library/react";
import type { AppProps } from "next/app";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../pages/_app";

const routerState = vi.hoisted(() => ({
  pathname: "/ai-studio",
}));
const replaceMock = vi.hoisted(() => vi.fn());

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useMediaComplianceGateMock = vi.hoisted(() => vi.fn());
const mediaComplianceGatePropsSpy = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: routerState.pathname,
    asPath: routerState.pathname,
    replace: replaceMock,
    events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
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
  PROTECTED_ROUTES: [
    "/performance",
    "/saved-creators",
    "/media-library",
    "/profile",
    "/ai-studio",
    "/creator-studio",
    "/character",
    "/admin",
  ],
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../lib/appErrorReporter", () => ({
  installGlobalAppErrorHandlers: () => () => undefined,
  reportAppError: vi.fn(),
}));

vi.mock("../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
  redactUrlForTelemetry: (value: string) => value,
}));

vi.mock("../../lib/mediaPerfTelemetry", () => ({
  installMediaPerfDebugHandle: vi.fn(),
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

const renderApp = () => {
  const TestComponent = () => <div data-testid="page-content">Page content</div>;

  return render(
    <App
      Component={TestComponent}
      pageProps={{}}
      router={undefined as unknown as AppProps["router"]}
    />
  );
};

describe("App AI Studio entry behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.pathname = "/ai-studio";

    useProtectedRouteMock.mockReturnValue({
      loading: false,
      session: { access_token: "token", user: { id: "user-1" } },
      user: { id: "user-1" },
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

    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Loading project");
    expect(
      screen.getByText("Checking your session before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Project loading progress")).toBeInTheDocument();
    expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
  });

  it("uses the AI Studio entry shell while checking media compliance on creator studio", () => {
    routerState.pathname = "/creator-studio";
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      initialized: false,
      loading: true,
      status: "loading",
    });

    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Loading project");
    expect(
      screen.getByText("Checking your media agreement before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Project loading progress")).toBeInTheDocument();
  });

  it("keeps the explicit compliance form when acceptance is still required", () => {
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      accepted: false,
      status: "needs_consent",
    });

    renderApp();

    expect(screen.getByTestId("media-compliance-gate")).toBeInTheDocument();
    expect(mediaComplianceGatePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        loading: false,
        error: null,
      })
    );
  });

  it("leaves non-AI-Studio protected routes on the generic protected loader", () => {
    routerState.pathname = "/profile";
    useProtectedRouteMock.mockReturnValue({
      loading: true,
      session: null,
      user: null,
    });

    renderApp();

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.queryByText("AI Studio Access Check")).not.toBeInTheDocument();
  });

  it("does not render the consent form when auth recovery is required", () => {
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      accepted: false,
      initialized: true,
      status: "auth_recovery_required",
      error: "Your session expired. Sign in again to continue.",
    });

    renderApp();

    expect(
      screen.getByText("Refreshing your session before project restore continues.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("media-compliance-gate")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/auth?next=%2Fai-studio");
  });
});
