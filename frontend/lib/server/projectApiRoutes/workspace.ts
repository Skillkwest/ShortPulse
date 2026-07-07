/**
 * Reads and writes one user-owned project workspace snapshot for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../api/auth";
import { logApiRouteException } from "../api/appErrorLogs";
import { getProjectForUser, parseProjectId } from "../projectsService";
import {
  deleteProjectWorkspaceStateForUser,
  getProjectWorkspaceStateForUser,
  InvalidProjectWorkspaceSnapshotError,
  type ProjectWorkspaceSaveOutcome,
  upsertProjectWorkspaceStateForUser,
} from "../projectWorkspaceStatesService";

type ProjectWorkspaceSuccessResponse = {
  project?: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
  workspace: {
    projectId: string;
    schemaVersion: number;
    snapshot?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  } | null;
  saveOutcome?: ProjectWorkspaceSaveOutcome;
};

type ProjectWorkspaceErrorResponse = {
  error: string;
  details?: string;
  failureStage?: WorkspaceFailureStage;
};

type WorkspaceFailureStage =
  | "auth resolution"
  | "project lookup"
  | "workspace read"
  | "workspace save"
  | "workspace delete";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const summarizeWorkspaceSaveSnapshotForLog = (
  snapshot: unknown
): Record<
  | "workspace_snapshot_bytes"
  | "workspace_snapshot_active_output_count"
  | "workspace_snapshot_archived_output_count"
  | "workspace_snapshot_total_output_count"
  | "workspace_snapshot_media_id_count"
  | "workspace_snapshot_prompt_id_count"
  | "workspace_snapshot_generation_id_count",
  number
> => {
  const snapshotRecord = asRecord(snapshot);
  const outputsRecord = asRecord(snapshotRecord.outputs);
  const activeRows = Array.isArray(outputsRecord.active) ? outputsRecord.active : [];
  const outputRows = activeRows;
  const mediaIds = new Set<string>();
  const promptIds = new Set<string>();
  const generationIds = new Set<string>();
  outputRows.forEach((row) => {
    const record = asRecord(row);
    const promptId = typeof record.promptId === "string" ? record.promptId.trim() : "";
    const generationId = typeof record.generationId === "string" ? record.generationId.trim() : "";
    const savedMediaIds = Array.isArray(record.savedMediaIds) ? record.savedMediaIds : [];
    if (promptId) promptIds.add(promptId);
    if (generationId) generationIds.add(generationId);
    savedMediaIds.forEach((savedMediaId) => {
      const mediaId = typeof savedMediaId === "string" ? savedMediaId.trim() : "";
      if (mediaId) mediaIds.add(mediaId);
    });
  });

  let snapshotBytes = 0;
  try {
    snapshotBytes = Buffer.byteLength(JSON.stringify(snapshotRecord), "utf8");
  } catch {
    snapshotBytes = 0;
  }

  return {
    workspace_snapshot_bytes: snapshotBytes,
    workspace_snapshot_active_output_count: activeRows.length,
    workspace_snapshot_archived_output_count: 0,
    workspace_snapshot_total_output_count: outputRows.length,
    workspace_snapshot_media_id_count: mediaIds.size,
    workspace_snapshot_prompt_id_count: promptIds.size,
    workspace_snapshot_generation_id_count: generationIds.size,
  };
};

const toRequestBody = (value: unknown): Record<string, unknown> => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toOptionalSchemaVersion = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
};

const resolveWorkspaceRouteLabel = (
  method: NextApiRequest["method"]
): "projects-workspace-save" | "projects-workspace-read" | "projects-workspace-delete" => {
  if (method === "PUT") return "projects-workspace-save";
  if (method === "DELETE") return "projects-workspace-delete";
  return "projects-workspace-read";
};

const resolveWorkspaceErrorMessage = (method: NextApiRequest["method"]): string => {
  if (method === "PUT") return "Failed to save project workspace";
  if (method === "DELETE") return "Failed to reset project workspace";
  return "Failed to load project workspace";
};

const resolveWorkspaceFailureDetails = ({
  method,
  stage,
}: {
  method: NextApiRequest["method"];
  stage: WorkspaceFailureStage | null;
}): string => {
  if (!stage) return `${resolveWorkspaceErrorMessage(method)}.`;
  return `${resolveWorkspaceErrorMessage(method)} during ${stage}.`;
};

const prefersMinimalWorkspaceSaveResponse = (req: NextApiRequest): boolean => {
  if (req.method !== "PUT") return false;
  const preferHeader = req.headers?.prefer;
  const normalized = Array.isArray(preferHeader) ? preferHeader.join(",") : (preferHeader ?? "");
  return normalized
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .includes("return=minimal");
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectWorkspaceSuccessResponse | ProjectWorkspaceErrorResponse>
) {
  let user: Awaited<ReturnType<typeof requireApiUser>> | null = null;
  let failureStage: WorkspaceFailureStage | null = "auth resolution";
  let workspaceSaveSnapshotLogSummary: ReturnType<
    typeof summarizeWorkspaceSaveSnapshotForLog
  > | null = null;
  try {
    if (req.method !== "GET" && req.method !== "PUT" && req.method !== "DELETE") {
      res.setHeader("Allow", "GET, PUT, DELETE");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const requestBody = req.method === "PUT" ? toRequestBody(req.body) : null;
    workspaceSaveSnapshotLogSummary =
      req.method === "PUT" ? summarizeWorkspaceSaveSnapshotForLog(requestBody?.snapshot) : null;

    user = await requireApiUser(req, res);
    if (!user) return;

    const projectId = parseProjectId(req.query.projectId);
    if (!projectId) {
      return res.status(400).json({ error: "Invalid project id" });
    }
    failureStage = "project lookup";
    const project = await getProjectForUser({
      userId: user.id,
      projectId,
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (req.method === "DELETE") {
      failureStage = "workspace delete";
      await deleteProjectWorkspaceStateForUser({
        userId: user.id,
        projectId,
      });
      return res.status(200).json({ workspace: null });
    }

    failureStage = req.method === "PUT" ? "workspace save" : "workspace read";
    const includeWorkspaceSnapshot = !prefersMinimalWorkspaceSaveResponse(req);
    const workspace =
      req.method === "PUT"
        ? await upsertProjectWorkspaceStateForUser({
            userId: user.id,
            projectId,
            schemaVersion: toOptionalSchemaVersion(requestBody?.schemaVersion),
            snapshot: requestBody?.snapshot,
            includeSnapshotInResponse: includeWorkspaceSnapshot,
          })
        : await getProjectWorkspaceStateForUser({
            userId: user.id,
            projectId,
          });

    return res.status(200).json({
      project: {
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      workspace: workspace
        ? {
            projectId: workspace.projectId,
            schemaVersion: workspace.schemaVersion,
            ...(includeWorkspaceSnapshot ? { snapshot: workspace.snapshot } : {}),
            createdAt: workspace.createdAt,
            updatedAt: workspace.updatedAt,
          }
        : null,
      ...(workspace?.saveOutcome ? { saveOutcome: workspace.saveOutcome } : {}),
    });
  } catch (error) {
    if (res.headersSent || res.writableEnded) return;
    if (error instanceof InvalidProjectWorkspaceSnapshotError) {
      return res.status(400).json({
        error: "Invalid project workspace snapshot",
        details: error.message,
        failureStage: "workspace save",
      });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: resolveWorkspaceRouteLabel(req.method),
      user,
      metadata: {
        workspace_failure_stage: failureStage,
        source:
          req.method === "PUT"
            ? "api.projects.workspace.save"
            : req.method === "DELETE"
              ? "api.projects.workspace.delete"
              : "api.projects.workspace.read",
        ...(workspaceSaveSnapshotLogSummary ?? {}),
      },
    });
    return res.status(500).json({
      error: resolveWorkspaceErrorMessage(req.method),
      details: resolveWorkspaceFailureDetails({
        method: req.method,
        stage: failureStage,
      }),
      ...(failureStage ? { failureStage } : {}),
    });
  }
}
