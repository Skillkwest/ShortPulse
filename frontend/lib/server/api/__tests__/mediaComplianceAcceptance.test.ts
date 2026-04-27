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
    const eqVersion = vi.fn().mockReturnValue({ maybeSingle });
    const eqKey = vi.fn().mockReturnValue({ eq: eqVersion });
    const eqUser = vi.fn().mockReturnValue({ eq: eqKey });
    const select = vi.fn().mockReturnValue({ eq: eqUser });
    const from = vi.fn().mockReturnValue({ select });
    getSupabaseAdminMock.mockReturnValue({ from });

    const status = await getMediaComplianceAcceptanceStatusForUser("user-123");

    expect(from).toHaveBeenCalledWith("user_media_compliance_acceptances");
    expect(select).toHaveBeenCalledWith("accepted_at");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-123");
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
    const eqVersion = vi.fn().mockReturnValue({ maybeSingle });
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

  it("upserts the current version acceptance with request metadata", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { accepted_at: "2026-04-25T12:00:00.000Z" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
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

    expect(upsert).toHaveBeenCalledTimes(1);
    const [payload, options] = upsert.mock.calls[0] ?? [];
    expect(options).toEqual({ onConflict: "user_id,agreement_key,agreement_version" });
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
});
