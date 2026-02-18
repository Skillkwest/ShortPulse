import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioSelectors } from "../useAiStudioSelectors";

const makeOutput = (id: string, previewUrl?: string): StudioOutput =>
  ({
    id,
    prompt: `Prompt ${id}`,
    mode: "image",
    aspect: "9:16",
    model: "Model",
    status: "ready",
    timestamp: "now",
    taskState: "success",
    previewUrl,
  }) as StudioOutput;

describe("useAiStudioSelectors", () => {
  it("returns stable selectors for cross-surface lookups", () => {
    const active = makeOutput("a", "https://example.com/a.png");
    const archived = makeOutput("b", "https://example.com/b.png");

    const { result } = renderHook(() =>
      useAiStudioSelectors({
        outputOrder: [active.id],
        archivedOutputOrder: [archived.id],
        outputById: { [active.id]: active },
        archivedOutputById: { [archived.id]: archived },
        activeOutputId: active.id,
      })
    );

    expect(result.current.activeReferenceCount).toBe(1);
    expect(result.current.archivedReferenceCount).toBe(1);
    expect(result.current.resolveOutputPreviewUrl("a")).toBe("https://example.com/a.png");
    expect(result.current.resolveOutputPreviewUrl("b")).toBe("https://example.com/b.png");
    expect(result.current.activeOutputSummary?.id).toBe("a");
  });
});
