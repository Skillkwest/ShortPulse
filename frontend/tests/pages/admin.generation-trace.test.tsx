import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminGenerationTracePage from "../../pages/admin/generation-trace";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const useRouterMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("Admin generation trace page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({
      isReady: true,
      query: {},
    });
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "admin-1", email: "admin@example.com" },
    });
    useAdminAccessMock.mockReturnValue({
      status: "ready",
      isLoading: false,
      isAdmin: true,
      error: null,
      refresh: vi.fn(),
    });
  });

  it("renders pricing observability mismatch rows from the trace API", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: vi.fn(async () => ({
        query: {
          generationId: null,
          requestId: "req-1",
          traceId: null,
          userId: null,
        },
        summary: {
          generations: 1,
          attempts: 0,
          outputs: 0,
          mediaEvents: 0,
          mediaFiles: 0,
          reservations: 0,
          ledgerEntries: 0,
          errorEvents: 0,
          pricingObservabilityMismatches: 1,
        },
        pricingObservabilityMismatchRows: [
          {
            sourceType: "generation",
            rowId: "gen-1",
            generationId: "gen-1",
            requestId: "req-1",
            providerRequestId: null,
            sourceRef: null,
            observedAt: "2026-05-10T12:00:00.000Z",
            displayedBilledCredits: 8,
            actualBilledCredits: 10,
            deltaCredits: 2,
            mismatch: true,
            pricingDisplaySource: "shared_adapter",
            pricingPolicyReady: true,
          },
        ],
        generations: [],
        generationAttempts: [],
        generationOutputs: [],
        mediaEvents: [],
        mediaFiles: [],
        reservations: [],
        ledgerEntries: [],
        errorEvents: [],
        warnings: [],
      })),
    });

    render(<AdminGenerationTracePage />);

    fireEvent.change(screen.getByPlaceholderText("requestId (provider request_id)"), {
      target: { value: "req-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load trace" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Pricing observability mismatches" })
      ).toBeInTheDocument()
    );

    expect(screen.getByText(/"displayedBilledCredits": 8/)).toBeInTheDocument();
    expect(screen.getByText(/"actualBilledCredits": 10/)).toBeInTheDocument();
    expect(screen.getByText(/"pricingDisplaySource": "shared_adapter"/)).toBeInTheDocument();
  });
});
