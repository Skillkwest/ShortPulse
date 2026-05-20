import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { writeAppErrorLog } from "../api/appErrorLogs";
import {
  getProjectWorkspaceStateForUser,
  InvalidProjectWorkspaceSnapshotError,
  upsertProjectWorkspaceStateForUser,
} from "../projectWorkspaceStatesService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../api/appErrorLogs", () => ({
  writeAppErrorLog: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const writeAppErrorLogMock = vi.mocked(writeAppErrorLog);

type SupabaseMockOptions = {
  workspaceSnapshot?: Record<string, unknown>;
  recentGenerationIds?: string[];
  projectionRows?: Array<Record<string, unknown>>;
  publicationRows?: Array<Record<string, unknown>>;
  mediaRows?: Array<Record<string, unknown>>;
  projectionLimitError?: string;
  mediaAssociationError?: string;
  promptAssociationError?: string;
  generationAssociationError?: string;
  publicationError?: string;
  mediaRowReadError?: string;
  workspaceUpsertError?: string;
};

const createSupabaseMock = ({
  workspaceSnapshot,
  recentGenerationIds = ["generation-1"],
  projectionRows = [
    {
      generation_id: "generation-1",
      request_id: "task-1",
      preview_url: "https://cdn.example.com/project-output.png",
      result_urls: ["https://cdn.example.com/project-output.png"],
      preview_storage_path: "user-1/generated/project-output-preview.png",
      full_storage_path: "user-1/generated/project-output-full.png",
      task_state: "success",
      queue_state: "dispatched",
      display_prompt: "Server prompt",
      provider: "fal",
      model_id: "fal-ai/seedream",
      hidden_in_reference_grid: false,
      reference_grid_visible: true,
    },
  ],
  publicationRows = [],
  mediaRows = [],
  projectionLimitError,
  mediaAssociationError,
  promptAssociationError,
  generationAssociationError,
  publicationError,
  mediaRowReadError,
  workspaceUpsertError,
}: SupabaseMockOptions = {}) => {
  const projectionRowsById = new Map<string, Record<string, unknown>>(
    projectionRows
      .filter(
        (row): row is Record<string, unknown> & { generation_id: string } =>
          typeof row.generation_id === "string" && row.generation_id.length > 0
      )
      .map((row) => [row.generation_id, row])
  );
  const mediaRowsById = new Map<string, Record<string, unknown>>(
    mediaRows
      .filter(
        (row): row is Record<string, unknown> & { id: string } =>
          typeof row.id === "string" && row.id.length > 0
      )
      .map((row) => [row.id, row])
  );
  const mediaSelect = vi.fn((columns?: string) => ({
    eq: vi.fn(() => ({
      in: vi.fn(async (_column: string, ids: string[]) => {
        const isMediaRowRead = typeof columns === "string" && columns.includes("storage_path");
        if (isMediaRowRead && mediaRowReadError) {
          return {
            data: null,
            error: { message: mediaRowReadError },
          };
        }
        return {
          data: ids
            .filter((id) => id === "media-1" || id === "media-2" || mediaRowsById.has(id))
            .map((id) => mediaRowsById.get(id) ?? { id }),
          error: null,
        };
      }),
    })),
  }));
  const promptSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids.filter((id) => id === "prompt-1").map((id) => ({ id })),
        error: null,
      })),
    })),
  }));
  const generationSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids.filter((id) => id === "generation-1").map((id) => ({ id })),
        error: null,
      })),
    })),
  }));
  const mediaAssociationUpsert = vi.fn(async () => ({
    error: mediaAssociationError ? { message: mediaAssociationError } : null,
  }));
  const promptAssociationUpsert = vi.fn(async () => ({
    error: promptAssociationError ? { message: promptAssociationError } : null,
  }));
  const generationAssociationUpsert = vi.fn(async () => ({
    error: generationAssociationError ? { message: generationAssociationError } : null,
  }));
  const generationAssociationRecentLimit = vi.fn(async () => ({
    data: recentGenerationIds.map((generationId) => ({ generation_id: generationId })),
    error: null,
  }));
  const generationAssociationSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(async (_column: string, ids: string[]) => ({
          data: ids.filter((id) => id === "generation-1").map((id) => ({ generation_id: id })),
          error: null,
        })),
        order: vi.fn(() => ({
          limit: generationAssociationRecentLimit,
        })),
      })),
    })),
  }));
  const generationProjectionSelect = vi.fn(() => {
    const builder = {
      eq: vi.fn(),
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids
          .map((id) => projectionRowsById.get(id))
          .filter((row): row is Record<string, unknown> => Boolean(row)),
        error: null,
      })),
      order: vi.fn(),
      limit: vi.fn(async () => ({
        data: projectionLimitError
          ? null
          : recentGenerationIds.map((generationId, index) => ({
              generation_id: generationId,
              updated_at: new Date(Date.UTC(2026, 3, 18, 16, 13 - index, 0)).toISOString(),
            })),
        error: projectionLimitError ? { message: projectionLimitError } : null,
      })),
    };
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    return builder;
  });
  const generationPublicationSelect = vi.fn(() => {
    const builder = {
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(async () => ({
        data: publicationError ? null : publicationRows,
        error: publicationError ? { message: publicationError } : null,
      })),
    };
    builder.eq.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    return builder;
  });
  const workspaceMaybeSingle = vi.fn(async () => ({
    data: {
      project_id: "project-1",
      user_id: "user-1",
      schema_version: 2,
      snapshot: workspaceSnapshot ?? {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:legacy",
        },
        outputs: {
          active: [
            {
              id: "out-1",
              generationId: "generation-1",
              previewUrl: "https://expired.example.com/old.png",
              resultUrls: ["https://expired.example.com/old.png"],
            },
            {
              id: "out-2",
              generationId: "generation-2",
              previewUrl: "https://expired.example.com/other.png",
              resultUrls: ["https://expired.example.com/other.png"],
            },
          ],
          archived: [],
        },
        agent: {
          messages: [{ id: "msg-1", role: "assistant", content: "Legacy chat" }],
          input: "legacy draft",
          latestAgentPrompt: "Legacy prompt",
          promptOrigin: "agent",
          chatModeEnabled: false,
          pulseWorkflowSession: {
            presetId: "single_shot",
            status: "awaiting_input",
            currentStepIndex: 1,
            currentStepLabel: "Action",
            currentStepPrompt: "What happens next?",
            collectedInputs: ["Close-up"],
            lastArtifact: null,
            finalArtifactSource: null,
          },
        },
        agentRuntimes: {
          standard: {
            messages: [{ id: "msg-0", role: "assistant", content: "Legacy standard" }],
            input: "",
            latestAgentPrompt: "Legacy standard",
            promptOrigin: "agent",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
          pulsePresetId: "single_shot",
          pulse: {
            messages: [{ id: "msg-1", role: "assistant", content: "Legacy chat" }],
            input: "legacy draft",
            latestAgentPrompt: "Legacy prompt",
            promptOrigin: "agent",
            chatModeEnabled: false,
            pulseWorkflowSession: {
              presetId: "single_shot",
              status: "awaiting_input",
              currentStepIndex: 1,
              currentStepLabel: "Action",
              currentStepPrompt: "What happens next?",
              collectedInputs: ["Close-up"],
              lastArtifact: null,
              finalArtifactSource: null,
            },
          },
        },
      },
      created_at: "2026-04-23T00:00:00.000Z",
      updated_at: "2026-04-23T01:00:00.000Z",
    },
    error: null,
  }));
  const workspaceReadSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: workspaceMaybeSingle,
      })),
    })),
  }));
  const workspaceUpsert = vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: workspaceUpsertError
          ? null
          : {
              project_id: "project-1",
              user_id: "user-1",
              schema_version: 2,
              snapshot:
                workspaceSnapshot ??
                ({
                  schemaVersion: 2,
                  sessionId: "session-1",
                  updatedAt: "2026-04-23T01:00:00.000Z",
                } as Record<string, unknown>),
              created_at: "2026-04-23T00:00:00.000Z",
              updated_at: "2026-04-23T01:00:00.000Z",
            },
        error: workspaceUpsertError ? { message: workspaceUpsertError } : null,
      })),
    })),
  }));

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === "media_files") {
        return {
          select: mediaSelect,
        };
      }
      if (table === "media_prompts") {
        return {
          select: promptSelect,
        };
      }
      if (table === "ai_generations") {
        return {
          select: generationSelect,
        };
      }
      if (table === "project_media_items") {
        return {
          upsert: mediaAssociationUpsert,
        };
      }
      if (table === "project_prompt_items") {
        return {
          upsert: promptAssociationUpsert,
        };
      }
      if (table === "project_generation_items") {
        return {
          upsert: generationAssociationUpsert,
          select: generationAssociationSelect,
        };
      }
      if (table === "generation_projection") {
        return {
          select: generationProjectionSelect,
        };
      }
      if (table === "generation_publications") {
        return {
          select: generationPublicationSelect,
        };
      }
      if (table === "project_workspace_states") {
        return {
          select: workspaceReadSelect,
          upsert: workspaceUpsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  getSupabaseAdminMock.mockReturnValue(supabaseMock as never);

  return {
    mediaAssociationUpsert,
    promptAssociationUpsert,
    generationAssociationUpsert,
    workspaceUpsert,
  };
};

describe("projectWorkspaceStatesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: "evt-1" });
  });

  it("rejects snapshots that fit the size gate but fail the restore-shape contract", async () => {
    createSupabaseMock();

    await expect(
      upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          updatedAt: "2026-04-23T01:00:00.000Z",
          workspace: {},
        },
      })
    ).rejects.toBeInstanceOf(InvalidProjectWorkspaceSnapshotError);
  });

  it("backfills owned media and prompt ids from the workspace snapshot before saving", async () => {
    const {
      mediaAssociationUpsert,
      promptAssociationUpsert,
      generationAssociationUpsert,
      workspaceUpsert,
    } = createSupabaseMock();

    const snapshot = {
      schemaVersion: 2,
      sessionId: "session-1",
      updatedAt: "2026-04-23T01:00:00.000Z",
      meta: {
        generatedAt: "2026-04-23T01:00:00.000Z",
        checksum: "fnv1a32:legacy",
      },
      workspace: {
        mode: "image",
        selectedTool: "create",
        prompt: "Legacy prompt",
        standardPrompt: "Legacy prompt",
        model: "fal-ai/seedream",
        aspect: "9:16",
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        editReferenceText: "Keep this edit draft local to the page session.",
        videoReferenceText: "Keep this video draft local to the page session.",
        videoReferenceMode: "standard",
        videoDurationSeconds: 6,
        videoResolution: "1080p",
        imageResolution: "model_default",
        videoGenerateAudio: false,
        videoCameraFixed: false,
        videoAutoFix: false,
        klingNegativePrompt: "",
        klingCfgScale: 0.5,
        klingWorkflowMode: "single",
        klingShotType: "customize",
        klingVoiceIds: ["", ""],
        klingMultiPrompts: [],
        klingElements: [],
        motionReferenceVideoUrl: null,
      },
      outputs: {
        active: [
          {
            id: "out-1",
            generationId: "generation-1",
            promptId: "prompt-1",
            savedMediaIds: ["media-1", "media-1", "media-missing"],
          },
        ],
        archived: [
          {
            id: "out-2",
            generationId: "generation-missing",
            promptId: "prompt-missing",
            savedMediaIds: ["media-2"],
          },
        ],
      },
      agent: {
        messages: [{ id: "msg-1", role: "assistant", content: "Legacy chat" }],
        input: "legacy draft",
        latestAgentPrompt: "Legacy prompt",
        promptOrigin: "agent",
        chatModeEnabled: false,
        pulseWorkflowSession: {
          presetId: "single_shot",
          status: "awaiting_input",
          currentStepIndex: 1,
          currentStepLabel: "Action",
          currentStepPrompt: "What happens next?",
          collectedInputs: ["Close-up"],
          lastArtifact: null,
          finalArtifactSource: null,
        },
      },
      agentRuntimes: {
        standard: {
          messages: [{ id: "msg-0", role: "assistant", content: "Legacy standard" }],
          input: "",
          latestAgentPrompt: "Legacy standard",
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        pulsePresetId: "single_shot",
        pulse: {
          messages: [{ id: "msg-1", role: "assistant", content: "Legacy chat" }],
          input: "legacy draft",
          latestAgentPrompt: "Legacy prompt",
          promptOrigin: "agent",
          chatModeEnabled: false,
          pulseWorkflowSession: {
            presetId: "single_shot",
            status: "awaiting_input",
            currentStepIndex: 1,
            currentStepLabel: "Action",
            currentStepPrompt: "What happens next?",
            collectedInputs: ["Close-up"],
            lastArtifact: null,
            finalArtifactSource: null,
          },
        },
      },
    };

    await expect(
      upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot,
      })
    ).resolves.toMatchObject({
      projectId: "project-1",
      userId: "user-1",
      schemaVersion: 2,
      saveOutcome: {
        status: "saved",
      },
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        workspace: {
          prompt: "",
          standardPrompt: "",
          pulsePrompt: "",
          editReferenceText: "",
          videoReferenceText: "",
        },
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
        outputs: {
          active: [
            {
              id: "out-1",
              generationId: "generation-1",
              promptId: "prompt-1",
              savedMediaIds: ["media-1"],
              prompt: "Server prompt",
              previewUrl: "https://cdn.example.com/project-output.png",
              resultUrls: ["https://cdn.example.com/project-output.png"],
              previewStoragePath: "user-1/generated/project-output-preview.png",
              fullStoragePath: "user-1/generated/project-output-full.png",
              taskId: "task-1",
              taskState: "success",
              queueState: "dispatched",
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
      },
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });

    expect(mediaAssociationUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          project_id: "project-1",
          media_file_id: "media-1",
          user_id: "user-1",
        }),
        expect.objectContaining({
          project_id: "project-1",
          media_file_id: "media-2",
          user_id: "user-1",
        }),
      ]),
      expect.objectContaining({
        onConflict: "project_id,media_file_id",
      })
    );
    expect(promptAssociationUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          project_id: "project-1",
          prompt_id: "prompt-1",
          user_id: "user-1",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,prompt_id",
      })
    );
    expect(generationAssociationUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          project_id: "project-1",
          generation_id: "generation-1",
          user_id: "user-1",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,generation_id",
      })
    );
    expect(workspaceUpsert).toHaveBeenCalled();
    expect(workspaceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          outputs: {
            active: [
              expect.objectContaining({
                id: "out-1",
                generationId: "generation-1",
                promptId: "prompt-1",
                savedMediaIds: ["media-1"],
              }),
            ],
            archived: [],
            activeOutputId: null,
            curatedReferenceIds: [],
            removedFromAllRefsIds: [],
          },
          agent: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
        }),
      }),
      expect.anything()
    );
    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect("agentRuntimes" in (firstWorkspaceUpsertArg?.snapshot ?? {})).toBe(false);
  });

  it("removes failed outputs from project workspace snapshots before saving", async () => {
    createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    const result = await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-failed-save",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:failed-save",
        },
        workspace: {
          mode: "audio",
          selectedTool: "create",
          prompt: "failed audio",
          standardPrompt: "failed audio",
          model: "eleven_multilingual_v2",
          aspect: "audio",
          referenceImageUrl: null,
          extraImageUrls: [null, null, null],
          editReferenceText: "",
          videoReferenceText: "",
          videoReferenceMode: "standard",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          imageResolution: "model_default",
          videoGenerateAudio: false,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "",
          klingCfgScale: 0.5,
          klingWorkflowMode: "single",
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
          motionReferenceVideoUrl: null,
        },
        outputs: {
          active: [
            {
              id: "out-fail-active",
              taskState: "fail",
              errorMessage: "Unknown error",
              errorMessageShort: "Unknown error",
            },
          ],
          archived: [
            {
              id: "out-fail-archived",
              taskState: "fail",
              errorMessage: "Unknown error",
              errorMessageShort: "Unknown error",
            },
          ],
          activeOutputId: "out-fail-active",
          curatedReferenceIds: ["out-fail-active", "out-fail-archived"],
          removedFromAllRefsIds: ["out-fail-active"],
        },
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
      },
    });

    expect(result.snapshot.outputs).toMatchObject({
      active: [],
      archived: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
    });
  });

  it("persists the sanitized snapshot when restored-project projection hydration fails during save", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { workspaceUpsert } = createSupabaseMock({
      projectionLimitError: "projection unavailable",
    });

    try {
      await expect(
        upsertProjectWorkspaceStateForUser({
          userId: "user-1",
          projectId: "project-1",
          schemaVersion: 2,
          snapshot: {
            schemaVersion: 2,
            sessionId: "session-1",
            updatedAt: "2026-04-23T01:00:00.000Z",
            meta: {
              generatedAt: "2026-04-23T01:00:00.000Z",
              checksum: "fnv1a32:projection-failure",
            },
            workspace: {
              selectedTool: "create",
              standardPrompt: "Project prompt",
            },
            outputs: {
              active: [
                {
                  id: "out-1",
                  generationId: "generation-1",
                  previewUrl: "https://expired.example.com/old.png",
                  resultUrls: ["https://expired.example.com/old.png"],
                },
              ],
              archived: [],
            },
            agent: {
              messages: [],
              input: "",
              latestAgentPrompt: null,
              promptOrigin: "manual",
              chatModeEnabled: false,
              pulseWorkflowSession: null,
            },
          },
        })
      ).resolves.toMatchObject({
        snapshot: {
          outputs: {
            active: [
              expect.objectContaining({
                id: "out-1",
                generationId: "generation-1",
                previewUrl: "https://expired.example.com/old.png",
                resultUrls: ["https://expired.example.com/old.png"],
              }),
            ],
          },
        },
      });

      const firstWorkspaceUpsertArg = (
        workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
      ).at(0)?.[0];
      expect(firstWorkspaceUpsertArg?.snapshot).toMatchObject({
        outputs: {
          active: [
            expect.objectContaining({
              id: "out-1",
              generationId: "generation-1",
              previewUrl: "https://expired.example.com/old.png",
              resultUrls: ["https://expired.example.com/old.png"],
            }),
          ],
        },
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] best-effort save stage failed; persisting sanitized snapshot",
        expect.objectContaining({
          projectId: "project-1",
          stage: "generated output hydration",
          error: "projection unavailable",
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("persists the sanitized snapshot when restored-project media delivery hydration fails during save", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseMock({
      mediaRowReadError: "media rows unavailable",
      projectionRows: [
        {
          generation_id: "generation-1",
          request_id: "task-1",
          preview_url: "https://cdn.example.com/generated-video.mp4",
          result_urls: ["https://cdn.example.com/generated-video.mp4"],
          saved_media_ids: ["media-video-1"],
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Restored video",
          provider: "kie",
          model_id: "kling-video-v1",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      publicationRows: [
        {
          generation_id: "generation-1",
          owned_media_file_id: "media-video-1",
          preview_storage_path: "user-1/generated/generated-video-preview.png",
          full_storage_path: "user-1/generated/generated-video.mp4",
          created_at: "2026-04-23T01:00:00.000Z",
        },
      ],
    });
    try {
      await expect(
        upsertProjectWorkspaceStateForUser({
          userId: "user-1",
          projectId: "project-1",
          schemaVersion: 2,
          snapshot: {
            schemaVersion: 2,
            sessionId: "session-1",
            updatedAt: "2026-04-23T01:00:00.000Z",
            meta: {
              generatedAt: "2026-04-23T01:00:00.000Z",
              checksum: "fnv1a32:media-delivery-failure",
            },
            workspace: {
              selectedTool: "create",
              standardPrompt: "Project prompt",
            },
            outputs: {
              active: [
                {
                  id: "video-1",
                  generationId: "generation-1",
                  mode: "video",
                  previewUrl: "https://cdn.example.com/generated-video.mp4",
                  resultUrls: ["https://cdn.example.com/generated-video.mp4"],
                },
              ],
              archived: [],
            },
            agent: {
              messages: [],
              input: "",
              latestAgentPrompt: null,
              promptOrigin: "manual",
              chatModeEnabled: false,
              pulseWorkflowSession: null,
            },
          },
        })
      ).resolves.toMatchObject({
        snapshot: {
          outputs: {
            active: [
              expect.objectContaining({
                id: "video-1",
                generationId: "generation-1",
                mode: "video",
              }),
            ],
          },
        },
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] best-effort save stage failed; persisting sanitized snapshot",
        expect.objectContaining({
          projectId: "project-1",
          stage: "generated output hydration",
          error: "media rows unavailable",
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns repair-pending save outcomes when project association backfill fails after the workspace write", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { workspaceUpsert } = createSupabaseMock({
      mediaAssociationError: "duplicate key value violates unique constraint",
    });

    try {
      await expect(
        upsertProjectWorkspaceStateForUser({
          userId: "user-1",
          projectId: "project-1",
          schemaVersion: 2,
          snapshot: {
            schemaVersion: 2,
            sessionId: "session-1",
            updatedAt: "2026-04-23T01:00:00.000Z",
            meta: {
              generatedAt: "2026-04-23T01:00:00.000Z",
              checksum: "fnv1a32:association-failure",
            },
            workspace: {
              selectedTool: "create",
              standardPrompt: "Project prompt",
            },
            outputs: {
              active: [
                {
                  id: "library-1",
                  savedMediaIds: ["media-1"],
                },
              ],
              archived: [],
            },
            agent: {
              messages: [],
              input: "",
              latestAgentPrompt: null,
              promptOrigin: "manual",
              chatModeEnabled: false,
              pulseWorkflowSession: null,
            },
          },
        })
      ).resolves.toMatchObject({
        saveOutcome: {
          status: "saved_with_repair_pending",
          repairStage: "project_association_backfill",
          repairMessage:
            "Project workspace save failed during project association backfill: duplicate key value violates unique constraint",
        },
        snapshot: {
          outputs: {
            active: [
              expect.objectContaining({
                id: "library-1",
                savedMediaIds: ["media-1"],
              }),
            ],
          },
        },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] best-effort save stage failed; persisting sanitized snapshot",
        expect.objectContaining({
          projectId: "project-1",
          stage: "project association backfill",
          error: "duplicate key value violates unique constraint",
        })
      );
      expect(writeAppErrorLogMock).toHaveBeenCalledWith({
        source: "telemetry.ai_studio.project_workspace.repair_pending",
        message: "Project workspace save completed, but follow-up project repair is still pending.",
        userId: "user-1",
        statusCode: 200,
        metadata: {
          project_id: "project-1",
          repair_stage: "project_association_backfill",
          save_outcome: "saved_with_repair_pending",
          repair_message:
            "Project workspace save failed during project association backfill: duplicate key value violates unique constraint",
        },
      });
      expect(workspaceUpsert).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("accepts richer agent attachment fields while still sanitizing project workspace saves", async () => {
    createSupabaseMock();

    await expect(
      upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          updatedAt: "2026-04-23T01:00:00.000Z",
          meta: {
            generatedAt: "2026-04-23T01:00:00.000Z",
            checksum: "fnv1a32:legacy",
          },
          workspace: {
            selectedTool: "create",
            standardPrompt: "Project prompt",
          },
          outputs: {
            active: [],
            archived: [],
          },
          agent: {
            messages: [
              {
                id: "msg-1",
                role: "user",
                content: "Use these references",
                attachments: [
                  {
                    id: "att-1",
                    kind: "image",
                    referenceId: "out-1",
                    mediaId: "media-1",
                    previewStoragePath: "user-1/generated/out-1-preview.png",
                    fullStoragePath: "user-1/generated/out-1-full.png",
                    referenceUrl: "https://signed.example.com/reference.png",
                    referenceRenderUrl: "https://cdn.example.com/reference-preview.png",
                    imageUrl: "https://cdn.example.com/reference-preview.png",
                    imageFallbackUrls: ["https://signed.example.com/reference.png"],
                    text: null,
                    aspect: "1:1",
                    deliveryStatus: "ready",
                    deliveryError: null,
                  },
                ],
              },
            ],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
        },
      })
    ).resolves.toMatchObject({
      snapshot: {
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
      },
    });
  });

  it("refreshes generated outputs from project-associated generations on workspace read", async () => {
    createSupabaseMock();

    const result = await getProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result).toMatchObject({
      projectId: "project-1",
      userId: "user-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
        outputs: {
          active: [
            {
              id: "out-1",
              generationId: "generation-1",
              previewUrl: "https://cdn.example.com/project-output.png",
              resultUrls: ["https://cdn.example.com/project-output.png"],
              previewStoragePath: "user-1/generated/project-output-preview.png",
              fullStoragePath: "user-1/generated/project-output-full.png",
              taskId: "task-1",
              taskState: "success",
              queueState: "dispatched",
              prompt: "Server prompt",
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
      },
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T01:00:00.000Z",
    });
    expect("agentRuntimes" in (result?.snapshot ?? {})).toBe(false);
  });

  it("removes failed legacy snapshot rows and prunes dependent ids on workspace read", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:legacy-failed",
        },
        outputs: {
          active: [
            {
              id: "out-fail-active",
              taskState: "fail",
              errorMessage: "Unknown error",
              errorMessageShort: "Unknown error",
            },
          ],
          archived: [
            {
              id: "out-fail-archived",
              taskState: "fail",
              errorMessage: "Unknown error",
              errorMessageShort: "Unknown error",
            },
          ],
          activeOutputId: "out-fail-active",
          curatedReferenceIds: ["out-fail-active", "out-fail-archived"],
          removedFromAllRefsIds: ["out-fail-active"],
        },
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
      },
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    const result = await getProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result?.snapshot.outputs).toMatchObject({
      active: [],
      archived: [],
      activeOutputId: null,
      curatedReferenceIds: [],
      removedFromAllRefsIds: [],
    });
  });

  it("returns the sanitized base workspace when read-time enrichment fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseMock({
      projectionLimitError: "projection unavailable",
    });

    try {
      const result = await getProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
      });

      expect(result).toMatchObject({
        projectId: "project-1",
        userId: "user-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          agent: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
          outputs: {
            active: [
              {
                id: "out-1",
                generationId: "generation-1",
                previewUrl: "https://expired.example.com/old.png",
                resultUrls: ["https://expired.example.com/old.png"],
              },
            ],
            archived: [],
          },
        },
      });
      expect(result?.snapshot.outputs).not.toMatchObject({
        active: [expect.objectContaining({ id: "out-2" })],
      });
      expect("agentRuntimes" in (result?.snapshot ?? {})).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] read enrichment failed; returning sanitized snapshot",
        expect.objectContaining({
          projectId: "project-1",
          error: "projection unavailable",
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("preserves settled non-generated refs when project workspace reads refresh generated outputs", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:refs",
        },
        outputs: {
          active: [
            {
              id: "generated-1",
              generationId: "generation-1",
              previewUrl: "https://expired.example.com/generated.png",
              resultUrls: ["https://expired.example.com/generated.png"],
            },
            {
              id: "library-1",
              mediaSource: "library",
              previewUrl: "https://cdn.example.com/library.png",
              resultUrls: ["https://cdn.example.com/library.png"],
              savedMediaIds: ["media-1"],
              saveState: "saved",
              status: "saved",
            },
            {
              id: "upload-1",
              mediaSource: "upload",
              previewUrl: "https://cdn.example.com/upload.png",
              resultUrls: ["https://cdn.example.com/upload.png"],
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
      },
    });

    const result = await getProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result?.snapshot.outputs).toMatchObject({
      active: [
        expect.objectContaining({
          id: "generated-1",
          previewUrl: "https://cdn.example.com/project-output.png",
        }),
        expect.objectContaining({
          id: "library-1",
          mediaSource: "library",
          savedMediaIds: ["media-1"],
          saveState: "saved",
        }),
        expect.objectContaining({
          id: "upload-1",
          mediaSource: "upload",
          previewUrl: "https://cdn.example.com/upload.png",
        }),
      ],
    });
  });

  it("hydrates restored project video outputs with poster storage from saved media rows", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:video",
        },
        outputs: {
          active: [
            {
              id: "out-1",
              generationId: "generation-1",
              mode: "video",
              previewUrl: "https://cdn.example.com/generated-video.mp4",
              resultUrls: ["https://cdn.example.com/generated-video.mp4"],
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
      },
      projectionRows: [
        {
          generation_id: "generation-1",
          request_id: "task-1",
          preview_url: "https://cdn.example.com/generated-video.mp4",
          result_urls: ["https://cdn.example.com/generated-video.mp4"],
          saved_media_ids: ["media-video-1"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Restored video",
          provider: "kie",
          model_id: "kie-ai/seedance-2-fast",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      publicationRows: [
        {
          generation_id: "generation-1",
          owned_media_file_id: "media-video-1",
          preview_storage_path: null,
          full_storage_path: null,
          publication_state: "published",
          created_at: "2026-04-23T01:00:00.000Z",
        },
      ],
      mediaRows: [
        {
          id: "media-video-1",
          file_type: "video",
          storage_path: "user-1/generations/videos/restored-video.mp4",
          preview_storage_path: null,
          poster_variant_path: "user-1/variants/videos/restored-video/poster_720.jpg",
          thumb_variant_path: null,
          preview_variant_path: null,
        },
      ],
    });

    const result = await getProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result?.snapshot.outputs).toMatchObject({
      active: [
        {
          id: "out-1",
          generationId: "generation-1",
          mode: "video",
          previewPosterStoragePath: "user-1/variants/videos/restored-video/poster_720.jpg",
          previewStoragePath: "user-1/generations/videos/restored-video.mp4",
          fullStoragePath: "user-1/generations/videos/restored-video.mp4",
          taskId: "task-1",
          taskState: "success",
          queueState: "dispatched",
          prompt: "Restored video",
        },
      ],
    });
  });

  it("appends project-associated generated outputs that are absent from the workspace snapshot", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:empty",
        },
        outputs: {
          active: [],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
      },
      recentGenerationIds: ["generation-2"],
      projectionRows: [
        {
          generation_id: "generation-2",
          request_id: "task-2",
          preview_url: "https://cdn.example.com/generated-video.mp4",
          result_urls: ["https://cdn.example.com/generated-video.mp4"],
          saved_media_ids: ["media-video-2"],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Recovered video",
          provider: "kie",
          model_id: "kie-ai/seedance-2-fast",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      publicationRows: [
        {
          generation_id: "generation-2",
          owned_media_file_id: "media-video-2",
          preview_storage_path: null,
          full_storage_path: null,
          publication_state: "published",
          created_at: "2026-04-23T01:00:00.000Z",
        },
      ],
      mediaRows: [
        {
          id: "media-video-2",
          file_type: "video",
          storage_path: "user-1/generations/videos/generated-video.mp4",
          preview_storage_path: null,
          poster_variant_path: "user-1/variants/videos/generated-video/poster_720.jpg",
          thumb_variant_path: null,
          preview_variant_path: null,
        },
      ],
    });

    const result = await getProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result?.snapshot.outputs).toMatchObject({
      active: [
        {
          id: "generated:generation-2",
          generationId: "generation-2",
          taskId: "task-2",
          taskState: "success",
          queueState: "dispatched",
          mode: "video",
          modelId: "kie-ai/seedance-2-fast",
          mediaSource: "generated",
          previewTier: "preview_loop",
          previewUrl: "https://cdn.example.com/generated-video.mp4",
          resultUrls: ["https://cdn.example.com/generated-video.mp4"],
          previewPosterStoragePath: "user-1/variants/videos/generated-video/poster_720.jpg",
          previewStoragePath: "user-1/generations/videos/generated-video.mp4",
          fullStoragePath: "user-1/generations/videos/generated-video.mp4",
        },
      ],
      archived: [],
    });
  });

  it("does not append failed project-associated generations into active outputs", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:empty",
        },
        outputs: {
          active: [],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
      },
      recentGenerationIds: ["generation-failed-1"],
      projectionRows: [
        {
          generation_id: "generation-failed-1",
          request_id: "task-failed-1",
          preview_url: null,
          result_urls: [],
          saved_media_ids: [],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "fail",
          queue_state: "failed",
          display_prompt: "Failed voiceover",
          provider: "elevenlabs",
          model_id: "eleven_multilingual_v2",
          error_message_short: "Unknown error",
          error_detail: "Unknown error",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
    });

    const result = await getProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result?.snapshot.outputs).toMatchObject({
      active: [],
      archived: [],
    });
  });

  it("drops existing snapshot rows when the associated project generation is suppressed", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:empty",
        },
        outputs: {
          active: [
            {
              id: "generated:generation-removed-1",
              generationId: "generation-removed-1",
              taskId: "task-removed-1",
              mode: "audio",
              model: "ElevenLabs Voiceover",
              prompt: "Suppressed failure",
              status: "ready",
              timestamp: "Now",
              mediaSource: "generated",
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
      },
      associatedSnapshotGenerationIds: ["generation-removed-1"],
      recentGenerationIds: ["generation-removed-1"],
      projectionRows: [
        {
          generation_id: "generation-removed-1",
          request_id: "task-removed-1",
          preview_url: null,
          result_urls: [],
          saved_media_ids: [],
          preview_storage_path: null,
          full_storage_path: null,
          task_state: "fail",
          queue_state: "failed",
          display_prompt: "Suppressed failure",
          provider: "elevenlabs",
          model_id: "eleven_multilingual_v2",
          error_message_short: "Generation was removed",
          error_detail: "Generation was removed",
          hidden_in_reference_grid: true,
          reference_grid_visible: false,
        },
      ],
    });

    const result = await getProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(result?.snapshot.outputs).toMatchObject({
      active: [],
      archived: [],
    });
  });
});
