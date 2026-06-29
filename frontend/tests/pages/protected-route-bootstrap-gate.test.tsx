import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRouteBootstrapGate } from "../../features/compliance/routes/ProtectedRouteBootstrapGate";

const routerState = vi.hoisted(() => ({
  asPath: "/profile",
}));
const replaceMock = vi.hoisted(() => vi.fn());
const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useProtectedRouteRestoreGuardMock = vi.hoisted(() => vi.fn());
const useMediaComplianceGateMock = vi.hoisted(() => vi.fn());
const mediaComplianceGatePropsSpy = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({
  useRouter: () => ({
    asPath: routerState.asPath,
    replace: replaceMock,
  }),
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../lib/useProtectedRouteRestoreGuard", () => ({
  useProtectedRouteRestoreGuard: (...args: unknown[]) => useProtectedRouteRestoreGuardMock(...args),
}));

vi.mock("../../features/compliance/hooks/useMediaComplianceGate", () => ({
  useMediaComplianceGate: (...args: unknown[]) => useMediaComplianceGateMock(...args),
}));

vi.mock("../../features/compliance/components/MediaComplianceGate", () => ({
  MediaComplianceGate: (props: Record<string, unknown>) => {
    mediaComplianceGatePropsSpy(props);
    return <div data-testid="media-compliance-gate">Media compliance gate</div>;
  },
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

const renderGate = () =>
  render(
    <ProtectedRouteBootstrapGate>
      <div data-testid="protected-page">Protected page</div>
    </ProtectedRouteBootstrapGate>
  );

describe("ProtectedRouteBootstrapGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.asPath = "/profile";
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

  it("shows the generic session loader while protected auth is resolving", () => {
    useProtectedRouteMock.mockReturnValue({
      loading: true,
      session: null,
      user: null,
    });

    renderGate();

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.getByText("ShortPulse · Loading")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
  });

  it("keeps protected content hidden while browser restore auth is revalidating", () => {
    useProtectedRouteRestoreGuardMock.mockReturnValue({
      checking: true,
    });

    renderGate();

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
  });

  it("shows the generic compliance loader while media compliance is resolving", () => {
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      initialized: false,
      loading: true,
      status: "loading",
    });

    renderGate();

    expect(screen.getByText("Checking your media agreement…")).toBeInTheDocument();
    expect(screen.getByText("ShortPulse · Loading")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
  });

  it("keeps protected content hidden before media compliance initializes", () => {
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      accepted: false,
      initialized: false,
      loading: false,
      status: "idle",
    });

    renderGate();

    expect(screen.getByText("Checking your media agreement…")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("media-compliance-gate")).not.toBeInTheDocument();
  });

  it("keeps the explicit compliance gate when acceptance is still required", () => {
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      accepted: false,
      status: "needs_consent",
    });

    renderGate();

    expect(screen.getByTestId("media-compliance-gate")).toBeInTheDocument();
    expect(mediaComplianceGatePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        loading: false,
        error: null,
        secondaryActionLabel: "Sign out",
        onSecondaryAction: expect.any(Function),
      })
    );
  });

  it("redirects to login when recovery is required and keeps the recovery loader visible", () => {
    useMediaComplianceGateMock.mockReturnValue({
      ...baseComplianceState,
      accepted: false,
      initialized: true,
      status: "auth_recovery_required",
      error: "Your session expired. Sign in again to continue.",
    });

    renderGate();

    expect(screen.getByText("Refreshing your session…")).toBeInTheDocument();
    expect(screen.queryByTestId("media-compliance-gate")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fprofile");
  });

  it("renders protected page content once the gate clears", () => {
    renderGate();

    expect(screen.getByTestId("protected-page")).toBeInTheDocument();
    expect(screen.queryByText("Checking your session…")).not.toBeInTheDocument();
  });
});
