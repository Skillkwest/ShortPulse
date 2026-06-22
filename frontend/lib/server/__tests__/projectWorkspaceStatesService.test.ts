import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAiStudioProjectWorkspaceSnapshot } from "../../ai-studio-session/projectWorkspaceSnapshot";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { writeAppErrorLog } from "../api/appErrorLogs";
import { createLightweightProjectWorkspaceCheckpointSnapshot } from "../projectOutputDisplayItemsService";
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
const createTrustedSignedMediaUrl = (path: string) =>
  `https://project.supabase.co/${["storage", "v1", "object", "sign"].join("/")}/media_library/${path}?token=expired`;

const createCanonicalCheckpointSnapshot = (
  snapshot: Record<string, unknown>,
  checkpointRevision = 1
): Record<string, unknown> =>
  createLightweightProjectWorkspaceCheckpointSnapshot({
    snapshot: createAiStudioProjectWorkspaceSnapshot(
      snapshot as Record<string, unknown> & {
        schemaVersion: number;
        updatedAt: string;
      }
    ) as unknown as Record<string, unknown>,
    checkpointRevision,
  });

type SupabaseMockOptions = {
  workspaceSnapshot?: Record<string, unknown>;
  workspaceSnapshotUpdatedAt?: string;
  workspaceUpsertSnapshot?: Record<string, unknown>;
  workspaceUpsertSnapshotUpdatedAt?: string;
  associatedSnapshotGenerationIds?: string[];
  recentGenerationIds?: string[];
  generationRows?: Array<Record<string, unknown>>;
  projectionRows?: Array<Record<string, unknown>>;
  publicationRows?: Array<Record<string, unknown>>;
  mediaRows?: Array<Record<string, unknown>>;
  outputDisplayRows?: Array<Record<string, unknown>>;
  outputDisplayReadError?: string;
  outputDisplayUpsertError?: string;
  outputDisplayDeleteError?: string;
  projectionLimitError?: string;
  mediaAssociationError?: string;
  promptAssociationError?: string;
  generationAssociationError?: string;
  generationReadError?: string;
  publicationError?: string;
  mediaRowReadError?: string;
  workspaceUpsertError?: string | Record<string, unknown>;
};

const createSupabaseMock = ({
  workspaceSnapshot,
  workspaceSnapshotUpdatedAt,
  workspaceUpsertSnapshot,
  workspaceUpsertSnapshotUpdatedAt,
  associatedSnapshotGenerationIds = [GENERATION_ID_1],
  recentGenerationIds = [GENERATION_ID_1],
  generationRows = [
    {
      id: GENERATION_ID_1,
      request_id: "task-1",
    },
  ],
  projectionRows = [
    {
      generation_id: GENERATION_ID_1,
      request_id: "task-1",
      source_ref: "source-1",
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
  outputDisplayRows = [],
  outputDisplayReadError,
  outputDisplayUpsertError,
  outputDisplayDeleteError,
  projectionLimitError,
  mediaAssociationError,
  promptAssociationError,
  generationAssociationError,
  generationReadError,
  publicationError,
  mediaRowReadError,
  workspaceUpsertError,
}: SupabaseMockOptions = {}) => {
  const fallbackWorkspaceSnapshot = {
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
  } as Record<string, unknown>;
  const resolvedWorkspaceSnapshot = workspaceSnapshot ?? fallbackWorkspaceSnapshot;
  const resolvedWorkspaceSnapshotUpdatedAt =
    workspaceSnapshotUpdatedAt ??
    (typeof resolvedWorkspaceSnapshot.updatedAt === "string"
      ? resolvedWorkspaceSnapshot.updatedAt
      : "2026-04-23T01:00:00.000Z");
  const resolvedWorkspaceUpsertSnapshot = workspaceUpsertSnapshot ?? resolvedWorkspaceSnapshot;
  const resolvedWorkspaceUpsertSnapshotUpdatedAt =
    workspaceUpsertSnapshotUpdatedAt ??
    (typeof resolvedWorkspaceUpsertSnapshot.updatedAt === "string"
      ? resolvedWorkspaceUpsertSnapshot.updatedAt
      : resolvedWorkspaceSnapshotUpdatedAt);
  let mutableWorkspaceRow = {
    project_id: "project-1",
    user_id: "user-1",
    schema_version: 2,
    snapshot: resolvedWorkspaceSnapshot,
    snapshot_updated_at: resolvedWorkspaceSnapshotUpdatedAt,
    checkpoint_revision: 1,
    created_at: "2026-04-23T00:00:00.000Z",
    updated_at: "2026-04-23T01:00:00.000Z",
  };
  const mediaRowsById = new Map<string, Record<string, unknown>>(
    mediaRows
      .filter(
        (row): row is Record<string, unknown> & { id: string } =>
          typeof row.id === "string" && row.id.length > 0
      )
      .map((row) => [row.id, row])
  );
  let mutableOutputDisplayRows = outputDisplayRows.map((row) => ({ ...row }));
  const selectGenerationRows = (column: string, ids: string[]) => {
    const requestedIds = new Set(ids);
    return generationRows.filter((row) => {
      const record = row as Record<string, unknown>;
      const value = record[column];
      return typeof value === "string" && requestedIds.has(value);
    });
  };
  const selectProjectionRows = (column: string, ids: string[]) => {
    const requestedIds = new Set(ids);
    return projectionRows.filter((row) => {
      const record = row as Record<string, unknown>;
      const value = record[column];
      return typeof value === "string" && requestedIds.has(value);
    });
  };
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
      : selectGenerationRows(_column, ids).map((row) => ({ id: row.id })),
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
        data: selectProjectionRows(_column, ids),
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
    data: mutableWorkspaceRow,
    error: null,
  }));
  const workspaceReadSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: workspaceMaybeSingle,
      })),
    })),
  }));
  const workspaceUpsert = vi.fn((payload: Record<string, unknown>) => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data:
          workspaceUpsertError == null
            ? (() => {
                mutableWorkspaceRow = {
                  ...mutableWorkspaceRow,
                  schema_version:
                    typeof payload.schema_version === "number" ? payload.schema_version : 2,
                  snapshot:
                    payload.snapshot && typeof payload.snapshot === "object"
                      ? (payload.snapshot as Record<string, unknown>)
                      : resolvedWorkspaceUpsertSnapshot,
                  snapshot_updated_at:
                    typeof payload.snapshot_updated_at === "string"
                      ? payload.snapshot_updated_at
                      : resolvedWorkspaceUpsertSnapshotUpdatedAt,
                  checkpoint_revision:
                    typeof payload.checkpoint_revision === "number"
                      ? payload.checkpoint_revision
                      : 2,
                  updated_at:
                    typeof payload.updated_at === "string"
                      ? payload.updated_at
                      : mutableWorkspaceRow.updated_at,
                };
                return mutableWorkspaceRow;
              })()
            : null,
        error:
          workspaceUpsertError == null
            ? null
            : typeof workspaceUpsertError === "string"
              ? { message: workspaceUpsertError }
              : workspaceUpsertError,
      })),
    })),
  }));
  const outputDisplaySelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(async () => ({
        data: outputDisplayReadError ? null : mutableOutputDisplayRows,
        error: outputDisplayReadError ? { message: outputDisplayReadError } : null,
      })),
    })),
  }));
  const outputDisplayUpsert = vi.fn(async (rows: Record<string, unknown>[]) => {
    if (outputDisplayUpsertError) {
      return { error: { message: outputDisplayUpsertError } };
    }
    rows.forEach((row) => {
      const outputId = typeof row.output_id === "string" ? row.output_id : "";
      const index = mutableOutputDisplayRows.findIndex(
        (candidate) => candidate.output_id === outputId
      );
      if (index >= 0) {
        mutableOutputDisplayRows[index] = { ...mutableOutputDisplayRows[index], ...row };
      } else {
        mutableOutputDisplayRows.push({ ...row });
      }
    });
    return { error: null };
  });
  const outputDisplayDeleteIn = vi.fn(async (_column: string, ids: string[]) => {
    if (outputDisplayDeleteError) {
      return { error: { message: outputDisplayDeleteError } };
    }
    const idSet = new Set(ids);
    mutableOutputDisplayRows = mutableOutputDisplayRows.filter(
      (row) => !idSet.has(String(row.output_id))
    );
    return { error: null };
  });
  const outputDisplayDelete = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: outputDisplayDeleteIn,
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
      if (table === "project_output_display_items") {
        return {
          select: outputDisplaySelect,
          upsert: outputDisplayUpsert,
          delete: outputDisplayDelete,
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
    outputDisplayUpsert,
    outputDisplaySelect,
    outputDisplayDeleteIn,
    getOutputDisplayRows: () => mutableOutputDisplayRows.map((row) => ({ ...row })),
    getWorkspaceRow: () => ({ ...mutableWorkspaceRow }),
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

  it("persists right-rail layout changes in the lightweight project checkpoint when the timestamp is unchanged", async () => {
    const existingSnapshot = {
      schemaVersion: 2,
      sessionId: "session-right-rail",
      updatedAt: "2026-04-23T01:00:00.000Z",
      meta: {
        generatedAt: "2026-04-23T01:00:00.000Z",
        checksum: "fnv1a32:right-rail-existing",
      },
      workspace: {
        rightRailLayout: {
          schemaVersion: 1,
          panels: {
            canvas: false,
            quickSlot: true,
            referenceGrid: true,
          },
          splits: {
            canvasInventoryTopRatio: null,
            quickSlotReferenceTopRatio: null,
          },
        },
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
    };
    const { workspaceUpsert } = createSupabaseMock({
      workspaceSnapshot: createCanonicalCheckpointSnapshot(existingSnapshot),
      workspaceSnapshotUpdatedAt: "2026-04-23T01:00:00.000Z",
    });
    const nextRightRailLayout = {
      schemaVersion: 1,
      panels: {
        canvas: true,
        quickSlot: false,
        referenceGrid: true,
      },
      splits: {
        canvasInventoryTopRatio: 0.41,
        quickSlotReferenceTopRatio: 0.67,
      },
    };

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        ...existingSnapshot,
        updatedAt: existingSnapshot.updatedAt,
        workspace: {
          ...existingSnapshot.workspace,
          rightRailLayout: nextRightRailLayout,
        },
      },
    });

    expect(workspaceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          workspace: expect.objectContaining({
            rightRailLayout: nextRightRailLayout,
          }),
        }),
      }),
      expect.objectContaining({
        onConflict: "project_id",
      })
    );
  });

  it("backfills owned media and prompt ids from the workspace snapshot before saving", async () => {
    const {
      mediaAssociationUpsert,
      promptAssociationUpsert,
      generationAssociationUpsert,
      workspaceUpsert,
      outputDisplayUpsert,
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
              id: `generated:${GENERATION_ID_1}`,
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
      updatedAt: expect.any(String),
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
                id: `generated:${GENERATION_ID_1}`,
                generationId: GENERATION_ID_1,
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
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: `generated:${GENERATION_ID_1}`,
          generation_id: GENERATION_ID_1,
          prompt_id: PROMPT_ID_1,
          saved_media_ids: [MEDIA_ID_1],
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(firstWorkspaceUpsertArg?.snapshot?.agentRuntimes).toBeDefined();
  });

  it("drops invalid association ids before owned-id resolution so autosave does not fail", async () => {
    const { workspaceUpsert, outputDisplayUpsert } = createSupabaseMock({
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
            mediaSource: "library",
          }),
        ],
        archived: [],
      },
    });
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "out-library",
          saved_media_ids: [MEDIA_ID_1],
          preview_url_fallback: "https://cdn.example.com/library.png",
          result_urls_fallback: ["https://cdn.example.com/library.png"],
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
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

  it("returns the newer stored workspace unchanged when an older snapshot arrives late", async () => {
    const existingSnapshot = {
      schemaVersion: 2,
      sessionId: "session-existing",
      updatedAt: "2026-04-23T01:00:05.000Z",
      workspace: {
        mode: "image",
        selectedTool: "create",
        prompt: "",
        standardPrompt: "",
      },
      outputs: {
        active: [
          {
            id: "library-existing",
            savedMediaIds: [MEDIA_ID_1],
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
    };
    const {
      mediaAssociationUpsert,
      promptAssociationUpsert,
      generationAssociationUpsert,
      workspaceUpsert,
    } = createSupabaseMock({
      workspaceSnapshot: existingSnapshot,
      workspaceSnapshotUpdatedAt: "2026-04-23T01:00:05.000Z",
      workspaceUpsertSnapshot: existingSnapshot,
      workspaceUpsertSnapshotUpdatedAt: "2026-04-23T01:00:05.000Z",
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
          sessionId: "session-stale",
          updatedAt: "2026-04-23T01:00:00.000Z",
          workspace: {
            mode: "image",
            selectedTool: "create",
            prompt: "older prompt",
            standardPrompt: "older prompt",
          },
          outputs: {
            active: [
              {
                id: "library-stale",
                savedMediaIds: [MEDIA_ID_2],
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
        schemaVersion: 2,
        sessionId: "session-existing",
        updatedAt: "2026-04-23T01:00:05.000Z",
        outputs: {
          active: [
            expect.objectContaining({
              id: "library-existing",
            }),
          ],
        },
      },
      updatedAt: "2026-04-23T01:00:00.000Z",
    });

    expect(workspaceUpsert).not.toHaveBeenCalled();
    expect(mediaAssociationUpsert).not.toHaveBeenCalled();
    expect(promptAssociationUpsert).not.toHaveBeenCalled();
    expect(generationAssociationUpsert).not.toHaveBeenCalled();
  });

  it("preserves saved media-library quick-slot rows through workspace writes", async () => {
    const { workspaceUpsert, outputDisplayUpsert } = createSupabaseMock({
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
        sessionId: "session-library-quick-slot-save",
        updatedAt: "2026-06-01T18:00:00.000Z",
        meta: {
          generatedAt: "2026-06-01T18:00:00.000Z",
          checksum: "fnv1a32:library-quick-slot-save",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Project prompt",
        },
        outputs: {
          active: [
            {
              id: "library-quick-slot-1",
              mediaSource: "library",
              savedMediaIds: [MEDIA_ID_1],
              previewUrl: "https://cdn.example.com/library-quick-slot.png",
              resultUrls: ["https://cdn.example.com/library-quick-slot.png"],
              prompt: "Quick slot reference",
              status: "ready",
              mode: "image",
            },
          ],
          archived: [],
          activeOutputId: "library-quick-slot-1",
          curatedReferenceIds: ["library-quick-slot-1"],
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

    expect(result.snapshot.outputs).toMatchObject({
      active: [
        expect.objectContaining({
          id: "library-quick-slot-1",
          mediaSource: "library",
          savedMediaIds: [MEDIA_ID_1],
        }),
      ],
      archived: [],
      activeOutputId: null,
      curatedReferenceIds: ["library-quick-slot-1"],
      removedFromAllRefsIds: [],
    });

    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(firstWorkspaceUpsertArg?.snapshot?.outputs).toMatchObject({
      active: [
        expect.objectContaining({
          id: "library-quick-slot-1",
          mediaSource: "library",
        }),
      ],
      activeOutputId: null,
      curatedReferenceIds: ["library-quick-slot-1"],
    });
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "library-quick-slot-1",
          media_source: "library",
          saved_media_ids: [MEDIA_ID_1],
          display_prompt_summary: "Quick slot reference",
          status: "ready",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
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
          model: "eleven_v3",
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
              generationId: GENERATION_ID_1,
              taskState: " FAIL ",
              previewUrl: "https://expired.example.com/failed-active.png",
              resultUrls: ["https://expired.example.com/failed-active.png"],
              errorMessage: "Unknown error",
              errorMessageShort: "Unknown error",
            },
            {
              id: "out-failed-active",
              generationId: GENERATION_ID_2,
              taskState: "failed",
              previewUrl: "https://expired.example.com/failed-alias.png",
              resultUrls: ["https://expired.example.com/failed-alias.png"],
              errorMessage: "Provider failed",
              errorMessageShort: "Provider failed",
            },
            {
              id: "out-status-failed-active",
              previewUrl: "https://expired.example.com/status-failed.png",
              resultUrls: ["https://expired.example.com/status-failed.png"],
              status: " failed ",
              errorMessage: "Legacy status failure",
              errorMessageShort: "Legacy status failure",
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
    const { mediaIdInMock, workspaceUpsert, outputDisplayUpsert } = createSupabaseMock({
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
            mediaSource: "library",
          }),
        ],
      },
    });
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "out-library-large",
          saved_media_ids: largeMediaIds,
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
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
    expect(generationIdInMock).toHaveBeenCalledTimes(3);
    expect(generationIdInMock.mock.calls.map(([, ids]) => ids.length)).toEqual([100, 100, 5]);
    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(
      (firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: unknown[] })?.active
    ).toHaveLength(205);
  });

  it("stores pathological output-heavy projects as lightweight checkpoints", async () => {
    const { workspaceUpsert, outputDisplayUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });
    const activeOutputs = Array.from({ length: 600 }, (_, index) => ({
      id: `pathological-output-${index + 1}`,
      mode: "image",
      mediaSource: "library",
      prompt: `Pathological rich display prompt ${index + 1} ${"cinematic texture ".repeat(12)}`,
      previewUrl: `https://cdn.example.com/pathological-${index + 1}.png`,
      resultUrls: [`https://cdn.example.com/pathological-${index + 1}.png`],
      status: "ready",
      width: index === 0 ? 1024.8 : 1024,
      height: index === 0 ? 768.4 : 768,
      durationMs: index === 0 ? 333.9 : undefined,
    }));
    const snapshot = {
      schemaVersion: 2,
      sessionId: "session-pathological-lightweight-checkpoint",
      updatedAt: "2026-06-03T14:00:00.000Z",
      meta: {
        generatedAt: "2026-06-03T14:00:00.000Z",
        checksum: "fnv1a32:pathological-lightweight-checkpoint",
      },
      workspace: {
        selectedTool: "create",
      },
      outputs: {
        active: activeOutputs,
        archived: [],
        activeOutputId: "pathological-output-1",
        curatedReferenceIds: ["pathological-output-1", "pathological-output-2"],
        removedFromAllRefsIds: ["pathological-output-3"],
      },
      agent: {
        messages: [],
        input: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: false,
        pulseWorkflowSession: null,
      },
    };
    const originalBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot,
    });

    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    const storedCheckpoint = firstWorkspaceUpsertArg?.snapshot ?? {};
    const storedBytes = Buffer.byteLength(JSON.stringify(storedCheckpoint), "utf8");
    const storedActiveOutputs = ((
      storedCheckpoint.outputs as {
        active?: Array<Record<string, unknown>>;
      }
    )?.active ?? []) as Array<Record<string, unknown>>;

    expect(storedActiveOutputs).toHaveLength(600);
    expect(storedBytes).toBeLessThan(originalBytes * 0.3);
    expect(storedActiveOutputs[0]).toEqual({
      id: "pathological-output-1",
      mode: "image",
      mediaSource: "library",
    });
    expect(outputDisplayUpsert).toHaveBeenCalled();
    expect(outputDisplayUpsert.mock.calls[0]?.[0]?.[0]).toMatchObject({
      output_id: "pathological-output-1",
      width: 1024,
      height: 768,
      duration_ms: 333,
    });
  });

  it("retains quick-slot generated outputs when ownership is projection-backed during workspace save", async () => {
    const { generationAssociationUpsert, workspaceUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [GENERATION_ID_2],
      recentGenerationIds: [GENERATION_ID_2],
      projectionRows: [
        {
          generation_id: GENERATION_ID_2,
          request_id: "task-projection-only-1",
          preview_url: "https://cdn.example.com/projection-only.png",
          result_urls: ["https://cdn.example.com/projection-only.png"],
          preview_storage_path: "user-1/generated/projection-only-preview.png",
          full_storage_path: "user-1/generated/projection-only-full.png",
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Projection-only generated output",
          provider: "fal",
          model_id: "fal-ai/seedream",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
    });

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-projection-only-save",
        updatedAt: "2026-05-31T18:00:00.000Z",
        meta: {
          generatedAt: "2026-05-31T18:00:00.000Z",
          checksum: "fnv1a32:projection-only-save",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Projection-only project workspace",
        },
        outputs: {
          active: [
            {
              id: "out-projection-only-1",
              generationId: GENERATION_ID_2,
              mediaSource: "generated",
              previewUrl: "https://cdn.example.com/projection-only.png",
              resultUrls: ["https://cdn.example.com/projection-only.png"],
            },
          ],
          archived: [],
          activeOutputId: "out-projection-only-1",
          curatedReferenceIds: ["out-projection-only-1"],
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

    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(firstWorkspaceUpsertArg?.snapshot?.outputs).toMatchObject({
      active: [
        expect.objectContaining({
          id: `generated:${GENERATION_ID_2}`,
          generationId: GENERATION_ID_2,
        }),
      ],
      curatedReferenceIds: [`generated:${GENERATION_ID_2}`],
    });
    expect(generationAssociationUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          project_id: "project-1",
          generation_id: GENERATION_ID_2,
          user_id: "user-1",
        }),
      ],
      {
        onConflict: "project_id,generation_id",
      }
    );
  });

  it("reuses prewrite runtime-owned generation authority for project association backfill", async () => {
    const { generationAssociationUpsert, generationIdInMock } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      generationRows: [
        {
          id: GENERATION_ID_2,
          request_id: "task-runtime-owned-save-1",
        },
      ],
      projectionRows: [
        {
          generation_id: GENERATION_ID_2,
          request_id: "task-runtime-owned-save-1",
          source_ref: "source-runtime-owned-save-1",
          preview_url: "https://cdn.example.com/runtime-owned-save.png",
          result_urls: ["https://cdn.example.com/runtime-owned-save.png"],
          preview_storage_path: "user-1/generated/runtime-owned-save-preview.png",
          full_storage_path: "user-1/generated/runtime-owned-save-full.png",
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Runtime-owned generated output",
          provider: "fal",
          model_id: "fal-ai/seedream",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
    });

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-runtime-owned-save",
        updatedAt: "2026-06-02T22:10:00.000Z",
        meta: {
          generatedAt: "2026-06-02T22:10:00.000Z",
          checksum: "fnv1a32:runtime-owned-save",
        },
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "out-generated-runtime-owned-save",
              taskId: "task-runtime-owned-save-1",
              sourceRef: "source-runtime-owned-save-1",
              mediaSource: "generated",
              previewUrl: "https://cdn.example.com/runtime-owned-save.png",
              resultUrls: ["https://cdn.example.com/runtime-owned-save.png"],
            },
          ],
          archived: [],
          activeOutputId: "out-generated-runtime-owned-save",
          curatedReferenceIds: ["out-generated-runtime-owned-save"],
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

    expect(generationAssociationUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          project_id: "project-1",
          generation_id: GENERATION_ID_2,
          user_id: "user-1",
        }),
      ],
      {
        onConflict: "project_id,generation_id",
      }
    );
    expect(generationIdInMock).toHaveBeenCalledTimes(1);
    expect(generationIdInMock).toHaveBeenCalledWith("request_id", [
      "task-runtime-owned-save-1",
      "source-runtime-owned-save-1",
    ]);
  });

  it("preserves durable generated rows during workspace save even when generation ownership resolves unowned", async () => {
    const { generationAssociationUpsert, workspaceUpsert, outputDisplayUpsert } =
      createSupabaseMock({
        associatedSnapshotGenerationIds: [],
        recentGenerationIds: [],
        generationRows: [],
        projectionRows: [],
      });

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-durable-generated-save",
        updatedAt: "2026-05-31T20:15:00.000Z",
        meta: {
          generatedAt: "2026-05-31T20:15:00.000Z",
          checksum: "fnv1a32:durable-generated-save",
        },
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "out-durable-generated-1",
              generationId: GENERATION_ID_2,
              mediaSource: "generated",
              previewStoragePath: "user-1/generated/durable-generated-preview.png",
              fullStoragePath: "user-1/generated/durable-generated-full.png",
            },
          ],
          archived: [],
          activeOutputId: "out-durable-generated-1",
          curatedReferenceIds: ["out-durable-generated-1"],
          removedFromAllRefsIds: ["out-durable-generated-1"],
        },
        canvas: {
          scene: {
            items: [
              {
                id: "canvas-generated-1",
                kind: "image",
                x: 18,
                y: 24,
                z: 1,
                selected: false,
                outputId: "out-durable-generated-1",
                sourceSurface: "curated",
                src: "https://signed.shortpulse.test/generated.png",
                alt: "Durable generated image",
                width: 320,
                height: 180,
              },
            ],
          },
          viewports: {
            main: { x: 0, y: 0, zoom: 1 },
            rail: { x: 0, y: 0, zoom: 1 },
          },
          transient: {
            draftTextEntry: null,
            textEditSession: null,
            draftOwnerInstanceId: null,
            textEditOwnerInstanceId: null,
          },
          meta: {
            schemaVersion: 1,
            itemCount: 1,
            truncatedItemCount: 0,
            skippedNonDurableImageCount: 0,
          },
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
    expect(firstWorkspaceUpsertArg?.snapshot?.outputs).toMatchObject({
      active: [
        expect.objectContaining({
          id: `generated:${GENERATION_ID_2}`,
          mediaSource: "generated",
        }),
      ],
      activeOutputId: null,
      curatedReferenceIds: [`generated:${GENERATION_ID_2}`],
      removedFromAllRefsIds: [`generated:${GENERATION_ID_2}`],
    });
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: `generated:${GENERATION_ID_2}`,
          media_source: "generated",
          preview_storage_path: "user-1/generated/durable-generated-preview.png",
          full_storage_path: "user-1/generated/durable-generated-full.png",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
    expect(
      (firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: Array<Record<string, unknown>> })
        ?.active?.[0]
    ).not.toHaveProperty("generationId");
    expect(firstWorkspaceUpsertArg?.snapshot?.canvas).toMatchObject({
      scene: {
        items: [expect.objectContaining({ outputId: `generated:${GENERATION_ID_2}` })],
      },
    });
    expect(generationAssociationUpsert).not.toHaveBeenCalled();
  });

  it("strips foreign trusted direct preview URLs from generated rows before workspace save", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const { workspaceUpsert } = createSupabaseMock();
    const foreignSignedUrl =
      "https://project.supabase.co/storage/v1/object/sign/media_library/user-2/generated/foreign.png?token=test-token";

    try {
      await upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-foreign-generated-save",
          updatedAt: "2026-06-01T00:00:00.000Z",
          meta: {
            generatedAt: "2026-06-01T00:00:00.000Z",
            checksum: "fnv1a32:foreign-generated-save",
          },
          workspace: {
            selectedTool: "create",
            standardPrompt: "Foreign generated preview",
          },
          outputs: {
            active: [
              {
                id: "out-foreign-generated-save",
                generationId: GENERATION_ID_1,
                mediaSource: "generated",
                previewUrl: foreignSignedUrl,
                resultUrls: [foreignSignedUrl],
              },
            ],
            archived: [],
            activeOutputId: "out-foreign-generated-save",
            curatedReferenceIds: ["out-foreign-generated-save"],
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

      const firstWorkspaceUpsertArg = (
        workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
      ).at(0)?.[0];
      const savedRow = (
        ((firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: Array<Record<string, unknown>> })
          ?.active ?? []) as Array<Record<string, unknown>>
      )[0];

      expect(savedRow).toMatchObject({
        id: `generated:${GENERATION_ID_1}`,
        generationId: GENERATION_ID_1,
        mediaSource: "generated",
      });
      expect(savedRow).not.toHaveProperty("previewUrl");
      expect(savedRow).not.toHaveProperty("resultUrls");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("preserves companion-art-backed generated rows during workspace save", async () => {
    const { workspaceUpsert, outputDisplayUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      generationRows: [],
      projectionRows: [],
    });

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-companion-art-save",
        updatedAt: "2026-05-31T20:20:00.000Z",
        meta: {
          generatedAt: "2026-05-31T20:20:00.000Z",
          checksum: "fnv1a32:companion-art-save",
        },
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "out-companion-art-1",
              generationId: GENERATION_ID_2,
              mediaSource: "generated",
              companionArtStoragePath: "user-1/generated/companion-art-1.png",
            },
          ],
          archived: [],
          activeOutputId: "out-companion-art-1",
          curatedReferenceIds: ["out-companion-art-1"],
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

    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(firstWorkspaceUpsertArg?.snapshot?.outputs).toMatchObject({
      active: [
        expect.objectContaining({
          id: `generated:${GENERATION_ID_2}`,
          mediaSource: "generated",
        }),
      ],
      activeOutputId: null,
      curatedReferenceIds: [`generated:${GENERATION_ID_2}`],
    });
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: `generated:${GENERATION_ID_2}`,
          media_source: "generated",
          companion_art_storage_path: "user-1/generated/companion-art-1.png",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
  });

  it("preserves durable canvas content while stripping transient canvas state during workspace save", async () => {
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
        sessionId: "session-canvas-save",
        updatedAt: "2026-05-31T19:00:00.000Z",
        meta: {
          generatedAt: "2026-05-31T19:00:00.000Z",
          checksum: "fnv1a32:canvas-save",
        },
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "library-1",
              mediaSource: "library",
              previewUrl: "https://cdn.example.com/library.png",
              resultUrls: ["https://cdn.example.com/library.png"],
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
        canvas: {
          scene: {
            items: [
              {
                id: "canvas-image-1",
                kind: "image",
                x: 12,
                y: 24,
                z: 1,
                selected: true,
                outputId: "library-1",
                sourceSurface: "curated",
                mediaId: MEDIA_ID_1,
                src: "https://signed.shortpulse.test/library.png",
                alt: "Library image",
                width: 320,
                height: 180,
              },
            ],
          },
          viewports: {
            main: { x: 3, y: 4, zoom: 1.2 },
            rail: { x: -2, y: 5, zoom: 0.8 },
          },
          transient: {
            draftTextEntry: { x: 10, y: 20, value: "draft" },
            textEditSession: null,
            draftOwnerInstanceId: "main",
            textEditOwnerInstanceId: null,
          },
          meta: {
            schemaVersion: 1,
            itemCount: 1,
            truncatedItemCount: 0,
            skippedNonDurableImageCount: 0,
          },
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
    expect(firstWorkspaceUpsertArg?.snapshot?.canvas).toMatchObject({
      scene: {
        items: [
          expect.objectContaining({
            id: "canvas-image-1",
            selected: false,
            outputId: "library-1",
            mediaId: MEDIA_ID_1,
            src: "https://signed.shortpulse.test/library.png",
          }),
        ],
      },
      transient: {
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
      },
      viewports: {
        main: { x: 3, y: 4, zoom: 1.2 },
        rail: { x: -2, y: 5, zoom: 0.8 },
      },
    });
  });

  it("recovers owned canvas storage paths from trusted media URLs before workspace save", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const { workspaceUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    try {
      await upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-canvas-signed-url-save",
          updatedAt: "2026-05-31T19:10:00.000Z",
          meta: {
            generatedAt: "2026-05-31T19:10:00.000Z",
            checksum: "fnv1a32:canvas-signed-url-save",
          },
          workspace: {},
          outputs: {
            active: [],
            archived: [],
          },
          canvas: {
            scene: {
              items: [
                {
                  id: "canvas-image-legacy",
                  kind: "image",
                  x: 0,
                  y: 0,
                  z: 1,
                  selected: false,
                  outputId: "out-missing-image",
                  sourceSurface: "all-refs",
                  mediaId: null,
                  src: createTrustedSignedMediaUrl("user-1/generations/images/legacy.png"),
                  alt: "Legacy image",
                  width: 320,
                  height: 180,
                },
                {
                  id: "canvas-video-legacy",
                  kind: "video",
                  x: 10,
                  y: 12,
                  z: 2,
                  selected: false,
                  outputId: "out-missing-video",
                  sourceSurface: "all-refs",
                  mediaId: null,
                  videoUrl: createTrustedSignedMediaUrl("user-1/generations/videos/legacy.mp4"),
                  posterUrl: createTrustedSignedMediaUrl(
                    "user-1/variants/videos/legacy/poster_720.jpg"
                  ),
                  title: "Legacy video",
                  durationMs: 1000,
                  width: 320,
                  height: 180,
                },
              ],
            },
            viewports: {
              main: { x: 0, y: 0, zoom: 1 },
              rail: { x: 0, y: 0, zoom: 1 },
            },
            transient: {
              draftTextEntry: null,
              textEditSession: null,
              draftOwnerInstanceId: null,
              textEditOwnerInstanceId: null,
            },
            meta: {
              schemaVersion: 1,
              itemCount: 2,
              truncatedItemCount: 0,
              skippedNonDurableImageCount: 0,
            },
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
    } finally {
      vi.unstubAllEnvs();
    }

    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(firstWorkspaceUpsertArg?.snapshot?.canvas).toMatchObject({
      scene: {
        items: [
          expect.objectContaining({
            id: "canvas-image-legacy",
            outputId: "out-missing-image",
            srcStoragePath: "user-1/generations/images/legacy.png",
          }),
          expect.objectContaining({
            id: "canvas-video-legacy",
            outputId: "out-missing-video",
            videoStoragePath: "user-1/generations/videos/legacy.mp4",
            posterStoragePath: "user-1/variants/videos/legacy/poster_720.jpg",
          }),
        ],
      },
    });
  });

  it("does not recover canvas storage paths from foreign or render-image media URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const { workspaceUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    try {
      await upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-canvas-foreign-signed-url-save",
          updatedAt: "2026-05-31T19:20:00.000Z",
          meta: {
            generatedAt: "2026-05-31T19:20:00.000Z",
            checksum: "fnv1a32:canvas-foreign-signed-url-save",
          },
          workspace: {},
          outputs: {
            active: [],
            archived: [],
          },
          canvas: {
            scene: {
              items: [
                {
                  id: "canvas-image-foreign",
                  kind: "image",
                  x: 0,
                  y: 0,
                  z: 1,
                  selected: false,
                  outputId: "out-foreign-image",
                  sourceSurface: "all-refs",
                  mediaId: null,
                  src: createTrustedSignedMediaUrl("user-2/generations/images/foreign.png"),
                  alt: "Foreign image",
                  width: 320,
                  height: 180,
                },
                {
                  id: "canvas-image-render",
                  kind: "image",
                  x: 0,
                  y: 0,
                  z: 2,
                  selected: false,
                  outputId: "out-render-image",
                  sourceSurface: "all-refs",
                  mediaId: null,
                  src: "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/generations/images/render.png?token=expired&width=320",
                  alt: "Render image",
                  width: 320,
                  height: 180,
                },
              ],
            },
            viewports: {
              main: { x: 0, y: 0, zoom: 1 },
              rail: { x: 0, y: 0, zoom: 1 },
            },
            transient: {
              draftTextEntry: null,
              textEditSession: null,
              draftOwnerInstanceId: null,
              textEditOwnerInstanceId: null,
            },
            meta: {
              schemaVersion: 1,
              itemCount: 2,
              truncatedItemCount: 0,
              skippedNonDurableImageCount: 0,
            },
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
    } finally {
      vi.unstubAllEnvs();
    }

    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    const savedCanvasItems = ((
      firstWorkspaceUpsertArg?.snapshot?.canvas as { scene?: { items?: unknown[] } }
    )?.scene?.items ?? []) as Array<Record<string, unknown>>;

    expect(savedCanvasItems).toHaveLength(2);
    expect(savedCanvasItems[0]?.srcStoragePath).toBeNull();
    expect(savedCanvasItems[1]?.srcStoragePath).toBeNull();
  });

  it("strips out-of-scope preview storage paths before saving project workspace snapshots", async () => {
    const { workspaceUpsert, outputDisplayUpsert } = createSupabaseMock({
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
      mediaSource: "library",
    });
    expect(savedRow).not.toHaveProperty("previewStoragePath");
    expect(savedRow).not.toHaveProperty("fullStoragePath");
    expect(savedRow).not.toHaveProperty("previewPosterStoragePath");
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "out-1",
          saved_media_ids: [MEDIA_ID_1],
          preview_url_fallback: "https://cdn.example.com/library.png",
          result_urls_fallback: ["https://cdn.example.com/library.png"],
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
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
                id: `generated:${GENERATION_ID_1}`,
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
              id: `generated:${GENERATION_ID_1}`,
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
                id: `generated:${GENERATION_ID_1}`,
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

  it("preserves Supabase plain-object workspace upsert errors for actionable diagnostics", async () => {
    createSupabaseMock({
      workspaceUpsertError: {
        message: "duplicate key value violates unique constraint",
        details: "Key (project_id) already exists.",
        code: "23505",
      },
    });

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
            checksum: "fnv1a32:plain-error",
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
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
        },
      })
    ).rejects.toThrow(
      "Project workspace save failed during workspace upsert: duplicate key value violates unique constraint Key (project_id) already exists. 23505"
    );
  });

  it("returns repair-pending save outcomes when save-side generation authority resolution degrades", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { workspaceUpsert } = createSupabaseMock({
      generationReadError: "upstream request timeout",
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
              checksum: "fnv1a32:authority-degraded",
            },
            workspace: {
              selectedTool: "create",
              standardPrompt: "Project prompt",
            },
            outputs: {
              active: [
                {
                  id: `generated:${GENERATION_ID_1}`,
                  generationId: GENERATION_ID_1,
                  taskId: "task-1",
                  sourceRef: "source-1",
                  mode: "image",
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
          repairStage: "owned_id_resolution",
          repairMessage:
            "Project workspace save failed during owned id resolution: upstream request timeout",
        },
      });

      expect(workspaceUpsert).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] best-effort save stage failed; persisting sanitized snapshot",
        expect.objectContaining({
          projectId: "project-1",
          stage: "owned id resolution",
          error:
            "Project workspace save failed during owned id resolution: upstream request timeout",
        })
      );
      expect(writeAppErrorLogMock).toHaveBeenCalledWith({
        source: "telemetry.ai_studio.project_workspace.repair_pending",
        message: "Project workspace save completed, but follow-up project repair is still pending.",
        userId: "user-1",
        statusCode: 200,
        metadata: {
          project_id: "project-1",
          repair_stage: "owned_id_resolution",
          save_outcome: "saved_with_repair_pending",
          repair_message:
            "Project workspace save failed during owned id resolution: upstream request timeout",
        },
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns repair-pending save outcomes when output display sync fails after the checkpoint write", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { workspaceUpsert, outputDisplayUpsert } = createSupabaseMock({
      outputDisplayUpsertError: "invalid input syntax for type integer",
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
              checksum: "fnv1a32:display-sync-failure",
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
                  prompt: "Display prompt",
                  width: 1024.8,
                  height: 768.4,
                  durationMs: 333.9,
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
          repairStage: "project_output_display_sync",
          repairMessage:
            "Project workspace save failed during project output display sync: invalid input syntax for type integer",
        },
      });

      expect(workspaceUpsert).toHaveBeenCalledTimes(1);
      expect(outputDisplayUpsert).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] best-effort save stage failed; persisting sanitized snapshot",
        expect.objectContaining({
          projectId: "project-1",
          stage: "project output display sync",
          error: "invalid input syntax for type integer",
        })
      );
      expect(writeAppErrorLogMock).toHaveBeenCalledWith({
        source: "telemetry.ai_studio.project_workspace.repair_pending",
        message: "Project workspace save completed, but follow-up project repair is still pending.",
        userId: "user-1",
        statusCode: 200,
        metadata: {
          project_id: "project-1",
          repair_stage: "project_output_display_sync",
          save_outcome: "saved_with_repair_pending",
          repair_message:
            "Project workspace save failed during project output display sync: invalid input syntax for type integer",
        },
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not fail the workspace save response when output display materialization is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { workspaceUpsert } = createSupabaseMock({
      outputDisplayReadError: "relation public.project_output_display_items does not exist",
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    try {
      await expect(
        upsertProjectWorkspaceStateForUser({
          userId: "user-1",
          projectId: "project-1",
          schemaVersion: 2,
          snapshot: {
            schemaVersion: 2,
            sessionId: "session-display-materialization-fallback-save",
            updatedAt: "2026-04-23T01:00:00.000Z",
            meta: {
              generatedAt: "2026-04-23T01:00:00.000Z",
              checksum: "fnv1a32:display-materialization-fallback-save",
            },
            workspace: {
              selectedTool: "create",
              standardPrompt: "Project prompt",
            },
            outputs: {
              active: [
                {
                  id: "library-display-fallback-save",
                  mediaSource: "library",
                  mode: "image",
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
          repairStage: "project_output_display_sync",
          repairMessage: expect.stringContaining(
            "relation public.project_output_display_items does not exist"
          ),
        },
        snapshot: {
          outputs: {
            active: [
              expect.objectContaining({
                id: "library-display-fallback-save",
              }),
            ],
          },
        },
      });

      expect(workspaceUpsert).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] output display materialization skipped",
        expect.objectContaining({
          projectId: "project-1",
          stage: "workspace save",
          error: "relation public.project_output_display_items does not exist",
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("skips save-response snapshot materialization for minimal project workspace saves", async () => {
    const { outputDisplaySelect, workspaceUpsert } = createSupabaseMock();

    const result = await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      includeSnapshotInResponse: false,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-minimal-save-response",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:minimal-save-response",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Project prompt",
        },
        outputs: {
          active: [
            {
              id: "library-minimal-save-response",
              mediaSource: "library",
              mode: "image",
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

    expect(result.saveOutcome).toEqual({ status: "saved" });
    expect(workspaceUpsert).toHaveBeenCalledTimes(1);
    expect(outputDisplaySelect).toHaveBeenCalledTimes(2);
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
              id: `generated:${GENERATION_ID_1}`,
              generationId: GENERATION_ID_1,
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

  it("does not fail workspace reads when output display materialization is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseMock({
      outputDisplayReadError: "relation public.project_output_display_items does not exist",
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-display-materialization-fallback-read",
        updatedAt: "2026-06-03T12:00:00.000Z",
        meta: {
          generatedAt: "2026-06-03T12:00:00.000Z",
          checkpointRevision: 4,
        },
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "display-fallback-read",
              mode: "image",
              mediaSource: "library",
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: "display-fallback-read",
          curatedReferenceIds: ["display-fallback-read"],
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

    try {
      await expect(
        getProjectWorkspaceStateForUser({
          userId: "user-1",
          projectId: "project-1",
        })
      ).resolves.toMatchObject({
        projectId: "project-1",
        userId: "user-1",
        snapshot: {
          outputs: {
            active: [
              expect.objectContaining({
                id: "display-fallback-read",
              }),
            ],
            activeOutputId: null,
            curatedReferenceIds: ["display-fallback-read"],
          },
        },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] output display materialization skipped",
        expect.objectContaining({
          projectId: "project-1",
          stage: "workspace read",
          error: "relation public.project_output_display_items does not exist",
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("materializes lightweight checkpoint outputs from display records on workspace read", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-lightweight-read",
        updatedAt: "2026-06-03T12:00:00.000Z",
        meta: {
          generatedAt: "2026-06-03T12:00:00.000Z",
          checkpointRevision: 4,
        },
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "display-1",
              mode: "image",
              mediaSource: "library",
            },
          ],
          archived: [],
          activeOutputId: "display-1",
          curatedReferenceIds: ["display-1"],
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
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "display-1",
          version: 3,
          source_snapshot_updated_at: "2026-06-03T12:00:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: "2026-06-03T11:55:00.000Z",
          generation_id: null,
          prompt_id: PROMPT_ID_1,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: "A materialized display row",
          display_title: "Display Title",
          display_prompt_summary: "Display prompt",
          mime_type: "image/png",
          width: 1024,
          height: 768,
          duration_ms: null,
          preview_storage_path: "user-1/generated/display-preview.png",
          full_storage_path: "user-1/generated/display-full.png",
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://cdn.example.com/display-preview.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://cdn.example.com/display-preview.png"],
          saved_media_ids: [MEDIA_ID_1],
          task_state: "success",
          queue_state: null,
          save_state: "saved",
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-06-03T12:00:01.000Z",
        },
      ],
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    await expect(
      getProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
      })
    ).resolves.toMatchObject({
      checkpointRevision: 1,
      snapshot: {
        outputs: {
          active: [
            expect.objectContaining({
              id: "display-1",
              mediaSource: "library",
              promptId: PROMPT_ID_1,
              previewStoragePath: "user-1/generated/display-preview.png",
              fullStoragePath: "user-1/generated/display-full.png",
              savedMediaIds: [MEDIA_ID_1],
              title: "Display Title",
              prompt: "Display prompt",
            }),
          ],
          curatedReferenceIds: ["display-1"],
        },
      },
    });
  });

  it("repairs materialized generated display rows from durable projection authority on workspace read", async () => {
    const { generationIdInMock } = createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-generated-display-convergence",
        updatedAt: "2026-06-03T12:00:00.000Z",
        meta: {
          generatedAt: "2026-06-03T12:00:00.000Z",
          checkpointRevision: 5,
        },
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "generated-display-1",
              mode: "image",
              mediaSource: "generated",
              generationId: GENERATION_ID_2,
            },
            {
              id: "library-display-1",
              mode: "image",
              mediaSource: "library",
            },
          ],
          archived: [],
          activeOutputId: "generated-display-1",
          curatedReferenceIds: ["generated-display-1", "library-display-1"],
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
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "generated-display-1",
          version: 2,
          source_snapshot_updated_at: "2026-06-03T12:00:00.000Z",
          mode: "image",
          media_source: "generated",
          created_at: "2026-06-03T11:55:00.000Z",
          generation_id: GENERATION_ID_2,
          prompt_id: null,
          task_id: "task-generated-display-1",
          source_ref: "source-generated-display-1",
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: null,
          mime_type: "image/png",
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://expired.example.com/generated-display.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://expired.example.com/generated-display.png"],
          saved_media_ids: [],
          task_state: "success",
          queue_state: "dispatched",
          save_state: "idle",
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-06-03T12:00:01.000Z",
        },
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "library-display-1",
          version: 2,
          source_snapshot_updated_at: "2026-06-03T12:00:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: "2026-06-03T11:56:00.000Z",
          generation_id: null,
          prompt_id: null,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: "Library row",
          display_prompt_summary: "Library prompt",
          mime_type: "image/png",
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: "user-1/generated/library-display-preview.png",
          full_storage_path: "user-1/generated/library-display-full.png",
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://cdn.example.com/library-display.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://cdn.example.com/library-display.png"],
          saved_media_ids: [MEDIA_ID_1],
          task_state: "success",
          queue_state: null,
          save_state: "saved",
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-06-03T12:00:01.000Z",
        },
      ],
      associatedSnapshotGenerationIds: [GENERATION_ID_2],
      recentGenerationIds: [],
      generationRows: [
        {
          id: GENERATION_ID_2,
          request_id: "task-generated-display-1",
        },
      ],
      projectionRows: [
        {
          generation_id: GENERATION_ID_2,
          request_id: "task-generated-display-1",
          source_ref: "source-generated-display-1",
          preview_url: "https://cdn.example.com/generated-display-preview.png",
          result_urls: ["https://cdn.example.com/generated-display-full.png"],
          preview_storage_path: "user-1/generated/generated-display-preview.png",
          full_storage_path: "user-1/generated/generated-display-full.png",
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Projection repaired generated output",
          provider: "fal",
          model_id: "fal-ai/seedream",
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
      active: [
        expect.objectContaining({
          id: `generated:${GENERATION_ID_2}`,
          generationId: GENERATION_ID_2,
          previewStoragePath: "user-1/generated/generated-display-preview.png",
          fullStoragePath: "user-1/generated/generated-display-full.png",
        }),
        expect.objectContaining({
          id: "library-display-1",
          mediaSource: "library",
          savedMediaIds: [MEDIA_ID_1],
        }),
      ],
      curatedReferenceIds: [`generated:${GENERATION_ID_2}`, "library-display-1"],
    });
    // One read canonicalization pass resolves both generation ids and runtime request ids.
    // A second post-convergence canonicalization would repeat these low-level ownership reads.
    expect(generationIdInMock).toHaveBeenCalledTimes(2);
  });

  it("restores generated output metadata from projection while preserving durable display rows", async () => {
    const generationReplay = {
      version: 2,
      mode: "image",
      submitTool: "create",
      modelId: "fal-ai/seedream",
      displayPrompt: "Durable display row prompt restored from projection",
      submissionPrompt: "Durable display row prompt restored from projection",
      aspect: "16:9",
      imageResolution: "2K",
      referenceInputs: [],
      internalMediaRefs: [],
      capturedAt: "2026-06-03T12:00:00.000Z",
    };
    const workflowReload = {
      version: 1,
      source: "ai_studio_generation",
      restoreBehavior: "navigate_and_hydrate",
      originTool: "create",
      panelKind: "create",
    };
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-durable-display-metadata",
        updatedAt: "2026-06-03T12:00:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "generated-display-durable-1",
              mode: "image",
              mediaSource: "generated",
              generationId: GENERATION_ID_2,
            },
          ],
          archived: [],
          activeOutputId: "generated-display-durable-1",
          curatedReferenceIds: ["generated-display-durable-1"],
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
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "generated-display-durable-1",
          version: 2,
          source_snapshot_updated_at: "2026-06-03T12:00:00.000Z",
          mode: "image",
          media_source: "generated",
          created_at: "2026-06-03T11:55:00.000Z",
          generation_id: GENERATION_ID_2,
          prompt_id: null,
          task_id: "task-generated-display-durable-1",
          source_ref: "source-generated-display-durable-1",
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: null,
          mime_type: "image/png",
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: "user-1/generated/existing-display-preview.png",
          full_storage_path: "user-1/generated/existing-display-full.png",
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://expired.example.com/generated-display-preview.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://expired.example.com/generated-display-full.png"],
          saved_media_ids: [MEDIA_ID_1],
          task_state: "success",
          queue_state: "dispatched",
          save_state: "saved",
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-06-03T12:00:01.000Z",
        },
      ],
      associatedSnapshotGenerationIds: [GENERATION_ID_2],
      recentGenerationIds: [],
      generationRows: [
        {
          id: GENERATION_ID_2,
          request_id: "task-generated-display-durable-1",
        },
      ],
      projectionRows: [
        {
          generation_id: GENERATION_ID_2,
          request_id: "task-generated-display-durable-1",
          source_ref: "source-generated-display-durable-1",
          preview_url: "https://cdn.example.com/generated-display-preview.png",
          result_urls: ["https://cdn.example.com/generated-display-full.png"],
          preview_storage_path: "user-1/generated/projection-display-preview.png",
          full_storage_path: "user-1/generated/projection-display-full.png",
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: generationReplay.displayPrompt,
          provider: "fal",
          model_id: "fal-ai/seedream",
          generation_replay: generationReplay,
          workflow_reload: workflowReload,
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
      active: [
        expect.objectContaining({
          id: `generated:${GENERATION_ID_2}`,
          generationId: GENERATION_ID_2,
          prompt: generationReplay.displayPrompt,
          modelId: "fal-ai/seedream",
          aspect: "16:9",
          generationReplay,
          workflowReload,
          previewStoragePath: "user-1/generated/existing-display-preview.png",
          fullStoragePath: "user-1/generated/existing-display-full.png",
        }),
      ],
      curatedReferenceIds: [`generated:${GENERATION_ID_2}`],
    });
  });

  it("repairs audio companion art from projection while preserving durable display rows on workspace read", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-audio-companion-art-read",
        updatedAt: "2026-06-03T12:00:00.000Z",
        workspace: {
          selectedTool: "sound",
        },
        outputs: {
          active: [
            {
              id: "generated-audio-display-1",
              mode: "audio",
              mediaSource: "generated",
              generationId: GENERATION_ID_2,
            },
          ],
          archived: [],
          activeOutputId: "generated-audio-display-1",
          curatedReferenceIds: ["generated-audio-display-1"],
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
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "generated-audio-display-1",
          version: 2,
          source_snapshot_updated_at: "2026-06-03T12:00:00.000Z",
          mode: "audio",
          media_source: "generated",
          created_at: "2026-06-03T11:55:00.000Z",
          generation_id: GENERATION_ID_2,
          prompt_id: null,
          task_id: "task-generated-audio-display-1",
          source_ref: "source-generated-audio-display-1",
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: null,
          mime_type: "audio/mpeg",
          width: null,
          height: null,
          duration_ms: 24000,
          preview_storage_path: "user-1/generations/audio/audio-display.mp3",
          full_storage_path: "user-1/generations/audio/audio-display.mp3",
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://expired.example.com/audio-display.mp3",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://expired.example.com/audio-display.mp3"],
          saved_media_ids: [MEDIA_ID_1],
          task_state: "success",
          queue_state: "dispatched",
          save_state: "saved",
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-06-03T12:00:01.000Z",
        },
      ],
      associatedSnapshotGenerationIds: [GENERATION_ID_2],
      recentGenerationIds: [],
      generationRows: [
        {
          id: GENERATION_ID_2,
          request_id: "task-generated-audio-display-1",
        },
      ],
      projectionRows: [
        {
          generation_id: GENERATION_ID_2,
          request_id: "task-generated-audio-display-1",
          source_ref: "source-generated-audio-display-1",
          preview_url: "https://cdn.example.com/audio-display.mp3",
          result_urls: ["https://cdn.example.com/audio-display.mp3"],
          preview_storage_path: "user-1/generations/audio/audio-display.mp3",
          full_storage_path: "user-1/generations/audio/audio-display.mp3",
          companion_art_status: "ready",
          companion_art_storage_path:
            "user-1/generations/audio/audio-display/companion-art/cover.webp",
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Audio display row prompt",
          provider: "elevenlabs",
          model_id: "elevenlabs/music",
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
      active: [
        expect.objectContaining({
          id: `generated:${GENERATION_ID_2}`,
          generationId: GENERATION_ID_2,
          mode: "audio",
          previewStoragePath: "user-1/generations/audio/audio-display.mp3",
          fullStoragePath: "user-1/generations/audio/audio-display.mp3",
          companionArtStatus: "ready",
          companionArtStoragePath:
            "user-1/generations/audio/audio-display/companion-art/cover.webp",
        }),
      ],
      curatedReferenceIds: [`generated:${GENERATION_ID_2}`],
    });
  });

  it("does not overwrite newer display rows when an older compatibility snapshot arrives", async () => {
    const { outputDisplayUpsert } = createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-stale-display",
        updatedAt: "2026-06-03T12:00:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "stale-display-1",
              mode: "image",
              mediaSource: "library",
            },
          ],
          archived: [],
          activeOutputId: "stale-display-1",
          curatedReferenceIds: ["stale-display-1"],
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
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "stale-display-1",
          version: 7,
          source_snapshot_updated_at: "2026-06-03T12:05:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: null,
          generation_id: null,
          prompt_id: null,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: "Newer prompt",
          mime_type: null,
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://cdn.example.com/newer.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://cdn.example.com/newer.png"],
          saved_media_ids: [MEDIA_ID_2],
          task_state: "success",
          queue_state: null,
          save_state: "saved",
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-06-03T12:05:01.000Z",
        },
      ],
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
          sessionId: "session-stale-display",
          updatedAt: "2026-06-03T12:00:00.000Z",
          workspace: {
            selectedTool: "create",
          },
          outputs: {
            active: [
              {
                id: "stale-display-1",
                mode: "image",
                mediaSource: "library",
                prompt: "Older prompt",
                previewUrl: "https://cdn.example.com/older.png",
                resultUrls: ["https://cdn.example.com/older.png"],
                savedMediaIds: [MEDIA_ID_1],
              },
            ],
            archived: [],
            activeOutputId: "stale-display-1",
            curatedReferenceIds: ["stale-display-1"],
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
      })
    ).resolves.toMatchObject({
      snapshot: {
        outputs: {
          active: [
            expect.objectContaining({
              id: "stale-display-1",
              prompt: "Newer prompt",
              previewUrl: "https://cdn.example.com/newer.png",
              savedMediaIds: [MEDIA_ID_2],
            }),
          ],
        },
      },
    });
    expect(outputDisplayUpsert).not.toHaveBeenCalled();
  });

  it("normalizes invalid typed display values before writing output display rows", async () => {
    const { outputDisplayUpsert } = createSupabaseMock({
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
        sessionId: "session-invalid-display-types",
        updatedAt: "2026-06-03T13:00:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "invalid-display-types-1",
              mode: "image",
              mediaSource: "library",
              createdAt: "not-a-date",
              promptId: "not-a-uuid",
              savedMediaIds: [MEDIA_ID_1],
              previewStoragePath: "user-1/generated/invalid-display-types-preview.png",
              fullStoragePath: "user-1/generated/invalid-display-types-full.png",
              prompt: "Invalid display types should not break autosave.",
            },
          ],
          archived: [],
          activeOutputId: "invalid-display-types-1",
          curatedReferenceIds: ["invalid-display-types-1"],
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

    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "invalid-display-types-1",
          created_at: null,
          generation_id: null,
          prompt_id: null,
          saved_media_ids: [MEDIA_ID_1],
        }),
      ],
      {
        onConflict: "project_id,output_id",
      }
    );
  });

  it("touches workspace freshness without rewriting unchanged display rows", async () => {
    const existingCheckpointSnapshot = createCanonicalCheckpointSnapshot({
      schemaVersion: 2,
      sessionId: "session-display-touch",
      updatedAt: "2026-06-03T12:00:00.000Z",
      workspace: {
        selectedTool: "create",
      },
      outputs: {
        active: [
          {
            id: "display-touch-1",
            mode: "image",
            mediaSource: "library",
            prompt: "Stable prompt",
            previewUrl: "https://cdn.example.com/stable.png",
            resultUrls: ["https://cdn.example.com/stable.png"],
            savedMediaIds: [MEDIA_ID_1],
          },
        ],
        archived: [],
        activeOutputId: "display-touch-1",
        curatedReferenceIds: ["display-touch-1"],
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
    });
    const { outputDisplayUpsert, workspaceUpsert, getWorkspaceRow } = createSupabaseMock({
      workspaceSnapshot: existingCheckpointSnapshot,
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "display-touch-1",
          version: 4,
          source_snapshot_updated_at: "2026-06-03T12:00:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: null,
          generation_id: null,
          prompt_id: null,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: "Stable prompt",
          mime_type: null,
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://cdn.example.com/stable.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://cdn.example.com/stable.png"],
          saved_media_ids: [MEDIA_ID_1],
          task_state: null,
          queue_state: null,
          save_state: null,
          status: null,
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-06-03T12:00:01.000Z",
        },
      ],
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
          sessionId: "session-display-touch",
          updatedAt: "2026-06-03T12:05:00.000Z",
          workspace: {
            selectedTool: "create",
          },
          outputs: {
            active: [
              {
                id: "display-touch-1",
                mode: "image",
                mediaSource: "library",
                prompt: "Stable prompt",
                previewUrl: "https://cdn.example.com/stable.png",
                resultUrls: ["https://cdn.example.com/stable.png"],
                savedMediaIds: [MEDIA_ID_1],
              },
            ],
            archived: [],
            activeOutputId: "display-touch-1",
            curatedReferenceIds: ["display-touch-1"],
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
      })
    ).resolves.toMatchObject({
      checkpointRevision: 1,
      snapshot: {
        outputs: {
          active: [
            expect.objectContaining({
              id: "display-touch-1",
              prompt: "Stable prompt",
            }),
          ],
        },
      },
    });

    expect(outputDisplayUpsert).not.toHaveBeenCalled();
    expect(workspaceUpsert).toHaveBeenCalledTimes(1);
    expect(workspaceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpoint_revision: 1,
        snapshot: existingCheckpointSnapshot,
        snapshot_updated_at: "2026-06-03T12:05:00.000Z",
      }),
      expect.anything()
    );
    expect(getWorkspaceRow()).toMatchObject({
      checkpoint_revision: 1,
      snapshot_updated_at: "2026-06-03T12:05:00.000Z",
    });
  });

  it("rejects older structural saves after a newer display-only freshness touch", async () => {
    const existingCheckpointSnapshot = createCanonicalCheckpointSnapshot({
      schemaVersion: 2,
      sessionId: "session-display-structural-race",
      updatedAt: "2026-06-03T12:00:00.000Z",
      workspace: {
        selectedTool: "create",
      },
      outputs: {
        active: [
          {
            id: "display-race-1",
            mode: "image",
            mediaSource: "library",
            prompt: "Older prompt",
            previewUrl: "https://cdn.example.com/older-race.png",
            resultUrls: ["https://cdn.example.com/older-race.png"],
            savedMediaIds: [MEDIA_ID_1],
          },
        ],
        archived: [],
        activeOutputId: "display-race-1",
        curatedReferenceIds: ["display-race-1"],
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
    });
    const { outputDisplayUpsert, workspaceUpsert } = createSupabaseMock({
      workspaceSnapshot: existingCheckpointSnapshot,
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "display-race-1",
          version: 2,
          source_snapshot_updated_at: "2026-06-03T12:00:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: null,
          generation_id: null,
          prompt_id: null,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: "Older prompt",
          mime_type: null,
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://cdn.example.com/older-race.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://cdn.example.com/older-race.png"],
          saved_media_ids: [MEDIA_ID_1],
          task_state: "success",
          queue_state: null,
          save_state: "saved",
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-06-03T12:00:01.000Z",
        },
      ],
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
          sessionId: "session-display-structural-race",
          updatedAt: "2026-06-03T12:05:00.000Z",
          workspace: {
            selectedTool: "create",
          },
          outputs: {
            active: [
              {
                id: "display-race-1",
                mode: "image",
                mediaSource: "library",
                prompt: "Fresh prompt",
                previewUrl: "https://cdn.example.com/fresh-race.png",
                resultUrls: ["https://cdn.example.com/fresh-race.png"],
                savedMediaIds: [MEDIA_ID_1],
              },
            ],
            archived: [],
            activeOutputId: "display-race-1",
            curatedReferenceIds: ["display-race-1"],
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
      })
    ).resolves.toMatchObject({
      checkpointRevision: 1,
      snapshot: {
        outputs: {
          active: [
            expect.objectContaining({
              id: "display-race-1",
              prompt: "Fresh prompt",
            }),
          ],
        },
      },
    });

    await expect(
      upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-display-structural-race",
          updatedAt: "2026-06-03T12:03:00.000Z",
          workspace: {
            selectedTool: "create",
          },
          outputs: {
            active: [
              {
                id: "display-race-1",
                mode: "image",
                mediaSource: "library",
                prompt: "Stale structural prompt",
                previewUrl: "https://cdn.example.com/stale-race.png",
                resultUrls: ["https://cdn.example.com/stale-race.png"],
                savedMediaIds: [MEDIA_ID_1],
              },
            ],
            archived: [],
            activeOutputId: "display-race-1",
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
      })
    ).resolves.toMatchObject({
      checkpointRevision: 1,
      snapshot: {
        outputs: {
          active: [
            expect.objectContaining({
              id: "display-race-1",
              prompt: "Fresh prompt",
            }),
          ],
          curatedReferenceIds: ["display-race-1"],
        },
      },
    });

    expect(workspaceUpsert).toHaveBeenCalledTimes(1);
    expect(outputDisplayUpsert).toHaveBeenCalledTimes(1);
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

  it("drops unresolved generated rows when generation ownership resolution fails on read", async () => {
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
            active: [],
            archived: [],
            activeOutputId: null,
            curatedReferenceIds: [],
            removedFromAllRefsIds: [],
          },
        },
      });
      expect(result?.snapshot.agentRuntimes).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] read sanitization degraded unresolved ownership associations",
        expect.objectContaining({
          projectId: "project-1",
          failedAuthorities: ["generation"],
          errors: ["generation ownership unavailable"],
        })
      );
      expect(writeAppErrorLogMock).toHaveBeenCalledWith({
        source: "telemetry.ai_studio.project_workspace.read_sanitization_fallback",
        message:
          "Project workspace read degraded unresolved ownership associations after read-time ownership resolution failed.",
        userId: "user-1",
        statusCode: 200,
        metadata: {
          project_id: "project-1",
          fallback_stage: "read_sanitization",
          failed_authorities: ["generation"],
          errors: ["generation ownership unavailable"],
        },
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("preserves media-backed rows when unrelated generation ownership resolution fails on read", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseMock({
      generationReadError: "generation ownership unavailable",
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-partial-degrade-read",
        updatedAt: "2026-05-31T18:45:00.000Z",
        meta: {
          generatedAt: "2026-05-31T18:45:00.000Z",
          checksum: "fnv1a32:partial-degrade-read",
        },
        outputs: {
          active: [
            {
              id: "library-1",
              mediaSource: "library",
              previewUrl: "https://cdn.example.com/library.png",
              resultUrls: ["https://cdn.example.com/library.png"],
              savedMediaIds: [MEDIA_ID_1],
              saveState: "saved",
            },
            {
              id: "out-generated-1",
              generationId: GENERATION_ID_1,
              previewUrl: "https://expired.example.com/generated.png",
              resultUrls: ["https://expired.example.com/generated.png"],
            },
          ],
          archived: [],
          activeOutputId: "out-generated-1",
          curatedReferenceIds: ["library-1", "out-generated-1"],
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

    try {
      const result = await getProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
      });

      expect(result?.snapshot.outputs).toMatchObject({
        active: [
          expect.objectContaining({
            id: "library-1",
            mediaSource: "library",
            savedMediaIds: [MEDIA_ID_1],
            saveState: "saved",
          }),
        ],
        archived: [],
        activeOutputId: null,
        curatedReferenceIds: ["library-1"],
        removedFromAllRefsIds: [],
      });
      expect(result?.snapshot.outputs).not.toMatchObject({
        active: [expect.objectContaining({ generationId: GENERATION_ID_1 })],
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] read sanitization degraded unresolved ownership associations",
        expect.objectContaining({
          projectId: "project-1",
          failedAuthorities: ["generation"],
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("preserves durable generated rows and dependent references when generation ownership resolution fails on read", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseMock({
      generationReadError: "generation ownership unavailable",
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-durable-generated-read",
        updatedAt: "2026-05-31T20:25:00.000Z",
        meta: {
          generatedAt: "2026-05-31T20:25:00.000Z",
          checksum: "fnv1a32:durable-generated-read",
        },
        outputs: {
          active: [
            {
              id: "out-durable-generated-read-1",
              generationId: GENERATION_ID_1,
              mediaSource: "generated",
              previewStoragePath: "user-1/generated/durable-generated-read-preview.png",
              fullStoragePath: "user-1/generated/durable-generated-read-full.png",
            },
          ],
          archived: [],
          activeOutputId: "out-durable-generated-read-1",
          curatedReferenceIds: ["out-durable-generated-read-1"],
          removedFromAllRefsIds: ["out-durable-generated-read-1"],
        },
        canvas: {
          scene: {
            items: [
              {
                id: "canvas-generated-read-1",
                kind: "image",
                x: 10,
                y: 12,
                z: 1,
                selected: false,
                outputId: "out-durable-generated-read-1",
                sourceSurface: "curated",
                src: "https://signed.shortpulse.test/generated-read.png",
                alt: "Durable generated image",
                width: 320,
                height: 180,
              },
            ],
          },
          viewports: {
            main: { x: 0, y: 0, zoom: 1 },
            rail: { x: 0, y: 0, zoom: 1 },
          },
          transient: {
            draftTextEntry: null,
            textEditSession: null,
            draftOwnerInstanceId: null,
            textEditOwnerInstanceId: null,
          },
          meta: {
            schemaVersion: 1,
            itemCount: 1,
            truncatedItemCount: 0,
            skippedNonDurableImageCount: 0,
          },
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

    try {
      const result = await getProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
      });

      expect(result?.snapshot.outputs).toMatchObject({
        active: [
          expect.objectContaining({
            id: `generated:${GENERATION_ID_1}`,
            generationId: GENERATION_ID_1,
            mediaSource: "generated",
            previewStoragePath: "user-1/generated/durable-generated-read-preview.png",
            fullStoragePath: "user-1/generated/durable-generated-read-full.png",
          }),
        ],
        activeOutputId: null,
        curatedReferenceIds: [`generated:${GENERATION_ID_1}`],
        removedFromAllRefsIds: [`generated:${GENERATION_ID_1}`],
      });
      expect(result?.snapshot.canvas).toMatchObject({
        scene: {
          items: [expect.objectContaining({ outputId: `generated:${GENERATION_ID_1}` })],
        },
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] read sanitization degraded unresolved ownership associations",
        expect.objectContaining({
          projectId: "project-1",
          failedAuthorities: ["generation"],
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("drops generated rows that only retain task identity when generation ownership resolution fails on read", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseMock({
      generationReadError: "generation ownership unavailable",
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-generated-taskid-degrade-read",
        updatedAt: "2026-05-31T19:15:00.000Z",
        meta: {
          generatedAt: "2026-05-31T19:15:00.000Z",
          checksum: "fnv1a32:generated-taskid-degrade-read",
        },
        outputs: {
          active: [
            {
              id: "out-generated-runtime-only",
              taskId: "task-runtime-only-1",
              sourceRef: "source-runtime-only-1",
              mediaSource: "generated",
              previewUrl: "https://cdn.example.com/runtime-only.png",
              resultUrls: ["https://cdn.example.com/runtime-only.png"],
            },
          ],
          archived: [],
          activeOutputId: "out-generated-runtime-only",
          curatedReferenceIds: ["out-generated-runtime-only"],
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

    try {
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
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] read sanitization degraded unresolved ownership associations",
        expect.objectContaining({
          projectId: "project-1",
          failedAuthorities: ["generation"],
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("retains generated rows that only retain runtime identity when read ownership resolves by request id", async () => {
    createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [GENERATION_ID_2],
      generationRows: [
        {
          id: GENERATION_ID_2,
          request_id: "task-runtime-owned-1",
        },
      ],
      projectionRows: [
        {
          generation_id: GENERATION_ID_2,
          request_id: "task-runtime-owned-1",
          source_ref: "source-runtime-owned-1",
          preview_url: "https://cdn.example.com/runtime-owned.png",
          result_urls: ["https://cdn.example.com/runtime-owned.png"],
          preview_storage_path: "user-1/generated/runtime-owned-preview.png",
          full_storage_path: "user-1/generated/runtime-owned-full.png",
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Runtime-owned generated output",
          provider: "fal",
          model_id: "fal-ai/seedream",
          hidden_in_reference_grid: false,
          reference_grid_visible: true,
        },
      ],
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-generated-runtime-owned-read",
        updatedAt: "2026-05-31T19:20:00.000Z",
        meta: {
          generatedAt: "2026-05-31T19:20:00.000Z",
          checksum: "fnv1a32:generated-runtime-owned-read",
        },
        outputs: {
          active: [
            {
              id: "out-generated-runtime-owned",
              taskId: "task-runtime-owned-1",
              sourceRef: "source-runtime-owned-1",
              mediaSource: "generated",
              previewUrl: "https://cdn.example.com/runtime-owned.png",
              resultUrls: ["https://cdn.example.com/runtime-owned.png"],
            },
          ],
          archived: [],
          activeOutputId: "out-generated-runtime-owned",
          curatedReferenceIds: ["out-generated-runtime-owned"],
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
          id: `generated:${GENERATION_ID_2}`,
          generationId: GENERATION_ID_2,
          taskId: "task-runtime-owned-1",
          sourceRef: "source-runtime-owned-1",
          mediaSource: "generated",
          previewStoragePath: "user-1/generated/runtime-owned-preview.png",
          fullStoragePath: "user-1/generated/runtime-owned-full.png",
        }),
      ],
      archived: [],
      activeOutputId: null,
      curatedReferenceIds: [`generated:${GENERATION_ID_2}`],
      removedFromAllRefsIds: [],
    });
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

  it("strips foreign trusted direct preview URLs from generated workspace snapshots on read", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const foreignSignedUrl =
      "https://project.supabase.co/storage/v1/object/sign/media_library/user-2/generated/foreign.png?token=test-token";

    try {
      createSupabaseMock({
        workspaceSnapshot: {
          schemaVersion: 2,
          sessionId: "session-foreign-generated-read",
          updatedAt: "2026-06-01T00:05:00.000Z",
          meta: {
            generatedAt: "2026-06-01T00:05:00.000Z",
            checksum: "fnv1a32:foreign-generated-read",
          },
          outputs: {
            active: [
              {
                id: "out-foreign-generated-read",
                generationId: GENERATION_ID_1,
                mediaSource: "generated",
                previewUrl: foreignSignedUrl,
                resultUrls: [foreignSignedUrl],
              },
            ],
            archived: [],
            activeOutputId: "out-foreign-generated-read",
            curatedReferenceIds: ["out-foreign-generated-read"],
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

      const restoredRow = (
        ((result?.snapshot.outputs as { active?: Array<Record<string, unknown>> })?.active ??
          []) as Array<Record<string, unknown>>
      )[0];

      expect(restoredRow).toMatchObject({
        id: `generated:${GENERATION_ID_1}`,
        generationId: GENERATION_ID_1,
        mediaSource: "generated",
      });
      expect(restoredRow).not.toHaveProperty("previewUrl");
      expect(restoredRow).not.toHaveProperty("resultUrls");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("preserves settled non-generated refs while refreshing generated delivery on workspace read", async () => {
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
          id: `generated:${GENERATION_ID_1}`,
          previewStoragePath: "user-1/generated/project-output-preview.png",
          fullStoragePath: "user-1/generated/project-output-full.png",
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

  it("recovers owned canvas storage paths from trusted media URLs during workspace read", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    try {
      createSupabaseMock({
        workspaceSnapshot: {
          schemaVersion: 2,
          sessionId: "session-canvas-signed-url-read",
          updatedAt: "2026-05-31T19:30:00.000Z",
          meta: {
            generatedAt: "2026-05-31T19:30:00.000Z",
            checksum: "fnv1a32:canvas-signed-url-read",
          },
          outputs: {
            active: [],
            archived: [],
          },
          canvas: {
            scene: {
              items: [
                {
                  id: "canvas-image-legacy-read",
                  kind: "image",
                  x: 0,
                  y: 0,
                  z: 1,
                  selected: false,
                  outputId: "out-missing-image",
                  sourceSurface: "all-refs",
                  mediaId: null,
                  src: createTrustedSignedMediaUrl("user-1/generations/images/legacy-read.png"),
                  alt: "Legacy image",
                  width: 320,
                  height: 180,
                },
                {
                  id: "canvas-video-legacy-read",
                  kind: "video",
                  x: 10,
                  y: 12,
                  z: 2,
                  selected: false,
                  outputId: "out-missing-video",
                  sourceSurface: "all-refs",
                  mediaId: null,
                  videoUrl: createTrustedSignedMediaUrl(
                    "user-1/generations/videos/legacy-read.mp4"
                  ),
                  posterUrl: createTrustedSignedMediaUrl(
                    "user-1/variants/videos/legacy-read/poster_720.jpg"
                  ),
                  title: "Legacy video",
                  durationMs: 1000,
                  width: 320,
                  height: 180,
                },
              ],
            },
            viewports: {
              main: { x: 0, y: 0, zoom: 1 },
              rail: { x: 0, y: 0, zoom: 1 },
            },
            transient: {
              draftTextEntry: null,
              textEditSession: null,
              draftOwnerInstanceId: null,
              textEditOwnerInstanceId: null,
            },
            meta: {
              schemaVersion: 1,
              itemCount: 2,
              truncatedItemCount: 0,
              skippedNonDurableImageCount: 0,
            },
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

      expect(result?.snapshot.canvas).toMatchObject({
        scene: {
          items: [
            expect.objectContaining({
              id: "canvas-image-legacy-read",
              srcStoragePath: "user-1/generations/images/legacy-read.png",
            }),
            expect.objectContaining({
              id: "canvas-video-legacy-read",
              videoStoragePath: "user-1/generations/videos/legacy-read.mp4",
              posterStoragePath: "user-1/variants/videos/legacy-read/poster_720.jpg",
            }),
          ],
        },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("retains quick-slot generated outputs during workspace read when ownership is projection-backed", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-projection-only-read",
        updatedAt: "2026-05-31T18:05:00.000Z",
        meta: {
          generatedAt: "2026-05-31T18:05:00.000Z",
          checksum: "fnv1a32:projection-only-read",
        },
        outputs: {
          active: [
            {
              id: "out-projection-only-1",
              generationId: GENERATION_ID_2,
              mediaSource: "generated",
              previewUrl: "https://cdn.example.com/projection-only.png",
              resultUrls: ["https://cdn.example.com/projection-only.png"],
            },
          ],
          archived: [],
          activeOutputId: "out-projection-only-1",
          curatedReferenceIds: ["out-projection-only-1"],
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
      associatedSnapshotGenerationIds: [GENERATION_ID_2],
      recentGenerationIds: [GENERATION_ID_2],
      projectionRows: [
        {
          generation_id: GENERATION_ID_2,
          request_id: "task-projection-only-1",
          preview_url: "https://cdn.example.com/projection-only.png",
          result_urls: ["https://cdn.example.com/projection-only.png"],
          preview_storage_path: "user-1/generated/projection-only-preview.png",
          full_storage_path: "user-1/generated/projection-only-full.png",
          task_state: "success",
          queue_state: "dispatched",
          display_prompt: "Projection-only generated output",
          provider: "fal",
          model_id: "fal-ai/seedream",
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
      active: [
        expect.objectContaining({
          id: `generated:${GENERATION_ID_2}`,
          generationId: GENERATION_ID_2,
        }),
      ],
      curatedReferenceIds: [`generated:${GENERATION_ID_2}`],
    });
  });

  it("drops preview-only generated rows that lost all project-owned restore authority during workspace read", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-orphan-generated-read",
        updatedAt: "2026-05-31T18:55:00.000Z",
        meta: {
          generatedAt: "2026-05-31T18:55:00.000Z",
          checksum: "fnv1a32:orphan-generated-read",
        },
        outputs: {
          active: [
            {
              id: "legacy-orphan-output",
              mediaSource: "generated",
              previewUrl: "https://cdn.example.com/orphan-preview.png",
              previewText: "Legacy orphan prompt",
            },
          ],
          archived: [],
          activeOutputId: "legacy-orphan-output",
          curatedReferenceIds: ["legacy-orphan-output"],
          removedFromAllRefsIds: ["legacy-orphan-output"],
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

  it("re-sanitizes durable canvas content during workspace read", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-canvas-read",
        updatedAt: "2026-05-31T19:05:00.000Z",
        meta: {
          generatedAt: "2026-05-31T19:05:00.000Z",
          checksum: "fnv1a32:canvas-read",
        },
        workspace: {},
        outputs: {
          active: [
            {
              id: "library-1",
              mediaSource: "library",
              previewUrl: "https://cdn.example.com/library.png",
              resultUrls: ["https://cdn.example.com/library.png"],
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: [],
          removedFromAllRefsIds: [],
        },
        canvas: {
          scene: {
            items: [
              {
                id: "canvas-image-1",
                kind: "image",
                x: 12,
                y: 24,
                z: 1,
                selected: true,
                outputId: "library-1",
                sourceSurface: "curated",
                mediaId: MEDIA_ID_1,
                src: "https://signed.shortpulse.test/library.png",
                alt: "Library image",
                width: 320,
                height: 180,
              },
            ],
          },
          viewports: {
            main: { x: 3, y: 4, zoom: 1.2 },
            rail: { x: -2, y: 5, zoom: 0.8 },
          },
          transient: {
            draftTextEntry: { x: 10, y: 20, value: "draft" },
            textEditSession: {
              itemId: "canvas-image-1",
              value: "editing",
            },
            draftOwnerInstanceId: "main",
            textEditOwnerInstanceId: "rail",
          },
          meta: {
            schemaVersion: 1,
            itemCount: 1,
            truncatedItemCount: 0,
            skippedNonDurableImageCount: 0,
          },
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

    expect(result?.snapshot.canvas).toMatchObject({
      scene: {
        items: [
          expect.objectContaining({
            id: "canvas-image-1",
            selected: false,
            outputId: "library-1",
            mediaId: MEDIA_ID_1,
            src: "https://signed.shortpulse.test/library.png",
          }),
        ],
      },
      transient: {
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
      },
      viewports: {
        main: { x: 3, y: 4, zoom: 1.2 },
        rail: { x: -2, y: 5, zoom: 0.8 },
      },
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
          model_id: "eleven_v3",
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
          model_id: "eleven_v3",
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
