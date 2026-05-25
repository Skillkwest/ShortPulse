import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AdminReportDetailModal } from "../AdminReportDetailModal";
import type { AdminIssueReportRow } from "../../types";

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

const buildReport = (overrides: Partial<AdminIssueReportRow> = {}): AdminIssueReportRow => ({
  id: "report-1",
  userId: "user-1",
  submitterEmail: "alpha@example.com",
  message: "Generation failed on upload.",
  adminNotes: "Initial notes",
  status: "new" as const,
  sourcePath: "/dashboard",
  userAgent: "Mozilla/5.0",
  reviewedAt: null,
  reviewedByUserId: null,
  createdAt: "2026-05-24T18:00:00.000Z",
  updatedAt: "2026-05-24T18:00:00.000Z",
  ...overrides,
});

describe("AdminReportDetailModal", () => {
  it("limits notes length and resets the draft when a different report is opened", () => {
    const onUpdateReport = vi.fn().mockResolvedValue(null);
    const initialReport = buildReport();
    const { rerender } = render(
      <AdminReportDetailModal
        key={`${initialReport.id}:${initialReport.updatedAt}`}
        selectedReport={initialReport}
        updatingReportId={null}
        onClose={vi.fn()}
        onUpdateReport={onUpdateReport}
      />
    );

    const notesInput = screen.getByLabelText("Admin notes") as HTMLTextAreaElement;
    expect(notesInput.maxLength).toBe(4000);
    expect(notesInput.value).toBe("Initial notes");

    fireEvent.change(notesInput, { target: { value: "Edited notes" } });
    expect(notesInput.value).toBe("Edited notes");

    const nextReport = buildReport({
      id: "report-2",
      submitterEmail: "beta@example.com",
      adminNotes: "Fresh report notes",
      updatedAt: "2026-05-24T18:10:00.000Z",
    });
    rerender(
      <AdminReportDetailModal
        key={`${nextReport.id}:${nextReport.updatedAt}`}
        selectedReport={nextReport}
        updatingReportId={null}
        onClose={vi.fn()}
        onUpdateReport={onUpdateReport}
      />
    );

    expect(screen.getByLabelText("Admin notes")).toHaveValue("Fresh report notes");
  });
});
