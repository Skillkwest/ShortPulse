import { describe, expect, it } from "vitest";
import {
  buildCheckpointSummary,
  getCheckpoint,
  parseArgs,
} from "../media_library_checkpoint_runner.mjs";

describe("media_library_checkpoint_runner", () => {
  it("parses list mode and run mode", () => {
    expect(parseArgs(["--list"])).toEqual({
      help: false,
      list: true,
      run: false,
      checkpoint: "",
    });

    expect(parseArgs(["--checkpoint", "count-hot-path", "--run"])).toEqual({
      help: false,
      list: false,
      run: true,
      checkpoint: "count-hot-path",
    });
  });

  it("resolves known checkpoints", () => {
    const checkpoint = getCheckpoint("count-hot-path");
    expect(checkpoint?.title).toBe("Count Hot Path");
    expect(getCheckpoint("panel-runtime-churn")?.title).toBe("Panel Runtime Churn");
    expect(getCheckpoint("deep-scroll-performance")?.title).toBe("Deep Scroll Performance");
    expect(getCheckpoint("route-runtime-churn")).toBeNull();
    expect(getCheckpoint("missing")).toBeNull();
  });

  it("builds a readable checkpoint summary", () => {
    const checkpoint = getCheckpoint("preview-authority");
    expect(checkpoint).not.toBeNull();

    const summary = buildCheckpointSummary("preview-authority", checkpoint);
    expect(summary).toContain("Checkpoint: preview-authority");
    expect(summary).toContain("Commands:");
    expect(summary).toContain("Done hint:");
  });

  it("documents the authenticated browser proof boundary for deep-scroll performance", () => {
    const checkpoint = getCheckpoint("deep-scroll-performance");
    expect(checkpoint).not.toBeNull();

    const summary = buildCheckpointSummary("deep-scroll-performance", checkpoint);
    expect(summary).toContain(
      "features/media-library/logic/__tests__/mediaGridVirtualization.test.ts"
    );
    expect(summary).toContain(
      "features/media-library/logic/__tests__/mediaPreviewSigningPass.test.ts"
    );
    expect(summary).toContain("npm run type-check:touched");
    expect(summary).toContain("npm run test:e2e:media-library-runtime separately");
  });
});
