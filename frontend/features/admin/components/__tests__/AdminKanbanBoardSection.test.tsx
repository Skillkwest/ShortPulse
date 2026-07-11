/**
 * Admin kanban board tests.
 * Covers shared API persistence plus accessible item movement between workflow statuses.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminKanbanBoardSection } from "../AdminKanbanBoardSection";
import type { AdminKanbanItem } from "../../data/adminKanbanBoard";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const makeItem = (overrides: Partial<AdminKanbanItem> = {}): AdminKanbanItem => ({
  id: "task-1",
  title: "Publish billing update",
  details: "Release note",
  status: "backlog",
  sortOrder: 1,
  sourceType: "manual",
  sourceKey: null,
  sourcePath: null,
  sourceSection: null,
  sourceLine: null,
  sourceFingerprint: null,
  sourceSyncedAt: null,
  sourceMissingAt: null,
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z",
  createdBy: "admin-user-1",
  updatedBy: "admin-user-1",
  ...overrides,
});

const jsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });

describe("AdminKanbanBoardSection", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    fetchWithAuthMock.mockResolvedValue(jsonResponse({ items: [] }));
  });

  it("loads tasks and adds a task to backlog through the admin API", async () => {
    const createdItem = makeItem({
      id: "task-created",
      title: "Draft launch checklist",
      details: "Owner: ops",
    });
    fetchWithAuthMock
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, item: createdItem }, { status: 201 }));

    render(<AdminKanbanBoardSection />);

    fireEvent.change(screen.getByPlaceholderText("Add a to-do item"), {
      target: { value: "Draft launch checklist" },
    });
    fireEvent.change(screen.getByPlaceholderText("Owner, ticket, or release context"), {
      target: { value: "Owner: ops" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() => {
      const backlogColumn = screen.getByLabelText("Board Backlog tasks");
      expect(within(backlogColumn).getByText("Draft launch checklist")).toBeInTheDocument();
      expect(within(backlogColumn).getByText("Owner: ops")).toBeInTheDocument();
    });

    expect(fetchWithAuthMock).toHaveBeenLastCalledWith(
      "/api/admin/kanban/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Draft launch checklist",
          details: "Owner: ops",
        }),
      })
    );
  });

  it("moves a task across the requested statuses", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(jsonResponse({ items: [makeItem()] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, item: makeItem({ status: "in_progress" }) }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, item: makeItem({ status: "review" }) }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, item: makeItem({ status: "complete" }) }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, item: makeItem({ status: "published" }) }));

    render(<AdminKanbanBoardSection />);

    await waitFor(() =>
      expect(
        within(screen.getByLabelText("Board Backlog tasks")).getByText("Publish billing update")
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Publish billing update right" }));
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("In progress tasks")).getByText("Publish billing update")
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Publish billing update right" }));
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("Review tasks")).getByText("Publish billing update")
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Publish billing update right" }));
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("Complete tasks")).getByText("Publish billing update")
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Publish billing update right" }));
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("Published tasks")).getByText("Publish billing update")
      ).toBeInTheDocument()
    );

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/kanban/items/task-1/move",
      expect.objectContaining({
        body: JSON.stringify({ status: "published" }),
        method: "POST",
      })
    );
  });

  it("does not expose card archive controls", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        items: [makeItem({ title: "Remove stale task", details: "", status: "complete" })],
      })
    );

    render(<AdminKanbanBoardSection />);

    await waitFor(() => expect(screen.getByText("Remove stale task")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Archive Remove stale task" })).toBeNull();
  });

  it("surfaces human-review tickets with a visible label", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          makeItem({
            title: "[HUMAN REVIEW] Provider access blocked",
            details:
              "*** HUMAN REVIEW REQUIRED ***\nBlocked by: Vendor/provider access\nHuman action needed: connect provider account",
          }),
        ],
      })
    );

    render(<AdminKanbanBoardSection />);

    const backlogColumn = await screen.findByLabelText("Board Backlog tasks");
    expect(within(backlogColumn).getByText("Human review required")).toBeInTheDocument();
    expect(
      within(backlogColumn).getByText(/Blocked by: Vendor\/provider access/)
    ).toBeInTheDocument();
    expect(
      within(backlogColumn).queryByText("*** HUMAN REVIEW REQUIRED ***")
    ).not.toBeInTheDocument();
  });

  it("opens the Ophestivus action log from the board header", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(jsonResponse({ items: [] })).mockResolvedValueOnce(
      jsonResponse({
        activity: [
          {
            id: "activity-1",
            itemId: "task-1",
            itemTitle: "Publish billing update",
            action: "moved",
            fromStatus: "backlog",
            toStatus: "review",
            note: "Moved during review",
            actorUserId: "admin-user-1",
            actorEmail: "admin@example.com",
            createdAt: "2026-04-30T00:01:00.000Z",
          },
        ],
      })
    );

    render(<AdminKanbanBoardSection />);

    fireEvent.click(screen.getByRole("button", { name: "Action log" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Ophestivus action log" })).toBeInTheDocument();
      expect(screen.getByText("Publish billing update")).toBeInTheDocument();
      expect(screen.getByText("Moved during review")).toBeInTheDocument();
      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      expect(screen.getByText("Backlog -> Review")).toBeInTheDocument();
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/kanban/activity",
      expect.objectContaining({ method: "GET", shortpulseSkipErrorLogging: true })
    );
  });

  it("renders planning backlog document cards in their own source column", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          makeItem({
            id: "planning-task",
            title: "Make paid generation cost obvious",
            details: "Program: Program 1: Runtime And Money",
            sourceType: "planning_backlog",
            sourceKey: "spb-p1-001",
            sourcePath: "docs/planning/backlog.md",
            sourceSection: "Program 1: Runtime And Money",
            sourceLine: 30,
            sourceFingerprint: "a".repeat(64),
            sourceSyncedAt: "2026-07-10T00:00:00.000Z",
          }),
          makeItem({
            id: "manual-task",
            title: "Manual backlog task",
          }),
        ],
      })
    );

    render(<AdminKanbanBoardSection />);

    const planningColumn = await screen.findByLabelText("Backlog Document tasks");
    const boardBacklogColumn = screen.getByLabelText("Board Backlog tasks");
    expect(
      within(planningColumn).getByText("Make paid generation cost obvious")
    ).toBeInTheDocument();
    expect(within(planningColumn).getByText("Backlog doc")).toBeInTheDocument();
    expect(within(boardBacklogColumn).getByText("Manual backlog task")).toBeInTheDocument();
    expect(
      within(boardBacklogColumn).queryByText("Make paid generation cost obvious")
    ).not.toBeInTheDocument();
  });
});
