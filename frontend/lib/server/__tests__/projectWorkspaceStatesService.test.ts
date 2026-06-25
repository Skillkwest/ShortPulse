import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeAiStudioSessionChecksum,
  createAiStudioProjectWorkspaceSnapshot,
} from "../../ai-studio-session/projectWorkspaceSnapshot";
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
const FOREIGN_MEDIA_ID = "77777777-7777-4777-8777-777777777777";
const FOREIGN_PROMPT_ID = "88888888-8888-4888-8888-888888888888";
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

const createProjectAssetAssociationChecksum = ({
  mediaFileIds = [],
  promptIds = [],
  generationIds = [],
}: {
  mediaFileIds?: string[];
  promptIds?: string[];
  generationIds?: string[];
}): string =>
  computeAiStudioSessionChecksum({
    generationIds: Array.from(new Set(generationIds)).sort(),
    mediaFileIds: Array.from(new Set(mediaFileIds)).sort(),
    promptIds: Array.from(new Set(promptIds)).sort(),
  });

const withProjectAssetAssociationChecksum = (
  snapshot: Record<string, unknown>,
  projectAssetAssociationChecksum: string
): Record<string, unknown> => {
  const metaWithAssociationChecksum: Record<string, unknown> = {
    ...(snapshot.meta as Record<string, unknown>),
    projectAssetAssociationChecksum,
  };
  const { checksum: _existingChecksum, ...metaWithoutChecksum } = metaWithAssociationChecksum;
  void _existingChecksum;
  const snapshotWithoutChecksum = {
    ...snapshot,
    meta: metaWithoutChecksum,
  };
  return {
    ...snapshotWithoutChecksum,
    meta: {
      ...metaWithoutChecksum,
      checksum: computeAiStudioSessionChecksum(snapshotWithoutChecksum),
    },
  };
};

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
  outputDisplayUpsertDelayMs?: number;
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
  outputDisplayUpsertDelayMs,
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
  const selectWorkspaceColumns = (
    row: typeof mutableWorkspaceRow,
    columns?: string
  ): Record<string, unknown> => {
    if (!columns || columns.includes("*")) return row;
    return columns
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean)
      .reduce<Record<string, unknown>>((selected, column) => {
        if (column in row) {
          selected[column] = row[column as keyof typeof mutableWorkspaceRow];
        }
        return selected;
      }, {});
  };
  const workspaceUpsertSelect = vi.fn((columns?: string) => ({
    maybeSingle: vi.fn(async () => ({
      data:
        workspaceUpsertError == null
          ? selectWorkspaceColumns(
              (() => {
                mutableWorkspaceRow = {
                  ...mutableWorkspaceRow,
                  schema_version:
                    typeof pendingWorkspaceUpsertPayload?.schema_version === "number"
                      ? pendingWorkspaceUpsertPayload.schema_version
                      : 2,
                  snapshot:
                    pendingWorkspaceUpsertPayload?.snapshot &&
                    typeof pendingWorkspaceUpsertPayload.snapshot === "object"
                      ? (pendingWorkspaceUpsertPayload.snapshot as Record<string, unknown>)
                      : resolvedWorkspaceUpsertSnapshot,
                  snapshot_updated_at:
                    typeof pendingWorkspaceUpsertPayload?.snapshot_updated_at === "string"
                      ? pendingWorkspaceUpsertPayload.snapshot_updated_at
                      : resolvedWorkspaceUpsertSnapshotUpdatedAt,
                  checkpoint_revision:
                    typeof pendingWorkspaceUpsertPayload?.checkpoint_revision === "number"
                      ? pendingWorkspaceUpsertPayload.checkpoint_revision
                      : 2,
                  updated_at:
                    typeof pendingWorkspaceUpsertPayload?.updated_at === "string"
                      ? pendingWorkspaceUpsertPayload.updated_at
                      : mutableWorkspaceRow.updated_at,
                };
                return mutableWorkspaceRow;
              })(),
              columns
            )
          : null,
      error:
        workspaceUpsertError == null
          ? null
          : typeof workspaceUpsertError === "string"
            ? { message: workspaceUpsertError }
            : workspaceUpsertError,
    })),
  }));
  let pendingWorkspaceUpsertPayload: Record<string, unknown> | null = null;
  const workspaceUpsert = vi.fn((payload: Record<string, unknown>) => {
    pendingWorkspaceUpsertPayload = payload;
    return {
      select: workspaceUpsertSelect,
    };
  });
  const outputDisplaySelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(async () => ({
        data: outputDisplayReadError ? null : mutableOutputDisplayRows,
        error: outputDisplayReadError ? { message: outputDisplayReadError } : null,
      })),
    })),
  }));
  const outputDisplayUpsert = vi.fn(async (rows: Record<string, unknown>[]) => {
    if (outputDisplayUpsertDelayMs != null) {
      await new Promise((resolve) => setTimeout(resolve, outputDisplayUpsertDelayMs));
    }
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
    workspaceUpsertSelect,
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

  it("backfills project associations and refreshes the checkpoint when durable media authority changes", async () => {
    const existingSnapshot = createCanonicalCheckpointSnapshot(
      {
        schemaVersion: 2,
        sessionId: "session-display-only-association-existing",
        updatedAt: "2026-04-23T01:00:00.000Z",
        workspace: {
          selectedTool: "create",
          standardPrompt: "",
        },
        outputs: {
          active: [
            {
              id: "library-display-only-association",
              mediaSource: "library",
              mode: "image",
              previewUrl: "https://cdn.example.com/display-only-association.png",
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: ["library-display-only-association"],
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
      4
    );
    const { mediaAssociationUpsert, promptAssociationUpsert, workspaceUpsert } = createSupabaseMock(
      {
        workspaceSnapshot: existingSnapshot,
        workspaceSnapshotUpdatedAt: "2026-04-23T01:00:00.000Z",
        associatedSnapshotGenerationIds: [],
        recentGenerationIds: [],
        projectionRows: [],
      }
    );

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-display-only-association-existing",
        updatedAt: "2026-04-23T01:00:00.000Z",
        workspace: {
          selectedTool: "create",
          standardPrompt: "",
        },
        outputs: {
          active: [
            {
              id: "library-display-only-association",
              mediaSource: "library",
              mode: "image",
              savedMediaIds: [MEDIA_ID_1],
              promptId: PROMPT_ID_1,
              previewUrl: "https://cdn.example.com/display-only-association.png",
            },
          ],
          archived: [],
          activeOutputId: null,
          curatedReferenceIds: ["library-display-only-association"],
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
    expect(workspaceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpoint_revision: 2,
        snapshot: expect.objectContaining({
          outputs: expect.objectContaining({
            active: [
              expect.objectContaining({
                id: "library-display-only-association",
                savedMediaIds: [MEDIA_ID_1],
              }),
            ],
          }),
        }),
      }),
      expect.anything()
    );
  });

  it("preserves and associates prompt-only library references during workspace save", async () => {
    const { promptAssociationUpsert, outputDisplayUpsert } = createSupabaseMock({
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
        sessionId: "session-prompt-only-library-reference",
        updatedAt: "2026-04-23T01:00:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:00:00.000Z",
          checksum: "fnv1a32:prompt-only-library-reference",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Prompt-only library reference",
        },
        outputs: {
          active: [
            {
              id: "prompt-library-output-1",
              mode: "text",
              mediaSource: "library",
              promptId: PROMPT_ID_1,
              prompt: "Reusable saved prompt text",
              previewText: "Reusable saved prompt text",
            },
          ],
          archived: [],
          activeOutputId: "prompt-library-output-1",
          curatedReferenceIds: ["prompt-library-output-1"],
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
          id: "prompt-library-output-1",
          promptId: PROMPT_ID_1,
          prompt: "Reusable saved prompt text",
          previewText: "Reusable saved prompt text",
        }),
      ],
      activeOutputId: null,
      curatedReferenceIds: ["prompt-library-output-1"],
    });
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
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "prompt-library-output-1",
          generation_id: null,
          prompt_id: PROMPT_ID_1,
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
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
      mediaIdInMock,
      promptIdInMock,
      generationIdInMock,
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
    expect(mediaIdInMock).not.toHaveBeenCalledWith("id", expect.arrayContaining([MEDIA_ID_2]));
    expect(promptIdInMock).not.toHaveBeenCalled();
    expect(generationIdInMock).not.toHaveBeenCalled();
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
    expect(promptIdInMock).toHaveBeenCalledTimes(2);
    expect(promptIdInMock.mock.calls.map(([, ids]) => ids.length)).toEqual([100, 28]);
    expect(generationIdInMock).toHaveBeenCalledTimes(2);
    expect(generationIdInMock.mock.calls.map(([, ids]) => ids.length)).toEqual([100, 28]);
    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    expect(
      (firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: unknown[] })?.active
    ).toHaveLength(128);
  });

  it("stores pathological output-heavy projects as capped lightweight checkpoints", async () => {
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
      ...(index === 128 ? { savedMediaIds: [MEDIA_ID_1] } : {}),
      ...(index === 129 ? { promptId: PROMPT_ID_1 } : {}),
      ...(index === 130 ? { generationId: GENERATION_ID_1 } : {}),
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
        curatedReferenceIds: [
          "pathological-output-1",
          "pathological-output-2",
          "pathological-output-129",
        ],
        removedFromAllRefsIds: ["pathological-output-3", "pathological-output-130"],
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

    expect(storedActiveOutputs).toHaveLength(128);
    expect(storedBytes).toBeLessThan(originalBytes * 0.3);
    expect(storedActiveOutputs[0]).toEqual({
      id: "pathological-output-1",
      mode: "image",
      mediaSource: "library",
    });
    expect(storedActiveOutputs.at(-1)).toEqual({
      id: "pathological-output-128",
      mode: "image",
      mediaSource: "library",
    });
    expect(
      (storedCheckpoint.outputs as { curatedReferenceIds?: string[] }).curatedReferenceIds
    ).toEqual(["pathological-output-1", "pathological-output-2"]);
    expect(
      (storedCheckpoint.outputs as { removedFromAllRefsIds?: string[] }).removedFromAllRefsIds
    ).toEqual(["pathological-output-3"]);
    expect(outputDisplayUpsert).toHaveBeenCalled();
    expect(
      outputDisplayUpsert.mock.calls.reduce(
        (count, call) => count + ((call[0] as unknown[])?.length ?? 0),
        0
      )
    ).toBe(128);
    expect(outputDisplayUpsert.mock.calls[0]?.[0]?.[0]).toMatchObject({
      output_id: "pathological-output-1",
      width: 1024,
      height: 768,
      duration_ms: 333,
    });
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.ai_studio.project_workspace.reference_grid_cap_normalized",
        userId: "user-1",
        metadata: expect.objectContaining({
          project_id: "project-1",
          incoming_visible_active_outputs: 600,
          persisted_visible_active_outputs: 128,
          reference_grid_visible_limit: 128,
          trimmed_visible_active_outputs: 472,
          trimmed_sample_output_ids: [
            "pathological-output-129",
            "pathological-output-130",
            "pathological-output-131",
            "pathological-output-132",
            "pathological-output-133",
            "pathological-output-134",
            "pathological-output-135",
            "pathological-output-136",
            "pathological-output-137",
            "pathological-output-138",
            "pathological-output-139",
            "pathological-output-140",
            "pathological-output-141",
            "pathological-output-142",
            "pathological-output-143",
            "pathological-output-144",
            "pathological-output-145",
            "pathological-output-146",
            "pathological-output-147",
            "pathological-output-148",
          ],
          trimmed_with_durable_authority_count: 1,
          trimmed_with_runtime_identity_count: 1,
          trimmed_with_saved_media_ids_count: 1,
          trimmed_with_prompt_id_count: 1,
          trimmed_with_generation_id_count: 1,
        }),
      })
    );
  });

  it("compacts oversized raw project snapshots before the server admission byte check", async () => {
    const { workspaceUpsert, outputDisplayUpsert } = createSupabaseMock();
    const oversizedPrompt = "Oversized project prompt ".repeat(40_000);
    const expectedSummary = oversizedPrompt.slice(0, 1000).trim();
    const rawSnapshot = {
      schemaVersion: 2,
      sessionId: "session-server-admission-compaction",
      updatedAt: "2026-06-03T14:03:00.000Z",
      workspace: {
        selectedTool: "create",
      },
      outputs: {
        active: [
          {
            id: "server-admission-large-output",
            mode: "image",
            mediaSource: "library",
            savedMediaIds: [MEDIA_ID_1],
            prompt: oversizedPrompt,
            previewText: oversizedPrompt,
            previewUrl: "https://cdn.example.com/server-admission-large-output.png",
          },
        ],
        archived: [],
        activeOutputId: "server-admission-large-output",
        curatedReferenceIds: ["server-admission-large-output"],
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

    expect(Buffer.byteLength(JSON.stringify(rawSnapshot), "utf8")).toBeGreaterThan(900_000);

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: rawSnapshot,
    });

    const firstWorkspaceUpsertArg = (
      workspaceUpsert.mock.calls as Array<[{ snapshot?: Record<string, unknown> }?, unknown?]>
    ).at(0)?.[0];
    const storedActiveOutputs = ((
      firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: Array<Record<string, unknown>> }
    )?.active ?? []) as Array<Record<string, unknown>>;

    expect(storedActiveOutputs).toEqual([
      expect.objectContaining({
        id: "server-admission-large-output",
        mode: "image",
        mediaSource: "library",
      }),
    ]);
    expect(storedActiveOutputs[0]).not.toHaveProperty("prompt");
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "server-admission-large-output",
          preview_text: expectedSummary,
          display_prompt_summary: expectedSummary,
          saved_media_ids: [MEDIA_ID_1],
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
  });

  it("bounds rich display text before syncing project output display rows", async () => {
    const { outputDisplayUpsert } = createSupabaseMock();
    const longPrompt = "P".repeat(5000);
    const longPreviewText = "V".repeat(5000);
    const longTitle = "T".repeat(120);
    const longError = "E".repeat(5000);

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-display-text-bounds",
        updatedAt: "2026-06-03T14:05:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "display-text-bounds-output",
              mode: "image",
              mediaSource: "library",
              savedMediaIds: [MEDIA_ID_1],
              prompt: longPrompt,
              previewText: longPreviewText,
              title: longTitle,
              errorMessageShort: longError,
              previewUrl: "https://cdn.example.com/display-text-bounds.png",
            },
          ],
          archived: [],
          activeOutputId: "display-text-bounds-output",
          curatedReferenceIds: ["display-text-bounds-output"],
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
          output_id: "display-text-bounds-output",
          preview_text: longPreviewText.slice(0, 1000),
          display_prompt_summary: longPrompt.slice(0, 1000),
          display_title: longTitle.slice(0, 40),
          error_message_short: longError.slice(0, 1000),
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
  });

  it("prunes terminal hidden Reference Grid rows while capping visible project workspace rows", async () => {
    const { workspaceUpsert } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });
    const visibleOutputs = Array.from({ length: 130 }, (_, index) => ({
      id: `visible-output-${index + 1}`,
      mode: "image",
      mediaSource: "library",
      previewUrl: `https://cdn.example.com/visible-${index + 1}.png`,
      resultUrls: [`https://cdn.example.com/visible-${index + 1}.png`],
    }));
    const hiddenOutput = {
      id: "hidden-output-1",
      mode: "image",
      mediaSource: "library",
      hiddenInReferenceGrid: true,
      previewUrl: "https://cdn.example.com/hidden.png",
      resultUrls: ["https://cdn.example.com/hidden.png"],
    };

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-hidden-cap",
        updatedAt: "2026-06-03T14:10:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [...visibleOutputs.slice(0, 64), hiddenOutput, ...visibleOutputs.slice(64)],
          archived: [],
          activeOutputId: "visible-output-1",
          curatedReferenceIds: ["hidden-output-1", "visible-output-130"],
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
    const storedCheckpoint = firstWorkspaceUpsertArg?.snapshot ?? {};
    const storedActiveOutputs = ((
      storedCheckpoint.outputs as {
        active?: Array<Record<string, unknown>>;
      }
    )?.active ?? []) as Array<Record<string, unknown>>;

    expect(storedActiveOutputs).toHaveLength(128);
    expect(storedActiveOutputs.filter((row) => row.hiddenInReferenceGrid !== true)).toHaveLength(
      128
    );
    expect(storedActiveOutputs.some((row) => row.id === "hidden-output-1")).toBe(false);
    expect(storedActiveOutputs.some((row) => row.id === "visible-output-129")).toBe(false);
    expect(storedActiveOutputs.some((row) => row.id === "visible-output-130")).toBe(false);
    expect(
      (storedCheckpoint.outputs as { curatedReferenceIds?: string[] }).curatedReferenceIds
    ).toEqual([]);
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
    const {
      generationAssociationUpsert,
      generationIdInMock,
      workspaceUpsert,
      outputDisplayUpsert,
    } = createSupabaseMock({
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
    expect(generationIdInMock).toHaveBeenCalledTimes(1);
    expect(generationIdInMock).toHaveBeenCalledWith("id", [GENERATION_ID_2]);
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

  it("strips unsafe Supabase direct preview URLs from non-generated rows before workspace save", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const { outputDisplayUpsert, workspaceUpsert } = createSupabaseMock();
    const foreignSignedUrl =
      "https://project.supabase.co/storage/v1/object/sign/media_library/user-2/library/foreign.png?token=test-token";
    const renderImageUrl =
      "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/library/render.png?token=test-token&width=320";

    try {
      await upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-foreign-library-save",
          updatedAt: "2026-06-01T00:00:00.000Z",
          meta: {
            generatedAt: "2026-06-01T00:00:00.000Z",
            checksum: "fnv1a32:foreign-library-save",
          },
          workspace: {
            selectedTool: "create",
            standardPrompt: "Foreign library preview",
          },
          outputs: {
            active: [
              {
                id: "out-foreign-library-save",
                mediaSource: "library",
                savedMediaIds: [MEDIA_ID_1],
                previewUrl: foreignSignedUrl,
                previewPosterUrl: renderImageUrl,
                resultUrls: [foreignSignedUrl, "https://cdn.example.com/library-safe.png"],
              },
            ],
            archived: [],
            activeOutputId: "out-foreign-library-save",
            curatedReferenceIds: ["out-foreign-library-save"],
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
        id: "out-foreign-library-save",
        mediaSource: "library",
        savedMediaIds: [MEDIA_ID_1],
      });
      expect(savedRow).not.toHaveProperty("previewUrl");
      expect(savedRow).not.toHaveProperty("previewPosterUrl");
      expect(savedRow).not.toHaveProperty("resultUrls");
      expect(outputDisplayUpsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            output_id: "out-foreign-library-save",
            media_source: "library",
            preview_url_fallback: null,
            preview_poster_url_fallback: null,
            result_urls_fallback: ["https://cdn.example.com/library-safe.png"],
            saved_media_ids: [MEDIA_ID_1],
          }),
        ],
        expect.objectContaining({
          onConflict: "project_id,output_id",
        })
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("drops non-generated local-only media rows before workspace save", async () => {
    const { outputDisplayUpsert, workspaceUpsert } = createSupabaseMock({
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
        sessionId: "session-local-only-upload-save",
        updatedAt: "2026-06-01T00:00:00.000Z",
        meta: {
          generatedAt: "2026-06-01T00:00:00.000Z",
          checksum: "fnv1a32:local-only-upload-save",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Local-only upload preview",
        },
        outputs: {
          active: [
            {
              id: "upload-local-only-save",
              mediaSource: "upload",
              mode: "image",
              previewUrl: "blob:http://localhost/local-only-upload",
              resultUrls: ["data:image/png;base64,abc"],
            },
            {
              id: "library-durable-save",
              mediaSource: "library",
              mode: "image",
              savedMediaIds: [MEDIA_ID_1],
              previewUrl: "https://cdn.example.com/library-durable.png",
            },
          ],
          archived: [],
          activeOutputId: "upload-local-only-save",
          curatedReferenceIds: ["upload-local-only-save", "library-durable-save"],
          removedFromAllRefsIds: ["upload-local-only-save"],
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
          id: "library-durable-save",
          mediaSource: "library",
        }),
      ],
      activeOutputId: null,
      curatedReferenceIds: ["library-durable-save"],
      removedFromAllRefsIds: [],
    });
    expect(
      ((firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: Array<Record<string, unknown>> })
        ?.active ?? []) as Array<Record<string, unknown>>
    ).not.toContainEqual(expect.objectContaining({ id: "upload-local-only-save" }));
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "library-durable-save",
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
  });

  it("drops terminal hidden rows before workspace save while preserving hidden in-flight runtime rows", async () => {
    const { outputDisplayUpsert, workspaceUpsert } = createSupabaseMock({
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
        sessionId: "session-hidden-terminal-output-save",
        updatedAt: "2026-06-01T00:00:00.000Z",
        meta: {
          generatedAt: "2026-06-01T00:00:00.000Z",
          checksum: "fnv1a32:hidden-terminal-output-save",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Hidden output save",
        },
        outputs: {
          active: [
            {
              id: "visible-save",
              mediaSource: "library",
              mode: "image",
              savedMediaIds: [MEDIA_ID_1],
              previewUrl: "https://cdn.example.com/visible-save.png",
            },
            {
              id: "hidden-terminal-save",
              mediaSource: "library",
              mode: "image",
              hiddenInReferenceGrid: true,
              taskState: "success",
              savedMediaIds: [MEDIA_ID_1],
              previewUrl: "https://cdn.example.com/hidden-terminal-save.png",
            },
            {
              id: "hidden-running-save",
              mediaSource: "generated",
              mode: "image",
              hiddenInReferenceGrid: true,
              taskState: "running",
              taskId: "task-hidden-running-save",
              previewText: "Still processing",
            },
          ],
          archived: [],
          activeOutputId: "hidden-terminal-save",
          curatedReferenceIds: ["visible-save", "hidden-terminal-save", "hidden-running-save"],
          removedFromAllRefsIds: ["hidden-terminal-save", "hidden-running-save"],
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
          id: "visible-save",
          mediaSource: "library",
        }),
        expect.objectContaining({
          id: "hidden-running-save",
          mediaSource: "generated",
          hiddenInReferenceGrid: true,
        }),
      ],
      activeOutputId: null,
      curatedReferenceIds: ["visible-save", "hidden-running-save"],
      removedFromAllRefsIds: ["hidden-running-save"],
    });
    expect(
      ((firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: Array<Record<string, unknown>> })
        ?.active ?? []) as Array<Record<string, unknown>>
    ).not.toContainEqual(expect.objectContaining({ id: "hidden-terminal-save" }));
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "visible-save",
        }),
        expect.objectContaining({
          output_id: "hidden-running-save",
          hidden_in_reference_grid: true,
        }),
      ],
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
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

  it("drops canvas media items backed by foreign or render-image media URLs", async () => {
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

    expect(savedCanvasItems).toHaveLength(0);
  });

  it("strips unsafe canvas poster and companion art URLs while preserving valid media items", async () => {
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
          sessionId: "session-canvas-unsafe-secondary-media-save",
          updatedAt: "2026-05-31T19:22:00.000Z",
          meta: {
            generatedAt: "2026-05-31T19:22:00.000Z",
            checksum: "fnv1a32:canvas-unsafe-secondary-media-save",
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
                  id: "canvas-video-valid",
                  kind: "video",
                  x: 0,
                  y: 0,
                  z: 1,
                  selected: false,
                  outputId: null,
                  sourceSurface: null,
                  mediaId: null,
                  videoUrl: createTrustedSignedMediaUrl("user-1/generations/videos/valid.mp4"),
                  posterUrl:
                    "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/variants/videos/valid/poster.jpg?token=expired&width=320",
                  title: "Valid video",
                  durationMs: 1000,
                  width: 320,
                  height: 180,
                },
                {
                  id: "canvas-audio-valid",
                  kind: "audio",
                  x: 10,
                  y: 12,
                  z: 2,
                  selected: false,
                  outputId: null,
                  sourceSurface: null,
                  mediaId: null,
                  audioUrl: createTrustedSignedMediaUrl("user-1/generations/audio/valid.mp3"),
                  companionArtUrl: createTrustedSignedMediaUrl(
                    "user-2/generations/audio/foreign-cover.webp"
                  ),
                  title: "Valid audio",
                  audioSourceMode: "music",
                  durationMs: 1000,
                  waveformPeaks: null,
                  width: 280,
                  height: 120,
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
    expect(savedCanvasItems[0]).toMatchObject({
      id: "canvas-video-valid",
      videoStoragePath: "user-1/generations/videos/valid.mp4",
    });
    expect(savedCanvasItems[0]?.posterUrl).toBeNull();
    expect(savedCanvasItems[0]?.posterStoragePath).toBeNull();
    expect(savedCanvasItems[1]).toMatchObject({
      id: "canvas-audio-valid",
      audioStoragePath: "user-1/generations/audio/valid.mp3",
    });
    expect(savedCanvasItems[1]?.companionArtUrl).toBeNull();
    expect(savedCanvasItems[1]?.companionArtStoragePath).toBeNull();
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
      savedMediaIds: [MEDIA_ID_1],
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

  it("does not mark project associations complete when project association backfill fails", async () => {
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
      const workspacePayload = workspaceUpsert.mock.calls[0]?.[0] as
        | { snapshot?: Record<string, unknown> }
        | undefined;
      expect(
        workspacePayload?.snapshot?.meta as Record<string, unknown> | undefined
      ).not.toHaveProperty("projectAssetAssociationChecksum");
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

  it("does not request the heavy snapshot column from the workspace write response", async () => {
    const { workspaceUpsert, workspaceUpsertSelect } = createSupabaseMock({
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      includeSnapshotInResponse: false,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-light-write-return",
        updatedAt: "2026-04-23T01:05:00.000Z",
        meta: {
          generatedAt: "2026-04-23T01:05:00.000Z",
          checksum: "fnv1a32:light-write-return",
        },
        workspace: {
          selectedTool: "create",
          standardPrompt: "Project prompt",
        },
        outputs: {
          active: [
            {
              id: "library-light-write-return",
              mediaSource: "library",
              mode: "image",
              savedMediaIds: [MEDIA_ID_1],
              prompt: "Light write return",
            },
          ],
          archived: [],
          activeOutputId: "library-light-write-return",
          curatedReferenceIds: ["library-light-write-return"],
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

    expect(workspaceUpsert).toHaveBeenCalledTimes(1);
    const selectedColumns = String(workspaceUpsertSelect.mock.calls[0]?.[0] ?? "")
      .split(",")
      .map((column) => column.trim());
    expect(selectedColumns).toContain("snapshot_updated_at");
    expect(selectedColumns).not.toContain("snapshot");
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

  it("preserves media and prompt authority when generation authority resolution degrades", async () => {
    const {
      mediaAssociationUpsert,
      promptAssociationUpsert,
      generationAssociationUpsert,
      outputDisplayUpsert,
    } = createSupabaseMock({
      generationReadError: "upstream request timeout",
    });

    await expect(
      upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-partial-authority-degraded",
          updatedAt: "2026-04-23T01:00:00.000Z",
          meta: {
            generatedAt: "2026-04-23T01:00:00.000Z",
            checksum: "fnv1a32:partial-authority-degraded",
          },
          workspace: {
            selectedTool: "create",
            standardPrompt: "Project prompt",
          },
          outputs: {
            active: [
              {
                id: "library-with-prompt-1",
                mediaSource: "library",
                mode: "image",
                savedMediaIds: [MEDIA_ID_1],
                promptId: PROMPT_ID_1,
                previewUrl: "https://cdn.example.com/library-with-prompt.png",
              },
              {
                id: `generated:${GENERATION_ID_1}`,
                generationId: GENERATION_ID_1,
                taskId: "task-1",
                sourceRef: "source-1",
                mode: "image",
              },
            ],
            archived: [],
            activeOutputId: "library-with-prompt-1",
            curatedReferenceIds: ["library-with-prompt-1"],
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
      saveOutcome: {
        status: "saved_with_repair_pending",
        repairStage: "owned_id_resolution",
        repairMessage:
          "Project workspace save failed during owned id resolution: upstream request timeout",
      },
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
    expect(generationAssociationUpsert).not.toHaveBeenCalled();
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          output_id: "library-with-prompt-1",
          prompt_id: PROMPT_ID_1,
          saved_media_ids: [MEDIA_ID_1],
        }),
      ]),
      expect.objectContaining({
        onConflict: "project_id,output_id",
      })
    );
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

  it("sanitizes stale display fallback URLs from repair-pending save responses", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const foreignSignedUrl =
      "https://project.supabase.co/storage/v1/object/sign/media_library/user-2/library/foreign.png?token=test-token";
    const renderImageUrl =
      "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/library/render.png?token=test-token&width=320";
    createSupabaseMock({
      outputDisplayUpsertError: "invalid input syntax for type integer",
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "library-1",
          version: 3,
          source_snapshot_updated_at: "2026-04-23T00:59:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: "2026-04-23T00:55:00.000Z",
          generation_id: null,
          prompt_id: FOREIGN_PROMPT_ID,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: null,
          display_title: null,
          display_prompt_summary: "Stale display prompt",
          mime_type: "image/png",
          width: 1024,
          height: 768,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: foreignSignedUrl,
          preview_poster_url_fallback: renderImageUrl,
          companion_art_url_fallback: null,
          result_urls_fallback: [foreignSignedUrl, "https://cdn.example.com/library-safe.png"],
          saved_media_ids: [MEDIA_ID_1, FOREIGN_MEDIA_ID],
          task_state: "success",
          queue_state: null,
          save_state: "saved",
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-04-23T00:59:05.000Z",
        },
      ],
    });

    try {
      const result = await upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          updatedAt: "2026-04-23T01:00:00.000Z",
          meta: {
            generatedAt: "2026-04-23T01:00:00.000Z",
            checksum: "fnv1a32:display-sync-failure-sanitize-response",
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

      expect(result.saveOutcome).toMatchObject({
        status: "saved_with_repair_pending",
        repairStage: "project_output_display_sync",
      });
      const restoredRow = (
        ((result.snapshot.outputs as { active?: Array<Record<string, unknown>> })?.active ??
          []) as Array<Record<string, unknown>>
      )[0];
      expect(restoredRow).toMatchObject({
        id: "library-1",
        mediaSource: "library",
        savedMediaIds: [MEDIA_ID_1],
        resultUrls: ["https://cdn.example.com/library-safe.png"],
      });
      expect(restoredRow).not.toHaveProperty("previewUrl");
      expect(restoredRow).not.toHaveProperty("previewPosterUrl");
      expect(restoredRow).not.toHaveProperty("promptId");
    } finally {
      warnSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("returns repair-pending save outcomes when output display sync exceeds the autosave-safe budget", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { workspaceUpsert, outputDisplayUpsert } = createSupabaseMock({
      outputDisplayUpsertDelayMs: 60_000,
    });

    try {
      const savePromise = upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-1",
          updatedAt: "2026-04-23T01:00:00.000Z",
          meta: {
            generatedAt: "2026-04-23T01:00:00.000Z",
            checksum: "fnv1a32:display-sync-timeout",
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

      await vi.advanceTimersByTimeAsync(2_600);

      await expect(savePromise).resolves.toMatchObject({
        saveOutcome: {
          status: "saved_with_repair_pending",
          repairStage: "project_output_display_sync",
          repairMessage:
            "Project workspace save failed during project output display sync: project output display sync exceeded 2500ms budget",
        },
      });

      expect(workspaceUpsert).toHaveBeenCalledTimes(1);
      expect(outputDisplayUpsert).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        "[project-workspace] best-effort save stage failed; persisting sanitized snapshot",
        expect.objectContaining({
          projectId: "project-1",
          stage: "project output display sync",
          error: "project output display sync exceeded 2500ms budget",
        })
      );
      await vi.runOnlyPendingTimersAsync();
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
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
    expect(outputDisplaySelect).toHaveBeenCalledTimes(1);
  });

  it("runs display cleanup only when a structural save has stale display rows", async () => {
    const { outputDisplayDeleteIn, outputDisplaySelect } = createSupabaseMock({
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "stale-display-extra",
          version: 1,
          source_snapshot_updated_at: "2026-04-23T00:59:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: null,
          generation_id: null,
          prompt_id: null,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: "Stale display row",
          mime_type: null,
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://cdn.example.com/stale-display-extra.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://cdn.example.com/stale-display-extra.png"],
          saved_media_ids: [],
          task_state: null,
          queue_state: null,
          save_state: null,
          status: null,
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-04-23T00:59:00.000Z",
        },
      ],
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      includeSnapshotInResponse: false,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-display-cleanup",
        updatedAt: "2026-04-23T01:05:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "library-display-cleanup",
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

    expect(outputDisplaySelect).toHaveBeenCalledTimes(2);
    expect(outputDisplayDeleteIn).toHaveBeenCalledWith("output_id", ["stale-display-extra"]);
  });

  it("cleans display rows for terminal hidden outputs pruned from an older checkpoint", async () => {
    const existingCheckpointSnapshot = createLightweightProjectWorkspaceCheckpointSnapshot({
      checkpointRevision: 1,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-hidden-terminal-cleanup-old",
        updatedAt: "2026-04-23T00:59:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "visible-hidden-cleanup",
              mediaSource: "library",
              mode: "image",
              savedMediaIds: [MEDIA_ID_1],
            },
            {
              id: "hidden-terminal-cleanup",
              mediaSource: "library",
              mode: "image",
              hiddenInReferenceGrid: true,
              taskState: "success",
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: "hidden-terminal-cleanup",
          curatedReferenceIds: ["visible-hidden-cleanup", "hidden-terminal-cleanup"],
          removedFromAllRefsIds: ["hidden-terminal-cleanup"],
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
    const { outputDisplayDeleteIn, outputDisplaySelect, workspaceUpsert } = createSupabaseMock({
      workspaceSnapshot: existingCheckpointSnapshot,
      workspaceSnapshotUpdatedAt: "2026-04-23T00:59:00.000Z",
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "visible-hidden-cleanup",
          version: 1,
          source_snapshot_updated_at: "2026-04-23T00:59:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: null,
          generation_id: null,
          prompt_id: null,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: null,
          mime_type: null,
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: null,
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: [],
          saved_media_ids: [MEDIA_ID_1],
          task_state: null,
          queue_state: null,
          save_state: null,
          status: null,
          error_message_short: null,
          hidden_in_reference_grid: false,
          updated_at: "2026-04-23T00:59:00.000Z",
        },
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "hidden-terminal-cleanup",
          version: 1,
          source_snapshot_updated_at: "2026-04-23T00:59:00.000Z",
          mode: "image",
          media_source: "library",
          created_at: null,
          generation_id: null,
          prompt_id: null,
          task_id: null,
          source_ref: null,
          generation_trace_id: null,
          preview_text: null,
          display_prompt_summary: null,
          mime_type: null,
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://cdn.example.com/hidden-terminal-cleanup.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://cdn.example.com/hidden-terminal-cleanup.png"],
          saved_media_ids: [MEDIA_ID_1],
          task_state: "success",
          queue_state: null,
          save_state: null,
          status: "ready",
          error_message_short: null,
          hidden_in_reference_grid: true,
          updated_at: "2026-04-23T00:59:00.000Z",
        },
      ],
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      includeSnapshotInResponse: false,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-hidden-terminal-cleanup-new",
        updatedAt: "2026-04-23T01:05:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "visible-hidden-cleanup",
              mediaSource: "library",
              mode: "image",
              savedMediaIds: [MEDIA_ID_1],
            },
            {
              id: "hidden-terminal-cleanup",
              mediaSource: "library",
              mode: "image",
              hiddenInReferenceGrid: true,
              taskState: "success",
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: "hidden-terminal-cleanup",
          curatedReferenceIds: ["visible-hidden-cleanup", "hidden-terminal-cleanup"],
          removedFromAllRefsIds: ["hidden-terminal-cleanup"],
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
    const savedActiveOutputs = ((
      firstWorkspaceUpsertArg?.snapshot?.outputs as { active?: Array<Record<string, unknown>> }
    )?.active ?? []) as Array<Record<string, unknown>>;

    expect(savedActiveOutputs).toEqual([
      expect.objectContaining({
        id: "visible-hidden-cleanup",
      }),
    ]);
    expect(outputDisplaySelect).toHaveBeenCalledTimes(2);
    expect(outputDisplayDeleteIn).toHaveBeenCalledWith("output_id", ["hidden-terminal-cleanup"]);
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

  it("keeps saved media authority in lightweight checkpoint reads when display rows lag", async () => {
    createSupabaseMock({
      workspaceSnapshot: {
        schemaVersion: 2,
        sessionId: "session-lightweight-saved-media-read",
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
              id: "display-lag-1",
              mode: "image",
              mediaSource: "library",
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: "display-lag-1",
          curatedReferenceIds: ["display-lag-1"],
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
      outputDisplayRows: [],
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
      id: "display-lag-1",
      mode: "image",
      mediaSource: "library",
      savedMediaIds: [MEDIA_ID_1],
    });
    expect(restoredRow).not.toHaveProperty("previewUrl");
    expect(restoredRow).not.toHaveProperty("previewStoragePath");
    expect(restoredRow).not.toHaveProperty("fullStoragePath");
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

  it("strips unsafe Supabase display fallback URLs from non-generated rows on workspace read", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const foreignSignedUrl =
      "https://project.supabase.co/storage/v1/object/sign/media_library/user-2/library/foreign.png?token=test-token";
    const renderImageUrl =
      "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/library/render.png?token=test-token&width=320";

    try {
      createSupabaseMock({
        workspaceSnapshot: {
          schemaVersion: 2,
          sessionId: "session-display-unsafe-url-read",
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
                id: "display-unsafe-url-1",
                mode: "image",
                mediaSource: "library",
              },
            ],
            archived: [],
            activeOutputId: "display-unsafe-url-1",
            curatedReferenceIds: ["display-unsafe-url-1"],
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
            output_id: "display-unsafe-url-1",
            version: 3,
            source_snapshot_updated_at: "2026-06-03T12:00:00.000Z",
            mode: "image",
            media_source: "library",
            created_at: "2026-06-03T11:55:00.000Z",
            generation_id: null,
            prompt_id: null,
            task_id: null,
            source_ref: null,
            generation_trace_id: null,
            preview_text: "A materialized display row with unsafe URLs",
            display_title: "Display Title",
            display_prompt_summary: "Display prompt",
            mime_type: "image/png",
            width: 1024,
            height: 768,
            duration_ms: null,
            preview_storage_path: null,
            full_storage_path: null,
            preview_poster_storage_path: null,
            companion_art_storage_path: null,
            preview_url_fallback: foreignSignedUrl,
            preview_poster_url_fallback: renderImageUrl,
            companion_art_url_fallback: null,
            result_urls_fallback: [foreignSignedUrl, "https://cdn.example.com/display-safe.png"],
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

      const result = await getProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
      });

      const restoredRow = (
        ((result?.snapshot.outputs as { active?: Array<Record<string, unknown>> })?.active ??
          []) as Array<Record<string, unknown>>
      )[0];

      expect(restoredRow).toMatchObject({
        id: "display-unsafe-url-1",
        mediaSource: "library",
        savedMediaIds: [MEDIA_ID_1],
        resultUrls: ["https://cdn.example.com/display-safe.png"],
      });
      expect(restoredRow).not.toHaveProperty("previewUrl");
      expect(restoredRow).not.toHaveProperty("previewPosterUrl");
    } finally {
      vi.unstubAllEnvs();
    }
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
    const existingProjectAssetAssociationChecksum = createProjectAssetAssociationChecksum({
      mediaFileIds: [MEDIA_ID_1],
    });
    const existingCheckpointSnapshot = withProjectAssetAssociationChecksum(
      createCanonicalCheckpointSnapshot({
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
      }),
      existingProjectAssetAssociationChecksum
    );
    const {
      generationAssociationUpsert,
      mediaAssociationUpsert,
      outputDisplaySelect,
      outputDisplayUpsert,
      promptAssociationUpsert,
      workspaceUpsert,
      getWorkspaceRow,
    } = createSupabaseMock({
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
        includeSnapshotInResponse: false,
      })
    ).resolves.toMatchObject({
      checkpointRevision: 1,
      snapshot: {
        outputs: {
          active: [
            expect.objectContaining({
              id: "display-touch-1",
            }),
          ],
        },
      },
    });

    expect(outputDisplayUpsert).not.toHaveBeenCalled();
    expect(outputDisplaySelect).not.toHaveBeenCalled();
    expect(mediaAssociationUpsert).not.toHaveBeenCalled();
    expect(promptAssociationUpsert).not.toHaveBeenCalled();
    expect(generationAssociationUpsert).not.toHaveBeenCalled();
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

  it("skips ownership and repair work for exact same-timestamp minimal autosave retries", async () => {
    const existingProjectAssetAssociationChecksum = createProjectAssetAssociationChecksum({
      mediaFileIds: [MEDIA_ID_1],
    });
    const existingCheckpointSnapshot = withProjectAssetAssociationChecksum(
      createCanonicalCheckpointSnapshot({
        schemaVersion: 2,
        sessionId: "session-display-retry",
        updatedAt: "2026-06-03T12:00:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "display-retry-1",
              mode: "image",
              mediaSource: "library",
              prompt: "Stable prompt",
              previewUrl: "https://cdn.example.com/stable.png",
              resultUrls: ["https://cdn.example.com/stable.png"],
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: "display-retry-1",
          curatedReferenceIds: ["display-retry-1"],
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
      existingProjectAssetAssociationChecksum
    );
    const {
      generationAssociationUpsert,
      generationIdInMock,
      mediaAssociationUpsert,
      mediaIdInMock,
      outputDisplaySelect,
      outputDisplayUpsert,
      promptAssociationUpsert,
      promptIdInMock,
      workspaceUpsert,
    } = createSupabaseMock({
      workspaceSnapshot: existingCheckpointSnapshot,
      workspaceSnapshotUpdatedAt: "2026-06-03T12:00:00.000Z",
      associatedSnapshotGenerationIds: [],
      recentGenerationIds: [],
      projectionRows: [],
    });

    await expect(
      upsertProjectWorkspaceStateForUser({
        userId: "user-1",
        projectId: "project-1",
        schemaVersion: 2,
        includeSnapshotInResponse: false,
        snapshot: {
          schemaVersion: 2,
          sessionId: "session-display-retry",
          updatedAt: "2026-06-03T12:00:00.000Z",
          workspace: {
            selectedTool: "create",
          },
          outputs: {
            active: [
              {
                id: "display-retry-1",
                mode: "image",
                mediaSource: "library",
                prompt: "Stable prompt",
                previewUrl: "https://cdn.example.com/stable.png",
                resultUrls: ["https://cdn.example.com/stable.png"],
                savedMediaIds: [MEDIA_ID_1],
              },
            ],
            archived: [],
            activeOutputId: "display-retry-1",
            curatedReferenceIds: ["display-retry-1"],
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
      saveOutcome: {
        status: "saved",
      },
    });

    expect(mediaIdInMock).not.toHaveBeenCalled();
    expect(promptIdInMock).not.toHaveBeenCalled();
    expect(generationIdInMock).not.toHaveBeenCalled();
    expect(outputDisplaySelect).not.toHaveBeenCalled();
    expect(outputDisplayUpsert).not.toHaveBeenCalled();
    expect(mediaAssociationUpsert).not.toHaveBeenCalled();
    expect(promptAssociationUpsert).not.toHaveBeenCalled();
    expect(generationAssociationUpsert).not.toHaveBeenCalled();
    expect(workspaceUpsert).not.toHaveBeenCalled();
  });

  it("updates display rows without bumping structural checkpoint revision when only rich display data changes", async () => {
    const existingProjectAssetAssociationChecksum = createProjectAssetAssociationChecksum({
      mediaFileIds: [MEDIA_ID_1],
    });
    const existingCheckpointSnapshot = withProjectAssetAssociationChecksum(
      createCanonicalCheckpointSnapshot({
        schemaVersion: 2,
        sessionId: "session-display-rich-touch",
        updatedAt: "2026-06-03T12:00:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "display-rich-touch-1",
              mode: "image",
              mediaSource: "library",
              prompt: "Older prompt",
              previewUrl: "https://cdn.example.com/older.png",
              resultUrls: ["https://cdn.example.com/older.png"],
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: "display-rich-touch-1",
          curatedReferenceIds: ["display-rich-touch-1"],
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
      existingProjectAssetAssociationChecksum
    );
    const {
      outputDisplaySelect,
      outputDisplayUpsert,
      mediaAssociationUpsert,
      promptAssociationUpsert,
      generationAssociationUpsert,
      workspaceUpsert,
      getWorkspaceRow,
    } = createSupabaseMock({
      workspaceSnapshot: existingCheckpointSnapshot,
      outputDisplayRows: [
        {
          project_id: "project-1",
          user_id: "user-1",
          output_id: "display-rich-touch-1",
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
          display_prompt_summary: "Older prompt",
          mime_type: null,
          width: null,
          height: null,
          duration_ms: null,
          preview_storage_path: null,
          full_storage_path: null,
          preview_poster_storage_path: null,
          companion_art_storage_path: null,
          preview_url_fallback: "https://cdn.example.com/older.png",
          preview_poster_url_fallback: null,
          companion_art_url_fallback: null,
          result_urls_fallback: ["https://cdn.example.com/older.png"],
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

    await upsertProjectWorkspaceStateForUser({
      userId: "user-1",
      projectId: "project-1",
      schemaVersion: 2,
      includeSnapshotInResponse: false,
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-display-rich-touch",
        updatedAt: "2026-06-03T12:00:00.000Z",
        workspace: {
          selectedTool: "create",
        },
        outputs: {
          active: [
            {
              id: "display-rich-touch-1",
              mode: "image",
              mediaSource: "library",
              prompt: "Newer prompt",
              previewUrl: "https://cdn.example.com/newer.png",
              resultUrls: ["https://cdn.example.com/newer.png"],
              savedMediaIds: [MEDIA_ID_1],
            },
          ],
          archived: [],
          activeOutputId: "display-rich-touch-1",
          curatedReferenceIds: ["display-rich-touch-1"],
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

    expect(outputDisplaySelect).toHaveBeenCalledTimes(1);
    expect(outputDisplayUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          output_id: "display-rich-touch-1",
          display_prompt_summary: "Newer prompt",
          preview_url_fallback: "https://cdn.example.com/newer.png",
          result_urls_fallback: ["https://cdn.example.com/newer.png"],
          version: 5,
        }),
      ],
      {
        onConflict: "project_id,output_id",
      }
    );
    expect(mediaAssociationUpsert).not.toHaveBeenCalled();
    expect(promptAssociationUpsert).not.toHaveBeenCalled();
    expect(generationAssociationUpsert).not.toHaveBeenCalled();
    expect(workspaceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpoint_revision: 1,
        snapshot_updated_at: "2026-06-03T12:00:00.000Z",
      }),
      expect.anything()
    );
    expect(getWorkspaceRow()).toMatchObject({
      checkpoint_revision: 1,
      snapshot_updated_at: "2026-06-03T12:00:00.000Z",
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
