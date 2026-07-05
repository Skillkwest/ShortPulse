import { render } from "@testing-library/react";
import type { AppProps } from "next/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../pages/_app";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useMediaComplianceGateMock = vi.hoisted(() => vi.fn());
const addBreadcrumbMock = vi.hoisted(() => vi.fn());
const reportAppErrorMock = vi.hoisted(() => vi.fn());

const nextRouterMock = vi.hoisted(() => vi.fn());
const routeEvents = new Map<string, (...args: unknown[]) => void>();

vi.mock("next/router", () => ({
  useRouter: () => nextRouterMock(),
}));

vi.mock("../../components/AppErrorBoundary", () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../features/compliance/hooks/useMediaComplianceGate", () => ({
  useMediaComplianceGate: (...args: unknown[]) => useMediaComplianceGateMock(...args),
}));

vi.mock("../../features/compliance/components/MediaComplianceGate", () => ({
  MediaComplianceGate: () => <div>Media compliance gate</div>,
}));

vi.mock("../../lib/authGuard", () => ({
  PROTECTED_ROUTES: ["/profile", "/report-issue", "/ai-studio", "/admin"],
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../lib/appErrorReporter", () => ({
  installGlobalAppErrorHandlers: () => () => undefined,
  reportAppError: (...args: unknown[]) => reportAppErrorMock(...args),
}));

vi.mock("../../lib/browserSessionHealth", () => ({
  installBrowserSessionHealthMonitor: () => () => undefined,
}));

vi.mock("../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbMock(...args),
  redactUrlForTelemetry: (value: string) => value.replace(/=([^&]+)/g, ""),
}));

vi.mock("../../lib/mediaPerfTelemetry", () => ({
  installMediaPerfDebugHandle: vi.fn(),
}));

const renderApp = () =>
  render(
    <App
      Component={() => <div>test page</div>}
      pageProps={{}}
      router={nextRouterMock() as unknown as AppProps["router"]}
    />
  );

const withMockedLocationAssign = (fn: (...args: string[]) => void): (() => void) => {
  const previousLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...previousLocation,
      assign: fn,
    },
  });

  return () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: previousLocation,
    });
  };
};

describe("App route-change recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeEvents.clear();
    window.history.pushState({}, "", "/admin");
    sessionStorage.clear();

    nextRouterMock.mockReturnValue({
      pathname: "/admin",
      asPath: "/admin",
      events: {
        on: (type: string, handler: (...args: unknown[]) => void) => {
          routeEvents.set(type, handler);
        },
        off: vi.fn(),
      },
    });

    useProtectedRouteMock.mockReturnValue({
      loading: false,
      session: { access_token: "token", user: { id: "user-1" } },
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

  it("reports route script load failures without hard navigation", () => {
    const assignSpy = vi.fn();
    const restoreLocationAssign = withMockedLocationAssign(assignSpy);
    renderApp();

    const routeChangeError = routeEvents.get("routeChangeError");
    expect(routeChangeError).toBeTypeOf("function");

    const scriptError = new Error(
      "Error: Failed to load script: /_next/static/chunks/a019415c343aa550.js"
    );
    routeChangeError?.(scriptError, "/ai-studio?projectId=11111111-1111-4111-8111-111111111111");

    expect(assignSpy).not.toHaveBeenCalled();
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.route_change_script_load_failure",
        endpoint: "/ai-studio?projectId",
        severity: "high",
      })
    );

    restoreLocationAssign();
  });

  it("keeps regular route-change reporting when script-loading is not detected", () => {
    renderApp();
    const routeChangeError = routeEvents.get("routeChangeError");
    expect(routeChangeError).toBeTypeOf("function");

    routeChangeError?.(new Error("network failed"), "/admin");

    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "client.route_change" })
    );
  });

  it("does not recover when navigation was cancelled", () => {
    const assignSpy = vi.fn();
    const restoreLocationAssign = withMockedLocationAssign(assignSpy);
    renderApp();

    const routeChangeError = routeEvents.get("routeChangeError");
    expect(routeChangeError).toBeTypeOf("function");

    routeChangeError?.(
      {
        cancelled: true,
        message: "Failed to load script: /_next/static/chunks/a019415c343aa550.js",
      },
      "/dashboard"
    );

    expect(assignSpy).not.toHaveBeenCalled();
    expect(reportAppErrorMock).not.toHaveBeenCalled();

    restoreLocationAssign();
  });
});
