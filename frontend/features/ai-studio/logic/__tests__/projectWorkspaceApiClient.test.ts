import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import {
  getAiStudioProjectWorkspaceSnapshotViaApi,
  saveAiStudioProjectWorkspaceSnapshotViaApi,
} from "../projectWorkspaceApiClient";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const addBreadcrumbMock = vi.mocked(addBreadcrumb);

describe("projectWorkspaceApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a breadcrumb when project workspace save fails with an invalid snapshot response", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Invalid project workspace snapshot",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    await expect(
      saveAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: "project-1",
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          updatedAt: "2026-04-25T00:00:00.000Z",
        } as never,
      })
    ).rejects.toThrow(
      "Failed to save project workspace snapshot: Invalid project workspace snapshot"
    );

    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "warn",
      message: "ai_studio_project_workspace_save_invalid_snapshot",
      data: {
        project_id: "project-1",
        status: 400,
        error: "Invalid project workspace snapshot",
      },
    });
  });

  it("does not record the invalid snapshot breadcrumb for non-terminal save failures", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Failed to save project workspace",
          details:
            "Project workspace save failed during workspace upsert: row-level security denied",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    await expect(
      saveAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: "project-1",
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          updatedAt: "2026-04-25T00:00:00.000Z",
        } as never,
      })
    ).rejects.toThrow(
      "Failed to save project workspace snapshot: Project workspace save failed during workspace upsert: row-level security denied"
    );

    expect(addBreadcrumbMock).not.toHaveBeenCalled();
  });

  it("opts project workspace saves into one-time network retry", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workspace: {
            projectId: "project-1",
            schemaVersion: 2,
            snapshot: {
              schemaVersion: 2,
              sessionId: "session-1",
              updatedAt: "2026-04-25T00:00:00.000Z",
            },
            createdAt: "2026-04-25T00:00:00.000Z",
            updatedAt: "2026-04-25T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    await saveAiStudioProjectWorkspaceSnapshotViaApi({
      projectId: "project-1",
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-25T00:00:00.000Z",
      } as never,
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/projects/project-1/workspace", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          updatedAt: "2026-04-25T00:00:00.000Z",
        },
      }),
      keepalive: false,
      shortpulseLogScope: "app",
      shortpulseRetryNetworkOnce: true,
    });
  });

  it("includes status and content type when project workspace load fails with a non-json response", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response("<!doctype html><title>Not found</title>", {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      })
    );

    await expect(
      getAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: "project-1",
      })
    ).rejects.toThrow("Failed to load project workspace snapshot: HTTP 404 text/html");

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/projects/project-1/workspace", {
      method: "GET",
      shortpulseLogScope: "app",
      shortpulseAuthTimeoutMs: 5000,
      shortpulseRetryNetworkOnce: true,
    });
  });
});
