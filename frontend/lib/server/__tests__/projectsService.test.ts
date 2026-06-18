import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  deleteProjectForUser,
  getProjectForUser,
  listProjectsForUser,
  resolveProjectCardPreviewSigningStoragePaths,
  resolveProjectPreviewImageUrlsFromSnapshot,
  updateProjectTitleForUser,
} from "../projectsService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

const PROJECT_ID_1 = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const createAwaitableQuery = <T>(result: T) => {
  const query = {} as {
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: Promise<T>["then"];
  };
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.then = Promise.resolve(result).then.bind(Promise.resolve(result));
  return query;
};

const createProjectSingleQuery = <T>(result: T) => {
  const query = {} as {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  return query;
};

const mockProjectListSupabase = ({
  workspaceSnapshot,
  displayRows = [],
  displayError,
}: {
  workspaceSnapshot: Record<string, unknown>;
  displayRows?: Array<Record<string, unknown>>;
  displayError?: string;
}) => {
  const projectRows = [
    {
      id: PROJECT_ID_1,
      user_id: "user-1",
      title: "Project One",
      created_at: "2026-06-03T10:00:00.000Z",
      updated_at: "2026-06-03T11:00:00.000Z",
    },
  ];
  const workspaceIn = vi.fn(async () => ({
    data: [
      {
        project_id: PROJECT_ID_1,
        snapshot: workspaceSnapshot,
      },
    ],
    error: null,
  }));
  const displayProjectIn = vi.fn(() => ({
    in: displayOutputIn,
  }));
  const displayOutputIn = vi.fn(async () => ({
    data: displayError ? null : displayRows,
    error: displayError ? { message: displayError } : null,
  }));
  const createSignedUrls = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `signed:${path}` })),
    error: null,
  }));
  const projectListQuery = createAwaitableQuery({
    data: projectRows,
    error: null,
  });
  const workspaceEq = vi.fn(() => ({
    in: workspaceIn,
  }));
  const displayQuery: {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(() => displayQuery),
    in: displayProjectIn,
  };
  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === "projects") {
        return {
          select: vi.fn(() => projectListQuery),
        };
      }
      if (table === "project_workspace_states") {
        return {
          select: vi.fn(() => ({
            eq: workspaceEq,
          })),
        };
      }
      if (table === "project_output_display_items") {
        return {
          select: vi.fn(() => displayQuery),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrls,
      })),
    },
  };
  getSupabaseAdminMock.mockReturnValue(supabaseMock as never);
  return {
    createSignedUrls,
    displayOutputIn,
    displayProjectIn,
    displayQuery,
    projectListQuery,
    workspaceEq,
    workspaceIn,
  };
};

describe("project owner-scoped record access", () => {
  const projectRow = {
    id: PROJECT_ID_1,
    user_id: "user-1",
    title: "Project One",
    created_at: "2026-06-03T10:00:00.000Z",
    updated_at: "2026-06-03T11:00:00.000Z",
  };

  it("reads one project through the caller-owned user scope", async () => {
    const query = createProjectSingleQuery({ data: projectRow, error: null });
    const select = vi.fn(() => query);
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    await expect(getProjectForUser({ userId: "user-1", projectId: PROJECT_ID_1 })).resolves.toEqual(
      {
        id: PROJECT_ID_1,
        userId: "user-1",
        title: "Project One",
        createdAt: "2026-06-03T10:00:00.000Z",
        updatedAt: "2026-06-03T11:00:00.000Z",
      }
    );

    expect(query.eq).toHaveBeenCalledWith("id", PROJECT_ID_1);
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("updates one project through the caller-owned user scope", async () => {
    const query = createProjectSingleQuery({ data: projectRow, error: null });
    const update = vi.fn(() => query);
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    await expect(
      updateProjectTitleForUser({
        userId: "user-1",
        projectId: PROJECT_ID_1,
        title: "Project One",
      })
    ).resolves.toEqual(expect.objectContaining({ id: PROJECT_ID_1, userId: "user-1" }));

    expect(query.eq).toHaveBeenCalledWith("id", PROJECT_ID_1);
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("deletes one project through the caller-owned user scope", async () => {
    const query = createProjectSingleQuery({ data: projectRow, error: null });
    const deleteProject = vi.fn(() => query);
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({ delete: deleteProject })),
    } as never);

    await expect(
      deleteProjectForUser({ userId: "user-1", projectId: PROJECT_ID_1 })
    ).resolves.toEqual(expect.objectContaining({ id: PROJECT_ID_1, userId: "user-1" }));

    expect(query.eq).toHaveBeenCalledWith("id", PROJECT_ID_1);
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});

describe("resolveProjectPreviewImageUrlsFromSnapshot", () => {
  it("prefers the first four quick-slot image previews", () => {
    const snapshot = {
      outputs: {
        curatedReferenceIds: ["quick-1", "quick-2", "quick-3", "quick-4", "quick-5", "quick-6"],
        active: [
          { id: "quick-1", mode: "image", previewUrl: "https://cdn.example.com/quick-1.png" },
          { id: "quick-2", mode: "image", previewUrl: "https://cdn.example.com/quick-2.png" },
          { id: "quick-3", mode: "image", resultUrls: ["https://cdn.example.com/quick-3.png"] },
          { id: "quick-4", mode: "image", previewUrl: "https://cdn.example.com/quick-4.png" },
          { id: "quick-5", mode: "image", previewUrl: "https://cdn.example.com/quick-5.png" },
          { id: "quick-6", mode: "image", previewUrl: "https://cdn.example.com/quick-6.png" },
          { id: "grid-1", mode: "image", previewUrl: "https://cdn.example.com/grid-1.png" },
        ],
        archived: [],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot)).toEqual([
      "https://cdn.example.com/quick-1.png",
      "https://cdn.example.com/quick-2.png",
      "https://cdn.example.com/quick-3.png",
      "https://cdn.example.com/quick-4.png",
    ]);
  });

  it("falls back to the first four visible reference-grid images when quick slot has none", () => {
    const snapshot = {
      outputs: {
        curatedReferenceIds: ["video-1"],
        active: [
          { id: "video-1", mode: "video", previewUrl: "https://cdn.example.com/video-1.mp4" },
          { id: "grid-1", mode: "image", previewUrl: "https://cdn.example.com/grid-1.png" },
          { id: "grid-2", mode: "image", resultUrls: ["https://cdn.example.com/grid-2.png"] },
          {
            id: "grid-hidden",
            mode: "image",
            previewUrl: "https://cdn.example.com/grid-hidden.png",
            hiddenInReferenceGrid: true,
          },
          { id: "grid-3", mode: "image", previewUrl: "https://cdn.example.com/grid-3.png" },
          { id: "grid-4", mode: "image", previewUrl: "https://cdn.example.com/grid-4.png" },
          { id: "grid-5", mode: "image", previewUrl: "https://cdn.example.com/grid-5.png" },
          { id: "grid-6", mode: "image", previewUrl: "https://cdn.example.com/grid-6.png" },
        ],
        archived: [],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot)).toEqual([
      "https://cdn.example.com/grid-1.png",
      "https://cdn.example.com/grid-2.png",
      "https://cdn.example.com/grid-3.png",
      "https://cdn.example.com/grid-4.png",
    ]);
  });

  it("returns no previews when neither quick slot nor reference grid has images", () => {
    const snapshot = {
      outputs: {
        curatedReferenceIds: ["audio-1"],
        active: [{ id: "audio-1", mode: "audio", previewUrl: "https://cdn.example.com/audio.mp3" }],
        archived: [{ id: "text-1", mode: "text" }],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot)).toEqual([]);
  });

  it("ignores failed image outputs when resolving project previews from raw snapshots", () => {
    const snapshot = {
      outputs: {
        curatedReferenceIds: ["failed-quick", "success-quick"],
        active: [
          {
            id: "failed-quick",
            mode: "image",
            taskState: "fail",
            previewUrl: "https://cdn.example.com/failed-quick.png",
          },
          {
            id: "success-quick",
            mode: "image",
            taskState: "success",
            previewUrl: "https://cdn.example.com/success-quick.png",
          },
          {
            id: "failed-grid",
            mode: "image",
            taskState: "fail",
            previewUrl: "https://cdn.example.com/failed-grid.png",
          },
          {
            id: "success-grid",
            mode: "image",
            taskState: "success",
            previewUrl: "https://cdn.example.com/success-grid.png",
          },
        ],
        archived: [
          {
            id: "failed-archived",
            mode: "image",
            taskState: "fail",
            previewUrl: "https://cdn.example.com/failed-archived.png",
          },
        ],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot)).toEqual([
      "https://cdn.example.com/success-quick.png",
    ]);
  });

  it("drops foreign direct preview urls when a caller user scope is provided", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.test");

    const snapshot = {
      outputs: {
        curatedReferenceIds: ["quick-1"],
        active: [
          {
            id: "quick-1",
            mode: "image",
            previewUrl: "https://cdn.example.test/media_library/user-2/private/images/foreign.png",
          },
        ],
        archived: [],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot, "user-1")).toEqual([]);
  });

  it("keeps trusted user-scoped direct preview urls when a caller user scope is provided", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.test");

    const snapshot = {
      outputs: {
        curatedReferenceIds: ["quick-1"],
        active: [
          {
            id: "quick-1",
            mode: "image",
            previewUrl: "https://cdn.example.test/media_library/user-1/private/images/owned.png",
          },
        ],
        archived: [],
      },
    };

    expect(resolveProjectPreviewImageUrlsFromSnapshot(snapshot, "user-1")).toEqual([
      "https://cdn.example.test/media_library/user-1/private/images/owned.png",
    ]);
  });
});

describe("listProjectsForUser preview composition", () => {
  it("prefers checkpoint plus display-record previews over rich snapshot parsing", async () => {
    const { displayOutputIn, displayProjectIn, displayQuery, projectListQuery, workspaceEq } =
      mockProjectListSupabase({
        workspaceSnapshot: {
          outputs: {
            curatedReferenceIds: ["quick-display"],
            active: [
              {
                id: "grid-display",
                mode: "image",
              },
              {
                id: "quick-display",
                mode: "image",
              },
            ],
            archived: [],
          },
        },
        displayRows: [
          {
            project_id: PROJECT_ID_1,
            output_id: "grid-display",
            mode: "image",
            task_state: "success",
            preview_url_fallback: "https://cdn.example.com/display-grid.png",
            result_urls_fallback: [],
            preview_storage_path: "user-1/generated/display-grid.png",
            full_storage_path: null,
            hidden_in_reference_grid: false,
          },
          {
            project_id: PROJECT_ID_1,
            output_id: "quick-display",
            mode: "image",
            task_state: "success",
            preview_url_fallback: "https://cdn.example.com/display-quick.png",
            result_urls_fallback: [],
            preview_storage_path: "user-1/generated/display-quick.png",
            full_storage_path: null,
            hidden_in_reference_grid: false,
          },
        ],
      });

    await expect(listProjectsForUser({ userId: "user-1", limit: "all" })).resolves.toEqual([
      expect.objectContaining({
        id: PROJECT_ID_1,
        previewImageUrls: ["signed:user-1/generated/display-quick.png"],
      }),
    ]);
    expect(displayProjectIn).toHaveBeenCalledWith("project_id", [PROJECT_ID_1]);
    expect(displayOutputIn).toHaveBeenCalledWith("output_id", ["quick-display", "grid-display"]);
    expect(projectListQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(workspaceEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(displayQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(displayQuery.eq).toHaveBeenCalledWith("mode", "image");
  });

  it("falls back to snapshot-derived project previews when display records are unavailable", async () => {
    mockProjectListSupabase({
      displayError: "relation does not exist",
      workspaceSnapshot: {
        outputs: {
          curatedReferenceIds: ["quick-snapshot"],
          active: [
            {
              id: "quick-snapshot",
              mode: "image",
              previewStoragePath: "user-1/generated/snapshot-quick.png",
              previewUrl: "https://cdn.example.com/snapshot-quick.png",
            },
          ],
          archived: [],
        },
      },
    });

    await expect(listProjectsForUser({ userId: "user-1", limit: "all" })).resolves.toEqual([
      expect.objectContaining({
        id: PROJECT_ID_1,
        previewImageUrls: ["signed:user-1/generated/snapshot-quick.png"],
      }),
    ]);
  });
});

describe("resolveProjectCardPreviewSigningStoragePaths", () => {
  it("prefers the smaller thumb derivative before thumb_480 variants", () => {
    expect(
      resolveProjectCardPreviewSigningStoragePaths("user-1/variants/images/media-1/thumb_480")
    ).toEqual([
      "user-1/variants/images/media-1/thumb_240",
      "user-1/variants/images/media-1/thumb_480",
    ]);
  });

  it("keeps non-derivative storage paths unchanged", () => {
    expect(
      resolveProjectCardPreviewSigningStoragePaths("user-1/generations/images/project-1.png")
    ).toEqual(["user-1/generations/images/project-1.png"]);
  });

  it("drops out-of-scope storage paths when a user scope is provided", () => {
    expect(
      resolveProjectCardPreviewSigningStoragePaths(
        "user-2/generations/images/project-1.png",
        "user-1"
      )
    ).toEqual([]);
  });

  it("returns no signing paths when storage is unavailable", () => {
    expect(resolveProjectCardPreviewSigningStoragePaths(null)).toEqual([]);
  });
});
