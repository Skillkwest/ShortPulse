import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  getProjectWorkspaceStateForUser,
  upsertProjectWorkspaceStateForUser,
} from "../projectWorkspaceStatesService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

type SupabaseMockOptions = {
  workspaceSnapshot?: Record<string, unknown>;
  recentGenerationIds?: string[];
  projectionRows?: Array<Record<string, unknown>>;
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
}: SupabaseMockOptions = {}) => {
  const projectionRowsById = new Map<string, Record<string, unknown>>(
    projectionRows
      .filter(
        (row): row is Record<string, unknown> & { generation_id: string } =>
          typeof row.generation_id === "string" && row.generation_id.length > 0
      )
      .map((row) => [row.generation_id, row])
  );
  const mediaSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids.filter((id) => id === "media-1" || id === "media-2").map((id) => ({ id })),
        error: null,
      })),
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
  const mediaAssociationUpsert = vi.fn(async () => ({ error: null }));
  const promptAssociationUpsert = vi.fn(async () => ({ error: null }));
  const generationAssociationUpsert = vi.fn(async () => ({ error: null }));
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
  const generationProjectionSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids
          .map((id) => projectionRowsById.get(id))
          .filter((row): row is Record<string, unknown> => Boolean(row)),
        error: null,
      })),
    })),
  }));
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
  const workspaceWriteSelect = vi.fn(() => ({
    maybeSingle: workspaceMaybeSingle,
  }));
  const workspaceUpsert = vi.fn(() => ({
    select: workspaceWriteSelect,
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
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-23T01:00:00.000Z",
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
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
      [
        expect.objectContaining({
          project_id: "project-1",
          media_file_id: "media-1",
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
                previewUrl: "https://cdn.example.com/project-output.png",
                resultUrls: ["https://cdn.example.com/project-output.png"],
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
            chatModeEnabled: true,
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
          chatModeEnabled: true,
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
        },
      ],
      archived: [],
    });
  });
});
