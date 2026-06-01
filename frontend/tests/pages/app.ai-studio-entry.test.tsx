import { render, screen, waitFor } from "@testing-library/react";
import type { AppProps } from "next/app";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../pages/_app";

const routerState = vi.hoisted(() => ({
  pathname: "/ai-studio",
}));

const sharedGateSpy = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: routerState.pathname,
    asPath: routerState.pathname,
    replace: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

vi.mock("../../components/AppErrorBoundary", () => ({
  AppErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../features/compliance/routes/ProtectedRouteBootstrapGate", () => ({
  ProtectedRouteBootstrapGate: ({ children }: { children: ReactNode }) => {
    sharedGateSpy();
    return <div data-testid="shared-protected-gate">{children}</div>;
  },
}));

vi.mock("../../lib/protectedRoutes", () => ({
  isAiStudioRoutePath: (pathname: string) =>
    pathname.startsWith("/ai-studio") || pathname.startsWith("/creator-studio"),
  isProtectedRoutePath: (pathname: string) =>
    [
      "/performance",
      "/saved-creators",
      "/profile",
      "/report-issue",
      "/ai-studio",
      "/creator-studio",
      "/admin",
    ].some((route) => pathname.startsWith(route)),
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

describe("App protected-route entry wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.pathname = "/ai-studio";
  });

  it("bypasses the shared protected bootstrap on AI Studio routes", () => {
    renderApp();

    expect(sharedGateSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.queryByTestId("shared-protected-gate")).not.toBeInTheDocument();
  });

  it("uses the shared protected bootstrap on non-AI protected routes", async () => {
    routerState.pathname = "/profile";

    renderApp();

    await waitFor(() => {
      expect(sharedGateSpy).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId("shared-protected-gate")).toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("bypasses the shared protected bootstrap on public routes", () => {
    routerState.pathname = "/";

    renderApp();

    expect(sharedGateSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.queryByTestId("shared-protected-gate")).not.toBeInTheDocument();
  });
});
