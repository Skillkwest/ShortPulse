/**
 * Verifies the canonical protected-route list used by the app shell.
 */
import { describe, expect, it } from "vitest";
import {
  PROTECTED_ROUTES,
  isAiStudioRoutePath,
  isProtectedRoutePath,
} from "../../lib/protectedRoutes";

describe("protectedRoutes", () => {
  it("keeps signed-in customer and operator routes behind the protected shell", () => {
    expect(PROTECTED_ROUTES).toEqual(["/profile", "/report-issue", "/ai-studio", "/admin"]);
    expect(isProtectedRoutePath("/report-issue")).toBe(true);
    expect(isProtectedRoutePath("/report-issue?from=%2Fdashboard")).toBe(true);
    expect(isProtectedRoutePath("/ai-studio/projects")).toBe(true);
    expect(isProtectedRoutePath("/admin/reports")).toBe(true);
    expect(isProtectedRoutePath("/")).toBe(false);
    expect(isProtectedRoutePath("/administer")).toBe(false);
    expect(isProtectedRoutePath("/profiled")).toBe(false);
  });

  it("keeps AI Studio route detection separate from the broader protected set", () => {
    expect(isAiStudioRoutePath("/ai-studio")).toBe(true);
    expect(isAiStudioRoutePath("/ai-studio?projectId=project-1")).toBe(true);
    expect(isAiStudioRoutePath("/ai-studio/projects")).toBe(true);
    expect(isAiStudioRoutePath("/ai-studio-preview")).toBe(false);
    expect(isAiStudioRoutePath("/report-issue")).toBe(false);
  });
});
