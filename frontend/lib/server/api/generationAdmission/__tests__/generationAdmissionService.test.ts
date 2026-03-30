import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateUserGenerationAdmission } from "../generationAdmissionService";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const mockReservationRows = (rows: Array<{ model_id: string }>) => {
  const eqStatus = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eqUser = vi.fn().mockReturnValue({ eq: eqStatus });
  const select = vi.fn().mockReturnValue({ eq: eqUser });
  const from = vi.fn().mockReturnValue({ select });
  getSupabaseAdminMock.mockReturnValue({ from });
};

describe("generationAdmissionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits in off mode without querying reservations", async () => {
    const decision = await evaluateUserGenerationAdmission({
      userId: "user-1",
      modelId: "fal-ai/veo3.1",
      config: {
        mode: "off",
        globalMax: 4,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
        retryAfterSeconds: 20,
        sharedProviderEnabled: false,
        sharedProviderGlobalMax: 4,
      },
    });

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(decision.allowed).toBe(true);
    expect(decision.wouldLimit).toBe(false);
  });

  it("denies in enforce mode when reservation counts exceed caps", async () => {
    mockReservationRows([
      { model_id: "fal-ai/veo3.1" },
      { model_id: "fal-ai/veo3.1/image-to-video" },
      { model_id: "fal-ai/veo3.1/first-last-frame-to-video" },
      { model_id: "fal-ai/nano-banana" },
      { model_id: "fal-ai/nano-banana-pro" },
    ]);

    const decision = await evaluateUserGenerationAdmission({
      userId: "user-1",
      modelId: "fal-ai/veo3.1/image-to-video",
      config: {
        mode: "enforce",
        globalMax: 4,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
        retryAfterSeconds: 20,
        sharedProviderEnabled: false,
        sharedProviderGlobalMax: 4,
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.enforced).toBe(true);
    expect(decision.wouldLimit).toBe(true);
    expect(decision.reason).toBe("global_and_tier_limit");
    expect(decision.snapshot.globalActive).toBe(5);
    expect(decision.snapshot.tier).toBe("video_long");
    expect(decision.snapshot.tierActive).toBe(3);
  });

  it("allows in shadow mode while still marking would-limit state", async () => {
    mockReservationRows([
      { model_id: "fal-ai/nano-banana-pro" },
      { model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image" },
      { model_id: "fal-ai/nano-banana" },
    ]);

    const decision = await evaluateUserGenerationAdmission({
      userId: "user-1",
      modelId: "fal-ai/nano-banana-pro/edit",
      config: {
        mode: "shadow",
        globalMax: 4,
        tierLimits: {
          video_long: 2,
          image_heavy: 1,
          image_standard: 4,
        },
        retryAfterSeconds: 20,
        sharedProviderEnabled: false,
        sharedProviderGlobalMax: 4,
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.enforced).toBe(false);
    expect(decision.wouldLimit).toBe(true);
    expect(decision.reason).toBe("tier_limit");
    expect(decision.snapshot.tier).toBe("image_heavy");
    expect(decision.snapshot.tierActive).toBe(2);
    expect(decision.snapshot.tierMax).toBe(1);
  });
});
