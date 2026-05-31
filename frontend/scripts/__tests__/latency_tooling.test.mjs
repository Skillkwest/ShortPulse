import { describe, expect, it } from "vitest";
import {
  filterDiagnosticsForPaths,
  parseArgs as parseTypecheckArgs,
} from "../../../scripts/typecheck_changed_files.mjs";
import {
  buildAiStudioLatencyInventory,
  extractApiReferences,
  parseArgs as parseInventoryArgs,
} from "../../../scripts/inventory_ai_studio_latency_routes.mjs";

describe("latency tooling", () => {
  it("filters TypeScript diagnostics to touched frontend paths", () => {
    const output = [
      "features/ai-studio/hooks/useTouched.ts(12,4): error TS2322: Type 'number' is not assignable to type 'string'.",
      "  continuation for touched error",
      "features/ai-studio/hooks/useOther.ts(8,2): error TS2345: Argument problem.",
    ].join("\n");

    expect(
      filterDiagnosticsForPaths({
        output,
        paths: ["frontend/features/ai-studio/hooks/useTouched.ts"],
      })
    ).toEqual([
      "features/ai-studio/hooks/useTouched.ts(12,4): error TS2322: Type 'number' is not assignable to type 'string'.",
      "  continuation for touched error",
    ]);
  });

  it("parses changed-file typecheck options", () => {
    expect(parseTypecheckArgs(["--path", "frontend/features/x.ts", "--all"])).toEqual({
      paths: ["frontend/features/x.ts"],
      all: true,
      help: false,
    });
  });

  it("builds an AI Studio API route inventory with protected hints", () => {
    const inventory = buildAiStudioLatencyInventory({
      roots: ["features/ai-studio/hooks/useCredits.ts"],
    });

    expect(inventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: "/api/credits/snapshot",
          protected: true,
        }),
      ])
    );
  });

  it("normalizes dynamic API template references", () => {
    expect(
      extractApiReferences("fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace`)")
    ).toEqual(["/api/projects/:param/workspace"]);
  });

  it("parses inventory options", () => {
    expect(
      parseInventoryArgs(["--json", "--include-tests", "--root", "features/ai-studio"])
    ).toEqual({
      json: true,
      includeTests: true,
      roots: ["features/ai-studio"],
      help: false,
    });
  });
});
