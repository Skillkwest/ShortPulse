import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportIssuePage from "../../pages/report-issue";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const uploadToSignedUrlMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  asPath: "/report-issue?from=%2Fdashboard",
  query: {
    from: "/dashboard",
  } as Record<string, string>,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState,
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl: (...args: unknown[]) => uploadToSignedUrlMock(...args),
      }),
    },
  }),
}));

describe("ReportIssuePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:screenshot-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    routerState.asPath = "/report-issue?from=%2Fdashboard";
    routerState.query = { from: "/dashboard" };
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "user-1", email: "user@example.com" },
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reportId: "report-1" }),
    });
    uploadToSignedUrlMock.mockResolvedValue({ error: null });
  });

  it("shows the same captured context that it submits to the API", async () => {
    render(<ReportIssuePage />);

    expect(screen.getByText(/Captured context:/)).toBeInTheDocument();
    expect(screen.getByText("/dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Route context")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "The dashboard spinner never settled." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/report-issue",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            message: "The dashboard spinner never settled.",
            sourcePath: "/dashboard",
            screenshots: [],
          }),
        })
      );
    });

    expect(
      await screen.findByText("Report sent. We saved your note and context for review.")
    ).toBeInTheDocument();
  });

  it("uploads selected screenshots before submitting the report", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          target: {
            storagePath: "issue-reports/user-1/screenshot.png",
            uploadToken: "upload-token",
            mimeType: "image/png",
            maxBytes: 10485760,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, reportId: "report-1" }),
      });

    render(<ReportIssuePage />);

    const screenshot = new File(["screenshot-bytes"], "screenshot.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Screenshots"), {
      target: { files: [screenshot] },
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "The AI Studio canvas froze after upload." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
        1,
        "/api/report-issue/screenshots/prepare",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceMimeType: "image/png",
            sourceSize: screenshot.size,
          }),
        })
      );
    });
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "issue-reports/user-1/screenshot.png",
      "upload-token",
      screenshot,
      {
        contentType: "image/png",
        upsert: false,
      }
    );
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/report-issue",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          message: "The AI Studio canvas froze after upload.",
          sourcePath: "/dashboard",
          screenshots: [
            {
              storagePath: "issue-reports/user-1/screenshot.png",
              sourceName: "screenshot.png",
              sourceMimeType: "image/png",
              sourceSize: screenshot.size,
            },
          ],
        }),
      })
    );
  });
});
