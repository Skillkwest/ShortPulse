/**
 * Unit coverage for AI Studio session-persistence policy gates.
 * Verifies master and lane flags collapse to deterministic client behavior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const loadPolicy = async () => {
  const mod = await import("../sessionPersistencePolicy");
  return mod.readAiStudioSessionPersistencePolicy();
};

describe("readAiStudioSessionPersistencePolicy", () => {
  const originalLegacyMaster = process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED;
  const originalMaster = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED;
  const originalWrite = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED;
  const originalRemote = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED;
  const originalRestore = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED;
  const originalApply = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED;
  const originalApplyAgent = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED;

  afterEach(() => {
    vi.resetModules();
    if (typeof originalLegacyMaster === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED = originalLegacyMaster;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED;
    }
    if (typeof originalMaster === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED = originalMaster;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED;
    }
    if (typeof originalWrite === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED = originalWrite;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED;
    }
    if (typeof originalRemote === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED = originalRemote;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED;
    }
    if (typeof originalRestore === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED = originalRestore;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED;
    }
    if (typeof originalApply === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED = originalApply;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED;
    }
    if (typeof originalApplyAgent === "string") {
      process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED = originalApplyAgent;
    } else {
      delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED;
    }
  });

  it("defaults all legacy persistence lanes to disabled", async () => {
    delete process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED;
    delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED;
    delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED;
    delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED;
    delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED;
    delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED;
    delete process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED;

    vi.resetModules();
    const policy = await loadPolicy();
    expect(policy).toEqual({
      persistenceEnabled: false,
      writeShadowEnabled: false,
      remoteShadowEnabled: false,
      restoreShadowEnabled: false,
      restoreRemoteEnabled: false,
      restoreApplyEnabled: false,
      restoreApplyAgentEnabled: false,
    });
  });

  it("requires the explicit legacy master flag before any lane can turn on", async () => {
    delete process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED;
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED = "true";

    vi.resetModules();
    const policy = await loadPolicy();
    expect(policy).toEqual({
      persistenceEnabled: false,
      writeShadowEnabled: false,
      remoteShadowEnabled: false,
      restoreShadowEnabled: false,
      restoreRemoteEnabled: false,
      restoreApplyEnabled: false,
      restoreApplyAgentEnabled: false,
    });
  });

  it("disables all lanes when the legacy master is on but the persistence flag is false", async () => {
    process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED = "false";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED = "true";

    vi.resetModules();
    const policy = await loadPolicy();
    expect(policy).toEqual({
      persistenceEnabled: false,
      writeShadowEnabled: false,
      remoteShadowEnabled: false,
      restoreShadowEnabled: false,
      restoreRemoteEnabled: false,
      restoreApplyEnabled: false,
      restoreApplyAgentEnabled: false,
    });
  });

  it("allows legacy persistence lanes when both master flags are enabled", async () => {
    process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED = "true";

    vi.resetModules();
    const policy = await loadPolicy();
    expect(policy).toEqual({
      persistenceEnabled: true,
      writeShadowEnabled: true,
      remoteShadowEnabled: true,
      restoreShadowEnabled: true,
      restoreRemoteEnabled: true,
      restoreApplyEnabled: true,
      restoreApplyAgentEnabled: true,
    });
  });

  it("requires remote shadow lane for remote restore reads", async () => {
    process.env.NEXT_PUBLIC_AI_STUDIO_LEGACY_SESSION_PERSISTENCE_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED = "false";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED = "true";
    process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED = "true";

    vi.resetModules();
    const policy = await loadPolicy();
    expect(policy.restoreShadowEnabled).toBe(true);
    expect(policy.remoteShadowEnabled).toBe(false);
    expect(policy.restoreRemoteEnabled).toBe(false);
    expect(policy.restoreApplyEnabled).toBe(true);
    expect(policy.restoreApplyAgentEnabled).toBe(true);
  });
});
