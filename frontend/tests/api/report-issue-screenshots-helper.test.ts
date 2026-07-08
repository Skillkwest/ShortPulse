import { describe, expect, it, vi } from "vitest";
import { cleanupStaleIssueReportScreenshotUploadsForUser } from "../../lib/server/api/issueReportScreenshots";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("issue report screenshot helpers", () => {
  it("removes only old unreferenced prepared screenshot uploads for the user", async () => {
    const oldTimestamp = "2026-07-06T00:00:00.000Z";
    const freshTimestamp = "2026-07-08T00:00:00.000Z";
    const referencedPath = `issue-reports/${USER_ID}/22222222-2222-4222-8222-222222222222.png`;
    const stalePath = `issue-reports/${USER_ID}/33333333-3333-4333-8333-333333333333.webp`;
    const freshPath = `issue-reports/${USER_ID}/44444444-4444-4444-8444-444444444444.jpg`;
    const listMock = vi.fn().mockResolvedValue({
      data: [
        {
          name: "22222222-2222-4222-8222-222222222222.png",
          created_at: oldTimestamp,
        },
        {
          name: "33333333-3333-4333-8333-333333333333.webp",
          created_at: oldTimestamp,
        },
        {
          name: "44444444-4444-4444-8444-444444444444.jpg",
          created_at: freshTimestamp,
        },
        {
          name: "not-a-screenshot.txt",
          created_at: oldTimestamp,
        },
      ],
      error: null,
    });
    const removeMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const storageFromMock = vi.fn().mockReturnValue({
      list: listMock,
      remove: removeMock,
    });
    const inMock = vi.fn().mockResolvedValue({
      data: [{ storage_path: referencedPath }],
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ in: inMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    const supabaseAdmin = {
      storage: { from: storageFromMock },
      from: fromMock,
    };

    const result = await cleanupStaleIssueReportScreenshotUploadsForUser(supabaseAdmin as never, {
      userId: USER_ID,
      nowMs: Date.parse("2026-07-08T12:00:00.000Z"),
      minAgeMs: 24 * 60 * 60 * 1000,
    });

    expect(listMock).toHaveBeenCalledWith(`issue-reports/${USER_ID}`, {
      limit: 50,
      sortBy: { column: "created_at", order: "asc" },
    });
    expect(inMock).toHaveBeenCalledWith("storage_path", [referencedPath, stalePath]);
    expect(removeMock).toHaveBeenCalledWith([stalePath]);
    expect(removeMock).not.toHaveBeenCalledWith([freshPath]);
    expect(result).toEqual({ scanned: 4, removed: 1 });
  });
});
