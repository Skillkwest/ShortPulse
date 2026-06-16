/**
 * Guards the AI Studio project-route recovery contracts that protect brand-new
 * paid accounts from stale project IDs after Checkout or deep-link restores.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readRouteEntrySource = () =>
  readFileSync(
    path.join(process.cwd(), "features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx"),
    "utf8"
  );

const readProjectRouteRecoverySource = () =>
  readFileSync(
    path.join(process.cwd(), "features/ai-studio/hooks/useAiStudioProjectRouteRecovery.ts"),
    "utf8"
  );

describe("AI Studio project route hardening", () => {
  it("verifies remembered checkout starter projects before routing to them", () => {
    const source = readRouteEntrySource();
    const reuseStart = source.indexOf("const storedProjectId = getStoredCheckoutProjectId");
    const createStart = source.indexOf("const project = await createProject", reuseStart);

    expect(reuseStart).toBeGreaterThanOrEqual(0);
    expect(createStart).toBeGreaterThan(reuseStart);
    expect(source).toContain("userId}:${checkoutSessionId}");
    expect(source).toContain("const verifyStoredCheckoutProjectForCurrentUser = async");
    expect(source).toContain("fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}`");

    const reuseSource = source.slice(reuseStart, createStart);
    const verifyIndex = reuseSource.indexOf(
      "await verifyStoredCheckoutProjectForCurrentUser(storedProjectId)"
    );
    const routeIndex = reuseSource.indexOf("query: { projectId: storedProjectId }");

    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(routeIndex).toBeGreaterThan(verifyIndex);
    expect(reuseSource).toContain("forgetCheckoutProjectId");
  });

  it("clears stale project routes locally before opening Projects without list-fetch gating", () => {
    const source = readProjectRouteRecoverySource();
    const clearIndex = source.indexOf("await onClearStaleProjectRoute()");
    const openIndex = source.indexOf("onOpenProjectsModal()", clearIndex);

    expect(source).not.toContain("fetchWithAuth");
    expect(source).not.toContain("/api/projects?limit=all");
    expect(source).toContain('"invalid_id"');
    expect(source).toContain('"not_found"');
    expect(source).toContain('"forbidden"');
    expect(clearIndex).toBeGreaterThanOrEqual(0);
    expect(openIndex).toBeGreaterThan(clearIndex);
  });
});
