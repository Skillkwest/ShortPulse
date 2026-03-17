import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAiStudioEditSubmitIntent } from "../useAiStudioEditSubmitIntent";
import type { ToolId } from "../../types";

describe("useAiStudioEditSubmitIntent", () => {
  it("resets to the default intent when explicitly reset after leaving the edit workflow", () => {
    const { result, rerender } = renderHook(
      ({ selectedTool }: { selectedTool: ToolId | null }) =>
        useAiStudioEditSubmitIntent({ selectedTool }),
      {
        initialProps: { selectedTool: "edit" as ToolId },
      }
    );

    expect(result.current.editSubmitIntent).toBe("standard");

    act(() => {
      result.current.setEditSubmitIntent("markup");
    });

    expect(result.current.editSubmitIntent).toBe("markup");

    rerender({ selectedTool: "create" });
    expect(result.current.editSubmitIntent).toBe("standard");

    act(() => {
      result.current.resetEditSubmitIntent();
    });

    rerender({ selectedTool: "edit" });
    expect(result.current.editSubmitIntent).toBe("standard");
  });

  it("ignores explicit intent changes while edit workflow is inactive", () => {
    const { result } = renderHook(() => useAiStudioEditSubmitIntent({ selectedTool: "video" }));

    expect(result.current.editSubmitIntent).toBe("standard");

    act(() => {
      result.current.setEditSubmitIntent("inpaint");
    });

    expect(result.current.editSubmitIntent).toBe("standard");
  });

  it("preserves the prior edit intent until the explicit reset is invoked", () => {
    const { result, rerender } = renderHook(
      ({ selectedTool }: { selectedTool: ToolId | null }) =>
        useAiStudioEditSubmitIntent({ selectedTool }),
      {
        initialProps: { selectedTool: "edit" as ToolId },
      }
    );

    act(() => {
      result.current.setEditSubmitIntent("inpaint");
    });

    rerender({ selectedTool: "create" });
    expect(result.current.editSubmitIntent).toBe("standard");

    rerender({ selectedTool: "edit" });
    expect(result.current.editSubmitIntent).toBe("inpaint");

    act(() => {
      result.current.resetEditSubmitIntent();
    });

    expect(result.current.editSubmitIntent).toBe("standard");
  });
});
