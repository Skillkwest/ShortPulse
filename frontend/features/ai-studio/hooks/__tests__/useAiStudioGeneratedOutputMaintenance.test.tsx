/**
 * Regression tests for AI Studio generated-output maintenance.
 * Verifies project-scoped generated outputs refresh after project bootstrap instead of blocking workspace restore.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import {
  listVisibleGeneratedOutputs,
  resolveVisibleGenerationReconcile,
} from "../../logic/generatedMediaAuthority";
import { resolveVideoPosterRepairsForOutputs } from "../../logic/videoPosterRepair";
import { useAiStudioGeneratedOutputMaintenance } from "../useAiStudioGeneratedOutputMaintenance";

vi.mock("../../logic/generatedMediaAuthority", () => ({
  listVisibleGeneratedOutputs: vi.fn(),
  resolveVisibleGenerationReconcile: vi.fn(),
}));

vi.mock("../../logic/videoPosterRepair", () => ({
  resolveVideoPosterRepairsForOutputs: vi.fn(),
}));

const listVisibleGeneratedOutputsMock = vi.mocked(listVisibleGeneratedOutputs);
const resolveVisibleGenerationReconcileMock = vi.mocked(resolveVisibleGenerationReconcile);
const resolveVideoPosterRepairsForOutputsMock = vi.mocked(resolveVideoPosterRepairsForOutputs);

const hydratedOutput: StudioOutput = {
  id: "generated:generation-1",
  generationId: "generation-1",
  taskId: "task-1",
  mode: "image",
  aspect: "1:1",
  model: "Seedream",
  prompt: "A project output",
  status: "ready",
  timestamp: "Now",
  mediaSource: "generated",
  taskState: "success",
  queueState: "dispatched",
  previewUrl: "https://cdn.example.com/project-output.png",
  resultUrls: ["https://cdn.example.com/project-output.png"],
};

const renderMaintenanceHook = ({
  hasPendingWorkflowRestore = false,
  projectId = "project-1",
}: {
  hasPendingWorkflowRestore?: boolean;
  projectId?: string | null;
} = {}) =>
  renderHook(
    (props: { hasPendingWorkflowRestore: boolean; projectId: string | null }) => {
      const [outputs, setOutputs] = useState<StudioOutput[]>([]);
      const maintenance = useAiStudioGeneratedOutputMaintenance({
        baseRuntimeAuthorityKey: props.projectId ? `project:${props.projectId}` : "plain",
        hasPendingWorkflowRestore: props.hasPendingWorkflowRestore,
        outputs,
        projectId: props.projectId,
        projectRouteRequested: Boolean(props.projectId),
        setOutputsState: setOutputs,
      });
      return {
        outputs,
        canonicalGeneratedHydrationSettled: maintenance.canonicalGeneratedHydrationSettled,
      };
    },
    {
      initialProps: {
        hasPendingWorkflowRestore,
        projectId,
      },
    }
  );

describe("useAiStudioGeneratedOutputMaintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listVisibleGeneratedOutputsMock.mockResolvedValue([]);
    resolveVisibleGenerationReconcileMock.mockResolvedValue(null);
    resolveVideoPosterRepairsForOutputsMock.mockResolvedValue(new Map());
  });

  it("hydrates project-scoped generated outputs after workspace bootstrap is no longer pending", async () => {
    listVisibleGeneratedOutputsMock.mockResolvedValueOnce([hydratedOutput]);

    const { result } = renderMaintenanceHook();

    expect(result.current.canonicalGeneratedHydrationSettled).toBe(false);

    await waitFor(() => {
      expect(result.current.outputs).toEqual([hydratedOutput]);
      expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);
    });
    expect(listVisibleGeneratedOutputsMock).toHaveBeenCalledWith({ projectId: "project-1" });
  });

  it("waits until workflow restore settles before hydrating project-scoped generated outputs", async () => {
    listVisibleGeneratedOutputsMock.mockResolvedValueOnce([hydratedOutput]);

    const { result, rerender } = renderMaintenanceHook({
      hasPendingWorkflowRestore: true,
    });

    expect(result.current.outputs).toEqual([]);
    expect(listVisibleGeneratedOutputsMock).not.toHaveBeenCalled();
    expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);

    rerender({
      hasPendingWorkflowRestore: false,
      projectId: "project-1",
    });

    expect(result.current.canonicalGeneratedHydrationSettled).toBe(false);

    await waitFor(() => {
      expect(result.current.outputs).toEqual([hydratedOutput]);
      expect(result.current.canonicalGeneratedHydrationSettled).toBe(true);
    });
  });
});
