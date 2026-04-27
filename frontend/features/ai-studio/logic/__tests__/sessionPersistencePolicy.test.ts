/**
 * Unit coverage for the retired AI Studio legacy session-persistence policy.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const loadPolicy = async () => {
  const mod = await import("../sessionPersistencePolicy");
  return mod.readAiStudioSessionPersistencePolicy();
};

describe("readAiStudioSessionPersistencePolicy", () => {
  const originalMaster = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_PERSISTENCE_ENABLED;
  const originalWrite = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED;
  const originalRemote = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED;
  const originalRestore = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED;
  const originalApply = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED;
  const originalApplyAgent = process.env.NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED;

  afterEach(() => {
    vi.resetModules();
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

  it("ignores legacy env flags even when they request persistence", async () => {
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
});
