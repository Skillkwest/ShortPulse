import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import {
  clearAiStudioProjectWorkspaceBootstrapCacheForTests,
  getAiStudioProjectIdentityViaApi,
  getAiStudioProjectWorkspaceBootstrapViaApi,
  getAiStudioProjectWorkspaceSnapshotViaApi,
  resetAiStudioProjectWorkspaceSnapshotViaApi,
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
    clearAiStudioProjectWorkspaceBootstrapCacheForTests();
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
      message: "ai_studio_project_workspace_save_failed",
      data: {
        project_id: "project-1",
        status: 400,
        failure_stage: null,
        error: "Invalid project workspace snapshot",
        content_type: "application/json",
        payload_parse_mode: "json_object",
        raw_error_excerpt: null,
      },
    });
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

    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "error",
      message: "ai_studio_project_workspace_save_failed",
      data: {
        project_id: "project-1",
        status: 500,
        failure_stage: null,
        error: "Project workspace save failed during workspace upsert: row-level security denied",
        content_type: "application/json",
        payload_parse_mode: "json_object",
        raw_error_excerpt: null,
      },
    });
  });

  it("normalizes object-shaped project workspace save errors without throwing while formatting", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message: "Workspace dependency misconfigured",
          },
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
      "Failed to save project workspace snapshot: Workspace dependency misconfigured"
    );

    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "error",
      message: "ai_studio_project_workspace_save_failed",
      data: {
        project_id: "project-1",
        status: 500,
        failure_stage: null,
        error: "Workspace dependency misconfigured",
        content_type: "application/json",
        payload_parse_mode: "json_object",
        raw_error_excerpt: null,
      },
    });
  });

  it("includes status and content type when project workspace save fails with a non-json response", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response("<!doctype html><title>Server Error</title>", {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      })
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
    ).rejects.toThrow("Failed to save project workspace snapshot: HTTP 500 text/html");

    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "error",
      message: "ai_studio_project_workspace_save_failed",
      data: {
        project_id: "project-1",
        status: 500,
        failure_stage: null,
        error: "",
        content_type: "text/html",
        payload_parse_mode: "text",
        raw_error_excerpt: "Server returned an invalid error response.",
      },
    });
  });

  it("records the structured failure stage for project workspace save errors", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Failed to save project workspace",
          details:
            "Failed to save project workspace during project lookup: project query unavailable",
          failureStage: "project lookup",
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
      "Failed to save project workspace snapshot: Failed to save project workspace during project lookup: project query unavailable"
    );

    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "error",
      message: "ai_studio_project_workspace_save_failed",
      data: {
        project_id: "project-1",
        status: 500,
        failure_stage: "project lookup",
        error: "Failed to save project workspace during project lookup: project query unavailable",
        content_type: "application/json",
        payload_parse_mode: "json_object",
        raw_error_excerpt: null,
      },
    });
  });

  it("uses scalar json error payloads when project workspace save fails outside the route contract", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify("Internal Server Error"), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      })
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
    ).rejects.toThrow("Failed to save project workspace snapshot: Internal Server Error");

    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "error",
      message: "ai_studio_project_workspace_save_failed",
      data: {
        project_id: "project-1",
        status: 500,
        failure_stage: null,
        error: "Internal Server Error",
        content_type: "application/json",
        payload_parse_mode: "json_scalar",
        raw_error_excerpt: "Internal Server Error",
      },
    });
  });

  it("opts project workspace saves into one-time network retry", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workspace: {
            projectId: "project-1",
            schemaVersion: 2,
            createdAt: "2026-04-25T00:00:00.000Z",
            updatedAt: "2026-04-25T00:00:00.000Z",
          },
          saveOutcome: {
            status: "saved_with_repair_pending",
            repairStage: "project_association_backfill",
            repairMessage: "Project asset repair pending",
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

    await expect(
      saveAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: "project-1",
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          updatedAt: "2026-04-25T00:00:00.000Z",
        } as never,
      })
    ).resolves.toMatchObject({
      projectId: "project-1",
      saveOutcome: {
        status: "saved_with_repair_pending",
        repairStage: "project_association_backfill",
        repairMessage: "Project asset repair pending",
      },
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/projects/project-1/workspace", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
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
    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "warn",
      message: "ai_studio_project_workspace_save_repair_pending",
      data: {
        project_id: "project-1",
        save_status: "saved_with_repair_pending",
        repair_stage: "project_association_backfill",
        repair_message: "Project asset repair pending",
      },
    });
  });

  it("reuses prepared snapshot json when saving project workspace snapshots", async () => {
    const snapshot = {
      schemaVersion: 2,
      sessionId: "session-1",
      updatedAt: "2026-04-25T00:00:00.000Z",
      workspace: {
        prompt: "Prepared payload",
      },
    };
    const serializedSnapshotJson = JSON.stringify(snapshot);
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workspace: {
            projectId: "project-1",
            schemaVersion: 2,
            snapshot,
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

    await expect(
      saveAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: "project-1",
        snapshot: snapshot as never,
        serializedSnapshotJson,
      })
    ).resolves.toMatchObject({
      projectId: "project-1",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/projects/project-1/workspace", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: `{"schemaVersion":2,"snapshot":${serializedSnapshotJson}}`,
      keepalive: false,
      shortpulseLogScope: "app",
      shortpulseRetryNetworkOnce: true,
    });
  });

  it("records a malformed-success breadcrumb when project workspace save returns 200 without workspace", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          saveOutcome: {
            status: "saved",
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
      "Failed to save project workspace snapshot: Malformed project workspace save response: missing workspace"
    );

    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "error",
      message: "ai_studio_project_workspace_save_malformed_success",
      data: {
        project_id: "project-1",
        status: 200,
        content_type: "application/json",
        payload_parse_mode: "json_object",
        payload_keys: ["ok", "saveOutcome"],
        has_workspace_key: false,
        workspace_type: "undefined",
      },
    });
    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "warn",
      message: "ai_studio_project_workspace_save_failed",
      data: {
        project_id: "project-1",
        status: 200,
        failure_stage: null,
        error: "",
        content_type: "application/json",
        payload_parse_mode: "json_object",
        raw_error_excerpt: null,
      },
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
    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "warn",
      message: "ai_studio_project_workspace_bootstrap_failed",
      data: {
        project_id: "project-1",
        status: 404,
        failure_stage: null,
        error: "",
        content_type: "text/html",
        payload_parse_mode: "text",
        raw_error_excerpt: "Server returned an invalid error response.",
      },
    });
  });

  it("records structured breadcrumbs when project workspace bootstrap fails server-side", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Failed to load project workspace",
          details: "Failed to load project workspace during workspace read: database unavailable",
          failureStage: "workspace read",
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
      getAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: "project-1",
      })
    ).rejects.toThrow(
      "Failed to load project workspace snapshot: Failed to load project workspace during workspace read: database unavailable"
    );

    expect(addBreadcrumbMock).toHaveBeenCalledWith({
      type: "network",
      level: "error",
      message: "ai_studio_project_workspace_bootstrap_failed",
      data: {
        project_id: "project-1",
        status: 500,
        failure_stage: "workspace read",
        error: "Failed to load project workspace during workspace read: database unavailable",
        content_type: "application/json",
        payload_parse_mode: "json_object",
        raw_error_excerpt: null,
      },
    });
  });

  it("loads project identity from the existing project workspace bootstrap route", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          project: {
            id: "project-1",
            title: "Project One",
            createdAt: "2026-04-25T00:00:00.000Z",
            updatedAt: "2026-04-25T00:00:00.000Z",
          },
          workspace: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    await expect(
      getAiStudioProjectIdentityViaApi({
        projectId: "project-1",
      })
    ).resolves.toEqual({
      id: "project-1",
      title: "Project One",
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/projects/project-1/workspace", {
      method: "GET",
      shortpulseLogScope: "app",
      shortpulseAuthTimeoutMs: 5000,
      shortpulseRetryNetworkOnce: true,
    });
  });

  it("maps project bootstrap auth failures to project-identity load messages", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Unauthorized",
          workspace: null,
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    await expect(
      getAiStudioProjectIdentityViaApi({
        projectId: "project-1",
      })
    ).rejects.toThrow("Session expired. Retry project load.");

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/projects/project-1/workspace", {
      method: "GET",
      shortpulseLogScope: "app",
      shortpulseAuthTimeoutMs: 5000,
      shortpulseRetryNetworkOnce: true,
    });
  });

  it("dedupes overlapping workspace bootstrap reads for the same project", async () => {
    let resolveResponse: ((value: Response) => void) | null = null;
    fetchWithAuthMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve as (value: Response) => void;
        })
    );

    const first = getAiStudioProjectWorkspaceBootstrapViaApi({
      projectId: "project-1",
    });
    const second = getAiStudioProjectWorkspaceBootstrapViaApi({
      projectId: "project-1",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    const pendingResolveResponse = resolveResponse as ((value: Response) => void) | null;
    if (pendingResolveResponse) {
      pendingResolveResponse(
        new Response(
          JSON.stringify({
            project: {
              id: "project-1",
              title: "Project One",
              createdAt: "2026-04-25T00:00:00.000Z",
              updatedAt: "2026-04-25T00:00:00.000Z",
            },
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
    }

    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        project: {
          id: "project-1",
          title: "Project One",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:00:00.000Z",
        },
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
      },
      {
        project: {
          id: "project-1",
          title: "Project One",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:00:00.000Z",
        },
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
      },
    ]);
  });

  it("shares one bootstrap request when project identity and workspace snapshot load together", async () => {
    let resolveResponse: ((value: Response) => void) | null = null;
    fetchWithAuthMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve as (value: Response) => void;
        })
    );

    const identityPromise = getAiStudioProjectIdentityViaApi({
      projectId: "project-1",
    });
    const workspacePromise = getAiStudioProjectWorkspaceSnapshotViaApi({
      projectId: "project-1",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/projects/project-1/workspace", {
      method: "GET",
      shortpulseLogScope: "app",
      shortpulseAuthTimeoutMs: 5000,
      shortpulseRetryNetworkOnce: true,
    });

    const pendingResolveResponse = resolveResponse as ((value: Response) => void) | null;
    if (pendingResolveResponse) {
      pendingResolveResponse(
        new Response(
          JSON.stringify({
            project: {
              id: "project-1",
              title: "Project One",
              createdAt: "2026-04-25T00:00:00.000Z",
              updatedAt: "2026-04-25T00:00:00.000Z",
            },
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
    }

    await expect(identityPromise).resolves.toEqual({
      id: "project-1",
      title: "Project One",
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
    });
    await expect(workspacePromise).resolves.toEqual({
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-25T00:00:00.000Z",
      },
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
    });
  });

  it("reuses a fresh completed bootstrap result for near-sequential identity and workspace loads", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          project: {
            id: "project-1",
            title: "Project One",
            createdAt: "2026-04-25T00:00:00.000Z",
            updatedAt: "2026-04-25T00:00:00.000Z",
          },
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

    await expect(
      getAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: "project-1",
      })
    ).resolves.toMatchObject({
      projectId: "project-1",
      schemaVersion: 2,
    });
    await expect(
      getAiStudioProjectIdentityViaApi({
        projectId: "project-1",
      })
    ).resolves.toEqual({
      id: "project-1",
      title: "Project One",
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it("invalidates completed bootstrap results before saving project workspace snapshots", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            project: {
              id: "project-1",
              title: "Project One",
              createdAt: "2026-04-25T00:00:00.000Z",
              updatedAt: "2026-04-25T00:00:00.000Z",
            },
            workspace: null,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      )
      .mockResolvedValueOnce(
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            project: {
              id: "project-1",
              title: "Project One",
              createdAt: "2026-04-25T00:00:00.000Z",
              updatedAt: "2026-04-25T00:00:00.000Z",
            },
            workspace: null,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      );

    await getAiStudioProjectIdentityViaApi({
      projectId: "project-1",
    });
    await saveAiStudioProjectWorkspaceSnapshotViaApi({
      projectId: "project-1",
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-25T00:00:00.000Z",
      } as never,
    });
    await getAiStudioProjectIdentityViaApi({
      projectId: "project-1",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(3);
  });

  it("uses DELETE to reset the saved project workspace snapshot", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ workspace: null }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    await resetAiStudioProjectWorkspaceSnapshotViaApi({
      projectId: "project-1",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/projects/project-1/workspace", {
      method: "DELETE",
      shortpulseLogScope: "app",
      shortpulseRetryNetworkOnce: true,
    });
  });
});
