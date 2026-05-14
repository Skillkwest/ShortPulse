import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMediaComplianceAcceptanceStatusForUser,
  saveMediaComplianceAcceptanceForUser,
} from "../mediaComplianceAcceptance";

const getSupabaseAdminMock = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("mediaComplianceAcceptance", () => {
  beforeEach(() => {
    getSupabaseAdminMock.mockReset();
  });

  it("returns accepted status when the current version row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { accepted_at: "2026-04-25T10:00:00.000Z" },
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eqVersion = vi.fn().mockReturnValue({ order });
    const eqKey = vi.fn().mockReturnValue({ eq: eqVersion });
    const eqUser = vi.fn().mockReturnValue({ eq: eqKey });
    const select = vi.fn().mockReturnValue({ eq: eqUser });
    const from = vi.fn().mockReturnValue({ select });
    getSupabaseAdminMock.mockReturnValue({ from });

    const status = await getMediaComplianceAcceptanceStatusForUser("user-123");

    expect(from).toHaveBeenCalledWith("user_media_compliance_acceptances");
    expect(select).toHaveBeenCalledWith("accepted_at");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-123");
    expect(order).toHaveBeenCalledWith("accepted_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(1);
    expect(status).toEqual({
      accepted: true,
      acceptedAt: "2026-04-25T10:00:00.000Z",
    });
  });

  it("returns unaccepted status when no current version row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eqVersion = vi.fn().mockReturnValue({ order });
    const eqKey = vi.fn().mockReturnValue({ eq: eqVersion });
    const eqUser = vi.fn().mockReturnValue({ eq: eqKey });
    const select = vi.fn().mockReturnValue({ eq: eqUser });
    const from = vi.fn().mockReturnValue({ select });
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(getMediaComplianceAcceptanceStatusForUser("user-123")).resolves.toEqual({
      accepted: false,
      acceptedAt: null,
    });
  });

  it("inserts the current version acceptance with request metadata", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { accepted_at: "2026-04-25T12:00:00.000Z" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    getSupabaseAdminMock.mockReturnValue({ from });

    const status = await saveMediaComplianceAcceptanceForUser({
      req: {
        headers: {
          "x-forwarded-for": "198.51.100.8, 10.0.0.1",
          "user-agent": "Vitest Browser",
        },
      } as never,
      userId: "user-123",
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const [payload] = insert.mock.calls[0] ?? [];
    expect(payload).toMatchObject({
      user_id: "user-123",
      agreement_key: "media_usage_compliance",
      agreement_version: "2026-04-25",
      ip_address: "198.51.100.8",
      user_agent: "Vitest Browser",
    });
    expect(status).toEqual({
      accepted: true,
      acceptedAt: "2026-04-25T12:00:00.000Z",
    });
  });

  it("falls back to the existing acceptance row when the insert hits a duplicate", async () => {
    const duplicateError = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    };
    const duplicateMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: duplicateError,
    });
    const insertSelect = vi.fn().mockReturnValue({ maybeSingle: duplicateMaybeSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const readMaybeSingle = vi.fn().mockResolvedValue({
      data: { accepted_at: "2026-04-25T12:34:56.000Z" },
      error: null,
    });
    const readLimit = vi.fn().mockReturnValue({ maybeSingle: readMaybeSingle });
    const readOrder = vi.fn().mockReturnValue({ limit: readLimit });
    const readEqVersion = vi.fn().mockReturnValue({ order: readOrder });
    const readEqKey = vi.fn().mockReturnValue({ eq: readEqVersion });
    const readEqUser = vi.fn().mockReturnValue({ eq: readEqKey });
    const readSelect = vi.fn().mockReturnValue({ eq: readEqUser });
    const from = vi
      .fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({ select: readSelect });
    getSupabaseAdminMock.mockReturnValue({ from });

    const status = await saveMediaComplianceAcceptanceForUser({
      req: { headers: {} } as never,
      userId: "user-123",
    });

    expect(status).toEqual({
      accepted: true,
      acceptedAt: "2026-04-25T12:34:56.000Z",
    });
  });
});
