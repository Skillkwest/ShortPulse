import { describe, expect, it } from "vitest";
import {
  buildPromptCompilerCacheScopeKey,
  resolvePromptTemplateVersion,
} from "../promptCompilerCacheScopeKey";

describe("promptCompilerCacheScopeKey", () => {
  it("keeps parity for identical version signals", () => {
    const promptTemplateVersion = resolvePromptTemplateVersion({
      route: "studio-agent",
      prompts: ["System prompt", "Thinker prompt", "Formatter prompt"],
    });
    const first = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion,
      policySchemaVersion: 2,
      controlPlanePolicyVersion: 7,
    });
    const second = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion,
      policySchemaVersion: 2,
      controlPlanePolicyVersion: 7,
    });
    expect(first).toBe(second);
  });

  it("invalidates when the prompt template changes", () => {
    const base = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion: resolvePromptTemplateVersion({
        route: "studio-agent",
        prompts: ["System prompt", "Thinker prompt", "Formatter prompt"],
      }),
      policySchemaVersion: 2,
      controlPlanePolicyVersion: 7,
    });
    const drifted = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion: resolvePromptTemplateVersion({
        route: "studio-agent",
        prompts: ["System prompt", "Thinker prompt v2", "Formatter prompt"],
      }),
      policySchemaVersion: 2,
      controlPlanePolicyVersion: 7,
    });
    expect(drifted).not.toBe(base);
  });

  it("invalidates when the policy schema version changes", () => {
    const promptTemplateVersion = resolvePromptTemplateVersion({
      route: "studio-agent",
      prompts: ["System prompt"],
    });
    const base = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion,
      policySchemaVersion: 2,
      controlPlanePolicyVersion: 7,
    });
    const drifted = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion,
      policySchemaVersion: 3,
      controlPlanePolicyVersion: 7,
    });
    expect(drifted).not.toBe(base);
  });

  it("invalidates when the control-plane policy version changes", () => {
    const promptTemplateVersion = resolvePromptTemplateVersion({
      route: "studio-agent",
      prompts: ["System prompt"],
    });
    const base = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion,
      policySchemaVersion: 2,
      controlPlanePolicyVersion: 7,
    });
    const drifted = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion,
      policySchemaVersion: 2,
      controlPlanePolicyVersion: 8,
    });
    expect(drifted).not.toBe(base);
  });

  it("uses deterministic fallback tokens when versions are missing", () => {
    const key = buildPromptCompilerCacheScopeKey({
      route: "studio-agent",
      promptTemplateVersion: "PTV_ALPHA",
      policySchemaVersion: null,
      controlPlanePolicyVersion: null,
    });
    expect(key).toBe("route:studio-agent|prompt:ptv_alpha|schema:none|policy:none");
  });
});
