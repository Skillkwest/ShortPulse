/**
 * Tests for shared project creation dialog state and bounded async recovery.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProject, type CreatedProjectRecord } from "../../logic/projectCreateClient";
import { useProjectCreationDialog } from "../useProjectCreationDialog";

vi.mock("../../logic/projectCreateClient", () => ({
  DEFAULT_NEW_PROJECT_TITLE: "Untitled project",
  createProject: vi.fn(),
}));

const createProjectMock = vi.mocked(createProject);

const PROJECT_RECORD: CreatedProjectRecord = {
  id: "project-1",
  title: "Project One",
  createdAt: "2026-06-04T12:00:00.000Z",
  updatedAt: "2026-06-04T12:00:00.000Z",
};

describe("useProjectCreationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets creating state and surfaces request timeout errors", async () => {
    createProjectMock.mockRejectedValueOnce(
      new Error("Project creation timed out. Please try again.")
    );
    const { result } = renderHook(() => useProjectCreationDialog({}));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.isCreating).toBe(false);
    expect(result.current.error).toBe("Project creation timed out. Please try again.");
  });

  it("resets creating state when post-create handoff exceeds its deadline", async () => {
    vi.useFakeTimers();
    createProjectMock.mockResolvedValueOnce(PROJECT_RECORD);
    const onCreatedProject = vi.fn(() => new Promise<void>(() => undefined));
    const { result } = renderHook(() => useProjectCreationDialog({ onCreatedProject }));

    let submitPromise!: Promise<CreatedProjectRecord | null>;
    act(() => {
      submitPromise = result.current.submit();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isCreating).toBe(true);
    expect(onCreatedProject).toHaveBeenCalledWith(PROJECT_RECORD);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await submitPromise;
    });

    expect(result.current.isCreating).toBe(false);
    expect(result.current.error).toBe(
      "Project was created, but opening it timed out. Close this dialog and open it from Projects."
    );
  });
});
