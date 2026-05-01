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
      const backlogColumn = screen.getByLabelText("Backlog tasks");
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
        within(screen.getByLabelText("Backlog tasks")).getByText("Publish billing update")
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

  it("archives tasks from the board", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          items: [makeItem({ title: "Remove stale task", details: "", status: "complete" })],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    render(<AdminKanbanBoardSection />);

    await waitFor(() => expect(screen.getByText("Remove stale task")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Archive Remove stale task" }));

    await waitFor(() => {
      expect(screen.queryByText("Remove stale task")).not.toBeInTheDocument();
    });
    expect(fetchWithAuthMock).toHaveBeenLastCalledWith(
      "/api/admin/kanban/items/task-1/archive",
      expect.objectContaining({ method: "POST" })
    );
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

    const backlogColumn = await screen.findByLabelText("Backlog tasks");
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
});
