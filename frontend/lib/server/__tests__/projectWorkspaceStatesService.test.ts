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

const MEDIA_ID_1 = "11111111-1111-4111-8111-111111111111";
const MEDIA_ID_2 = "22222222-2222-4222-8222-222222222222";
const PROMPT_ID_1 = "33333333-3333-4333-8333-333333333333";
const GENERATION_ID_1 = "44444444-4444-4444-8444-444444444444";
const GENERATION_ID_2 = "55555555-5555-4555-8555-555555555555";
const MEDIA_VIDEO_ID_1 = "66666666-6666-4666-8666-666666666666";

type SupabaseMockOptions = {
  workspaceSnapshot?: Record<string, unknown>;
  associatedSnapshotGenerationIds?: string[];
  recentGenerationIds?: string[];
  projectionRows?: Array<Record<string, unknown>>;
  publicationRows?: Array<Record<string, unknown>>;
  mediaRows?: Array<Record<string, unknown>>;
  projectionLimitError?: string;
  mediaAssociationError?: string;
  promptAssociationError?: string;
  generationAssociationError?: string;
  generationReadError?: string;
  publicationError?: string;
  mediaRowReadError?: string;
  workspaceUpsertError?: string;
};

const createSupabaseMock = ({
  workspaceSnapshot,
  associatedSnapshotGenerationIds = [GENERATION_ID_1],
  recentGenerationIds = [GENERATION_ID_1],
  projectionRows = [
    {
      generation_id: GENERATION_ID_1,
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
  generationReadError,
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
  const mediaIdInMock = vi.fn(async (_column: string, ids: string[]) => ({
    data: ids
      .filter((id) => id === MEDIA_ID_1 || id === MEDIA_ID_2 || mediaRowsById.has(id))
      .map((id) => mediaRowsById.get(id) ?? { id }),
    error: null,
  }));
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
        return mediaIdInMock(_column, ids);
      }),
    })),
  }));
  const promptIdInMock = vi.fn(async (_column: string, ids: string[]) => ({
    data: ids.filter((id) => id === PROMPT_ID_1).map((id) => ({ id })),
    error: null,
  }));
  const promptSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      in: promptIdInMock,
    })),
  }));
  const generationIdInMock = vi.fn(async (_column: string, ids: string[]) => ({
    data: generationReadError
      ? null
      : ids.filter((id) => id === GENERATION_ID_1).map((id) => ({ id })),
    error: generationReadError ? { message: generationReadError } : null,
  }));
  const generationSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      in: generationIdInMock,
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
          data: ids
            .filter((id) => associatedSnapshotGenerationIds.includes(id))
            .map((id) => ({ generation_id: id })),
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
              generationId: GENERATION_ID_1,
              previewUrl: "https://expired.example.com/old.png",
              resultUrls: ["https://expired.example.com/old.png"],
            },
            {
              id: "out-2",
              generationId: GENERATION_ID_2,
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
    mediaIdInMock,
    promptIdInMock,
    generationIdInMock,
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
            generationId: GENERATION_ID_1,
            promptId: PROMPT_ID_1,
            savedMediaIds: [MEDIA_ID_1, MEDIA_ID_1, "media-missing"],
          },
        ],
        archived: [
          {
            id: "out-2",
            generationId: "generation-missing",
            promptId: "prompt-missing",
            savedMediaIds: [MEDIA_ID_2],
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
              generationId: GENERATION_ID_1,
              promptId: PROMPT_ID_1,
              savedMediaIds: [MEDIA_ID_1],
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
      [
        expect.objectContaining({
          project_id: "project-1",
          media_file_id: MEDIA_ID_1,
          user_id: "user-1",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,media_file_id",
      })
    );
    expect(promptAssociationUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          project_id: "project-1",
          prompt_id: PROMPT_ID_1,
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
          generation_id: GENERATION_ID_1,
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
                generationId: GENERATION_ID_1,
                promptId: PROMPT_ID_1,
                savedMediaIds: [MEDIA_ID_1],
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
    expect(firstWorkspaceUpsertArg?.snapshot?.agentRuntimes).toBeDefined();
  });

  it("drops invalid association ids before owned-id resolution so autosave does not fail", async () => {
    const { workspaceUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    await expect(
      upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-invalid-associations",
          updatedAt: "2026-04-23T01:00:00.000Z",
          meta: {
            generatedAt: "2026-04-23T01:00:00.000Z",
            checksum: "fnv1a32:invalid-associations",
          },
          workspace: {
            selectedTool: "create",
            standardPrompt: "Project prompt",
          },
          outputs: {
            active: [
              {
                id: "out-library",
                mediaSource: "library",
                promptId: "prompt-stale-local",
                savedMediaIds: [MEDIA_ID_1, "media-stale-local"],
                previewUrl: "https://cdn.example.com/library.png",
                resultUrls: ["https://cdn.example.com/library.png"],
              },
              {
                id: "out-generated-stale",
                generationId: "gen-stale-project",
                previewUrl: "https://expired.example.com/generated.png",
                resultUrls: ["https://expired.example.com/generated.png"],
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
        status: "saved",
      },
      snapshot: {
        outputs: {
          active: [
            expect.objectContaining({
              id: "out-library",
              savedMediaIds: [MEDIA_ID_1],
            }),
          ],
          archived: [],
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
            id: "out-library",
            savedMediaIds: [MEDIA_ID_1],
          }),
        ],
        archived: [],
      },
    });
    expect(
      (
        ((
          firstWorkspaceUpsertArg?.snapshot?.outputs as {
            active?: Array<Record<string, unknown>>;
          }
        )?.active ?? []) as Array<Record<string, unknown>>
      )[0]
    ).not.toHaveProperty("promptId");
    expect(firstWorkspaceUpsertArg?.snapshot?.outputs).not.toMatchObject({
      active: [expect.objectContaining({ id: "out-generated-stale" })],
    });
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

  it("batches owned media id resolution for large project workspace saves", async () => {
    const largeMediaIds = Array.from(
      { length: 205 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    );
    const { mediaIdInMock, workspaceUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
      mediaRows: largeMediaIds.map((id) => ({ id })),
    });

    const result = await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-large-owned-media-batch",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:large-owned-media-batch",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Project prompt",
        },
        outputs: {
          active: [
            {
              id: "out-library-large",
              mediaSource: "library",
              savedMediaIds: largeMediaIds,
              previewUrl: "https://cdn.example.com/library-large.png",
              resultUrls: ["https://cdn.example.com/library-large.png"],
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
    });

    expect(result.saveOutcome).toEqual({ status: "saved" });
    expect(mediaIdInMock).toHaveBeenCalledTimes(3);
    expect(mediaIdInMock.mock.calls.map(([, ids]) => ids.length)).toEqual([100, 100, 5]);
    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(firstWorkspaceUpsertArg?.snapshot).toMatchObject({
      outputs: {
        active: [
          expect.objectContaining({
            id: "out-library-large",
            savedMediaIds: largeMediaIds,
          }),
        ],
      },
    });
  });

  it("batches owned prompt and generation resolution for large project workspace saves", async () => {
    const promptIds = Array.from(
      { length: 205 },
      (_, index) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    );
    const generationIds = Array.from(
      { length: 205 },
      (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    );
    const { promptIdInMock, generationIdInMock, workspaceUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });
    promptIdInMock.mockImplementation(async (_column: string, ids: string[]) => ({
      data: ids.map((id) => ({ id })),
      error: null,
    }));
    generationIdInMock.mockImplementation(async (_column: string, ids: string[]) => ({
      data: ids.map((id) => ({ id })),
      error: null,
    }));

    const result = await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-large-owned-prompt-generation-batch",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:large-owned-prompt-generation-batch",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Project prompt",
        },
        outputs: {
          active: generationIds.map((generationId, index) => ({
            id: `out-generated-${index + 1}`,
            generationId,
            promptId: promptIds[index],
            previewUrl: `https://cdn.example.com/generated-${index + 1}.png`,
            resultUrls: [`https://cdn.example.com/generated-${index + 1}.png`],
          })),
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
    });

    expect(result.saveOutcome).toEqual({ status: "saved" });
    expect(promptIdInMock).toHaveBeenCalledTimes(3);
    expect(promptIdInMock.mock.calls.map(([, ids]) => ids.length)).toEqual([100, 100, 5]);
    expect(generationIdInMock).toHaveBeenCalledTimes(6);
    expect(generationIdInMock.mock.calls.map(([, ids]) => ids.length)).toEqual([
      100, 100, 5, 100, 100, 5,
    ]);
    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(
      (firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: unknown[] })?.active
    ).toHaveLength(205);
  });

  it("strips out-of-scope preview storage paths before saving project workspace snapshots", async () => {
    const { workspaceUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-storage-scope-save",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:storage-scope-save",
        },
        workspace: {},
        outputs: {
          active: [
            {
              id: "out-1",
              mediaSource: "library",
              previewUrl: "https://cdn.example.com/library.png",
              resultUrls: ["https://cdn.example.com/library.png"],
              previewStoragePath: "user-2/generated/foreign-preview.png",
              fullStoragePath: "user-2/generated/foreign-full.png",
              previewPosterStoragePath: "user-2/generated/foreign-poster.png",
              savedMediaIds: [MEDIA_ID_1],
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
    });

    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    const savedRow = (
      ((firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: Array<Record<string, unknown>> })
        ?.active ?? []) as Array<Record<string, unknown>>
    )[0];

    expect(savedRow).toMatchObject({
      id: "out-1",
      savedMediaIds: [MEDIA_ID_1],
      previewUrl: "https://cdn.example.com/library.png",
      resultUrls: ["https://cdn.example.com/library.png"],
    });
    expect(savedRow).not.toHaveProperty("previewStoragePath");
    expect(savedRow).not.toHaveProperty("fullStoragePath");
    expect(savedRow).not.toHaveProperty("previewPosterStoragePath");
  });

  it("persists the sanitized snapshot without requiring projection hydration during save", async () => {
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
                  generationId: GENERATION_ID_1,
                  previewUrl: "https://expired.example.com/old.png",
                  resultUrls: ["https://expired.example.com/old.png"],
                  previewStoragePath: "user-1/generated/out-1-preview.png",
                  fullStoragePath: "user-1/generated/out-1-full.png",
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
                generationId: GENERATION_ID_1,
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
              generationId: GENERATION_ID_1,
            }),
          ],
        },
      });
      expect(
        (
          ((
            firstWorkspaceUpsertArg?.snapshot?.outputs as {
              active?: Array<Record<string, unknown>>;
            }
          )?.active ?? []) as Array<Record<string, unknown>>
        )[0]
      ).not.toHaveProperty("previewUrl");
      expect(
        (
          ((
            firstWorkspaceUpsertArg?.snapshot?.outputs as {
              active?: Array<Record<string, unknown>>;
            }
          )?.active ?? []) as Array<Record<string, unknown>>
        )[0]
      ).not.toHaveProperty("resultUrls");
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("persists the sanitized snapshot without requiring media delivery hydration during save", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseMock({
      mediaRowReadError: "media rows unavailable",
      projectionRows: [
        {
          generation_id: GENERATION_ID_1,
          request_id: "task-1",
          preview_url: "https://cdn.example.com/generated-video.mp4",
          result_urls: ["https://cdn.example.com/generated-video.mp4"],
          saved_media_ids: [MEDIA_VIDEO_ID_1],
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
          generation_id: GENERATION_ID_1,
          owned_media_file_id: MEDIA_VIDEO_ID_1,
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
                  generationId: GENERATION_ID_1,
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
                generationId: GENERATION_ID_1,
                mode: "video",
              }),
            ],
          },
        },
      });
      expect(warnSpy).not.toHaveBeenCalled();
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
                  savedMediaIds: [MEDIA_ID_1],
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
                savedMediaIds: [MEDIA_ID_1],
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
                    mediaId: MEDIA_ID_1,
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

  it("returns the sanitized saved snapshot without blocking on generated-output enrichment", async () => {
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
              generationId: GENERATION_ID_1,
              previewUrl: "https://expired.example.com/old.png",
              resultUrls: ["https://expired.example.com/old.png"],
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
    expect(result?.snapshot.agentRuntimes).toBeDefined();
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

  it("returns the shape-sanitized workspace when read-time ownership sanitization fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseMock({
      generationReadError: "generation ownership unavailable",
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
                generationId: GENERATION_ID_1,
              },
              {
                id: "out-2",
                generationId: GENERATION_ID_2,
              },
            ],
            archived: [],
          },
        },
      });
      expect(result?.snapshot.agentRuntimes).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] read sanitization failed; returning shape-sanitized snapshot",
        expect.objectContaining({
          projectId: "project-1",
          error: "generation ownership unavailable",
        })
      );
      expect(writeAppErrorLogMock).toHaveBeenCalledWith({
        source: "telemetry.ai_studio.project_workspace.read_sanitization_fallback",
        message:
          "Project workspace read fell back to the shape-sanitized snapshot after ownership sanitization failed.",
        userId: "user-1",
        statusCode: 200,
        metadata: {
          project_id: "project-1",
          fallback_stage: "read_sanitization",
          error: "generation ownership unavailable",
        },
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("strips out-of-scope preview storage paths from legacy workspace snapshots on read", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-storage-scope-read",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:storage-scope-read",
        },
        outputs: {
          active: [
            {
              id: "out-1",
              mediaSource: "library",
              previewUrl: "https://cdn.example.com/library.png",
              resultUrls: ["https://cdn.example.com/library.png"],
              previewStoragePath: "user-2/generated/foreign-preview.png",
              fullStoragePath: "user-2/generated/foreign-full.png",
              previewPosterStoragePath: "user-2/generated/foreign-poster.png",
              savedMediaIds: [MEDIA_ID_1],
              saveState: "saved",
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
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    const result = await getProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    const restoredRow = (
      ((result?.snapshot.outputs as { active?: Array<Record<string, unknown>> })?.active ??
        []) as Array<Record<string, unknown>>
    )[0];

    expect(restoredRow).toMatchObject({
      id: "out-1",
      mediaSource: "library",
      previewUrl: "https://cdn.example.com/library.png",
      resultUrls: ["https://cdn.example.com/library.png"],
      savedMediaIds: [MEDIA_ID_1],
      saveState: "saved",
    });
    expect(restoredRow).not.toHaveProperty("previewStoragePath");
    expect(restoredRow).not.toHaveProperty("fullStoragePath");
    expect(restoredRow).not.toHaveProperty("previewPosterStoragePath");
  });

  it("preserves settled non-generated refs while leaving generated delivery refresh async", async () => {
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
              generationId: GENERATION_ID_1,
              previewUrl: "https://expired.example.com/generated.png",
              resultUrls: ["https://expired.example.com/generated.png"],
            },
            {
              id: "library-1",
              mediaSource: "library",
              previewUrl: "https://cdn.example.com/library.png",
              resultUrls: ["https://cdn.example.com/library.png"],
              savedMediaIds: [MEDIA_ID_1],
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
          previewUrl: "https://expired.example.com/generated.png",
        }),
        expect.objectContaining({
          id: "library-1",
          mediaSource: "library",
          savedMediaIds: [MEDIA_ID_1],
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

  it("does not append project-associated generated outputs during workspace read", async () => {
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
      recentGenerationIds: [GENERATION_ID_2],
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

  it("does not use project-associated failed generations during workspace read", async () => {
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

  it("drops existing snapshot rows with malformed generation ids during workspace read", async () => {
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
