/**
 * Admin page tests for dashboard announcement management interactions.
 */
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminAnnouncementsPage from "../../pages/admin/announcements";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
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

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

const createDataTransferMock = () => {
  const store = new Map<string, string>();
  return {
    effectAllowed: "",
    dropEffect: "",
    setData: vi.fn((type: string, value: string) => store.set(type, value)),
    getData: vi.fn((type: string) => store.get(type) ?? ""),
  };
};

describe("Admin announcements tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      const path = String(url);
      if (path.startsWith("/api/admin/users")) {
        return jsonResponse({
          users: [],
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
          search: { limited: false },
        });
      }
      if (path.startsWith("/api/admin/errors?")) {
        return jsonResponse({
          errors: [],
          summary: {
            openCount: 0,
            highSeverityOpenCount: 0,
            last24hCount: 0,
            appOpenCount: 0,
            generationOpenCount: 0,
          },
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
      if (path.startsWith("/api/admin/error-events?")) {
        return jsonResponse({
          events: [],
          summary: {
            last15mCount: 0,
            high15mCount: 0,
            generation15mCount: 0,
            providerRunningTimeout15mCount: 0,
            lastHourCount: 0,
            last24hCount: 0,
            app24hCount: 0,
            generation24hCount: 0,
            high24hCount: 0,
            characterModeReferenceRefreshEmptyLastHourCount: 0,
            characterModeReferenceRefreshEmptyLast24hCount: 0,
            characterModeBundleUnavailableFallbackLastHourCount: 0,
            characterModeBundleUnavailableFallbackLast24hCount: 0,
            total15mThreshold: 40,
            high15mThreshold: 8,
            generation15mThreshold: 20,
            providerRunningTimeout15mThreshold: 2,
            total15mBreached: false,
            high15mBreached: false,
            generation15mBreached: false,
            providerRunningTimeout15mBreached: false,
          },
          health: { eventsTableAvailable: true, degraded: false, reason: null },
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
      if (path === "/api/admin/announcements/current") {
        return jsonResponse({
          announcement: {
            id: "ann-1",
            title: "Studio maintenance",
            message: "We are deploying updates at 2AM UTC.",
            publishedAt: "2026-03-10T00:00:00.000Z",
            updatedAt: "2026-03-10T00:00:00.000Z",
          },
        });
      }
      if (path === "/api/admin/announcements/publish") {
        return jsonResponse({
          ok: true,
          announcement: {
            id: "ann-2",
            title: "New title",
            message: "New message",
            publishedAt: "2026-03-10T01:00:00.000Z",
            updatedAt: "2026-03-10T01:00:00.000Z",
          },
        });
      }
      if (path === "/api/admin/announcements/clear") {
        return jsonResponse({ ok: true });
      }
      if (path === "/api/admin/dashboard/tutorials") {
        return jsonResponse({
          tutorials: [
            {
              id: "tutorial-1",
              title: "Existing tutorial",
              youtubeUrl: "https://www.youtube.com/watch?v=existing",
              thumbnailUrl: "https://cdn.example.com/existing.gif",
              thumbnailMediaType: "image",
              thumbnailAlt: "Existing tutorial preview",
              displayOrder: 1,
              isActive: true,
              createdAt: "2026-06-10T00:00:00.000Z",
              updatedAt: "2026-06-10T00:00:00.000Z",
            },
          ],
        });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });
  });

  it("loads and pre-fills current announcement on tab open", async () => {
    render(<AdminAnnouncementsPage />);

    await waitFor(() => expect(screen.getByDisplayValue("Studio maintenance")).toBeInTheDocument());
    expect(screen.getByDisplayValue("We are deploying updates at 2AM UTC.")).toBeInTheDocument();
  });

  it("keeps the admin live dashboard payload preview ready for multiline messages", () => {
    const adminCss = readFileSync("styles/admin.module.css", "utf8");
    expect(adminCss).toMatch(/\.announcementPreviewMessage\s*{[^}]*white-space:\s*pre-line;/);
  });

  it("publishes and clears announcement with deterministic feedback", async () => {
    render(<AdminAnnouncementsPage />);

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/announcements/current",
        expect.objectContaining({ method: "GET" })
      )
    );

    fireEvent.change(screen.getByPlaceholderText("Platform notice"), {
      target: { value: "New title" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Tell users what changed and what to expect next."),
      {
        target: { value: "New message" },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(screen.getByText("Announcement published.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Clear active announcement" }));
    await waitFor(() =>
      expect(screen.getByText("Active announcement cleared.")).toBeInTheDocument()
    );
  });

  it("loads and saves dashboard tutorial cards with automatic thumbnail metadata", async () => {
    fetchWithAuthMock.mockImplementation(async (url: unknown, init?: { method?: string }) => {
      const path = String(url);
      if (path === "/api/admin/announcements/current") {
        return jsonResponse({ announcement: null });
      }
      if (path === "/api/admin/dashboard/tutorials" && init?.method === "GET") {
        return jsonResponse({
          tutorials: [
            {
              id: "tutorial-1",
              title: "Existing tutorial",
              youtubeUrl: "https://www.youtube.com/watch?v=existing",
              thumbnailUrl: "https://cdn.example.com/existing.gif",
              thumbnailMediaType: "image",
              thumbnailAlt: "Existing tutorial preview",
              displayOrder: 1,
              isActive: true,
              createdAt: "2026-06-10T00:00:00.000Z",
              updatedAt: "2026-06-10T00:00:00.000Z",
            },
          ],
        });
      }
      if (path === "/api/admin/dashboard/tutorials" && init?.method === "POST") {
        return jsonResponse({
          tutorial: {
            id: "tutorial-1",
            title: "Updated tutorial",
            youtubeUrl: "https://www.youtube.com/watch?v=abc123",
            thumbnailUrl: "https://cdn.example.com/existing.gif",
            thumbnailMediaType: "image",
            thumbnailAlt: "Tutorial thumbnail for Updated tutorial",
            displayOrder: 1,
            isActive: true,
            createdAt: "2026-06-10T00:00:00.000Z",
            updatedAt: "2026-06-10T00:00:00.000Z",
          },
          message: "Tutorial saved and active.",
        });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });

    render(<AdminAnnouncementsPage />);

    await waitFor(() => expect(screen.getByText("Existing tutorial")).toBeInTheDocument());
    expect(screen.queryByText("Thumbnail URL fallback")).not.toBeInTheDocument();
    expect(screen.queryByText("Thumbnail type")).not.toBeInTheDocument();
    expect(screen.queryByText("Display order")).not.toBeInTheDocument();
    expect(screen.queryByText(/Thumbnail alt/i)).not.toBeInTheDocument();

    const existingTutorialButton = screen.getByText("Existing tutorial").closest("button");
    expect(existingTutorialButton).not.toBeNull();
    fireEvent.click(existingTutorialButton as HTMLElement);
    fireEvent.change(screen.getByPlaceholderText("Create your first project"), {
      target: { value: "Updated tutorial" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://www.youtube.com/watch?v=..."), {
      target: { value: "https://www.youtube.com/watch?v=abc123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save tutorial" }));

    await waitFor(() => expect(screen.getByText("Tutorial saved and active.")).toBeInTheDocument());
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/dashboard/tutorials",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Tutorial thumbnail for Updated tutorial"),
      })
    );
  });

  it("persists dragged dashboard tutorial order through the reorder route", async () => {
    fetchWithAuthMock.mockImplementation(async (url: unknown, init?: { method?: string }) => {
      const path = String(url);
      if (path === "/api/admin/announcements/current") {
        return jsonResponse({ announcement: null });
      }
      if (path === "/api/admin/dashboard/tutorials" && init?.method === "GET") {
        return jsonResponse({
          tutorials: [
            {
              id: "tutorial-1",
              title: "First tutorial",
              youtubeUrl: "https://www.youtube.com/watch?v=first",
              thumbnailUrl: "https://cdn.example.com/first.gif",
              thumbnailMediaType: "image",
              thumbnailAlt: "First tutorial preview",
              displayOrder: 1,
              isActive: true,
              createdAt: "2026-06-10T00:00:00.000Z",
              updatedAt: "2026-06-10T00:00:00.000Z",
            },
            {
              id: "tutorial-2",
              title: "Second tutorial",
              youtubeUrl: "https://www.youtube.com/watch?v=second",
              thumbnailUrl: "https://cdn.example.com/second.gif",
              thumbnailMediaType: "image",
              thumbnailAlt: "Second tutorial preview",
              displayOrder: 2,
              isActive: true,
              createdAt: "2026-06-10T00:00:00.000Z",
              updatedAt: "2026-06-10T00:00:00.000Z",
            },
          ],
        });
      }
      if (path === "/api/admin/dashboard/tutorials" && init?.method === "PATCH") {
        return jsonResponse({
          tutorials: [
            {
              id: "tutorial-2",
              title: "Second tutorial",
              youtubeUrl: "https://www.youtube.com/watch?v=second",
              thumbnailUrl: "https://cdn.example.com/second.gif",
              thumbnailMediaType: "image",
              thumbnailAlt: "Second tutorial preview",
              displayOrder: 1,
              isActive: true,
              createdAt: "2026-06-10T00:00:00.000Z",
              updatedAt: "2026-06-10T00:00:00.000Z",
            },
            {
              id: "tutorial-1",
              title: "First tutorial",
              youtubeUrl: "https://www.youtube.com/watch?v=first",
              thumbnailUrl: "https://cdn.example.com/first.gif",
              thumbnailMediaType: "image",
              thumbnailAlt: "First tutorial preview",
              displayOrder: 2,
              isActive: true,
              createdAt: "2026-06-10T00:00:00.000Z",
              updatedAt: "2026-06-10T00:00:00.000Z",
            },
          ],
        });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });

    render(<AdminAnnouncementsPage />);

    await waitFor(() => expect(screen.getByText("First tutorial")).toBeInTheDocument());
    const firstCard = screen.getByText("First tutorial").closest("article");
    const secondCard = screen.getByText("Second tutorial").closest("article");
    expect(firstCard).not.toBeNull();
    expect(secondCard).not.toBeNull();

    const dataTransfer = createDataTransferMock();
    fireEvent.dragStart(firstCard as HTMLElement, { dataTransfer });
    fireEvent.dragOver(secondCard as HTMLElement, { dataTransfer });
    fireEvent.drop(secondCard as HTMLElement, { dataTransfer });

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/dashboard/tutorials",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ ids: ["tutorial-2", "tutorial-1"] }),
        })
      )
    );
  });
});
