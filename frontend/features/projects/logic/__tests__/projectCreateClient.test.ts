/**
 * Tests for authenticated project creation request handling and timeout recovery.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { createProject } from "../projectCreateClient";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

describe("projectCreateClient", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("creates a project through the authenticated API client", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          project: {
            id: "project-1",
            title: "Launch Campaign",
            createdAt: "2026-06-04T12:00:00.000Z",
            updatedAt: "2026-06-04T12:00:00.000Z",
          },
        }),
        { status: 200 }
      )
    );

    await expect(createProject("Launch Campaign")).resolves.toEqual({
      id: "project-1",
      title: "Launch Campaign",
      createdAt: "2026-06-04T12:00:00.000Z",
      updatedAt: "2026-06-04T12:00:00.000Z",
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/projects/create",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Launch Campaign" }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("aborts and rejects when project creation exceeds the request deadline", async () => {
    vi.useFakeTimers();
    fetchWithAuthMock.mockReturnValueOnce(new Promise(() => undefined) as Promise<Response>);

    const request = createProject("Slow Project");

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/projects/create",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    const requestInit = fetchWithAuthMock.mock.calls[0]?.[1];
    const signal = requestInit?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    const rejectionExpectation = expect(request).rejects.toThrow(
      "Project creation timed out. Please try again."
    );
    await vi.advanceTimersByTimeAsync(20_000);

    await rejectionExpectation;
    expect(signal.aborted).toBe(true);
  });
});
