import { describe, expect, it } from "vitest";
import {
  buildProfileSectionHref,
  normalizeProfileReturnPath,
  resolveProfileBackTarget,
} from "../profileNavigation";

describe("profileNavigation", () => {
  it("builds profile section URLs with safe same-app return paths", () => {
    expect(
      buildProfileSectionHref({
        section: "credits",
        fromPath: "/ai-studio?projectId=project-1",
      })
    ).toBe("/profile?section=credits&from=%2Fai-studio%3FprojectId%3Dproject-1");

    expect(
      buildProfileSectionHref({
        section: "account",
        fromPath: "/dashboard",
        hash: "billing",
      })
    ).toBe("/profile?section=account&from=%2Fdashboard#billing");
  });

  it("rejects non-canonical or unsafe return paths", () => {
    expect(normalizeProfileReturnPath("/ai-studio?projectId=project-1")).toBe(
      "/ai-studio?projectId=project-1"
    );
    expect(normalizeProfileReturnPath("/dashboard")).toBe("/dashboard");
    expect(normalizeProfileReturnPath("/profile")).toBeNull();
    expect(normalizeProfileReturnPath("//evil.test/dashboard")).toBeNull();
    expect(normalizeProfileReturnPath("/\\evil")).toBeNull();
    expect(normalizeProfileReturnPath("https://evil.test/dashboard")).toBeNull();
  });

  it("resolves the profile back target from the safe return path", () => {
    expect(resolveProfileBackTarget("/ai-studio?projectId=project-1")).toEqual({
      href: "/ai-studio?projectId=project-1",
      label: "Back to AI Studio",
    });
    expect(resolveProfileBackTarget("/dashboard")).toEqual({
      href: "/dashboard",
      label: "Back to dashboard",
    });
    expect(resolveProfileBackTarget("/profile?section=credits")).toEqual({
      href: "/dashboard",
      label: "Back to dashboard",
    });
  });
});
