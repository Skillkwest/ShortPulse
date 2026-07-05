/**
 * AdminCrashLogsPanel tests.
 * Verifies the operator-facing browser crash-session table and copy packet action.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCrashLogsPanel } from "../AdminCrashLogsPanel";
import type { AdminCrashSessionRow } from "../../types";

const copyToClipboardMock = vi.fn();

vi.mock("../../logic/copyToClipboard", () => ({
  copyToClipboard: (value: string) => copyToClipboardMock(value),
}));

const crashSession: AdminCrashSessionRow = {
  id: "crash-1",
  browserSessionId: "browser-session-1",
  userId: "user-1",
  userEmail: "alpha@example.com",
  status: "active",
  confidence: "none",
  effectiveStatus: "probable_freeze_or_crash",
  effectiveConfidence: "medium",
  isStale: false,
  lastEvent: "previous_session_abandoned",
  route: "/ai-studio",
  buildId: "build-1",
  clientRelease: "release-1",
  clientEnvironment: "production",
  userAgent: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36",
  host: "www.shortpulse.ai",
  vercelId: "iad1::abc",
  metadata: {
    pressure_level: 5,
    stall_duration_ms: 2400,
    heap_usage_ratio: 0.87,
  },
  startedAt: "2026-07-05T01:00:00.000Z",
  lastSeenAt: "2026-07-05T01:02:00.000Z",
  endedAt: null,
  suspectedAt: "2026-07-05T01:02:30.000Z",
  createdAt: "2026-07-05T01:00:00.000Z",
  updatedAt: "2026-07-05T01:02:30.000Z",
};

describe("AdminCrashLogsPanel", () => {
  beforeEach(() => {
    copyToClipboardMock.mockReset();
    copyToClipboardMock.mockResolvedValue(true);
  });

  it("renders account-linked crash evidence and copies a triage packet", async () => {
    render(
      <AdminCrashLogsPanel
        sessions={[crashSession]}
        loading={false}
        error={null}
        pagination={{
          page: 1,
          perPage: 50,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }}
        statusFilter="all"
        search=""
        onStatusFilterChange={vi.fn()}
        onSearchChange={vi.fn()}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText("Probable freeze")).toBeInTheDocument();
    expect(screen.getByText("medium confidence")).toBeInTheDocument();
    expect(screen.getByText("alpha@example.com")).toBeInTheDocument();
    expect(screen.getByText("/ai-studio")).toBeInTheDocument();
    expect(screen.getByText("pressure 5 · stall 2400ms · heap 87%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Session browser-session-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy packet" }));

    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });

    expect(copyToClipboardMock.mock.calls[0]?.[0]).toContain("browser_crash_session");
    expect(copyToClipboardMock.mock.calls[0]?.[0]).toContain("alpha@example.com");
  });
});
