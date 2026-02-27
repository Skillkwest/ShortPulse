/**
 * Integration guard: telemetry.* sources must persist only to app_error_events.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeAppErrorLog } from "../../lib/server/api/appErrorLogs";

const fromMock = vi.fn();
const appErrorEventsInsertMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock,
  }),
}));

describe("appErrorLogs telemetry-only integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    appErrorEventsInsertMock.mockReturnValue({
      select: () => ({
        maybeSingle: async () => ({ data: { id: "evt-telemetry-1" }, error: null }),
      }),
    });

    fromMock.mockImplementation((tableName: string) => {
      if (tableName === "app_error_events") {
        return {
          insert: appErrorEventsInsertMock,
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (tableName === "app_error_logs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  order: () => ({
                    is: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                    eq: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: "inc-1" }, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    });
  });

  it("writes telemetry.* rows to event stream only and never creates an incident row", async () => {
    const result = await writeAppErrorLog({
      source: "telemetry.queue.dispatch.retry",
      scope: "generation",
      severity: "medium",
      message: "Queue retry telemetry sample",
      metadata: { attempts: 2 },
    });

    expect(result).toEqual({ ok: true, skipped: false, id: null });
    expect(appErrorEventsInsertMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("app_error_events");
    expect(fromMock).not.toHaveBeenCalledWith("app_error_logs");
  });
});
