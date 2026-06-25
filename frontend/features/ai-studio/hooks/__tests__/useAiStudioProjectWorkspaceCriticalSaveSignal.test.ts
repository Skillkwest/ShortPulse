import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAiStudioProjectWorkspaceCriticalSaveSignal } from "../useAiStudioProjectWorkspaceCriticalSaveSignal";
import type { StudioOutput } from "../../types";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "output-1",
  prompt: "A durable reference",
  mode: "image",
  aspect: "16:9",
  model: "model-1",
  status: "ready",
  timestamp: "Just now",
  ...overrides,
});

describe("useAiStudioProjectWorkspaceCriticalSaveSignal", () => {
  it("does not emit for the first project signature", () => {
    const output = createOutput({
      savedMediaIds: ["media-1"],
      previewStoragePath: "user-1/project/reference.png",
    });

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspaceCriticalSaveSignal({
        projectId: "project-1",
        projectRouteRequested: true,
        outputs: [output],
        curatedReferenceIds: ["output-1"],
      })
    );

    expect(result.current).toBe(0);
  });

  it("emits when a project output gains durable display authority", async () => {
    const localOnlyOutput = createOutput({
      previewUrl: "blob:http://localhost/local-reference",
      localObjectUrl: "blob:http://localhost/local-reference",
    });
    const durableOutput = {
      ...localOnlyOutput,
      localObjectUrl: null,
      previewStoragePath: "user-1/project/reference.png",
      savedMediaIds: ["media-1"],
    };

    const { result, rerender } = renderHook(
      ({ outputs }: { outputs: StudioOutput[] }) =>
        useAiStudioProjectWorkspaceCriticalSaveSignal({
          projectId: "project-1",
          projectRouteRequested: true,
          outputs,
          curatedReferenceIds: ["output-1"],
        }),
      {
        initialProps: {
          outputs: [localOnlyOutput],
        },
      }
    );

    expect(result.current).toBe(0);
    rerender({ outputs: [durableOutput] });
    await waitFor(() => {
      expect(result.current).toBe(1);
    });
  });

  it("does not emit immediate saves for durable output display churn", async () => {
    const durableOutput = createOutput({
      savedMediaIds: ["media-1"],
      previewStoragePath: "user-1/project/reference.png",
      title: "Original title",
      taskState: "pending",
    });

    const { result, rerender } = renderHook(
      ({ output }: { output: StudioOutput }) =>
        useAiStudioProjectWorkspaceCriticalSaveSignal({
          projectId: "project-1",
          projectRouteRequested: true,
          outputs: [output],
          curatedReferenceIds: ["output-1"],
        }),
      {
        initialProps: {
          output: durableOutput,
        },
      }
    );

    rerender({
      output: {
        ...durableOutput,
        prompt: "Updated prompt summary",
        title: "Updated title",
        previewText: "Updated preview text",
        status: "ready",
        taskState: "success",
      },
    });
    await Promise.resolve();

    expect(result.current).toBe(0);
  });

  it("emits when durable Reference Grid visibility changes", async () => {
    const durableOutput = createOutput({
      savedMediaIds: ["media-1"],
      previewStoragePath: "user-1/project/reference.png",
    });

    const { result, rerender } = renderHook(
      ({ output }: { output: StudioOutput }) =>
        useAiStudioProjectWorkspaceCriticalSaveSignal({
          projectId: "project-1",
          projectRouteRequested: true,
          outputs: [output],
          curatedReferenceIds: ["output-1"],
        }),
      {
        initialProps: {
          output: durableOutput,
        },
      }
    );

    rerender({
      output: {
        ...durableOutput,
        hiddenInReferenceGrid: true,
      },
    });
    await waitFor(() => {
      expect(result.current).toBe(1);
    });
  });

  it("does not emit when a local-only output enters the right rail", () => {
    const localOnlyOutput = createOutput({
      previewUrl: "blob:http://localhost/local-reference",
      localObjectUrl: "blob:http://localhost/local-reference",
    });

    const { result, rerender } = renderHook(
      ({
        outputs,
        curatedReferenceIds,
      }: {
        outputs: StudioOutput[];
        curatedReferenceIds: string[];
      }) =>
        useAiStudioProjectWorkspaceCriticalSaveSignal({
          projectId: "project-1",
          projectRouteRequested: true,
          outputs,
          curatedReferenceIds,
        }),
      {
        initialProps: {
          outputs: [] as StudioOutput[],
          curatedReferenceIds: [] as string[],
        },
      }
    );

    rerender({
      outputs: [localOnlyOutput],
      curatedReferenceIds: ["output-1"],
    });
    expect(result.current).toBe(0);
  });

  it("does not emit outside project routes", () => {
    const output = createOutput({
      savedMediaIds: ["media-1"],
      previewStoragePath: "user-1/project/reference.png",
    });

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string | null }) =>
        useAiStudioProjectWorkspaceCriticalSaveSignal({
          projectId,
          projectRouteRequested: false,
          outputs: [output],
          curatedReferenceIds: ["output-1"],
        }),
      {
        initialProps: {
          projectId: null as string | null,
        },
      }
    );

    rerender({ projectId: "project-1" });
    expect(result.current).toBe(0);
  });
});
