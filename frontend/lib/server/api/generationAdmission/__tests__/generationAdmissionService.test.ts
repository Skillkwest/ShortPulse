import { beforeEach, describe, expect, it, vi } from "vitest";
import { KIE_VEO_31_FAST_I2V_MODEL_ID } from "../../../../model-runtime/providerModelIds";
import {
  evaluateScopedGenerationAdmission,
  evaluateUserGenerationAdmission,
} from "../generationAdmissionService";

const readActiveProviderCapacitySnapshotMock = vi.fn();
const readRecoveryBackpressureDecisionMock = vi.fn();

vi.mock("../../generationQueue/activeProviderCapacity", () => ({
  readActiveProviderCapacitySnapshot: (...args: unknown[]) =>
    readActiveProviderCapacitySnapshotMock(...args),
}));

vi.mock("../recoveryBackpressure", () => ({
  readRecoveryBackpressureDecision: (...args: unknown[]) =>
    readRecoveryBackpressureDecisionMock(...args),
}));

describe("generationAdmissionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readActiveProviderCapacitySnapshotMock.mockResolvedValue({
      tier: "image_standard",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    readRecoveryBackpressureDecisionMock.mockResolvedValue({
      level: 0,
      requestedGlobalMax: 4,
      effectiveGlobalMax: 4,
      reduction: 0,
      signals: {
        staleProviderAttachedReservations: 0,
        staleRecoverableGenerations: 0,
        recentQueueWaitTimeouts: 0,
        recentRecoveryP95Ms: null,
      },
    });
  });

  it("short-circuits in off mode without reading provider capacity", async () => {
    const result = await evaluateScopedGenerationAdmission({
      scopeUserId: "user-1",
      provider: "kie",
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
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
      globalMax: 4,
      staleIgnoreMinAgeSeconds: 900,
      activeGenerationStaleIgnoreMinAgeSeconds: 900,
      orphanGraceSeconds: 60,
    });

    expect(readActiveProviderCapacitySnapshotMock).not.toHaveBeenCalled();
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.wouldLimit).toBe(false);
    expect(result.capacitySnapshot.globalActive).toBe(0);
  });

  it("denies in enforce mode when provider-attached counts exceed caps", async () => {
    readActiveProviderCapacitySnapshotMock.mockResolvedValueOnce({
      tier: "video_long",
      globalActive: 4,
      tierActive: 2,
      staleIgnoredGlobal: 1,
      staleIgnoredTier: 1,
    });

    const result = await evaluateScopedGenerationAdmission({
      scopeUserId: "user-1",
      provider: "kie",
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
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
      globalMax: 4,
      staleIgnoreMinAgeSeconds: 900,
      activeGenerationStaleIgnoreMinAgeSeconds: 900,
      orphanGraceSeconds: 60,
    });

    expect(readActiveProviderCapacitySnapshotMock).toHaveBeenCalledWith({
      userId: "user-1",
      provider: "kie",
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      staleIgnoreMinAgeSeconds: 900,
      activeGenerationStaleIgnoreMinAgeSeconds: 900,
      orphanGraceSeconds: 60,
    });
    expect(result.decision.allowed).toBe(false);
    expect(result.decision.enforced).toBe(true);
    expect(result.decision.wouldLimit).toBe(true);
    expect(result.decision.reason).toBe("global_and_tier_limit");
    expect(result.decision.snapshot.globalActive).toBe(5);
    expect(result.decision.snapshot.tier).toBe("video_long");
    expect(result.decision.snapshot.tierActive).toBe(3);
    expect(result.capacitySnapshot.staleIgnoredGlobal).toBe(1);
    expect(result.backpressure).toBeNull();
  });

  it("allows in shadow mode while still marking would-limit state", async () => {
    readActiveProviderCapacitySnapshotMock.mockResolvedValueOnce({
      tier: "image_heavy",
      globalActive: 3,
      tierActive: 1,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });

    const result = await evaluateScopedGenerationAdmission({
      scopeUserId: "user-1",
      provider: "fal",
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
      globalMax: 4,
      staleIgnoreMinAgeSeconds: 900,
      activeGenerationStaleIgnoreMinAgeSeconds: 900,
      orphanGraceSeconds: 60,
    });

    expect(result.decision.allowed).toBe(true);
    expect(result.decision.enforced).toBe(false);
    expect(result.decision.wouldLimit).toBe(true);
    expect(result.decision.reason).toBe("tier_limit");
    expect(result.decision.snapshot.tier).toBe("image_heavy");
    expect(result.decision.snapshot.tierActive).toBe(2);
    expect(result.decision.snapshot.tierMax).toBe(1);
    expect(result.backpressure).toBeNull();
  });

  it("keeps the legacy user helper aligned with the scoped admission helper", async () => {
    readActiveProviderCapacitySnapshotMock.mockResolvedValueOnce({
      tier: "image_standard",
      globalActive: 1,
      tierActive: 1,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });

    const decision = await evaluateUserGenerationAdmission({
      userId: "user-1",
      modelId: "fal-ai/nano-banana",
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
      staleIgnoreMinAgeSeconds: 900,
      activeGenerationStaleIgnoreMinAgeSeconds: 900,
      orphanGraceSeconds: 60,
    });

    expect(readActiveProviderCapacitySnapshotMock).toHaveBeenCalledWith({
      userId: "user-1",
      provider: "fal",
      modelId: "fal-ai/nano-banana",
      staleIgnoreMinAgeSeconds: 900,
      activeGenerationStaleIgnoreMinAgeSeconds: 900,
      orphanGraceSeconds: 60,
    });
    expect(decision.snapshot.globalActive).toBe(2);
    expect(decision.snapshot.tierActive).toBe(2);
  });

  it("reduces shared-provider global max when recovery backpressure is active", async () => {
    readActiveProviderCapacitySnapshotMock.mockResolvedValueOnce({
      tier: "image_standard",
      globalActive: 5,
      tierActive: 1,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    readRecoveryBackpressureDecisionMock.mockResolvedValueOnce({
      level: 1,
      requestedGlobalMax: 6,
      effectiveGlobalMax: 5,
      reduction: 1,
      signals: {
        staleProviderAttachedReservations: 12,
        staleRecoverableGenerations: 4,
        recentQueueWaitTimeouts: 0,
        recentRecoveryP95Ms: null,
      },
    });

    const result = await evaluateScopedGenerationAdmission({
      scopeUserId: null,
      provider: "fal",
      modelId: "fal-ai/nano-banana",
      config: {
        mode: "enforce",
        globalMax: 4,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
        retryAfterSeconds: 20,
        sharedProviderEnabled: true,
        sharedProviderGlobalMax: 6,
      },
      globalMax: 6,
      staleIgnoreMinAgeSeconds: 900,
      activeGenerationStaleIgnoreMinAgeSeconds: 900,
      orphanGraceSeconds: 60,
    });

    expect(readRecoveryBackpressureDecisionMock).toHaveBeenCalledWith({
      provider: "fal",
      requestedGlobalMax: 6,
    });
    expect(result.decision.snapshot.globalMax).toBe(5);
    expect(result.decision.snapshot.globalActive).toBe(6);
    expect(result.decision.enforced).toBe(true);
    expect(result.backpressure).toEqual(
      expect.objectContaining({
        level: 1,
        effectiveGlobalMax: 5,
      })
    );
  });
});
